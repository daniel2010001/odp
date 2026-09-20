// API: sonda de sesión. Responde a una única pregunta: ¿el token guardado en el
// navegador sigue siendo un token vivo?
//
// ─── La medición que fija el diseño (2026-09-20) ─────────────────────
// Medido contra el stack `odp-dev` en marcha, por el mismo camino que usa el
// navegador (proxy de desarrollo `http://localhost:8082/api/3/action`), y
// repetido con token válido, vencido, revocado, basura y ausente:
//
//   `user_show {}`             → token vivo: 200 + el usuario que llama
//                              → vencido / revocado / basura / ausente: 404 `Not Found Error`
//
// **No hay 401 ni 403 en esta condición**: CKAN no distingue «token inválido» con
// un estado de autenticación, devuelve un 404 seco. Por eso el 404 es la única
// señal de sesión muerta.
//
// **Por qué el 404 se corrobora.** La sonda no pide ningún `id`, así que un 404
// no puede significar «el recurso no existe»: no hay recurso que falte. Pero un
// 404 tampoco prueba por sí solo que el token murió: una base URL o un proxy mal
// configurados hacen que `/api/3/action/user_show` devuelva 404 aunque CKAN esté
// sano. Por eso el 404 no cierra la sesión por sí mismo; se corrobora con una
// lectura pública.
//
// **La corroboración: `status_show`.** Medido, `status_show {}` responde 200
// tanto con token válido como con token muerto: no depende de la sesión. Por eso
// un 200 es prueba conductual de que CKAN está contestando y el 404 de
// `user_show` fue el rechazo del token. Si la lectura pública falla (404, 5xx,
// timeout, red, cuerpo no-JSON), el despliegue no llega a la acción: eso es
// infraestructura, no una sesión muerta, y se responde `inconclusive`. Expulsar a
// todos los usuarios autenticados es peor que no saber; las pantallas informan su
// propio error de carga.
//
// **Por qué la sonda no es `user_show {id}`.** Se descartó como sonda: medido,
// `user_show` con `id` responde 200 a un llamador anónimo, así que jamás
// distinguiría una sesión muerta de una anónima.
//
// **Por qué todo lo demás es `inconclusive`.** Un 5xx, un 403, un timeout, una
// caída de red o un cuerpo que no es JSON describen el servidor o el transporte,
// no al token. Expulsar a un usuario que está autenticado porque CKAN tuvo un
// hipo es peor que no saber: ante la duda, la sesión se deja intacta.

import { CkanApiError } from "$lib/types/api";
import type { CkanUser } from "$lib/types/ckan";
import type { CkanClient } from "./client";

/** Veredicto de la sonda de sesión. */
export type SessionCheck =
	/** El token vive: CKAN devolvió el usuario que llama. */
	| { state: "alive"; user: CkanUser }
	/** El 404 medido: el token está vencido, revocado, es basura, o no existe. */
	| { state: "dead" }
	/**
	 * No se pudo saber. `error` describe el fallo real (5xx, 403, timeout, red,
	 * cuerpo no-JSON) para que la UI pueda informarlo sin cerrar la sesión.
	 */
	| { state: "inconclusive"; error: CkanApiError };

/**
 * Normaliza cualquier excepción a `CkanApiError`. El cliente ya envuelve todo,
 * pero la sonda no confía en ello: si un `fetch` parcheado, un polyfill o un
 * `throw` inesperado se escapa sin envolver, se envuelve acá con status `0`
 * («sin respuesta del servidor») para no perder el motivo.
 */
function toCkanApiError(err: unknown): CkanApiError {
	if (err instanceof CkanApiError) return err;
	const message = err instanceof Error ? err.message : "Error desconocido";
	return new CkanApiError(message, 0);
}

/** Verifica si el token guardado corresponde todavía a una sesión viva en CKAN. */
export function createSessionApi(client: CkanClient) {
	return {
		async check(): Promise<SessionCheck> {
			try {
				// Sin `id`, a propósito: ver la medición del encabezado.
				const user = await client.post<CkanUser>("user_show", {});
				return { state: "alive", user };
			} catch (err) {
				// Sólo el 404 medido cierra la sesión; cualquier otro fallo se informa sin tocarla.
				if (err instanceof CkanApiError && err.status === 404) {
					// Corroboración conductual (ver encabezado): un 404 de `user_show {}`
					// puede venir de CKAN (token rechazado) o de una base URL/proxy roto.
					// `status_show` no depende de la sesión, así que un 200 prueba que CKAN
					// está contestando. Si la lectura pública falla, el despliegue no llega
					// a la acción: es infraestructura, no una sesión muerta, y expulsar a
					// todos los usuarios es peor que responder `inconclusive`.
					try {
						await client.post("status_show", {});
						return { state: "dead" };
					} catch {
						return { state: "inconclusive", error: err };
					}
				}
				return { state: "inconclusive", error: toCkanApiError(err) };
			}
		},
	};
}

export type SessionApi = ReturnType<typeof createSessionApi>;
