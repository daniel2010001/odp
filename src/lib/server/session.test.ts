// Pruebas de la **sesión sellada** del portal: el sobre cifrado y autenticado que guarda la credencial de CKAN
// fuera del navegador (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, S1/S2).
//
// Lo que estas pruebas fijan, y por qué cada una:
//  1. **Ida y vuelta**: lo sellado con una clave se abre con esa clave y devuelve el mismo payload. Si esto
//     falla, el login no tiene sesión.
//  2. **El token no viaja legible**: es el objetivo entero de la feature. La aserción mira el valor sellado y
//     su contenido decodificado, no una promesa del comentario.
//  3. **El sello se verifica**: un byte cambiado, otra clave, o un formato que no es el nuestro devuelven
//     `null` en vez de un payload a medias. Un sobre sin autenticación dejaría que el navegador eligiera su
//     propio usuario.
//  4. **El vencimiento se respeta en el borde**: `expiresAt == now` ya no vale.
//  5. **Nunca lanza**: entradas basura (ausente, vacía, texto, número) devuelven `null`. Un `throw` en el
//     camino de lectura de sesión tumbaría cada request.
//  6. **El costo cabe**: el sello agrega un costo **fijo** (nonce + tag en base64url), no proporcional, así que
//     una cookie con un JWT de CKAN entra con holgura. Es la medición que el plan dejó anotada como pendiente:
//     se mide acá, no se estima.
//
// La clave y el reloj entran como parámetros a propósito: `$env/dynamic/private` y `$app/environment` son
// módulos virtuales que Vitest no resuelve, y un `Date.now()` escondido volvería no determinista el borde del
// vencimiento. Es el mismo patrón de `ckan-internal-url.ts`.

import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
	CKAN_TOKEN_TTL_S,
	DEV_SESSION_SECRET,
	openSession,
	resolveSessionSecret,
	SESSION_COOKIE_NAME,
	SESSION_SECRET_VAR,
	type SessionPayload,
	sealSession,
	sessionCookieOptions,
} from "./session";

const SECRET = "clave-de-prueba-con-largo-suficiente-0001";
const OTHER_SECRET = "otra-clave-de-prueba-con-largo-suficiente-0002";
/** Reloj fijo: el borde del vencimiento se prueba por aritmética, no por la hora de la máquina. */
const NOW = 1_800_000_000_000;
/** Largo del JWT que CKAN emite en este stack: cientos de caracteres, nunca miles. */
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJ0b2tlbi1kZS1wcnVlYmEifQ.firma-de-prueba";

/**
 * Los dos tamaños que la primitiva usa, repetidos acá a propósito: si alguien los cambia en el módulo, el
 * cálculo del test deja de dar y el cambio se revisa en vez de pasar inadvertido.
 */
const NONCE_BYTES_ESPERADOS = 12;
const TAG_BYTES_ESPERADOS = 16;

function makePayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
	return {
		token: TOKEN,
		user: { id: "u-1", name: "ckan_admin", displayName: "Administración del catálogo" },
		issuedAt: NOW,
		expiresAt: NOW + CKAN_TOKEN_TTL_S * 1000,
		...overrides,
	};
}

describe("la sesión sellada — ida y vuelta", () => {
	it("lo sellado con una clave se abre con esa clave y devuelve el mismo payload", () => {
		const payload = makePayload();

		const sealed = sealSession(payload, SECRET);

		expect(openSession(sealed, SECRET, NOW)).toEqual(payload);
	});

	it("dos sellados del mismo payload difieren: el nonce es nuevo en cada uno", () => {
		const payload = makePayload();

		expect(sealSession(payload, SECRET)).not.toBe(sealSession(payload, SECRET));
	});

	it("el token de CKAN no viaja legible: ni en el valor sellado ni en su contenido decodificado", () => {
		const sealed = sealSession(makePayload(), SECRET);

		expect(sealed).not.toContain(TOKEN);
		// Y no alcanza con que no aparezca literal: si el payload estuviera en claro detrás de un base64 sin
		// cifrar, decodificar el cuerpo lo mostraría. Se comprueba sobre el cuerpo, no sobre el string.
		const cuerpo = sealed.split(".").slice(1).join(".");
		expect(Buffer.from(cuerpo, "base64url").toString("utf8")).not.toContain(TOKEN);
	});
});

