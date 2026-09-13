import { describe, expect, it, vi } from "vitest";
import type { CkanClient } from "./client";
import { createDatasetApi } from "./datasets";

function makeClient() {
	const post = vi.fn().mockResolvedValue({ count: 0, sort: "", results: [], search_facets: {} });
	return {
		client: { post } as unknown as CkanClient,
		post,
	};
}

describe("createDatasetApi", () => {
	it("search construye los params por defecto", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.search();

		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("package_search");
		expect(params.q).toBe("*:*");
		expect(params.rows).toBe(20);
		expect(params.start).toBe(0);
		expect(params.sort).toBe("metadata_modified desc");
		expect(params["facet.field"]).toEqual(["organization", "tags", "res_format", "license_id"]);
	});

	it("search usa los params proporcionados", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.search({ q: "salud", limit: 10, sort: "title asc", facet_field: ["tags"] });

		const [, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(params.q).toBe("salud");
		expect(params.rows).toBe(10);
		expect(params.sort).toBe("title asc");
		expect(params["facet.field"]).toEqual(["tags"]);
	});

	it("byOrganization llama a package_search con fq organization:<orgId>", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.byOrganization("org-123");

		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("package_search");
		expect(params.fq).toBe("organization:org-123");
	});

	it("tagSuggestions devuelve los nombres de las tags en orden de faceta", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({
			count: 0,
			sort: "",
			results: [],
			search_facets: {
				tags: {
					title: "Tags",
					items: [
						{ name: "salud", display_name: "salud", count: 5 },
						{ name: "educacion", display_name: "educacion", count: 3 },
					],
				},
			},
		});

		const api = createDatasetApi(client);
		const tags = await api.tagSuggestions(50);

		expect(tags).toEqual(["salud", "educacion"]);

		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("package_search");
		expect(params.rows).toBe(0);
		expect(params["facet.field"]).toEqual(["tags"]);
		expect(params["facet.limit"]).toBe(50);
	});

	it("tagSuggestions devuelve [] si la faceta no viene", async () => {
		const { client } = makeClient();
		const api = createDatasetApi(client);

		const tags = await api.tagSuggestions();

		expect(tags).toEqual([]);
	});

	it("tagSuggestions degrada a [] si la llamada falla", async () => {
		const { client, post } = makeClient();
		post.mockRejectedValueOnce(new Error("ckan caído"));
		const api = createDatasetApi(client);

		const tags = await api.tagSuggestions();

		expect(tags).toEqual([]);
	});

	it("byOrganization combina un fq existente con AND", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.byOrganization("org-123", { fq: "tags:salud" });

		const [, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(params.fq).toBe("tags:salud AND organization:org-123");
	});
});
