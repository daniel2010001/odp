// API: autenticación del cliente contra las rutas server de SvelteKit.
// El frontend NO habla con CKAN directamente para login/logout: las rutas
// /auth/login y /auth/logout actúan de proxy server-side.

import type { AuthSession } from "$lib/types/api";

/** Error tipado lanzado por `login` ante una respuesta no-OK del servidor. */
export class AuthApiError extends Error {
	readonly status?: number;

	constructor(message: string, status?: number) {
		super(message);
		this.name = "AuthApiError";
		this.status = status;
	}
}

/**
 * Inicia sesión contra el proxy /auth/login y devuelve la sesión
 * ({ token, user }). Lanza `AuthApiError` con el mensaje en español
 * del servidor ante un fallo (credenciales inválidas, throttling, etc.).
 */
export async function login(username: string, password: string): Promise<AuthSession> {
	const response = await fetch("/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});

	const json = (await response.json()) as {
		token?: string;
		user?: AuthSession["user"];
		error?: string;
	};

	if (!response.ok || !json.token || !json.user) {
		throw new AuthApiError(json.error ?? `HTTP ${response.status}`, response.status);
	}

	return { token: json.token, user: json.user };
}

/**
 * Cierra sesión: el proxy /auth/logout borra la cookie de sesión del portal e
 * intenta revocar el token en CKAN —el del cuerpo si viene, si no el de la
 * sesión—. Es best-effort: nunca lanza, porque el cliente limpia su estado
 * independientemente del resultado de la revocación.
 */
export async function logout(token?: string): Promise<void> {
	try {
		await fetch("/auth/logout", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(token ? { token } : {}),
		});
	} catch {
		// best-effort: se ignora cualquier fallo de red.
	}
}
