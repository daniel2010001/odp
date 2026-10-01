import { describe, expect, it } from "vitest";
import { LOGIN_PATH, SESSION_EXPIRED_PARAM, sessionExpiredLoginUrl } from "./session";

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
