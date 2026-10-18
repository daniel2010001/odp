// La **descarga por el portal**: el servidor autentica contra el catálogo y devuelve los bytes (feature de
// endurecimiento del token, `odd/tasks/token-hardening.md`, S3 y § El diseño de T6, G1–G6).
//
// ─── Por qué existe, y por qué es una pieza aparte de la ruta ─────────
// Con el token fuera del navegador, el navegador ya no puede pedirle un archivo privado al catálogo. La ruta
// `/catalog/download/<id>` es un adaptador (los módulos virtuales no resuelven en Vitest); el orden que
// importa vive acá, con `fetch` inyectable, igual que `ckan-bridge.ts`.
//
// ─── Lo que este módulo garantiza ─────────────────────────────────────
//  · **Las negativas no llaman al archivo.** Sesión muerta `401` sin ningún `fetch`; `resource_show` negado
//    `403`/`404`; un enlace externo `404` (los enlaces siguen siendo enlaces, no pasan por el portal).
//  · **La URL del archivo se construye, no se copia.** Sale de `internalUrl` + `package_id` + `id` + el nombre
//    (último segmento de `resource.url`). El host de `resource.url` no se usa jamás: sería un SSRF con
//    credencial.
//  · **Del cliente viajan `Range` e `If-Range`, y nada más.** La credencial es la de la sesión.
//  · **Ningún contenido activo desde el origen del portal.** Antes los archivos salían del host de CKAN; ahora
//    salen del mismo origen que tiene la sesión, así que un `.html` o un `.svg` subido ejecutaría scripts
//    capaces de llamar a `/catalog` a nombre del usuario. `nosniff` siempre; sólo la lista de `INLINE_TYPES`
//    va `inline`; todo lo demás, `attachment` + `sandbox`. La lista `inline` no lleva `sandbox` porque rompe el
//    visor de PDF de Chromium.
//  · **El cuerpo viaja en stream**, sin leerlo: un archivo de decenas de MB no pasa por la memoria del servidor.

import type { BridgeSession, Fetcher } from "./ckan-bridge";
import { upstreamHeaders, upstreamUrl } from "./ckan-proxy";

/** Los únicos tipos que se muestran `inline` en el origen del portal (G4). */
export const INLINE_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"text/plain",
	"text/csv",
	"application/json",
	// GeoJSON es JSON (RFC 7946): el navegador lo muestra como texto, igual que `application/json`, y `nosniff`
	// impide leerlo como otra cosa. Sin él, la vista previa de un `.geojson` quedaba en blanco (demo, 2026-10-18).
	"application/geo+json",
] as const;

/** Las únicas cabeceras del catálogo que vuelven al navegador (G3). */
const PASSTHROUGH_HEADERS = [
	"content-type",
	"content-length",
	"content-range",
	"accept-ranges",
	"etag",
	"last-modified",
] as const;

export interface DownloadRequest {
	resourceId: string;
	/** La sesión ya resuelta por `hooks.server.ts` (`locals.session`). */
	session: BridgeSession;
	/** La URL interna del catálogo (`resolveCkanInternalUrl`). */
	internalUrl: string;
	/** Las cabeceras del pedido entrante: sólo `Range` e `If-Range` se leen. */
	incomingHeaders: Headers;
	fetcher?: Fetcher;
}

/** Una respuesta propia, de texto plano: el navegador no confunde una negativa del portal con un archivo. */
function textResponse(status: number, body: string): Response {
	return new Response(body, {
		status,
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"x-content-type-options": "nosniff",
			"cache-control": "private, no-store",
			vary: "Cookie",
		},
	});
}

const NO_SESSION = () => textResponse(401, "La sesión del portal no está activa.");
const FORBIDDEN = () => textResponse(403, "No tiene permiso para descargar este archivo.");
const NOT_FOUND = () => textResponse(404, "Archivo no encontrado.");
const UPSTREAM_FAILURE = () => textResponse(502, "No se pudo contactar el catálogo.");

/** El tipo de medio sin parámetros y en minúsculas: `Text/CSV; charset=utf-8` → `text/csv`. */
function mediaType(value: string | null): string {
	return value?.split(";")[0].trim().toLowerCase() ?? "";
}

