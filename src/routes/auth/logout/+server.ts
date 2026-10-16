// POST /auth/logout — revocación best-effort del token CKAN.
//
// El **cuerpo** se tolera: el cliente limpia localStorage independientemente del
// resultado de la revocación en CKAN, así que un cuerpo inválido responde éxito
// igual. Lo que **no** se tolera es una configuración ausente: si
// `CKAN_INTERNAL_URL` (o, con cookie, `SESSION_SECRET`) falta fuera de desarrollo,
// la ruta responde 500, porque la alternativa silenciosa sería apuntar la
// revocación a la propia máquina del portal. Ese 500 se **devuelve**, no se lanza:
// la cookie de sesión se borra igual.

import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { revokeToken } from "$lib/server/ckan-auth";
import { resolveCkanInternalUrl } from "$lib/server/ckan-internal-url";
import { openSession, resolveSessionSecret, SESSION_COOKIE_NAME } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, cookies }) => {
	let token: string | undefined;
	try {
		const body = (await request.json()) as { token?: unknown };
		if (typeof body?.token === "string") {
			token = body.token;
		}
	} catch {
		// Cuerpo inválido: no hay token que revocar; se responde éxito igual.
	}

	// La sesión del portal se mata **siempre**: aunque la revocación falle —es best-effort—, el navegador no
	// puede quedarse con una cookie que le sirve para seguir llamando al catálogo a nombre del usuario. Por eso
	// se lee primero y se borra **antes** de todo lo que puede lanzar: SvelteKit **descarta** las cookies de una
	// ruta que lanza (sólo las conserva ante un `Redirect`), así que un `delete` después de un resolvedor que
	// falla nunca llegaría al navegador.
	const cookie = cookies.get(SESSION_COOKIE_NAME);
	cookies.delete(SESSION_COOKIE_NAME, { path: "/" });

	try {
		// El token puede venir del cuerpo —el camino del navegador de hoy— o de la **sesión del servidor**, que es
		// de donde saldrá cuando los sitios migren al puente. El del cuerpo va primero: es el que el navegador cree
		// que tiene. La clave se resuelve **sólo** si hay cookie: el logout tiene que funcionar igual sin sesión.
		const deLaSesion =
			cookie !== undefined
				? openSession(cookie, resolveSessionSecret(env.SESSION_SECRET, dev), Date.now())?.token
				: undefined;
		const aRevocar = token ?? deLaSesion;

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
