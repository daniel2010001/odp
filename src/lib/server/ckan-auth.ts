// Helper server-side para autenticación contra CKAN.
//
// Ejecuta el flujo validado de 6 pasos:
//   1) web-login (form-encoded, redirect manual) → cookie de sesión
//   2) user_show → usuario resuelto (usa `name` resuelto)
//   3) GET /user/<name> → token CSRF (meta `_csrf_token`)
//   4) api_token_create → JWT (cookie + header `X-CSRFToken`)
//   5) devuelve { token, user }
//   6) fallback CSRF: si el login devuelve 400, obtiene el formulario e
//      incluye `_csrf_token`; si api_token_create devuelve 400, reobtiene el
//      CSRF y reintenta una vez.
//
// La contraseña NUNCA sale de este módulo: el browser solo recibe el JWT.

import type { CkanUser } from "$lib/types/ckan";

/** Nombre con el que se etiqueta el token CKAN minteado. */
export const TOKEN_NAME = "Portal Datos UMSS";

export type CkanAuthErrorCode =
	| "INVALID_CREDENTIALS"
	| "NETWORK_ERROR"
	| "TIMEOUT"
	| "CSRF_UNAVAILABLE"
	| "TOKEN_CREATION_FAILED"
	| "USER_RESOLUTION_FAILED";

export class CkanAuthError extends Error {
	readonly code: CkanAuthErrorCode;
	readonly status?: number;

	constructor(code: CkanAuthErrorCode, message: string, status?: number) {
		super(message);
		this.name = "CkanAuthError";
		this.code = code;
		this.status = status;
	}
}

export interface CkanAuthResult {
	token: string;
	user: CkanUser;
}

export interface CkanAuthOptions {
	/** URL base del CKAN (sin barra final), inyectada por el route server. */
	baseUrl: string;
}

interface HeadersLike {
	get(name: string): string | null;
	getSetCookie?(): string[];
}

/** Jar de cookies: acumula Set-Cookie y las reenvía como `Cookie`. */
class CookieJar {
	private cookies = new Map<string, string>();

	store(setCookie: string): void {
		const first = setCookie.split(";")[0]?.trim() ?? "";
		const eq = first.indexOf("=");
		if (eq <= 0) return;
		const name = first.slice(0, eq).trim();
		const value = first.slice(eq + 1).trim();
		this.cookies.set(name, value);
	}

	toString(): string {
		return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
	}
}

function readSetCookies(headers: HeadersLike): string[] {
	if (typeof headers.getSetCookie === "function") {
		const cookies = headers.getSetCookie();
		if (cookies.length > 0) return cookies;
	}
	const raw = headers.get("set-cookie");
	return raw ? [raw] : [];
}

function storeCookies(jar: CookieJar, headers: HeadersLike): void {
	for (const cookie of readSetCookies(headers)) {
		jar.store(cookie);
	}
}

function cookieHeaders(jar: CookieJar): Record<string, string> {
	const value = jar.toString();
	return value ? { Cookie: value } : {};
}

function extractMetaCsrf(html: string): string | null {
	return /<meta\s+name="_csrf_token"\s+content="([^"]*)"/i.exec(html)?.[1] ?? null;
}

function extractFormCsrf(html: string): string | null {
	return /<input[^>]*name="_csrf_token"[^>]*value="([^"]*)"/i.exec(html)?.[1] ?? null;
}

function toCkanUser(user: Record<string, unknown>): CkanUser {
	return {
		id: String(user.id ?? ""),
		name: String(user.name ?? ""),
		display_name: String(user.display_name ?? user.fullname ?? user.name ?? ""),
		email: typeof user.email === "string" ? user.email : undefined,
		created: String(user.created ?? ""),
		state: user.state === "deleted" ? "deleted" : "active",
		sysadmin: user.sysadmin === true,
		fullname: typeof user.fullname === "string" ? user.fullname : undefined,
	};
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
	try {
		return await fetch(url, init);
	} catch (err) {
		const name = (err as { name?: string } | null)?.name;
		if (name === "AbortError" || name === "TimeoutError") {
			throw new CkanAuthError("TIMEOUT", "La conexión con CKAN expiró.");
		}
		throw new CkanAuthError("NETWORK_ERROR", "No se pudo conectar con CKAN.");
	}
}

function isRedirect(status: number): boolean {
	return status >= 300 && status < 400;
}

