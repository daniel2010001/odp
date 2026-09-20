// Contrato de la sesión expirada: una condición, un mensaje y una URL en un solo lugar.
//
// ─── Una condición, un mensaje ───────────────────────────────────────
// «Su sesión expiró o dejó de ser válida» tiene un único texto en el portal: el de
// `SESSION_EXPIRED_MESSAGE`. Hoy el dashboard lanza por su cuenta «No se pudo identificar al usuario
// autenticado.» cuando la sesión no trae id; medido, ésa y «token vencido o revocado» son la misma
// condición (una sonda `user_show {}` con token muerto responde 404), así que no deben quedar con dos
// mensajes distintos. Cuando el dashboard adopte este módulo, esa cadena desaparece.
//
// ─── La trampa del bucle (leer antes de navegar) ─────────────────────
// `src/routes/auth/login/+page.svelte:20-23` reenvía a `/dashboard` a quien todavía tiene un token
// guardado. Si se navega a esta URL con la sesión muerta aún en el almacenamiento, el guard devuelve
// al dashboard y el ciclo se repite. El llamador debe limpiar la sesión guardada **antes** de navegar
// acá.
//
// ─── Por qué el motivo viaja en la URL ───────────────────────────────
// El motivo (`SESSION_EXPIRED_PARAM`) se declara como parámetro de búsqueda, no sólo en memoria: así
// sobrevive a una recarga de la pantalla de login y el aviso se sigue mostrando.
//
// No se agrega un `invalidate()` al store: `logout()` ya limpia la sesión en el cliente sin llamar al
// servidor, de modo que un segundo método con el mismo cuerpo sería duplicación.

/** Ruta de la pantalla de login. */
export const LOGIN_PATH = "/auth/login";

/** Parámetro que declara el motivo de la vuelta al login. */
export const SESSION_EXPIRED_PARAM = "expired";

/** Único texto del portal para «su sesión ya no es válida». */
export const SESSION_EXPIRED_MESSAGE =
	"Su sesión expiró o dejó de ser válida. Inicie sesión nuevamente.";

/**
 * Construye la URL de re-login que declara el motivo y conserva el destino original.
 *
 * `returnTo` viaja en la query (y se codifica solo): así una ruta que ya trae su propia query
 * —por ejemplo `/dashboard?page=2`— vuelve intacta después de iniciar sesión.
 */
export function sessionExpiredLoginUrl(returnTo: string): string {
	return `${LOGIN_PATH}?${new URLSearchParams({ returnTo, [SESSION_EXPIRED_PARAM]: "1" })}`;
}

/**
 * Construye la URL de login **sin** declarar motivo.
 *
 * A diferencia de `sessionExpiredLoginUrl`, no lleva `SESSION_EXPIRED_PARAM`. Se usa cuando el
 * espectador nunca tuvo sesión y el portal le pide iniciar sesión con una cuenta autorizada:
 * declarar ahí una sesión expirada haría que la pantalla de login mienta, que es justo lo que la
 * spec prohíbe. `returnTo` se conserva y se codifica igual que en la URL de re-login.
 */
export function loginUrl(returnTo: string): string {
	return `${LOGIN_PATH}?${new URLSearchParams({ returnTo })}`;
}
