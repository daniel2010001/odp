// Política única de enlaces externos del portal.
//
// Un recurso de CKAN guarda su `url` como texto arbitrario: el wizard la valida
// al escribirla, pero la API de CKAN (y su UI nativa) siguen aceptando cualquier
// esquema. Como el portal renderiza ese valor en `href`, un `javascript:` o un
// `data:text/html,...` almacenado en CKAN se convierte en XSS almacenado al
// abrir la página. Este módulo es el borde de salida: nada se renderiza como
// enlace externo si no pasa por acá.
//
// Se permite únicamente http/https (fail-closed): cualquier otro esquema, un
// valor vacío o una cadena que no parsea se descartan.

/** Protocolos aceptados para un enlace externo. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Motivo por el que un valor no puede renderizarse como enlace externo. */
export type UnsafeUrlReason = "empty" | "not-absolute" | "protocol";

/**
 * Diagnóstico del valor: `null` si es un enlace externo seguro, o el motivo del rechazo.
 *
 * - `empty`: ausente, vacío o sólo espacios.
 * - `not-absolute`: no parsea como URL absoluta (p. ej. `datos.umss.edu/x` o `/dataset/x`).
 * - `protocol`: parsea, pero el esquema no está permitido (`javascript:`, `data:`, `file:`, …).
 */
export function unsafeUrlReason(raw: string | null | undefined): UnsafeUrlReason | null {
	if (typeof raw !== "string" || !raw.trim()) return "empty";
	try {
		if (!ALLOWED_PROTOCOLS.has(new URL(raw.trim()).protocol)) return "protocol";
	} catch {
		return "not-absolute";
	}
	return null;
}

/**
 * Devuelve la URL lista para usar en `href`/`src`, o `null` si no es un enlace
 * externo seguro (esquema no permitido, vacío o no parseable).
 *
 * No normaliza la URL con `URL.href`: para una URL válida se conserva el texto
 * original (sólo se recortan los espacios de los extremos), así no cambian los
 * valores ya guardados en CKAN.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim() ?? "";
	if (!trimmed || unsafeUrlReason(trimmed) !== null) return null;
	return trimmed;
}
