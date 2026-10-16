import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, login, logout } from "./auth";

type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

function stubFetch(response: { ok: boolean; status: number; json: unknown }) {
	const mock = vi.fn(async (_url: string, _init?: FetchInit) => ({
		ok: response.ok,
		status: response.status,
		json: async () => response.json,
	}));
	vi.stubGlobal("fetch", mock);
	return mock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("api/auth — login", () => {
	it("hace POST a /auth/login con las credenciales y devuelve el usuario", async () => {
		const user = {
			id: "abc-123",
			name: "jdoe",
			display_name: "Jane Doe",
			created: "2026-01-01",
			state: "active" as const,
		};
		const mock = stubFetch({ ok: true, status: 200, json: { user } });

		const result = await login("jdoe", "secret123");

		expect(mock.mock.calls[0]?.[0]).toBe("/auth/login");
		const init = mock.mock.calls[0]?.[1] as FetchInit;
		expect(init.method).toBe("POST");
		expect(init.headers?.["Content-Type"]).toBe("application/json");
		expect(JSON.parse(init.body ?? "{}")).toEqual({ username: "jdoe", password: "secret123" });
		expect(result.name).toBe("jdoe");
		expect(result).not.toHaveProperty("token");
	});

	it("no expone un token aunque el servidor lo mandara: devuelve sólo el usuario", async () => {
		const user = { id: "abc-123", name: "jdoe", display_name: "Jane Doe" };
		stubFetch({ ok: true, status: 200, json: { token: "jwt-1", user } });

		const result = await login("jdoe", "secret123");

		expect(result).toEqual(user);
	});

	it("lanza AuthApiError si la respuesta OK no trae usuario", async () => {
		stubFetch({ ok: true, status: 200, json: {} });

		await expect(login("jdoe", "secret123")).rejects.toBeInstanceOf(AuthApiError);
	});

	it("lanza AuthApiError con el mensaje español cuando el servidor responde 401", async () => {
		stubFetch({ ok: false, status: 401, json: { error: "Usuario o contraseña incorrectos" } });

		await expect(login("jdoe", "wrongpass1")).rejects.toBeInstanceOf(AuthApiError);
		await expect(login("jdoe", "wrongpass1")).rejects.toMatchObject({
			status: 401,
			message: "Usuario o contraseña incorrectos",
		});
	});

	it("lanza AuthApiError con un mensaje por defecto cuando no hay cuerpo de error", async () => {
		stubFetch({ ok: false, status: 500, json: {} });

		await expect(login("jdoe", "secret123")).rejects.toMatchObject({
			status: 500,
			message: "HTTP 500",
		});
	});
});

describe("api/auth — logout", () => {
	it("hace POST a /auth/logout con un cuerpo vacío: el servidor revoca el token de la sesión y borra la cookie", async () => {
		const mock = stubFetch({ ok: true, status: 200, json: { success: true } });

		await logout();

		expect(mock.mock.calls[0]?.[0]).toBe("/auth/logout");
		const init = mock.mock.calls[0]?.[1] as FetchInit;
		expect(init.method).toBe("POST");
		expect(init.headers?.["Content-Type"]).toBe("application/json");
		expect(JSON.parse(init.body ?? "null")).toEqual({});
	});

	it("no lanza cuando el servidor falla (best-effort)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network down");
			}),
		);

		await expect(logout()).resolves.toBeUndefined();
	});
});
