// Lógica server-side del handler de login (/auth/login).
//
// Se mantiene separada del `+server.ts` (que importa `$env/dynamic/private`)
// para que sea unit-testable sin depender de la resolución de `$env` de
// SvelteKit dentro de Vitest. Devuelve resultados planos ({ status, body })
// que el route convierte a `Response` con `json(...)`.

import { type LoginInput, loginSchema } from "$lib/schemas/auth";
import { CkanAuthError, type CkanAuthErrorCode, ckanLogin } from "$lib/server/ckan-auth";

/** Máximo de intentos de login por IP dentro de la ventana. */
export const LOGIN_MAX_ATTEMPTS = 5;
/** Ventana de limitación (15 minutos) en milisegundos. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export interface RateLimiter {
	/** Devuelve `true` si el intento está permitido y lo registra. */
	check(key: string): boolean;
}

/**
 * Rate limiter en memoria (por clave, p. ej. IP). Simple, por instancia:
 * acumula timestamps y descarta los que caen fuera de la ventana.
 */
export function createRateLimiter(max: number, windowMs: number): RateLimiter {
	const attempts = new Map<string, number[]>();
	return {
		check(key: string): boolean {
			const now = Date.now();
			const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
			if (recent.length >= max) {
				attempts.set(key, recent);
				return false;
			}
			recent.push(now);
			attempts.set(key, recent);
			return true;
		},
	};
}

export interface ErrorBody {
	error: string;
}

export interface LoginHandlerResponse {
	status: number;
	body: unknown;
}

const ERROR_RESPONSES: Record<CkanAuthErrorCode, { status: number; message: string }> = {
	INVALID_CREDENTIALS: { status: 401, message: "Usuario o contraseña incorrectos" },
	NETWORK_ERROR: { status: 502, message: "No se pudo conectar con CKAN." },
	TIMEOUT: { status: 504, message: "La conexión con CKAN expiró." },
	CSRF_UNAVAILABLE: { status: 502, message: "No se pudo obtener el token de seguridad de CKAN." },
	TOKEN_CREATION_FAILED: { status: 502, message: "No se pudo crear el token de acceso." },
	USER_RESOLUTION_FAILED: { status: 502, message: "No se pudo resolver el usuario en CKAN." },
};

/** Mapea un `CkanAuthError` tipado a su status HTTP y mensaje en español. */
export function loginErrorResponse(error: CkanAuthError): { status: number; body: ErrorBody } {
	const mapped = ERROR_RESPONSES[error.code];
	if (mapped) {
		return { status: mapped.status, body: { error: mapped.message } };
	}
	return { status: 500, body: { error: "Error interno del servidor." } };
}

export type ParseLoginResult =
	| { ok: true; data: LoginInput }
	| { ok: false; status: number; body: ErrorBody };

/** Valida el cuerpo del login con `loginSchema` y normaliza los errores a 400. */
export function parseLoginBody(raw: unknown): ParseLoginResult {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		return { ok: false, status: 400, body: { error: "Cuerpo de la solicitud inválido." } };
	}
	const parsed = loginSchema.safeParse(raw);
	if (!parsed.success) {
		const first = parsed.error.issues[0];
		return {
			ok: false,
			status: 400,
			body: { error: first?.message ?? "Datos de acceso inválidos." },
		};
	}
	return { ok: true, data: parsed.data };
}

const defaultLimiter = createRateLimiter(LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);

/**
 * Orquesta una petición de login: rate limit → parseo → flujo CKAN → mapeo
 * de errores. La contraseña nunca se expone en la respuesta.
 */
export async function handleLogin(
	baseUrl: string,
	address: string,
	rawBody: unknown,
	limiter: RateLimiter = defaultLimiter,
): Promise<LoginHandlerResponse> {
	if (!limiter.check(address)) {
		return { status: 429, body: { error: "Demasiados intentos. Esperá un momento." } };
	}

	const parsed = parseLoginBody(rawBody);
	if (!parsed.ok) {
		return { status: parsed.status, body: parsed.body };
	}

	try {
		const result = await ckanLogin(parsed.data.username, parsed.data.password, { baseUrl });
		return { status: 200, body: result };
	} catch (error) {
		if (error instanceof CkanAuthError) {
			const mapped = loginErrorResponse(error);
			return { status: mapped.status, body: mapped.body };
		}
		return { status: 500, body: { error: "Error interno del servidor." } };
	}
}
