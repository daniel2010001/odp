import { afterEach, describe, expect, it, vi } from "vitest";
import type { CkanUser } from "$lib/types/ckan";
import { createCkanClient } from "./client";
import { createSessionApi } from "./session";

type FetchInit = { headers?: Record<string, string>; method?: string; body?: string };

function stubResponse(status: number, body: unknown) {
	const fetchMock = vi.fn(async (_url: string, _init?: FetchInit) => ({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	}));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function stubRejection(error: Error) {
	const fetchMock = vi.fn(async () => {
		throw error;
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const CALLER: CkanUser = {
	id: "99e165c0-b59d-47c5-a6b2-4d3992882dfd",
	name: "editor",
	display_name: "Editor",
	created: "2026-09-20T02:00:00",
	state: "active",
};

/** La respuesta que CKAN da a un token muerto: medido, 404 con `Not Found Error`. */
const NOT_FOUND_BODY = {
	success: false,
	error: { __type: "Not Found Error", message: "Not found" },
};

function makeApi() {
	return createSessionApi(
		createCkanClient({ baseUrl: "https://ckan.test", apiKey: () => "token-vivo" }),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createSessionApi — la sonda de sesión", () => {
	it("informa `alive` con el usuario que devuelve CKAN cuando el token vive", async () => {
		stubResponse(200, { success: true, result: CALLER });

		await expect(makeApi().check()).resolves.toEqual({ state: "alive", user: CALLER });
	});

	it("pregunta por el propio usuario, sin `id`: `user_show {id}` responde 200 a un anónimo", async () => {
		const fetchMock = stubResponse(200, { success: true, result: CALLER });

		await makeApi().check();

		const [url, init] = fetchMock.mock.calls[0] as [string, FetchInit];
		expect(url).toBe("https://ckan.test/api/3/action/user_show");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body ?? "{}")).toEqual({});
	});

	it("informa `dead` ante el 404 `Not Found Error` que CKAN da a un token muerto", async () => {
		stubResponse(404, NOT_FOUND_BODY);

		await expect(makeApi().check()).resolves.toEqual({ state: "dead" });
	});

	it("informa `dead` ante un 404 sin cuerpo de CKAN: en `user_show {}` no hay recurso que falte", async () => {
		stubResponse(404, {});

		await expect(makeApi().check()).resolves.toEqual({ state: "dead" });
	});

	it("informa `inconclusive` ante un 500 de CKAN: un hipo del servidor no expulsa al usuario", async () => {
		stubResponse(500, { success: false, error: { message: "Server Error" } });

		const result = await makeApi().check();

		expect(result.state).toBe("inconclusive");
		if (result.state !== "inconclusive") throw new Error("estado inesperado");
		expect(result.error.status).toBe(500);
	});

	it("informa `inconclusive` ante un 403: sólo el 404 medido cierra la sesión", async () => {
		stubResponse(403, { success: false, error: { message: "Access denied" } });

		await expect(makeApi().check()).resolves.toMatchObject({ state: "inconclusive" });
	});

	it("informa `inconclusive` ante un timeout del cliente", async () => {
		stubRejection(new DOMException("aborted", "AbortError"));

		const result = await makeApi().check();

		expect(result.state).toBe("inconclusive");
		if (result.state !== "inconclusive") throw new Error("estado inesperado");
		expect(result.error.status).toBe(408);
	});

	it("informa `inconclusive` cuando la red falla", async () => {
		stubRejection(new TypeError("Failed to fetch"));

		const result = await makeApi().check();

		expect(result.state).toBe("inconclusive");
		if (result.state !== "inconclusive") throw new Error("estado inesperado");
		expect(result.error.status).toBe(0);
	});

	it("informa `inconclusive` cuando la respuesta no es JSON (proxy, HTML de error)", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: false,
			status: 502,
			json: async () => {
				throw new SyntaxError("Unexpected token <");
			},
		}));
		vi.stubGlobal("fetch", fetchMock);

		await expect(makeApi().check()).resolves.toMatchObject({ state: "inconclusive" });
	});
});
