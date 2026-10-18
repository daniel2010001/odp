// Lógica server-side del handler de login (/auth/login).
//
// Se mantiene separada del `+server.ts` (que importa `$env/dynamic/private`)
// para que sea unit-testable sin depender de la resolución de `$env` de
// SvelteKit dentro de Vitest. Devuelve resultados planos ({ status, body })
// que el route convierte a `Response` con `json(...)`.

import { type LoginInput, loginSchema } from "$lib/schemas/auth";
import { CkanAuthError, type CkanAuthErrorCode, ckanLogin } from "$lib/server/ckan-auth";

/** Máximo de intentos fallidos de login por IP dentro de la ventana. */
export const LOGIN_MAX_ATTEMPTS = 5;
/** Ventana de limitación (15 minutos) en milisegundos. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Reserva de un intento en vuelo. Debe cerrarse con `fail()` o `release()`; cerrarla dos veces no tiene efecto. */
export interface LoginAttempt {
	/** CKAN rechazó las credenciales: la reserva pasa a ser un fallo contado (caduca con la ventana). */
	fail(): void;
	/** El intento terminó sin que las credenciales fueran rechazadas: devuelve el cupo. */
	release(): void;
}

export interface RateLimiter {
	/**
	 * Reserva un cupo de forma síncrona (atómica en JS): devuelve `null` si los fallos contados más las
	 * reservas en vuelo ya alcanzan el máximo en la ventana. No consume cupo hasta que se cierre con `fail()`.
	 */
	reserve(key: string): LoginAttempt | null;
	/** Devuelve `true` si la clave ya no admite más reservas. Sólo lectura. */
	isBlocked(key: string): boolean;
}

/**
 * Rate limiter en memoria (por clave, p. ej. IP). Simple, por instancia:
 * acumula los timestamps de los **fallos** y descarta los que caen fuera de
 * la ventana. Las reservas en vuelo ocupan cupo mientras CKAN responde, para
 * que una ráfaga concurrente no pase del máximo antes de registrarse los
 * fallos. Los éxitos no se registran ni limpian el conteo: detrás de un
 * proxy compartido, limpiarlo permitiría reiniciar el contador entrando con
 * una cuenta propia. Los fallos sólo caducan por la ventana.
 */
export function createRateLimiter(max: number, windowMs: number): RateLimiter {
	const failures = new Map<string, number[]>();
	const pending = new Map<string, number>();
	const used = (key: string, now: number) => {
		const current = (failures.get(key) ?? []).filter((t) => now - t < windowMs);
		if (current.length === 0) {
			failures.delete(key);
		} else {
			failures.set(key, current);
		}
		return current;
	};
	const adjustPending = (key: string, delta: number) => {
		const next = (pending.get(key) ?? 0) + delta;
		if (next <= 0) {
			pending.delete(key);
		} else {
			pending.set(key, next);
		}
	};
	const blocked = (key: string) => used(key, Date.now()).length + (pending.get(key) ?? 0) >= max;
	return {
		isBlocked: blocked,
		reserve(key: string): LoginAttempt | null {
			if (blocked(key)) return null;
			adjustPending(key, 1);
			let open = true;
			return {
				fail() {
					if (!open) return;
					open = false;
					adjustPending(key, -1);
					const now = Date.now();
					failures.set(key, [...used(key, now), now]);
				},
				release() {
					if (!open) return;
					open = false;
					adjustPending(key, -1);
				},
			};
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
 * Orquesta una petición de login: parseo → reserva de cupo → flujo CKAN →
 * mapeo de errores. La reserva es síncrona y precede a la llamada a CKAN; si
 * la clave ya agotó el cupo (fallos + intentos en vuelo) responde 429 sin
 * contactar a CKAN. Sólo cuentan las credenciales rechazadas por CKAN; los
 * cuerpos inválidos (que no toman reserva), los éxitos y las fallas del
 * upstream devuelven el cupo. La contraseña nunca se expone en la respuesta.
 */
export async function handleLogin(
	baseUrl: string,
	address: string,
	rawBody: unknown,
	limiter: RateLimiter = defaultLimiter,
): Promise<LoginHandlerResponse> {
	const parsed = parseLoginBody(rawBody);
	if (!parsed.ok) {
		return { status: parsed.status, body: parsed.body };
	}

	const attempt = limiter.reserve(address);
	if (!attempt) {
		return { status: 429, body: { error: "Demasiados intentos. Espere un momento." } };
	}

	try {
		const result = await ckanLogin(parsed.data.username, parsed.data.password, { baseUrl });
		return { status: 200, body: result };
	} catch (error) {
		if (error instanceof CkanAuthError) {
			if (error.code === "INVALID_CREDENTIALS") {
				attempt.fail();
			}
			const mapped = loginErrorResponse(error);
			return { status: mapped.status, body: mapped.body };
		}
		return { status: 500, body: { error: "Error interno del servidor." } };
	} finally {
		// No-op si ya se cerró con `fail()`; en cualquier otra salida devuelve el cupo.
		attempt.release();
	}
}
