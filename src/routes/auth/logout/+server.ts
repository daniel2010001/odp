// POST /auth/logout — revocación best-effort del token CKAN de la sesión.
//
// El navegador no manda credencial: la ruta revoca **sólo** el token de la
// cookie de sesión del portal, y no lee el cuerpo. El cliente limpia su estado
// independientemente del resultado de la revocación en CKAN. Lo que **no** se
// tolera es una configuración ausente: si `CKAN_INTERNAL_URL` (o, con cookie,
// `SESSION_SECRET`) falta fuera de desarrollo, la ruta responde 500, porque la alternativa silenciosa sería apuntar la
// revocación a la propia máquina del portal. Ese 500 se **devuelve**, no se lanza:
// la cookie de sesión se borra igual.

import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { revokeToken } from "$lib/server/ckan-auth";
import { resolveCkanInternalUrl } from "$lib/server/ckan-internal-url";
import { openSession, resolveSessionSecret, SESSION_COOKIE_NAME } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies }) => {
	// La sesión del portal se mata **siempre**: aunque la revocación falle —es best-effort—, el navegador no
	// puede quedarse con una cookie que le sirve para seguir llamando al catálogo a nombre del usuario. Por eso
	// se lee primero y se borra **antes** de todo lo que puede lanzar: SvelteKit **descarta** las cookies de una
	// ruta que lanza (sólo las conserva ante un `Redirect`), así que un `delete` después de un resolvedor que
	// falla nunca llegaría al navegador.
	const cookie = cookies.get(SESSION_COOKIE_NAME);
	cookies.delete(SESSION_COOKIE_NAME, { path: "/" });

	try {
		// El token sale de la **sesión del servidor**, nunca del cliente. La clave se resuelve **sólo** si hay
		// cookie: el logout tiene que funcionar igual sin sesión.
		const aRevocar =
			cookie !== undefined
				? openSession(cookie, resolveSessionSecret(env.SESSION_SECRET, dev), Date.now())?.token
				: undefined;

		if (aRevocar) {
			const baseUrl = resolveCkanInternalUrl(env.CKAN_INTERNAL_URL, dev);
			await revokeToken(aRevocar, { baseUrl });
		}
	} catch (error) {
		// Una configuración ausente sigue siendo un `500` ruidoso —el contrato que el autor dejó abierto el
		// 2026-09-24 no cambia—, pero devuelto **sin lanzar**, para que el borrado de la cookie llegue igual.
		console.error("[logout] no se pudo revocar el token:", error);
		return json({ success: false }, { status: 500 });
	}

	return json({ success: true });
};
