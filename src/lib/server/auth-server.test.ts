import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CkanUser } from "$lib/types/ckan";
import {
	createRateLimiter,
	handleLogin,
	LOGIN_MAX_ATTEMPTS,
	LOGIN_WINDOW_MS,
	loginErrorResponse,
	parseLoginBody,
} from "./auth-server";
import { CkanAuthError, ckanLogin } from "./ckan-auth";

vi.mock("./ckan-auth", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./ckan-auth")>();
	return { ...actual, ckanLogin: vi.fn() };
});

const userDict: CkanUser = {
	id: "abc-123",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01",
	state: "active",
};

const TOO_MANY = { error: "Demasiados intentos. Espere un momento." };
const GOOD = { username: "jdoe", password: "secret123" };
const BAD = { username: "jdoe", password: "wrongpass1" };

function freshLimiter() {
	return createRateLimiter(100, 60_000);
}

beforeEach(() => {
	vi.mocked(ckanLogin).mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("createRateLimiter (límite por IP, sólo fallos)", () => {
	it("bloquea una vez que los fallos registrados alcanzan el máximo", () => {
		const limiter = createRateLimiter(2, 60_000);

		limiter.reserve("1.2.3.4")?.fail();
		expect(limiter.isBlocked("1.2.3.4")).toBe(false);
		limiter.reserve("1.2.3.4")?.fail();
		expect(limiter.isBlocked("1.2.3.4")).toBe(true);
		expect(limiter.reserve("1.2.3.4")).toBeNull();
	});

	it("las reservas en vuelo ocupan cupo hasta que se liberan", () => {
		const limiter = createRateLimiter(2, 60_000);

		const a = limiter.reserve("ip");
		const b = limiter.reserve("ip");

		expect(a).not.toBeNull();
		expect(b).not.toBeNull();
		expect(limiter.reserve("ip")).toBeNull();
		a?.release();
		expect(limiter.reserve("ip")).not.toBeNull();
	});

	it("liberar o resolver dos veces la misma reserva no libera cupo ajeno", () => {
		const limiter = createRateLimiter(2, 60_000);
		const a = limiter.reserve("ip");
		limiter.reserve("ip");

		a?.release();
		a?.release();

		expect(limiter.reserve("ip")).not.toBeNull();
		expect(limiter.reserve("ip")).toBeNull();
	});

	it("liberar una reserva no consume cupo", () => {
		const limiter = createRateLimiter(1, 60_000);

		for (let i = 0; i < 10; i++) limiter.reserve("ip")?.release();

		expect(limiter.isBlocked("ip")).toBe(false);
	});

	it("vuelve a permitir una vez que expira la ventana", () => {
		vi.useFakeTimers();
		const limiter = createRateLimiter(1, 1000);

		limiter.reserve("ip")?.fail();
		expect(limiter.isBlocked("ip")).toBe(true);

		vi.advanceTimersByTime(1001);

		expect(limiter.isBlocked("ip")).toBe(false);
	});

	it("aisla el límite por clave (IP distinta)", () => {
		const limiter = createRateLimiter(1, 60_000);

		limiter.reserve("1.1.1.1")?.fail();

		expect(limiter.isBlocked("1.1.1.1")).toBe(true);
		expect(limiter.isBlocked("2.2.2.2")).toBe(false);
	});

	it("expone constantes coherentes con el diseño (5 intentos / 15 min)", () => {
		expect(LOGIN_MAX_ATTEMPTS).toBe(5);
		expect(LOGIN_WINDOW_MS).toBe(15 * 60 * 1000);
	});
});

describe("parseLoginBody", () => {
	it("acepta credenciales válidas", () => {
		const result = parseLoginBody({ username: "jdoe", password: "secret123" });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual({ username: "jdoe", password: "secret123" });
		}
	});

	it("rechaza un cuerpo no-objeto con 400 y mensaje en español", () => {
		const result = parseLoginBody(null);

		expect(result).toEqual({
			ok: false,
			status: 400,
			body: { error: "Cuerpo de la solicitud inválido." },
		});
	});

	it("rechaza username vacío con el mensaje del schema (zod)", () => {
		const result = parseLoginBody({ username: "", password: "secret123" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(400);
			expect(result.body.error).toBe("El nombre de usuario es obligatorio");
		}
	});

	it("rechaza password corto con el mensaje del schema (zod)", () => {
		const result = parseLoginBody({ username: "jdoe", password: "123" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(400);
			expect(result.body.error).toBe("La contraseña debe tener al menos 8 caracteres");
		}
	});
});

describe("loginErrorResponse (mapeo de errores a español)", () => {
	it.each([
		["INVALID_CREDENTIALS", 401, "Usuario o contraseña incorrectos"],
		["NETWORK_ERROR", 502, "No se pudo conectar con CKAN."],
		["TIMEOUT", 504, "La conexión con CKAN expiró."],
		["CSRF_UNAVAILABLE", 502, "No se pudo obtener el token de seguridad de CKAN."],
		["TOKEN_CREATION_FAILED", 502, "No se pudo crear el token de acceso."],
		["USER_RESOLUTION_FAILED", 502, "No se pudo resolver el usuario en CKAN."],
	] as const)("mapea %s → %i con mensaje en español", (code, status, message) => {
		const result = loginErrorResponse(new CkanAuthError(code, "detail"));

		expect(result).toEqual({ status, body: { error: message } });
	});
});

describe("handleLogin (orquestación del handler)", () => {
	it("devuelve 429 sin llamar a CKAN cuando el límite por IP está agotado", async () => {
		const limiter = createRateLimiter(1, 60_000);
		limiter.reserve("1.2.3.4")?.fail(); // consume el único fallo permitido

		const result = await handleLogin(
			"http://ckan.test",
			"1.2.3.4",
			{ username: "jdoe", password: "secret123" },
			limiter,
		);

		expect(result).toEqual({ status: 429, body: TOO_MANY });
		expect(ckanLogin).not.toHaveBeenCalled();
	});

	it("devuelve 400 ante un cuerpo inválido sin llamar a CKAN", async () => {
		const result = await handleLogin("http://ckan.test", "1.2.3.4", null, freshLimiter());

		expect(result.status).toBe(400);
		expect(ckanLogin).not.toHaveBeenCalled();
	});

	it("devuelve 200 con { token, user } al autenticar correctamente", async () => {
		vi.mocked(ckanLogin).mockResolvedValue({ token: "jwt-1", user: userDict });

		const result = await handleLogin(
			"http://ckan.test",
			"1.2.3.4",
			{ username: "jdoe", password: "secret123" },
			freshLimiter(),
		);

		expect(result).toEqual({ status: 200, body: { token: "jwt-1", user: userDict } });
		expect(ckanLogin).toHaveBeenCalledWith("jdoe", "secret123", { baseUrl: "http://ckan.test" });
	});

	it("mapea CkanAuthError a su status/mensaje correspondiente", async () => {
		vi.mocked(ckanLogin).mockRejectedValue(new CkanAuthError("INVALID_CREDENTIALS", "bad"));

		const result = await handleLogin(
			"http://ckan.test",
			"1.2.3.4",
			{ username: "jdoe", password: "wrongpass1" },
			freshLimiter(),
		);

		expect(result).toEqual({
			status: 401,
			body: { error: "Usuario o contraseña incorrectos" },
		});
	});

	it("devuelve 500 ante un error inesperado (no-CkanAuthError)", async () => {
		vi.mocked(ckanLogin).mockRejectedValue(new Error("boom"));

		const result = await handleLogin(
			"http://ckan.test",
			"1.2.3.4",
			{ username: "jdoe", password: "secret123" },
			freshLimiter(),
		);

		expect(result).toEqual({ status: 500, body: { error: "Error interno del servidor." } });
	});

	describe("sólo los intentos fallidos cuentan", () => {
		function limiter() {
			return createRateLimiter(LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
		}
		function failAll(l: ReturnType<typeof limiter>, n: number) {
			vi.mocked(ckanLogin).mockRejectedValue(new CkanAuthError("INVALID_CREDENTIALS", "bad"));
			return Promise.all(
				Array.from({ length: n }, () => handleLogin("http://ckan.test", "ip", BAD, l)),
			);
		}

		it("permite más de 5 logins exitosos seguidos", async () => {
			const l = limiter();
			vi.mocked(ckanLogin).mockResolvedValue({ token: "jwt-1", user: userDict });

			for (let i = 0; i < LOGIN_MAX_ATTEMPTS + 3; i++) {
				const result = await handleLogin("http://ckan.test", "ip", GOOD, l);
				expect(result).toEqual({ status: 200, body: { token: "jwt-1", user: userDict } });
			}
		});

		it("tras 5 fallos responde 429 aun con credenciales correctas, sin llamar a CKAN", async () => {
			const l = limiter();
			const failed = await failAll(l, LOGIN_MAX_ATTEMPTS);
			for (const r of failed) {
				expect(r).toEqual({ status: 401, body: { error: "Usuario o contraseña incorrectos" } });
			}
			vi.mocked(ckanLogin).mockReset();
			vi.mocked(ckanLogin).mockResolvedValue({ token: "jwt-1", user: userDict });

			const result = await handleLogin("http://ckan.test", "ip", GOOD, l);

			expect(result).toEqual({ status: 429, body: TOO_MANY });
			expect(ckanLogin).not.toHaveBeenCalled();
		});

		it("los fallos fuera de la ventana ya no bloquean", async () => {
			vi.useFakeTimers();
			const l = limiter();
			await failAll(l, LOGIN_MAX_ATTEMPTS);
			vi.mocked(ckanLogin).mockReset();
			vi.mocked(ckanLogin).mockResolvedValue({ token: "jwt-1", user: userDict });

			vi.advanceTimersByTime(LOGIN_WINDOW_MS + 1);
			const result = await handleLogin("http://ckan.test", "ip", GOOD, l);

			expect(result).toEqual({ status: 200, body: { token: "jwt-1", user: userDict } });
		});

		it("un cuerpo malformado (400) no cuenta", async () => {
			const l = limiter();
			for (let i = 0; i < LOGIN_MAX_ATTEMPTS + 2; i++) {
				const result = await handleLogin("http://ckan.test", "ip", null, l);
				expect(result).toEqual({
					status: 400,
					body: { error: "Cuerpo de la solicitud inválido." },
				});
			}
			expect(l.isBlocked("ip")).toBe(false);
			expect(ckanLogin).not.toHaveBeenCalled();
		});

		it("un error de CKAN o de red (502) no cuenta", async () => {
			const l = limiter();
			vi.mocked(ckanLogin).mockRejectedValue(new CkanAuthError("NETWORK_ERROR", "down"));
			for (let i = 0; i < LOGIN_MAX_ATTEMPTS + 2; i++) {
				const result = await handleLogin("http://ckan.test", "ip", GOOD, l);
				expect(result).toEqual({ status: 502, body: { error: "No se pudo conectar con CKAN." } });
			}
			expect(l.isBlocked("ip")).toBe(false);
		});

		// Sólo `INVALID_CREDENTIALS` prueba una contraseña; el resto de los códigos son fallas del camino hacia CKAN.
		it.each([
			"TIMEOUT",
			"CSRF_UNAVAILABLE",
			"TOKEN_CREATION_FAILED",
			"USER_RESOLUTION_FAILED",
		] as const)("un error %s de CKAN no cuenta", async (code) => {
			const l = limiter();
			vi.mocked(ckanLogin).mockRejectedValue(new CkanAuthError(code, "detail"));
			for (let i = 0; i < LOGIN_MAX_ATTEMPTS + 2; i++) {
				const result = await handleLogin("http://ckan.test", "ip", GOOD, l);
				expect(result.status).not.toBe(429);
			}
			expect(l.isBlocked("ip")).toBe(false);
		});

		it("con la clave bloqueada, un cuerpo malformado responde 400 sin contactar a CKAN", async () => {
			// El parseo va antes de la reserva para que un 400 no ocupe cupo: no prueba ninguna contraseña.
			const l = limiter();
			await failAll(l, LOGIN_MAX_ATTEMPTS);
			vi.mocked(ckanLogin).mockReset();
			const result = await handleLogin("http://ckan.test", "ip", null, l);
			expect(result.status).toBe(400);
			expect(ckanLogin).not.toHaveBeenCalled();
			expect(l.isBlocked("ip")).toBe(true);
		});

		it("un login exitoso no reinicia el conteo de fallos", async () => {
			const l = limiter();
			await failAll(l, LOGIN_MAX_ATTEMPTS - 1);
			vi.mocked(ckanLogin).mockReset();
			vi.mocked(ckanLogin).mockResolvedValue({ token: "jwt-1", user: userDict });
			expect((await handleLogin("http://ckan.test", "ip", GOOD, l)).status).toBe(200);

			vi.mocked(ckanLogin).mockRejectedValue(new CkanAuthError("INVALID_CREDENTIALS", "bad"));
			expect((await handleLogin("http://ckan.test", "ip", BAD, l)).status).toBe(401);

			// 4 fallos + éxito + 1 fallo = 5 fallos: el éxito no los borró.
			vi.mocked(ckanLogin).mockReset();
			const result = await handleLogin("http://ckan.test", "ip", GOOD, l);
			expect(result).toEqual({ status: 429, body: TOO_MANY });
			expect(ckanLogin).not.toHaveBeenCalled();
		});

		it("una ráfaga concurrente de 6 intentos fallidos deja pasar sólo 5 a CKAN", async () => {
			const l = limiter();
			const release: Array<() => void> = [];
			vi.mocked(ckanLogin).mockImplementation(
				() =>
					new Promise((_, reject) => {
						release.push(() => reject(new CkanAuthError("INVALID_CREDENTIALS", "bad")));
					}),
			);

			const burst = Array.from({ length: LOGIN_MAX_ATTEMPTS + 1 }, () =>
				handleLogin("http://ckan.test", "ip", BAD, l),
			);
			// El 6.º se rechaza de forma síncrona, antes de que CKAN responda a ninguno.
			expect(await burst[LOGIN_MAX_ATTEMPTS]).toEqual({ status: 429, body: TOO_MANY });
			expect(ckanLogin).toHaveBeenCalledTimes(LOGIN_MAX_ATTEMPTS);
			for (const r of release) r();
			const settled = await Promise.all(burst.slice(0, LOGIN_MAX_ATTEMPTS));
			for (const r of settled) {
				expect(r).toEqual({ status: 401, body: { error: "Usuario o contraseña incorrectos" } });
			}
			expect(ckanLogin).toHaveBeenCalledTimes(LOGIN_MAX_ATTEMPTS);
			expect(l.isBlocked("ip")).toBe(true);
		});

		it("logins exitosos concurrentes no se bloquean entre sí al liberar su reserva", async () => {
			const l = limiter();
			vi.mocked(ckanLogin).mockResolvedValue({ token: "jwt-1", user: userDict });

			for (let i = 0; i < LOGIN_MAX_ATTEMPTS + 3; i++) {
				const [a, b] = await Promise.all([
					handleLogin("http://ckan.test", "ip", GOOD, l),
					handleLogin("http://ckan.test", "ip", GOOD, l),
				]);
				expect(a.status).toBe(200);
				expect(b.status).toBe(200);
			}
		});

		it("un CKAN que lanza libera su reserva", async () => {
			const l = limiter();
			vi.mocked(ckanLogin).mockRejectedValue(new Error("boom"));
			for (let i = 0; i < LOGIN_MAX_ATTEMPTS + 2; i++) {
				const result = await handleLogin("http://ckan.test", "ip", GOOD, l);
				expect(result).toEqual({ status: 500, body: { error: "Error interno del servidor." } });
			}
			expect(l.isBlocked("ip")).toBe(false);
			expect(ckanLogin).toHaveBeenCalledTimes(LOGIN_MAX_ATTEMPTS + 2);
		});
	});
});
