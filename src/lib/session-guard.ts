// Camino único de expulsión para una sesión que ya no sirve: una condición, un mensaje y una ruta.
//
// ─── Una condición, un mensaje, una ruta ─────────────────────────────
// «La sesión murió» se diagnostica desde más de un lugar —la sonda `user_show {}` que responde 404 y
// la sesión local corrupta, con token pero sin identidad— y todos deben terminar exactamente igual:
// limpiar el almacenamiento y volver al login declarando el motivo. Tener esos tres pasos
// (`auth.logout()`, `SESSION_EXPIRED_MESSAGE` y `sessionExpiredLoginUrl()`) repetidos en cada pantalla
// permitía que dos superficies mostraran dos diagnósticos distintos para la misma condición. Por eso
// el camino vive acá y los llamadores sólo lo invocan.
//
// ─── Por qué se limpia antes de navegar (regla del bucle) ────────────
// `src/routes/auth/login/+page.svelte` reenvía a `/dashboard` a quien todavía tiene un token
// guardado. Si se navega al login con la sesión muerta aún en el almacenamiento, ese guard devuelve
// al dashboard y el ciclo se repite sin fin. El orden es carga estructural: primero `logout()`,
// después `goto(...)`. `src/lib/session-guard.test.ts` lo fija midiendo el store dentro del `goto`.

import { goto } from "$app/navigation";
import type { CkanClient } from "./api/client";
import { classifyFailure } from "./api/failure";
import { createSessionApi } from "./api/session";
import { sessionExpiredLoginUrl } from "./session";
import { auth } from "./stores/auth";

/**
 * Cierra una sesión que ya no sirve: la limpia del almacenamiento y manda al login con el motivo
 * (`SESSION_EXPIRED_PARAM`) y el destino original en la URL.
 *
 * `returnTo` es la ruta desde la que se expulsa, para que al iniciar sesión el usuario vuelva a donde
 * estaba. Limpiar antes de navegar no es opcional: ver la regla del bucle en el encabezado.
 */
export async function endInvalidSession(returnTo: string): Promise<void> {
	auth.logout();
	await goto(sessionExpiredLoginUrl(returnTo));
}

/** Resultado de decidir qué significa un fallo de autorización para el espectador actual. */
export type UnauthorizedResolution = "expelled" | "alive" | "inconclusive";

/**
 * Decide, una sola vez, qué significa un `403` para toda página que pueda recibirlo.
 *
 * Medido contra el stack en vivo: `resource_show` de un dataset privado responde el mismo `403` a
 * una sesión muerta y a una denegación real de permisos, así que el estado por sí solo no puede
 * elegir el mensaje. La sonda de sesión separa los dos casos. La decisión vive acá, junto al camino
 * único de expulsión, para que dos páginas no puedan divergir: una condición, un mensaje, una ruta.
 *
 * Devuelve `expelled` cuando la sesión estaba muerta y el espectador ya está en la ruta de login; el
 * llamador no debe renderizar nada más ni navegar de nuevo. Devuelve `alive` para una denegación
 * real de permisos, e `inconclusive` cuando la rama no sondeó o la sonda no pudo decidir. Un `404`,
 * un `5xx` o la ausencia de token no expulsan a nadie.
 */
export async function resolveUnauthorized(
	client: CkanClient,
	err: unknown,
	token: string | null,
	returnTo: string,
): Promise<UnauthorizedResolution> {
	// Sólo un fallo de autorización merece una sonda; un 404 o un 5xx no deben expulsar a nadie.
	if (classifyFailure(err) !== "unauthorized") return "inconclusive";
	// Un espectador anónimo no es una sesión muerta. Medido: sondear `user_show {}` sin token
	// responde 404, lo que lo etiquetaría como expirado. Nunca se sondea sin token.
	if (!token) return "inconclusive";

	const check = await createSessionApi(client).check();
	if (check.state === "dead") {
		await endInvalidSession(returnTo);
		return "expelled";
	}
	if (check.state === "alive") return "alive";
	return "inconclusive";
}
