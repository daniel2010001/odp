// POST /auth/login — proxy server-side de autenticación contra CKAN.
//
// La contraseña nunca se expone: el route la lee del body y la delega al flujo
// validado de 6 pasos en `ckanLogin`, que devuelve únicamente el JWT y el
// usuario resuelto.

import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { handleLogin } from "$lib/server/auth-server";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		raw = null;
	}

	// CKAN_INTERNAL_URL es server-only (compose). En dev sin configurar, se usa
	// el proxy de Vite (localhost:5000).
	const baseUrl = env.CKAN_INTERNAL_URL || "http://localhost:5000";
	const response = await handleLogin(baseUrl, getClientAddress(), raw);
	return json(response.body, { status: response.status });
};
