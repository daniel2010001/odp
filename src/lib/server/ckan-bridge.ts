// El **puente vivo** del portal hacia el catálogo: lo que hace con un pedido de acción del navegador.
//
// ─── Por qué existe, y por qué es una pieza aparte de la ruta ─────────
// `ckan-proxy.ts` decide **qué** se puede pedir y con qué cabeceras; esto resuelve el camino completo: la
// credencial ya salida de la sesión sellada, la guarda, el reenvío y la respuesta normalizada. Vive separado
// del `+server.ts` —y con tests— por el mismo motivo que `auth-server.ts` vive separado del login: los módulos
// virtuales de SvelteKit (`$env`, `$app`) no resuelven en Vitest, así que la lógica se prueba sin ellos y la
// ruta queda como adaptador.
//
// ─── Las tres cosas que este módulo garantiza ─────────────────────────
//  · **La guarda va antes del reenvío**, y por eso las dos negativas devuelven sin llamar al `fetch`: un
//    reenvío que ya salió no se puede deshacer. Sin sesión es `401`; una acción no permitida es `404` —no
//    `403`—, porque el `404` no confirma qué acciones existen.
//  · **La credencial viaja en la cabecera, nunca en la URL.** Importa sobre todo en un `GET`, donde los
//    parámetros sí van en la query: un token en una URL termina en logs, historiales y `Referer`.
//  · **Un catálogo caído no se disfraza de respuesta válida.** Un fallo de red es `502` con cuerpo propio —no
//    una excepción que tumbe el request ni un `200` vacío que el navegador lea como «no hay nada»—, y un
//    cuerpo que no es JSON conserva su status con el cuerpo vacío en vez de romper.

import {
	isReadAction,
	isRetryableAction,
	isUploadAction,
	upstreamHeaders,
	upstreamMultipartHeaders,
	upstreamUrl,
} from "./ckan-proxy";

/**
 * La sesión **ya resuelta** por quien llama, en tres estados que no se pueden confundir:
 *
 *  · `{ token }` — hay sesión válida y el portal pone la credencial en la cabecera.
 *  · `"anonymous"` — **no hay cookie**: el visitante no inició sesión. El pedido se reenvía **sin** credencial y
 *    el catálogo decide qué es público. Sin este estado, la navegación pública se rompería al pasar por el
 *    puente: hoy un visitante lee datasets públicos sin credencial y eso tiene que seguir funcionando.
 *  · `"dead"` — **hay cookie y no vale** (vencida, alterada, o con otra clave). Es una sesión que murió, no un
 *    visitante: se responde `401` para que el portal expulse por su camino único, en vez de degradar la lectura
 *    a una vista vacía —que es justo el defecto que `v1` ya corrigió una vez—.
 */
export type BridgeSession = { token: string } | "anonymous" | "dead";

/** El pedido, con la sesión resuelta por quien llama (de la cookie sellada). */
export interface BridgeRequest {
	action: string;
	method: "GET" | "POST";
	/** Los parámetros tal como llegaron del cliente. `undefined` no se manda. */
	params: Record<string, unknown>;
	session: BridgeSession;
	/** La URL interna del catálogo (`resolveCkanInternalUrl`). */
	internalUrl: string;
	/**
	 * Las cabeceras del pedido entrante. **Nada** de ellas viaja al catálogo (y se prueba); la única que se lee es
	 * el `Content-Type` de un `POST`, para rechazarlo si no es JSON.
	 */
	incomingHeaders: Headers;
	/**
	 * El cuerpo **crudo** del pedido, sólo para una subida `multipart/form-data`. Se reenvía como stream, sin
	 * leerlo ni parsearlo: leerlo entero pondría un archivo de decenas de MB en la memoria del servidor por
	 * cada subida. `null`/ausente en un multipart es un pedido sin cuerpo que reenviar (`415`).
	 */
	rawBody?: ReadableStream<Uint8Array> | null;
}

/** Lo que la ruta le devuelve al navegador: el status y el cuerpo, sin envoltorios propios. */
export interface BridgeResult {
	status: number;
	body: unknown;
}

/** El `fetch` inyectable: en producción es el global, en los tests uno de mentira. */
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Sin sesión: el navegador tiene que volver a entrar. */
export const NO_SESSION_STATUS = 401;
/** Acción fuera de la allowlist: no existe para este camino. */
export const UNKNOWN_ACTION_STATUS = 404;

/** El verbo no corresponde a la acción: un mutador no se pide con `GET` (ver `READ_ACTIONS`). */
export const METHOD_NOT_ALLOWED_STATUS = 405;
/** Un `POST` cuyo cuerpo no se declara JSON: no se reenvía (ver `isJsonBody`). */
export const UNSUPPORTED_MEDIA_TYPE_STATUS = 415;
/** El catálogo no respondió: la falla es de la conexión, no del pedido. */
export const UPSTREAM_FAILURE_STATUS = 502;

/** Una sesión **muerta** (cookie presente que no abre) no se reenvía: el portal expulsa por su camino único. */
export function deadSession(): BridgeResult {
	return {
		status: NO_SESSION_STATUS,
		body: { error: "La sesión del portal no está activa." },
	};
}

/** Una acción fuera de la allowlist no se reenvía, y el `404` no confirma qué acciones existen. */
export function unknownAction(): BridgeResult {
	return {
		status: UNKNOWN_ACTION_STATUS,
		body: { error: "Acción no disponible." },
	};
}

/**
 * Un mutador pedido con `GET` no se reenvía.
 *
 * No es celo: `SameSite=Lax` no frena una navegación de nivel superior, así que ese `GET` **sí** llevaría la
 * cookie de la sesión, y si el puente lo reenviara el efecto sería una escritura disparada desde otro sitio.
 */
