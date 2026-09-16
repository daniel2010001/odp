import { describe, expect, it, vi } from "vitest";
import { CkanApiError } from "$lib/types/api";
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

describe("createDatasetApi.publish", () => {
	it("llama a package_patch con exactamente {id, private: false}", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({ id: "pkg-1", private: false });
		const api = createDatasetApi(client);

		await api.publish("pkg-1");

		expect(post).toHaveBeenCalledTimes(1);
		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("package_patch");
		// La igualdad es estricta a propósito: una clave extra (p. ej. `state`) haría fallar esta prueba.
		expect(params).toEqual({ id: "pkg-1", private: false });
	});

	it("no envía `state` ni una acción propia de la extensión", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({ id: "pkg-1", private: false });
		const api = createDatasetApi(client);

		await api.publish("pkg-1");

		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(params).not.toHaveProperty("state");
		expect(Object.keys(params)).toEqual(["id", "private"]);
		// Ninguna acción inventada por el portal o por `ckanext-umss`: el permiso lo decide
		// la autorización de CKAN sobre `package_update`, no un transporte nuevo.
		expect(action).not.toMatch(/publish|umss/i);
	});

	it("devuelve la respuesta de CKAN sin asumir el resultado", async () => {
		const { client, post } = makeClient();
		// CKAN puede contestar 200 sin haber concedido la publicación; la API no lo corrige.
		const respuesta = { id: "pkg-1", name: "dataset-privado", private: true };
		post.mockResolvedValueOnce(respuesta);
		const api = createDatasetApi(client);

		const resultado = await api.publish("pkg-1");

		expect(resultado).toEqual(respuesta);
		expect(resultado.private).toBe(true);
	});

	it("propaga el 403 del catálogo en vez de tragárselo", async () => {
		const { client, post } = makeClient();
		post.mockRejectedValueOnce(
			new CkanApiError("Solo un administrador…", 403, "Authorization Error"),
		);
		const api = createDatasetApi(client);

		await expect(api.publish("pkg-1")).rejects.toBeInstanceOf(CkanApiError);
	});

	it("el helper muerto setState ya no existe", () => {
		const { client } = makeClient();
		const api = createDatasetApi(client) as Record<string, unknown>;

		// `package_patch {state}` es justo lo que la regla nueva de CKAN rechaza para quien no es
		// aprobador: dejarlo sería una trampa para el próximo que lo encuentre.
		expect(api.setState).toBeUndefined();
	});
});
