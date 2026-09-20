import { describe, expect, it } from "vitest";
import { LOGIN_PATH, loginUrl, SESSION_EXPIRED_PARAM, sessionExpiredLoginUrl } from "./session";

describe("sessionExpiredLoginUrl — la URL de re-login", () => {
	it("construye la URL de re-login declarando el motivo y conservando el destino", () => {
		const url = sessionExpiredLoginUrl("/dashboard");

		expect(url.startsWith(`${LOGIN_PATH}?`)).toBe(true);
		const params = new URLSearchParams(url.slice(LOGIN_PATH.length + 1));
		expect(params.get("returnTo")).toBe("/dashboard");
		expect(params.has(SESSION_EXPIRED_PARAM)).toBe(true);
	});

	it("conserva un destino que ya trae su propia query", () => {
		const url = sessionExpiredLoginUrl("/dashboard?page=2");

		const params = new URLSearchParams(url.slice(LOGIN_PATH.length + 1));
		expect(params.get("returnTo")).toBe("/dashboard?page=2");
		expect(params.has(SESSION_EXPIRED_PARAM)).toBe(true);
	});
});

describe("loginUrl — la URL de login sin motivo de expiración", () => {
	it("construye la URL de login conservando el destino y sin declarar una sesión expirada", () => {
		const url = loginUrl("/dataset/matricula-2026/resource/res-1");

		expect(url).toBe(
			`${LOGIN_PATH}?${new URLSearchParams({
				returnTo: "/dataset/matricula-2026/resource/res-1",
			})}`,
		);
		// El parámetro de expiración haría que el login muestre «Su sesión expiró…» a quien nunca tuvo
		// sesión: exactamente la mentira que la spec prohíbe.
		expect(url).not.toContain(SESSION_EXPIRED_PARAM);
	});

	it("codifica un destino que ya trae su propia query", () => {
		const url = loginUrl("/dashboard?page=2");

		const params = new URLSearchParams(url.slice(LOGIN_PATH.length + 1));
		expect(params.get("returnTo")).toBe("/dashboard?page=2");
		expect(params.has(SESSION_EXPIRED_PARAM)).toBe(false);
	});
});