export function methodNotAllowed(): BridgeResult {
	return {
		status: METHOD_NOT_ALLOWED_STATUS,
		body: { error: "Método no permitido para esa acción." },
	};
}

/** Un `POST` que no se declara JSON (ni es una subida multipart válida) no se reenvía. */
export function unsupportedMediaType(): BridgeResult {
	return {
		status: UNSUPPORTED_MEDIA_TYPE_STATUS,
		body: { error: "El cuerpo del pedido debe ser JSON." },
	};
}

/**
 * ¿El pedido declara un cuerpo JSON?
 *
 * Es la cuarta pierna del anti-CSRF. `SameSite=Lax` no retiene la cookie entre subdominios **del mismo sitio**,
 * y la verificación de origen de SvelteKit sólo mira los tipos de formulario: un `POST` **sin** `Content-Type`
 * —un `Blob` sin tipo— no pasa por ninguna de las dos ni por el preflight de CORS. Exigir `application/json`
 * obliga a cualquier origen ajeno a pedir preflight, que el portal no concede.
 */
function isJsonBody(headers: Headers): boolean {
	return mediaType(headers) === "application/json";
}

/**
 * ¿El pedido declara un cuerpo multipart? Un tipo de formulario: SvelteKit (`csrf.checkOrigin`) rechaza un
 * `POST` cross-origin con él y `SameSite=Lax` retiene la cookie, así que aceptarlo **sólo** para las acciones de
 * subida (`UPLOAD_ACTIONS`) no debilita el anti-CSRF.
 */
function isMultipartBody(headers: Headers): boolean {
	return mediaType(headers) === "multipart/form-data";
}

function mediaType(headers: Headers): string | undefined {
	return headers.get("content-type")?.split(";")[0].trim().toLowerCase();
}

/** Serializa un valor de la query: los complejos como JSON, que es lo que CKAN acepta en un `GET`. */
function serializeParam(value: unknown): string {
	return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

/** Los parámetros que sí viajan: `undefined` se omite, porque `"undefined"` no es un valor. */
function usableParams(params: Record<string, unknown>): [string, unknown][] {
	return Object.entries(params).filter(([, valor]) => valor !== undefined);
}

/**
 * Reenvía una acción al catálogo y devuelve su respuesta normalizada.
 *
 * El orden importa: primero la guarda, después la credencial, y recién entonces el `fetch`.
 */
export async function forwardToCatalog(
	request: BridgeRequest,
	fetcher: Fetcher = fetch,
): Promise<BridgeResult> {
	const url = upstreamUrl(request.internalUrl, request.action);
	if (!url) {
		return unknownAction();
	}

	// El verbo lo decide **el puente**, no el cliente: un mutador con `GET` sería el CSRF que `Lax` no frena.
	if (request.method === "GET" && !isReadAction(request.action)) {
		return methodNotAllowed();
	}

	// Multipart sólo para las acciones de subida y sólo con un cuerpo en stream; todo lo demás, JSON.
	const multipart =
		request.method === "POST" &&
		isMultipartBody(request.incomingHeaders) &&
		isUploadAction(request.action) &&
		!!request.rawBody;

	if (request.method === "POST" && !multipart && !isJsonBody(request.incomingHeaders)) {
		return unsupportedMediaType();
	}

	if (request.session === "dead") {
		return deadSession();
	}

	// `null` es **anónimo**, no una falla: el catálogo decide qué se puede leer sin credencial.
	const token = request.session === "anonymous" ? null : request.session.token;
	const params = usableParams(request.params);

	let destino = url;
	let init: RequestInit;

	if (multipart) {
		// El `Content-Type` del cliente viaja tal cual (lleva el boundary); Node exige `duplex` con un stream.
		init = {
			method: "POST",
			headers: upstreamMultipartHeaders(
				request.incomingHeaders.get("content-type") ?? "",
				token,
				request.incomingHeaders.get("content-length"),
			),
			body: request.rawBody,
			duplex: "half",
		} as RequestInit;
	} else if (request.method === "GET") {
		init = { method: "GET", headers: upstreamHeaders(request.incomingHeaders, token) };
		const conQuery = new URL(url);
		for (const [clave, valor] of params) {
			conQuery.searchParams.set(clave, serializeParam(valor));
		}
		destino = conQuery.toString();
	} else {
		init = {
			method: "POST",
			headers: upstreamHeaders(request.incomingHeaders, token),
			body: JSON.stringify(Object.fromEntries(params)),
		};
	}

	// Un solo reintento, sólo para una lectura sin efectos y nunca para una subida (su cuerpo es un stream que el
	// primer intento ya consumió). Es para P7: uWSGI cierra la conexión sin `Connection: close`, el `fetch` de Node
	// reusa ese socket muerto y falla en milisegundos (`UND_ERR_SOCKET`) sin reintentar un `POST` por su cuenta.
	const intentos = !multipart && isRetryableAction(request.action) ? 2 : 1;
	let respuesta: Response | undefined;
	for (let intento = 1; intento <= intentos && !respuesta; intento++) {
		try {
			respuesta = await fetcher(destino, init);
		} catch {
			// Se cuenta abajo si no queda otro intento.
		}
	}
	if (!respuesta) {
		// El catálogo no respondió: la falla es de la conexión. Se dice con nuestras palabras y con un status
		// propio, para que el navegador no confunda un catálogo caído con una negativa del catálogo.
		return {
			status: UPSTREAM_FAILURE_STATUS,
			body: { error: "No se pudo contactar el catálogo." },
		};
	}

	try {
		return { status: respuesta.status, body: await respuesta.json() };
	} catch {
		// Un cuerpo que no es JSON conserva su status: perder el status sería perder la única señal que quedó.
		return { status: respuesta.status, body: null };
	}
}
