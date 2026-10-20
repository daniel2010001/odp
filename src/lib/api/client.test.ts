import { afterEach, describe, expect, it, vi } from "vitest";
import { CkanApiError } from "$lib/types/api";
import { createCkanClient, createPortalClient } from "./client";

type FetchInit = { headers?: Record<string, string>; method?: string; body?: string };

function stubFetch() {
	const fetchMock = vi.fn(async (_url: string, _init?: FetchInit) => ({
		ok: true,
		status: 200,
		json: async () => ({ success: true, result: { ok: true } }),
	}));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function requestHeaders(
	fetchMock: ReturnType<typeof stubFetch>,
	callIndex = 0,
): Record<string, string> {
	const init = fetchMock.mock.calls[callIndex]?.[1];
	return init?.headers ?? {};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

// Cuerpo medido VERBATIM contra CKAN 2.12.0 el 2026-10-03 (compare-and-set de
// `package_revise`). Se reproduce tal cual para que el test no dependa de una paráfrasis.
const REVISE_409_MATCH_BODY = {
	help: "https://api.odp.hs.lan/api/3/action/help_show?name=package_revise",
	error: { match: ["metadata_modified"], __type: "Validation Error" },
	success: false,
};

function stubResponse(status: number, body: unknown) {
	const fetchMock = vi.fn(async () => ({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	}));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

describe("createCkanClient — payload de error", () => {
	it("preserva el json.error crudo del 409 de package_revise", async () => {
		const client = createCkanClient({ baseUrl: "https://ckan.test" });
		stubResponse(409, REVISE_409_MATCH_BODY);

		const error = await client.post("package_revise", {}).catch((err: unknown) => err);

		expect(error).toBeInstanceOf(CkanApiError);
		const apiError = error as CkanApiError;
		expect(apiError.status).toBe(409);
		expect(apiError.ckanType).toBe("Validation Error");
		// El objeto entero, verbatim: no una copia de claves elegidas a mano.
		expect(apiError.payload).toEqual(REVISE_409_MATCH_BODY.error);
		expect(apiError.payload?.match).toEqual(["metadata_modified"]);
		expect(apiError.payload).not.toHaveProperty("message");
	});
});

describe("createCkanClient — apiKey lazy", () => {
	it("resuelve el getter de apiKey en cada request", async () => {
		let token: string | null = "token-1";
		const client = createCkanClient({
			baseUrl: "https://ckan.test",
			apiKey: () => token,
		});
		const fetchMock = stubFetch();

		await client.get("package_search");
		expect(requestHeaders(fetchMock).Authorization).toBe("token-1");

		token = "token-2";
		await client.get("package_search");
		expect(requestHeaders(fetchMock, 1).Authorization).toBe("token-2");
	});

	it("no agrega Authorization cuando el getter devuelve null", async () => {
		const client = createCkanClient({
			baseUrl: "https://ckan.test",
			apiKey: () => null,
		});
		const fetchMock = stubFetch();

		await client.get("package_search");

		expect(requestHeaders(fetchMock).Authorization).toBeUndefined();
	});

	it("mantiene compatibilidad con apiKey como string", async () => {
		const client = createCkanClient({
			baseUrl: "https://ckan.test",
			apiKey: "static-token",
		});
		const fetchMock = stubFetch();

		await client.get("package_search");

		expect(requestHeaders(fetchMock).Authorization).toBe("static-token");
	});
});

describe("createCkanClient — los parámetros de un GET viajan en la query", () => {
	function urlOf(fetchMock: ReturnType<typeof stubFetch>): URL {
		return new URL(String(fetchMock.mock.calls[0]?.[0]));
	}

	it("manda los parámetros en la query y no manda cuerpo", async () => {
		const client = createCkanClient({ baseUrl: "https://ckan.test" });
		const fetchMock = stubFetch();

		await client.get("publication_request_list", { status: "pending", limit: 5 });

		const url = urlOf(fetchMock);
		expect(url.origin + url.pathname).toBe(
			"https://ckan.test/api/3/action/publication_request_list",
		);
		expect(url.searchParams.get("status")).toBe("pending");
		expect(url.searchParams.get("limit")).toBe("5");
		expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined();
	});

	it("un objeto viaja como JSON y un `undefined` se omite", async () => {
		const client = createCkanClient({ baseUrl: "https://ckan.test" });
		const fetchMock = stubFetch();

		await client.get("organization_list", { filtro: { a: [1, 2] }, omitido: undefined });

		const url = urlOf(fetchMock);
		expect(url.searchParams.get("filtro")).toBe('{"a":[1,2]}');
		expect(url.searchParams.has("omitido")).toBe(false);
	});

	it("sin parámetros la URL queda sin query", async () => {
		const client = createCkanClient({ baseUrl: "https://ckan.test" });
		const fetchMock = stubFetch();

		await client.get("package_search");

		expect(fetchMock.mock.calls[0]?.[0]).toBe("https://ckan.test/api/3/action/package_search");
	});

	it("un POST sigue mandando el cuerpo JSON y nada en la query", async () => {
		const client = createCkanClient({ baseUrl: "https://ckan.test" });
		const fetchMock = stubFetch();

		await client.post("package_search", { q: "agua" });

		expect(fetchMock.mock.calls[0]?.[0]).toBe("https://ckan.test/api/3/action/package_search");
		expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"q":"agua"}');
	});
});

describe("createPortalClient — el cliente que habla con el puente del portal", () => {
	it("pide a /catalog/<acción> del mismo origen", async () => {
		const client = createPortalClient();
		const fetchMock = stubFetch();

		await client.post("package_show", { id: "x" });

		expect(fetchMock.mock.calls[0]?.[0]).toBe("/catalog/package_show");
		expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
		expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"id":"x"}');
	});

	it("nunca manda Authorization: la credencial la pone el servidor", async () => {
		const client = createPortalClient();
		const fetchMock = stubFetch();

		await client.get("package_search");
		await client.post("package_show", { id: "x" });

		expect(requestHeaders(fetchMock, 0).Authorization).toBeUndefined();
		expect(requestHeaders(fetchMock, 1).Authorization).toBeUndefined();
	});

	it("un GET manda sus parámetros en la query del puente", async () => {
		const client = createPortalClient();
		const fetchMock = stubFetch();

		await client.get("publication_request_list", { status: "pending" });

		expect(fetchMock.mock.calls[0]?.[0]).toBe("/catalog/publication_request_list?status=pending");
	});

	it("no tiene opción `apiKey`: el tipo la rechaza", () => {
		// @ts-expect-error — el cliente del portal no admite credencial del lado del navegador.
		createPortalClient({ apiKey: "x" });
	});

	it("traduce los errores igual que el cliente de CKAN", async () => {
		const client = createPortalClient();
		stubResponse(401, { error: "La sesión del portal no está activa." });

		const error = await client.post("user_show", {}).catch((err: unknown) => err);

		expect(error).toBeInstanceOf(CkanApiError);
		expect((error as CkanApiError).status).toBe(401);
	});
});

// Una respuesta cuyo cuerpo no es JSON (p. ej. el HTML de un 502 del proxy con el catálogo caído):
// `json()` rechaza con el mensaje del intérprete, que no debe llegar al usuario.
function stubNonJson(status: number) {
	const parserMessage = "JSON.parse: unexpected character at line 1 column 1 of the JSON data";
	const fetchMock = vi.fn(async () => ({
		ok: status >= 200 && status < 300,
		status,
		json: async () => {
			throw new SyntaxError(parserMessage);
		},
	}));
	vi.stubGlobal("fetch", fetchMock);
	return parserMessage;
}

describe("createCkanClient — cuerpo que no es JSON", () => {
	it("un 502 con HTML conserva el status y no filtra el mensaje del intérprete", async () => {
		const parserMessage = stubNonJson(502);
		const client = createCkanClient({ baseUrl: "https://ckan.test" });

		const error = await client.post("package_search").catch((e: unknown) => e);

		expect(error).toBeInstanceOf(CkanApiError);
		expect((error as CkanApiError).status).toBe(502);
		expect((error as CkanApiError).message).toBe(
			"No se pudo completar la consulta al catálogo de datos.",
		);
		expect((error as CkanApiError).message).not.toContain(parserMessage);
	});

	it("un 200 que no es JSON tampoco muestra el mensaje del intérprete", async () => {
		const parserMessage = stubNonJson(200);
		const client = createPortalClient();

		const error = await client.get("organization_list_for_user").catch((e: unknown) => e);

		expect(error).toBeInstanceOf(CkanApiError);
		expect((error as CkanApiError).message).toBe(
			"No se pudo completar la consulta al catálogo de datos.",
		);
		expect((error as CkanApiError).message).not.toContain(parserMessage);
		// Sin respuesta utilizable no hay estado que citar: se clasifica como transporte.
		expect((error as CkanApiError).status).toBe(0);
	});

	it("una respuesta JSON válida se sigue leyendo como antes", async () => {
		stubResponse(200, { success: true, result: { id: "abc" } });
		const client = createCkanClient({ baseUrl: "https://ckan.test" });

		await expect(client.post("package_show")).resolves.toEqual({ id: "abc" });
	});

	it("un error JSON de CKAN conserva su mensaje y su status", async () => {
		stubResponse(404, {
			success: false,
			error: { message: "Not found", __type: "Not Found Error" },
		});
		const client = createCkanClient({ baseUrl: "https://ckan.test" });

		const error = await client.post("package_show").catch((e: unknown) => e);

		expect((error as CkanApiError).status).toBe(404);
		expect((error as CkanApiError).message).toBe("Not found");
	});
});
