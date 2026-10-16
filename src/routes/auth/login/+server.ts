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
import {
	buildSession,
	resolveSessionSecret,
	SESSION_COOKIE_NAME,
	sealSession,
	sessionCookieOptions,
} from "$lib/server/session";
import type { CkanUser } from "$lib/types/ckan";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
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
	// La clave se resuelve **antes** del login, no después: `handleLogin` acuña un token en CKAN, y si la clave
	// faltara recién al sellar, el `500` llegaría con ese token ya vivo —sin dueño, sin revocar, 24 h—, y cada
	// reintento acuñaría otro. Sin clave no se toca el catálogo.
	const secret = resolveSessionSecret(env.SESSION_SECRET, dev);
	const response = await handleLogin(baseUrl, getClientAddress(), raw);

	// La credencial entra en la **sesión del servidor**: la cookie la pone esta ruta, es `httpOnly`, y el
	// navegador no la lee. Hasta que los sitios del cliente migren al puente (`T4`), el cuerpo **sigue**
	// llevando el token: el navegador lo necesita para sus llamadas de hoy, y sacarlo antes de migrarlas
	// rompería el portal entero. Ése es el orden correcto, no una concesión.
	if (response.status === 200) {
		const { token, user } = response.body as { token?: string; user?: CkanUser };
		if (token && user) {
			const { name, ...opciones } = sessionCookieOptions(!dev);
			cookies.set(name, sealSession(buildSession(token, user, Date.now()), secret), opciones);
		}
	}

	return json(response.body, { status: response.status });
};
