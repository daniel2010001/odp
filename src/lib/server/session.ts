// La **sesión sellada** del portal: el sobre cifrado y autenticado que lleva la credencial de CKAN.
//
// ─── Por qué existe ────────────────────────────────────────────────────
// Hoy el JWT de CKAN vive en `localStorage` y el navegador lo manda en `Authorization`
// (`src/lib/stores/auth.ts:21,37,39`), así que cualquier XSS lo lee — y ese token además puede acuñar y revocar
// tokens de esa cuenta. La feature de endurecimiento (`odd/tasks/token-hardening.md`, S1/S2) lo saca del
// navegador: el servidor del portal guarda la credencial y el navegador sólo tiene una cookie **httpOnly**.
//
// La forma elegida es una cookie **sellada** (cifrada + autenticada con AEAD) y no un store de sesiones: el
// portal no tiene base de datos ni Redis, y un store sería infraestructura nueva para un problema que no la
// pide. **El precio, declarado:** no hay revocación del lado del portal —revocar en CKAN se descubre en el
// siguiente request, que es lo que ya hace `Invalid Session Detection`— y rotar la clave invalida todas las
// sesiones.
//
// ─── Qué garantiza el sello ────────────────────────────────────────────
//  · **Confidencialidad**: el contenido va cifrado con AES-256-GCM; el token no aparece en la cookie ni en su
//    base64.
//  · **Integridad y autenticidad**: el tag del AEAD se verifica al abrir. Un byte cambiado, otra clave, un
//    formato que no es el nuestro o una versión desconocida devuelven `null`. Sin esto, el navegador podría
//    elegir su propio usuario.
//  · **Nunca lanza**: el camino de lectura de sesión corre en cada request, así que toda entrada inválida es
//    «no hay sesión» y no una excepción. `try`/`catch` **alrededor de la apertura**, que es donde el AEAD
//    falla con entradas ajenas.
//
// ─── Lo que NO decide ──────────────────────────────────────────────────
// No decide si la sesión está **viva** en CKAN: un sello válido prueba que el portal la emitió, no que CKAN
// siga aceptando el token. Eso sigue siendo la sonda de sesión (`Invalid Session Detection`), ahora del lado
// servidor. Y no elige la `Secure`: la decide quien llama, porque en desarrollo el portal se sirve por http y
// una cookie `Secure` sería descartada por el navegador.

import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { CkanUser } from "$lib/types/ckan";

/** Nombre de la cookie de sesión del portal. */
export const SESSION_COOKIE_NAME = "odp_session";

/** Variable de entorno que define la clave de sellado fuera de desarrollo. */
export const SESSION_SECRET_VAR = "SESSION_SECRET";

/**
 * Vigencia de la sesión, en segundos. Espeja el TTL del token de CKAN en este stack
 * (`CKAN___EXPIRE_API_TOKEN__DEFAULT_LIFETIME` = 86 400 s = 1 día), porque una sesión que sobreviva al token
 * que lleva adentro sólo sirve para que la sonda la declare muerta.
 */
export const CKAN_TOKEN_TTL_S = 86_400;

/**
 * Clave que se asume **sólo en desarrollo** cuando la variable no está configurada. Es pública a propósito y
 * por eso su nombre lo grita: si un despliegue la heredara, cualquiera podría sellar su propia sesión, así que
 * fuera de desarrollo la ausencia de clave **falla** en vez de caer acá.
 */
export const DEV_SESSION_SECRET = "clave-de-desarrollo-no-usar-fuera-de-desarrollo-0001";

const ALGORITHM = "aes-256-gcm";
/** Nonce de GCM: 12 bytes es el tamaño recomendado y el que usa el estándar. */
const NONCE_BYTES = 12;
/** Tag de autenticación de GCM: 16 bytes. */
const TAG_BYTES = 16;
/** Versión del formato, para poder cambiarlo sin adivinar. */
const VERSION = "v1";

/** Quién es el usuario, tal como lo devuelve CKAN. */
export interface SessionUser {
	id: string;
	name: string;
	displayName?: string;
}

/** Lo que la sesión lleva adentro: la credencial de CKAN, el usuario y sus dos instantes. */
export interface SessionPayload {
	/** El JWT de CKAN. **Nunca** se expone al navegador: viaja cifrado en la cookie. */
	token: string;
	user: SessionUser;
	/** Cuándo se emitió la sesión (ms desde epoch). */
	issuedAt: number;
	/** Cuándo deja de valer (ms desde epoch). */
	expiresAt: number;
}

/**
 * La sesión que emite el **login**: el token que CKAN acaba de acuñar, el usuario ya traducido y los dos
 * instantes.
 *
 * La traducción del usuario vive acá y no en la ruta porque es donde se puede probar, y porque el nombre del
 * campo cambia: CKAN devuelve `display_name` y la sesión guarda `displayName`. Un usuario **sin** nombre visible
 * no inventa uno: el campo queda ausente y quien lo muestre decide su fallback.
 */
export function buildSession(token: string, user: CkanUser, now: number): SessionPayload {
	return {
		token,
		user: {
			id: user.id,
			name: user.name,
			...(user.display_name ? { displayName: user.display_name } : {}),
		},
		issuedAt: now,
		expiresAt: now + CKAN_TOKEN_TTL_S * 1000,
	};
}

