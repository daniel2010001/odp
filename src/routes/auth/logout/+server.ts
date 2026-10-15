// POST /auth/logout — revocación best-effort del token CKAN.
//
// El **cuerpo** se tolera: el cliente limpia localStorage independientemente del
// resultado de la revocación en CKAN, así que un cuerpo inválido responde éxito
// igual. Lo que **no** se tolera es una configuración ausente: si
// `CKAN_INTERNAL_URL` falta fuera de desarrollo, `resolveCkanInternalUrl` lanza y
// la ruta responde 500, porque el alternativa silenciosa sería apuntar la
// revocación a la propia máquina del portal.

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

	// El token puede venir del cuerpo —el camino del navegador de hoy— o de la **sesión del servidor**, que es
	// de donde saldrá cuando los sitios migren al puente. El del cuerpo va primero: es el que el navegador cree
	// que tiene. La cookie y la clave se miran **sólo** si hay cookie: el logout tiene que funcionar igual sin
	// sesión, y resolver la clave obligatoria de producción para nada lo ataría a una variable que no necesita.
	const cookie = cookies.get(SESSION_COOKIE_NAME);
	const deLaSesion =
		cookie !== undefined
			? openSession(cookie, resolveSessionSecret(env.SESSION_SECRET, dev), Date.now())?.token
			: undefined;
	const aRevocar = token ?? deLaSesion;

	if (aRevocar) {
		const baseUrl = resolveCkanInternalUrl(env.CKAN_INTERNAL_URL, dev);
		await revokeToken(aRevocar, { baseUrl });
	}

	// La sesión del portal se mata **siempre**: aunque la revocación falle —es best-effort—, el navegador no
	// puede quedarse con una cookie que le sirve para seguir llamando al catálogo a nombre del usuario.
	cookies.delete(SESSION_COOKIE_NAME, { path: "/" });

	return json({ success: true });
};