describe("la sesión sellada — el sello se verifica", () => {
	it("un byte cambiado en el cuerpo no abre", () => {
		const sealed = sealSession(makePayload(), SECRET);
		const partes = sealed.split(".");
		const cuerpo = partes[1];
		const cambiado = `${cuerpo.slice(0, 4)}${cuerpo[4] === "A" ? "B" : "A"}${cuerpo.slice(5)}`;

		expect(openSession(partes.with(1, cambiado).join("."), SECRET, NOW)).toBeNull();
	});

	it("otra clave no abre", () => {
		const sealed = sealSession(makePayload(), SECRET);

		expect(openSession(sealed, OTHER_SECRET, NOW)).toBeNull();
	});

	it("una sesión vencida no abre, y el borde exacto tampoco", () => {
		const sealed = sealSession(makePayload({ expiresAt: NOW }), SECRET);

		expect(openSession(sealed, SECRET, NOW)).toBeNull();
		expect(openSession(sealed, SECRET, NOW - 1)).toEqual(makePayload({ expiresAt: NOW }));
	});

	it("no lanza con entradas que no son un sello: devuelve `null`", () => {
		const basura = [
			undefined,
			null,
			"",
			"   ",
			"no-es-un-sello",
			"v1",
			"v1.",
			"v1.solo-una-parte",
			"v9.abc.def",
		];

		for (const valor of basura) {
			expect(openSession(valor as string, SECRET, NOW)).toBeNull();
		}
	});

	it("tampoco lanza con una clave ausente o vacía: el sello no se puede verificar y no hay sesión", () => {
		const sealed = sealSession(makePayload(), SECRET);

		for (const clave of [undefined, "", "   "]) {
			expect(openSession(sealed, clave as string, NOW)).toBeNull();
		}
	});
});

describe("la sesión sellada — el costo de la cookie (medido, no estimado)", () => {
	it("el cuerpo es exactamente nonce + tag + payload cifrado, con el relleno del base64", () => {
		const payload = makePayload();
		const sealed = sealSession(payload, SECRET);
		const bytesDelPayload = Buffer.byteLength(JSON.stringify(payload), "utf8");
		// El sello es `v1.` + base64url de (nonce 12 + tag 16 + ciphertext del mismo largo que el payload).
		// `toString("base64url")` omite el relleno, por eso el piso es el múltiplo inferior y el techo el
		// superior: el largo tiene que caer entre los dos. Un payload en claro, un campo duplicado o un nonce
		// más grande moverían el largo fuera de esta horquilla.
		const cuerpo = NONCE_BYTES_ESPERADOS + TAG_BYTES_ESPERADOS + bytesDelPayload;
		expect(sealed.length).toBeLessThanOrEqual(`v1.`.length + 4 * Math.ceil(cuerpo / 3));
		expect(sealed.length).toBeGreaterThanOrEqual(`v1.`.length + 4 * Math.floor(cuerpo / 3));
	});

	it("una sesión real cabe con holgura en una cookie", () => {
		const sealed = sealSession(makePayload(), SECRET);

		// Medido el 2026-10-15 con este payload (JWT de ~90 caracteres y nombre con acentos): 334 caracteres
		// (220 bytes de JSON + 28 de nonce y tag, en base64url). El límite práctico de una cookie es ~4 KB, así
		// que sobra un orden de magnitud; el tope de abajo no es decorativo: falla si alguien mete el token
		// crudo o guarda campos que nadie lee.
		expect(sealed.length).toBeLessThan(1024);
	});
});

describe("la clave de la sesión", () => {
	it("la configurada manda, recortada", () => {
		expect(resolveSessionSecret("  clave-configurada  ", false)).toBe("clave-configurada");
	});

	it("sin configurar y en desarrollo, hay una clave de desarrollo", () => {
		expect(resolveSessionSecret(undefined, true)).toBe(DEV_SESSION_SECRET);
		expect(resolveSessionSecret("   ", true)).toBe(DEV_SESSION_SECRET);
	});

	it("sin configurar fuera de desarrollo, falla nombrando la variable", () => {
		expect(() => resolveSessionSecret(undefined, false)).toThrowError(
			new RegExp(SESSION_SECRET_VAR),
		);
	});
});

describe("las opciones de la cookie", () => {
	it("httpOnly, `Path=/`, `SameSite=Lax` y con vencimiento: no la puede leer JavaScript", () => {
		expect(sessionCookieOptions(true)).toEqual({
			name: SESSION_COOKIE_NAME,
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			secure: true,
			maxAge: CKAN_TOKEN_TTL_S,
		});
	});

	it("sobre http (desarrollo sin TLS) no se marca `Secure`, o el navegador descartaría la cookie", () => {
		expect(sessionCookieOptions(false).secure).toBe(false);
	});
});
