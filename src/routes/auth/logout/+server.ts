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
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	let token: string | undefined;
	try {
		const body = (await request.json()) as { token?: unknown };
		if (typeof body?.token === "string") {
			token = body.token;
		}
	} catch {
		// Cuerpo inválido: no hay token que revocar; se responde éxito igual.
	}

	if (token) {
		const baseUrl = resolveCkanInternalUrl(env.CKAN_INTERNAL_URL, dev);
		await revokeToken(token, { baseUrl });
	}

	return json({ success: true });
};
