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

/**
 * Encola una respuesta por llamada. La sonda hace hasta dos: `user_show` y, sólo
 * tras el 404, la corroboración pública `status_show`. Un elemento `Error` simula
 * un fallo de red en esa llamada.
 */
function stubSequence(responses: Array<{ status: number; body: unknown } | Error>) {
	const pending = [...responses];
	const fetchMock = vi.fn(async (_url: string, _init?: FetchInit) => {
		const next = pending.shift();
		if (next === undefined) throw new Error("stubSequence agotada: llamada inesperada");
		if (next instanceof Error) throw next;
		return {
			ok: next.status >= 200 && next.status < 300,
			status: next.status,
			json: async () => next.body,
		};
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
	it("informa `alive` con el usuario que devuelve CKAN cuando el token vive, en una sola llamada", async () => {
		const fetchMock = stubResponse(200, { success: true, result: CALLER });

		await expect(makeApi().check()).resolves.toEqual({ state: "alive", user: CALLER });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("pregunta por el propio usuario, sin `id`: `user_show {id}` responde 200 a un anónimo", async () => {
		const fetchMock = stubResponse(200, { success: true, result: CALLER });

		await makeApi().check();

		const [url, init] = fetchMock.mock.calls[0] as [string, FetchInit];
		expect(url).toBe("https://ckan.test/api/3/action/user_show");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body ?? "{}")).toEqual({});
	});

	it("informa `dead` ante el 404 `Not Found Error` si `status_show` corrobora que CKAN responde", async () => {
		const fetchMock = stubSequence([
			{ status: 404, body: NOT_FOUND_BODY },
			{ status: 200, body: { success: true, result: { ckan_version: "2.10" } } },
		]);

		await expect(makeApi().check()).resolves.toEqual({ state: "dead" });

		const [url, init] = fetchMock.mock.calls[1] as [string, FetchInit];
		expect(url).toBe("https://ckan.test/api/3/action/status_show");
		expect(init.method).toBe("POST");
	});

	it("informa `dead` ante un 404 sin cuerpo de CKAN si la corroboración pública responde", async () => {
		stubSequence([
			{ status: 404, body: {} },
			{ status: 200, body: { success: true, result: {} } },
		]);

		await expect(makeApi().check()).resolves.toEqual({ state: "dead" });
	});

	it("informa `inconclusive` y conserva la sesión si el 404 también tumba la lectura pública (despliegue roto)", async () => {
		stubSequence([
			{ status: 404, body: NOT_FOUND_BODY },
			{
				status: 404,
				body: { success: false, error: { __type: "Not Found Error", message: "Not found" } },
			},
		]);

		const result = await makeApi().check();

		expect(result.state).toBe("inconclusive");
		if (result.state !== "inconclusive") throw new Error("estado inesperado");
		expect(result.error.status).toBe(404);
	});

	it("informa `inconclusive` si la corroboración pública falla a nivel de red", async () => {
		stubSequence([{ status: 404, body: NOT_FOUND_BODY }, new TypeError("Failed to fetch")]);

		const result = await makeApi().check();

		expect(result.state).toBe("inconclusive");
		if (result.state !== "inconclusive") throw new Error("estado inesperado");
		expect(result.error.status).toBe(404);
	});

	it("informa `inconclusive` ante un 500 de CKAN: un hipo del servidor no expulsa al usuario", async () => {
		const fetchMock = stubResponse(500, { success: false, error: { message: "Server Error" } });

		const result = await makeApi().check();

		expect(result.state).toBe("inconclusive");
		if (result.state !== "inconclusive") throw new Error("estado inesperado");
		expect(result.error.status).toBe(500);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("informa `inconclusive` ante un 403: sólo el 404 medido cierra la sesión", async () => {
		const fetchMock = stubResponse(403, { success: false, error: { message: "Access denied" } });

		await expect(makeApi().check()).resolves.toMatchObject({ state: "inconclusive" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("informa `inconclusive` ante un timeout del cliente", async () => {
		const fetchMock = stubRejection(new DOMException("aborted", "AbortError"));

		const result = await makeApi().check();

		expect(result.state).toBe("inconclusive");
		if (result.state !== "inconclusive") throw new Error("estado inesperado");
		expect(result.error.status).toBe(408);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("informa `inconclusive` cuando la red falla", async () => {
		const fetchMock = stubRejection(new TypeError("Failed to fetch"));

		const result = await makeApi().check();

		expect(result.state).toBe("inconclusive");
		if (result.state !== "inconclusive") throw new Error("estado inesperado");
		expect(result.error.status).toBe(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
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
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
