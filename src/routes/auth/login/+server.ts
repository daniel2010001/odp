// POST /auth/login — proxy server-side de autenticación contra CKAN.
//
// La contraseña nunca se expone: el route la lee del body y la delega al flujo
// validado de 6 pasos en `ckanLogin`, que devuelve únicamente el JWT y el
// usuario resuelto.

import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { handleLogin } from "$lib/server/auth-server";
import { resolveCkanInternalUrl } from "$lib/server/ckan-internal-url";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		raw = null;
	}

	// CKAN_INTERNAL_URL es server-only: la inyecta compose en el portal
	// contenedorizado. Cuando falta, la decisión (default sólo en dev, o fallo en
	// producción) vive en `resolveCkanInternalUrl`, no acá.
	const baseUrl = resolveCkanInternalUrl(env.CKAN_INTERNAL_URL, dev);
	const response = await handleLogin(baseUrl, getClientAddress(), raw);
	return json(response.body, { status: response.status });
};