async function fetchCsrf(baseUrl: string, jar: CookieJar, name: string): Promise<string> {
	const response = await safeFetch(`${baseUrl}/user/${name}`, {
		method: "GET",
		headers: cookieHeaders(jar),
	});
	const html = await response.text();
	const csrf = extractMetaCsrf(html);
	if (!csrf) {
		throw new CkanAuthError("CSRF_UNAVAILABLE", "No se pudo obtener el token CSRF de CKAN.");
	}
	return csrf;
}

async function mintToken(
	baseUrl: string,
	jar: CookieJar,
	name: string,
	csrf: string,
): Promise<string> {
	let attemptCsrf = csrf;
	for (let attempt = 0; attempt < 2; attempt++) {
		const response = await safeFetch(`${baseUrl}/api/3/action/api_token_create`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-CSRFToken": attemptCsrf,
				...cookieHeaders(jar),
			},
			body: JSON.stringify({ user: name, name: TOKEN_NAME }),
		});

		if (response.status === 400 && attempt === 0) {
			// CSRF vencido: reobtener de la página de usuario y reintentar una vez.
			attemptCsrf = await fetchCsrf(baseUrl, jar, name);
			continue;
		}

		const payload = (await response.json()) as {
			success?: boolean;
			result?: { token?: string };
		};
		if (!payload.success || !payload.result?.token) {
			throw new CkanAuthError(
				"TOKEN_CREATION_FAILED",
				"No se pudo crear el token de acceso.",
				response.status,
			);
		}
		return payload.result.token;
	}

	throw new CkanAuthError("TOKEN_CREATION_FAILED", "No se pudo crear el token de acceso.");
}

/**
 * Autentica `username`/`password` contra CKAN y devuelve un JWT más el
 * usuario resuelto. La contraseña nunca se expone fuera de esta función.
 */
export async function ckanLogin(
	username: string,
	password: string,
	options: CkanAuthOptions,
): Promise<CkanAuthResult> {
	const baseUrl = options.baseUrl.replace(/\/$/, "");
	const jar = new CookieJar();

	// Paso 1: web login (redirect manual para capturar la cookie de sesión).
	let loginResponse = await safeFetch(`${baseUrl}/user/login`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ login: username, password }).toString(),
		redirect: "manual",
	});

	// Paso 6: fallback CSRF del formulario de login.
	if (loginResponse.status === 400) {
		const formResponse = await safeFetch(`${baseUrl}/user/login`, {
			method: "GET",
			headers: cookieHeaders(jar),
		});
		storeCookies(jar, formResponse.headers);
		const loginCsrf = extractFormCsrf(await formResponse.text());
		if (!loginCsrf) {
			throw new CkanAuthError("CSRF_UNAVAILABLE", "No se pudo obtener el token CSRF de CKAN.", 400);
		}
		loginResponse = await safeFetch(`${baseUrl}/user/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				...cookieHeaders(jar),
			},
			body: new URLSearchParams({ login: username, password, _csrf_token: loginCsrf }).toString(),
			redirect: "manual",
		});
	}

	storeCookies(jar, loginResponse.headers);

	if (!isRedirect(loginResponse.status)) {
		// CKAN re-renderiza el formulario (200) con un flash de error.
		throw new CkanAuthError(
			"INVALID_CREDENTIALS",
			"Usuario o contraseña incorrectos",
			loginResponse.status,
		);
	}

	// Paso 2: resolver el usuario autenticado (session cookie).
	const userShowResponse = await safeFetch(`${baseUrl}/api/3/action/user_show`, {
		method: "GET",
		headers: cookieHeaders(jar),
	});
	const userShow = (await userShowResponse.json()) as {
		success?: boolean;
		result?: Record<string, unknown>;
	};
	if (!userShow.success || !userShow.result) {
		throw new CkanAuthError(
			"USER_RESOLUTION_FAILED",
			"No se pudo resolver el usuario en CKAN.",
			userShowResponse.status,
		);
	}
	const user = toCkanUser(userShow.result);

	// Pasos 3 y 4: CSRF de la página de usuario → mint token.
	const csrf = await fetchCsrf(baseUrl, jar, user.name);
	const token = await mintToken(baseUrl, jar, user.name, csrf);

	// Paso 5: devolver token + usuario.
	return { token, user };
}

/**
 * Revoca un token de acceso en CKAN (best-effort). Nunca lanza: el cierre de
 * sesión del cliente debe completarse aunque la revocación falle (red, timeout
 * o un error HTTP como token ya revocado).
 */
export async function revokeToken(token: string, options: CkanAuthOptions): Promise<void> {
	const baseUrl = options.baseUrl.replace(/\/$/, "");
	try {
		await safeFetch(`${baseUrl}/api/3/action/api_token_revoke`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token }),
		});
	} catch {
		// best-effort: se ignora cualquier fallo.
	}
}
