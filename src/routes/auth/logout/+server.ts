// POST /auth/logout — revocación best-effort del token CKAN.
//
// Siempre devuelve éxito: el cliente limpia localStorage independientemente
// del resultado de la revocación en CKAN.

import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { revokeToken } from "$lib/server/ckan-auth";
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
		const baseUrl = env.CKAN_INTERNAL_URL || "http://localhost:5000";
		await revokeToken(token, { baseUrl });
	}

	return json({ success: true });
};
