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

describe("createRateLimiter (límite por IP)", () => {
	it("permite hasta max intentos y bloquea el siguiente", () => {
		const limiter = createRateLimiter(2, 60_000);

		expect(limiter.check("1.2.3.4")).toBe(true);
		expect(limiter.check("1.2.3.4")).toBe(true);
		expect(limiter.check("1.2.3.4")).toBe(false);
	});

	it("vuelve a permitir una vez que expira la ventana", () => {
		vi.useFakeTimers();
		const limiter = createRateLimiter(1, 1000);

		expect(limiter.check("ip")).toBe(true);
		expect(limiter.check("ip")).toBe(false);

		vi.advanceTimersByTime(1001);

		expect(limiter.check("ip")).toBe(true);
	});

	it("aisla el límite por clave (IP distinta)", () => {
		const limiter = createRateLimiter(1, 60_000);

		expect(limiter.check("1.1.1.1")).toBe(true);
		expect(limiter.check("2.2.2.2")).toBe(true);
		expect(limiter.check("1.1.1.1")).toBe(false);
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
		limiter.check("1.2.3.4"); // consume el único intento

		const result = await handleLogin(
			"http://ckan.test",
			"1.2.3.4",
			{ username: "jdoe", password: "secret123" },
			limiter,
		);

		expect(result).toEqual({
			status: 429,
			body: { error: "Demasiados intentos. Esperá un momento." },
		});
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
});