function isInline(contentType: string | null): boolean {
	return (INLINE_TYPES as readonly string[]).includes(mediaType(contentType));
}

/**
 * El nombre del archivo: el último segmento del camino de `resource.url`, decodificado. `null` si no hay
 * (o si no decodifica): sin nombre no hay ruta de descarga que construir.
 */
function fileName(url: unknown): string | null {
	if (typeof url !== "string") return null;
	const path = url.split(/[?#]/)[0];
	const last = path.split("/").pop() ?? "";
	if (!last) return null;
	try {
		return decodeURIComponent(last) || null;
	} catch {
		return null;
	}
}

/** `Content-Disposition: attachment` con un nombre seguro: ASCII sin comillas ni separadores, y el real en `filename*`. */
function attachment(name: string): string {
	const ascii = name.replace(/[^\x20-\x7e]|["\\/;]/g, "_");
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function downloadResource(request: DownloadRequest): Promise<Response> {
	const fetcher: Fetcher = request.fetcher ?? fetch;

	if (request.session === "dead") {
		return NO_SESSION();
	}
	const token = request.session === "anonymous" ? null : request.session.token;

	const showUrl = upstreamUrl(request.internalUrl, "resource_show");
	if (!showUrl) {
		return NOT_FOUND();
	}

	// 1. Qué es el recurso, según el catálogo y con los permisos de la sesión (o ninguno, si es anónima).
	let shown: Response;
	try {
		shown = await fetcher(showUrl, {
			method: "POST",
			headers: upstreamHeaders(request.incomingHeaders, token),
			body: JSON.stringify({ id: request.resourceId }),
		});
	} catch {
		return UPSTREAM_FAILURE();
	}
	if (shown.status === 403 || shown.status === 401) return FORBIDDEN();
	if (shown.status === 404) return NOT_FOUND();
	if (!shown.ok) return UPSTREAM_FAILURE();

	let resource: Record<string, unknown>;
	try {
		const body = (await shown.json()) as { result?: Record<string, unknown> };
		resource = body.result ?? {};
	} catch {
		return UPSTREAM_FAILURE();
	}

	// Un enlace externo no aloja bytes en el catálogo: sigue siendo un enlace.
	if (resource.url_type !== "upload") {
		return NOT_FOUND();
	}
	const name = fileName(resource.url);
	const packageId = resource.package_id;
	if (!name || typeof packageId !== "string" || !packageId) {
		return NOT_FOUND();
	}

	// 2. El archivo, desde la URL **construida**; el host de `resource.url` no se mira.
	const fileUrl =
		`${request.internalUrl.replace(/\/+$/, "")}/dataset/${encodeURIComponent(packageId)}` +
		`/resource/${encodeURIComponent(request.resourceId)}/download/${encodeURIComponent(name)}`;

	// Se construye desde cero: del cliente sólo `Range` e `If-Range`. Y el archivo se pide **sin compresión**:
	// `fetch` descomprime solo y conserva el `Content-Length` comprimido, así que reenviarlo truncaría la descarga
	// o la dejaría colgada —y un `Content-Range` sobre bytes comprimidos no le sirve al visor de PDF—.
	const headers = new Headers({ "Accept-Encoding": "identity" });
	if (token) headers.set("Authorization", token);
	for (const clave of ["range", "if-range"]) {
		const valor = request.incomingHeaders.get(clave);
		if (valor) headers.set(clave, valor);
	}

	let upstream: Response;
	try {
		upstream = await fetcher(fileUrl, { method: "GET", headers });
	} catch {
		return UPSTREAM_FAILURE();
	}

	const out = new Headers();
	for (const clave of PASSTHROUGH_HEADERS) {
		const valor = upstream.headers.get(clave);
		if (valor !== null) out.set(clave, valor);
	}
	out.set("x-content-type-options", "nosniff");
	out.set("cache-control", "private, no-store");
	out.set("vary", "Cookie");
	if (!isInline(upstream.headers.get("content-type"))) {
		out.set("content-disposition", attachment(name));
		out.set("content-security-policy", "sandbox");
	}

	return new Response(upstream.body, { status: upstream.status, headers: out });
}