/**
 * Resuelve la clave de sellado.
 *
 * - `configured` con contenido (tras `trim()`) → ese valor, recortado.
 * - sin configurar **y** `isDev` → {@link DEV_SESSION_SECRET}.
 * - sin configurar **y** sin dev → lanza `Error`: producción sin clave no tiene default razonable, y una clave
 *   por defecto ahí sería una sesión que cualquiera puede fabricar.
 *
 * @throws {Error} cuando no hay valor configurado y `isDev` es `false`.
 */
export function resolveSessionSecret(configured: string | undefined, isDev: boolean): string {
	const trimmed = configured?.trim();
	if (trimmed) {
		return trimmed;
	}

	if (isDev) {
		return DEV_SESSION_SECRET;
	}

	throw new Error(
		`${SESSION_SECRET_VAR} no está configurada y el portal no corre en desarrollo. ` +
			"Defínala con una clave de alta entropía: con ella se sellan las sesiones, y rotarla " +
			"invalida todas las sesiones abiertas.",
	);
}

/**
 * Deriva los 32 bytes de AES-256 de la clave configurada. Se usa SHA-256 y no el texto crudo porque la clave
 * es una cadena de longitud arbitraria, y se documenta que **debe ser de alta entropía**: el sellado es tan
 * fuerte como la clave, sin estiramiento que compense una clave adivinable.
 */
function keyFrom(secret: string | undefined): Buffer | null {
	if (!secret || secret.trim() === "") {
		return null;
	}
	return createHash("sha256").update(secret, "utf8").digest();
}

/** Verifica la forma del payload: lo que se abre es dato, y un dato con otra forma no es una sesión. */
function isSessionPayload(value: unknown): value is SessionPayload {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const payload = value as Partial<SessionPayload>;
	const user = payload.user;
	return (
		typeof payload.token === "string" &&
		payload.token.length > 0 &&
		typeof payload.issuedAt === "number" &&
		typeof payload.expiresAt === "number" &&
		typeof user === "object" &&
		user !== null &&
		typeof user.id === "string" &&
		typeof user.name === "string"
	);
}

/**
 * Sella un payload en el valor de la cookie: `v1.<nonce||tag||ciphertext>` en base64url.
 *
 * El nonce es **nuevo en cada sello**, así que dos sellados del mismo payload difieren: repetir nonce con la
 * misma clave es el error que rompe GCM.
 *
 * @throws {Error} si la clave está vacía: sellar sin clave es un error de programación, no un caso de datos.
 */
export function sealSession(payload: SessionPayload, secret: string): string {
	const key = keyFrom(secret);
	if (!key) {
		throw new Error("No se puede sellar una sesión sin clave.");
	}

	const nonce = randomBytes(NONCE_BYTES);
	const cipher = createCipheriv(ALGORITHM, key, nonce);
	const ciphertext = Buffer.concat([
		cipher.update(JSON.stringify(payload), "utf8"),
		cipher.final(),
	]);

	return `${VERSION}.${Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64url")}`;
}

/**
 * Abre el valor de una cookie y devuelve el payload, o `null` si el valor no es una sesión válida **de este
 * portal**: sello inválido, otra clave, formato o versión desconocidos, payload con otra forma, o ya vencida.
 *
 * `now` entra como parámetro para que el borde del vencimiento sea determinista y testeable.
 */
export function openSession(
	value: string | null | undefined,
	secret: string | undefined,
	now: number,
): SessionPayload | null {
	const key = keyFrom(secret);
	if (!key || typeof value !== "string") {
		return null;
	}

	const parts = value.split(".");
	if (parts.length !== 2 || parts[0] !== VERSION) {
		return null;
	}

	// Decodificar es tolerante (ignora caracteres ajenos), así que el descarte real lo hacen el largo mínimo y
	// el tag: acá sólo se evita entrar al AEAD con un cuerpo que no puede ser un sello.
	const raw = Buffer.from(parts[1], "base64url");
	if (raw.length <= NONCE_BYTES + TAG_BYTES) {
		return null;
	}

	try {
		const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(0, NONCE_BYTES));
		decipher.setAuthTag(raw.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES));
		const plain = Buffer.concat([
			decipher.update(raw.subarray(NONCE_BYTES + TAG_BYTES)),
			decipher.final(),
		]).toString("utf8");

		const payload: unknown = JSON.parse(plain);
		if (!isSessionPayload(payload) || payload.expiresAt <= now) {
			return null;
		}

		return payload;
	} catch {
		// El AEAD falla con entradas ajenas y el JSON puede ser basura: las dos cosas son «no hay sesión».
		return null;
	}
}

/** Las opciones de la cookie de sesión. `secure` lo decide quien llama: en desarrollo el portal va por http. */
export function sessionCookieOptions(secure: boolean): {
	name: string;
	path: string;
	httpOnly: true;
	sameSite: "lax";
	secure: boolean;
	maxAge: number;
} {
	return {
		name: SESSION_COOKIE_NAME,
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure,
		maxAge: CKAN_TOKEN_TTL_S,
	};
}
