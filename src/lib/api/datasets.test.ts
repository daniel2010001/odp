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

	it("search propaga include_private cuando se pide", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.search({ include_private: true });

		const [, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(params.include_private).toBe(true);
	});

	// --- «Mis datasets» — contrato medido el 2026-09-17 -------------------------
	//
	// `current_package_list_with_resources` fija `include_private = is_sysadmin(user)`
	// (`ckan/logic/action/get.py:143`), así que un no-sysadmin no ve NUNCA un privado — ni el
	// propio. Espejamos la condición del dashboard de CKAN (`user_show` con `include_datasets`):
	// `fq=+creator_user_id:<id>` + `include_private`, con `rows`/`start` y un `sort` fijo.

	it("currentUser filtra por creador con la cláusula requerida de CKAN", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.currentUser("user-uuid");

		const [, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(params.fq).toBe("+creator_user_id:user-uuid");
	});

	it("currentUser incluye los privados del propio usuario", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.currentUser("user-uuid");

		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("package_search");
		expect(params.include_private).toBe(true);
	});

	it("currentUser no usa la acción que ignora los permisos", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.currentUser("user-uuid");

		const actions = post.mock.calls.map(([action]) => action);
		expect(actions).not.toContain("current_package_list_with_resources");
	});

	it("currentUser pagina explícitamente, con un sort fijo", async () => {
		const { client, post } = makeClient();
		const api = createDatasetApi(client);

		await api.currentUser("user-uuid", { limit: 5, offset: 10 });

		const [, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(params.rows).toBe(5);
		expect(params.start).toBe(10);
		// Sin `sort` fijo la paginación no es estable: medido, `start=0` y `start=2`
		// devolvieron conjuntos disjuntos y fuera del orden de creación. El valor exacto importa:
		// un `sort` no-vacío pero distinto reordena las páginas y deja el `start` apuntando a otro
		// conjunto, así que la aserción tiene que fijar el orden, no su sola presencia.
		expect(params.sort).toBe("metadata_modified desc");
	});

	it("currentUser devuelve el total, para poder paginar con honestidad", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({
			count: 42,
			sort: "metadata_modified desc",
			results: [{ name: "ds-1" }],
			search_facets: {},
		});
		const api = createDatasetApi(client);

		const result = await api.currentUser("user-uuid");

		// Falsable: la forma del pedido. El total solo es honesto si la llamada pidió una página
		// explícita; si no se manda `rows`, CKAN cae en su default de 10 y el conteo describe algo
		// que nunca se pidió. Los valores son los defaults de `search`: una página de 20 desde 0.
		// Estas dos aserciones son las que sostienen la prueba; no se pueden borrar.
		const [, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(params.rows).toBe(20);
		expect(params.start).toBe(0);

		// Documental: `count` y `results` solo espejan lo que devolvió el mock. Pasan igual con una
		// implementación que reenvía la respuesta sin mapearla, así que no prueban nada por sí
		// solas: leerlas sin las aserciones de arriba deja una prueba hueca.
		expect(result.count).toBe(42);
		expect(result.results).toHaveLength(1);
	});
});
