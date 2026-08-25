import { afterEach, describe, expect, it, vi } from "vitest";
import { CkanAuthError, ckanLogin, TOKEN_NAME } from "./ckan-auth";

const BASE = "https://ckan.test";

const userDict = {
	id: "abc-123",
	name: "jdoe",
	display_name: "Jane Doe",
	fullname: "Jane Doe",
	email: "jane@example.com",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

interface FetchInit {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	redirect?: string;
}

interface MockHeaders {
	get(name: string): string | null;
	getSetCookie?(): string[];
}

function makeHeaders(entries: Record<string, string>, setCookies?: string[]): MockHeaders {
	return {
		get: (name: string) => entries[name.toLowerCase()] ?? null,
		getSetCookie: () => setCookies ?? (entries["set-cookie"] ? [entries["set-cookie"]] : []),
	};
}

function response(
	status: number,
	opts: {
		headers?: Record<string, string>;
		setCookies?: string[];
		text?: string;
		json?: unknown;
	} = {},
) {
	return {
		status,
		headers: makeHeaders(opts.headers ?? {}, opts.setCookies),
		text: async () => opts.text ?? "",
		json: async () => opts.json,
	};
}

function fetchSequence(responses: unknown[]) {
	const calls: Array<{ url: string; init?: FetchInit }> = [];
	const impl = vi.fn(async (url: string, init?: FetchInit) => {
		calls.push({ url, init });
		const next = responses.shift();
		if (next instanceof Error) throw next;
		return next;
	});
	return { impl, calls };
}

function bodyOf(call: { init?: FetchInit }): string {
	return call.init?.body ?? "";
}

async function rejection(promise: Promise<unknown>): Promise<CkanAuthError> {
	try {
		await promise;
		throw new Error("Expected ckanLogin to reject");
	} catch (err) {
		return err as CkanAuthError;
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("ckanLogin — 6-step flow", () => {
	it("mints a token and returns the resolved user across the validated CKAN flow", async () => {
		const { impl, calls } = fetchSequence([
			response(302, { setCookies: ["ckan=sess-1; Path=/; HttpOnly"] }),
			response(200, { json: { success: true, result: userDict } }),
			response(200, {
				text: '<html><head><meta name="_csrf_token" content="csrf-1" /></head></html>',
			}),
			response(200, { json: { success: true, result: { token: "jwt-1" } } }),
		]);
		vi.stubGlobal("fetch", impl);

		const result = await ckanLogin("jdoe", "secret-pass", { baseUrl: BASE });

		expect(result.token).toBe("jwt-1");
		expect(result.user.name).toBe("jdoe");
		expect(result.user.sysadmin).toBe(false);
		expect(calls).toHaveLength(4);

		// 1) web login
		expect(calls[0].url).toBe(`${BASE}/user/login`);
		expect(calls[0].init?.method).toBe("POST");
		expect(calls[0].init?.headers?.["Content-Type"]).toBe("application/x-www-form-urlencoded");
		expect(bodyOf(calls[0])).toContain("login=jdoe");
		expect(bodyOf(calls[0])).toContain("password=secret-pass");

		// 2) user_show with session cookie
		expect(calls[1].url).toBe(`${BASE}/api/3/action/user_show`);
		expect(calls[1].init?.headers?.Cookie).toBe("ckan=sess-1");

		// 3) user page for CSRF
		expect(calls[2].url).toBe(`${BASE}/user/jdoe`);
		expect(calls[2].init?.headers?.Cookie).toBe("ckan=sess-1");

		// 4) api_token_create
		expect(calls[3].url).toBe(`${BASE}/api/3/action/api_token_create`);
		expect(calls[3].init?.headers?.Cookie).toBe("ckan=sess-1");
		expect(calls[3].init?.headers?.["X-CSRFToken"]).toBe("csrf-1");
		expect(calls[3].init?.headers?.["Content-Type"]).toBe("application/json");
		expect(JSON.parse(bodyOf(calls[3]))).toEqual({ user: "jdoe", name: TOKEN_NAME });
	});

	it("uses the name resolved by user_show, not the login input", async () => {
		const { impl, calls } = fetchSequence([
			response(302, { setCookies: ["ckan=sess-1"] }),
			response(200, { json: { success: true, result: { ...userDict, name: "resolved-name" } } }),
			response(200, { text: '<meta name="_csrf_token" content="csrf-2" />' }),
			response(200, { json: { success: true, result: { token: "jwt-2" } } }),
		]);
		vi.stubGlobal("fetch", impl);

		const result = await ckanLogin("email@example.com", "secret-pass", { baseUrl: BASE });

		expect(result.user.name).toBe("resolved-name");
		expect(calls[2].url).toBe(`${BASE}/user/resolved-name`);
		expect(JSON.parse(bodyOf(calls[3]))).toEqual({ user: "resolved-name", name: TOKEN_NAME });
	});
});

describe("ckanLogin — cookie jar", () => {
	it("acumula múltiples Set-Cookie y las reenvía en cada request posterior", async () => {
		const { impl, calls } = fetchSequence([
			response(302, {
				setCookies: ["ckan=sess-1; Path=/", "auth_tkt=abc; HttpOnly"],
			}),
			response(200, { json: { success: true, result: userDict } }),
			response(200, { text: '<meta name="_csrf_token" content="csrf-1" />' }),
			response(200, { json: { success: true, result: { token: "jwt-1" } } }),
		]);
		vi.stubGlobal("fetch", impl);

		await ckanLogin("jdoe", "secret-pass", { baseUrl: BASE });

		expect(calls[1].init?.headers?.Cookie).toContain("ckan=sess-1");
		expect(calls[1].init?.headers?.Cookie).toContain("auth_tkt=abc");
		expect(calls[2].init?.headers?.Cookie).toContain("ckan=sess-1");
		expect(calls[3].init?.headers?.Cookie).toContain("auth_tkt=abc");
	});
});

describe("ckanLogin — error mapping", () => {
	it("rechaza con INVALID_CREDENTIALS cuando CKAN re-renderiza el login", async () => {
		const { impl } = fetchSequence([
			response(200, { text: "<html>Login failed. Bad username or password.</html>" }),
		]);
		vi.stubGlobal("fetch", impl);

		const err = await rejection(ckanLogin("jdoe", "wrong-pass", { baseUrl: BASE }));

		expect(err).toBeInstanceOf(CkanAuthError);
		expect(err.code).toBe("INVALID_CREDENTIALS");
		expect(err.message).toBe("Usuario o contraseña incorrectos");
	});

	it("rechaza con NETWORK_ERROR cuando fetch lanza", async () => {
		const { impl } = fetchSequence([new Error("fetch failed")]);
		vi.stubGlobal("fetch", impl);

		const err = await rejection(ckanLogin("jdoe", "secret-pass", { baseUrl: BASE }));

		expect(err.code).toBe("NETWORK_ERROR");
		expect(err.message).toBe("No se pudo conectar con CKAN.");
	});

	it("rechaza con TIMEOUT cuando fetch aborta", async () => {
		const abort = new Error("The operation was aborted.");
		abort.name = "AbortError";
		const { impl } = fetchSequence([abort]);
		vi.stubGlobal("fetch", impl);

		const err = await rejection(ckanLogin("jdoe", "secret-pass", { baseUrl: BASE }));

		expect(err.code).toBe("TIMEOUT");
	});

	it("rechaza con CSRF_UNAVAILABLE cuando la página de usuario no trae token", async () => {
		const { impl } = fetchSequence([
			response(302, { setCookies: ["ckan=sess-1"] }),
			response(200, { json: { success: true, result: userDict } }),
			response(200, { text: "<html>sin meta csrf</html>" }),
		]);
		vi.stubGlobal("fetch", impl);

		const err = await rejection(ckanLogin("jdoe", "secret-pass", { baseUrl: BASE }));

		expect(err.code).toBe("CSRF_UNAVAILABLE");
	});

	it("rechaza con TOKEN_CREATION_FAILED cuando api_token_create falla", async () => {
		const { impl } = fetchSequence([
			response(302, { setCookies: ["ckan=sess-1"] }),
			response(200, { json: { success: true, result: userDict } }),
			response(200, { text: '<meta name="_csrf_token" content="csrf-1" />' }),
			response(200, {
				json: { success: false, error: { message: "not allowed", __type: "Authorization Error" } },
			}),
		]);
		vi.stubGlobal("fetch", impl);

		const err = await rejection(ckanLogin("jdoe", "secret-pass", { baseUrl: BASE }));

		expect(err.code).toBe("TOKEN_CREATION_FAILED");
	});

	it("rechaza con USER_RESOLUTION_FAILED cuando user_show falla", async () => {
		const { impl } = fetchSequence([
			response(302, { setCookies: ["ckan=sess-1"] }),
			response(200, { json: { success: false, error: { message: "not found" } } }),
		]);
		vi.stubGlobal("fetch", impl);

		const err = await rejection(ckanLogin("jdoe", "secret-pass", { baseUrl: BASE }));

		expect(err.code).toBe("USER_RESOLUTION_FAILED");
	});
});

describe("ckanLogin — CSRF fallback", () => {
	it("ante un login 400, obtiene el formulario y reintenta con _csrf_token", async () => {
		const { impl, calls } = fetchSequence([
			response(400, { text: "<html>csrf required</html>" }),
			response(200, {
				setCookies: ["ckan=sess-2"],
				text: '<form><input type="hidden" name="_csrf_token" value="csrf-login" /></form>',
			}),
			response(302, { setCookies: ["ckan=sess-2"] }),
			response(200, { json: { success: true, result: userDict } }),
			response(200, { text: '<meta name="_csrf_token" content="csrf-1" />' }),
			response(200, { json: { success: true, result: { token: "jwt-1" } } }),
		]);
		vi.stubGlobal("fetch", impl);

		const result = await ckanLogin("jdoe", "secret-pass", { baseUrl: BASE });

		expect(result.token).toBe("jwt-1");

		// 1) login inicial → 400
		expect(calls[0].url).toBe(`${BASE}/user/login`);
		expect(calls[0].init?.method).toBe("POST");
		// 2) GET del formulario de login
		expect(calls[1].url).toBe(`${BASE}/user/login`);
		expect(calls[1].init?.method).toBe("GET");
		// 3) reintento con _csrf_token y la cookie de sesión fresca
		expect(calls[2].url).toBe(`${BASE}/user/login`);
		expect(calls[2].init?.method).toBe("POST");
		expect(bodyOf(calls[2])).toContain("_csrf_token=csrf-login");
		expect(calls[2].init?.headers?.Cookie).toBe("ckan=sess-2");
	});

	it("ante un api_token_create 400, reobtiene el CSRF de la página y reintenta una vez", async () => {
		const { impl, calls } = fetchSequence([
			response(302, { setCookies: ["ckan=sess-1"] }),
			response(200, { json: { success: true, result: userDict } }),
			response(200, { text: '<meta name="_csrf_token" content="csrf-stale" />' }),
			response(400, { text: "<html>bad csrf</html>" }),
			response(200, { text: '<meta name="_csrf_token" content="csrf-fresh" />' }),
			response(200, { json: { success: true, result: { token: "jwt-1" } } }),
		]);
		vi.stubGlobal("fetch", impl);

		const result = await ckanLogin("jdoe", "secret-pass", { baseUrl: BASE });

		expect(result.token).toBe("jwt-1");

		expect(calls[3].url).toBe(`${BASE}/api/3/action/api_token_create`);
		expect(calls[3].init?.headers?.["X-CSRFToken"]).toBe("csrf-stale");

		// fallback: re-GET de la página de usuario
		expect(calls[4].url).toBe(`${BASE}/user/jdoe`);

		// reintento con el token fresco
		expect(calls[5].url).toBe(`${BASE}/api/3/action/api_token_create`);
		expect(calls[5].init?.headers?.["X-CSRFToken"]).toBe("csrf-fresh");
	});
});
