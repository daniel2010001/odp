import { afterEach, describe, expect, it, vi } from "vitest";
import { createCkanClient } from "./client";

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
