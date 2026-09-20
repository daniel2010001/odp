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
