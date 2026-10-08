import { describe, expect, it, vi } from "vitest";
import { CkanApiError } from "$lib/types/api";
import type { CkanClient } from "./client";
import { createDatasetApi, isEditConflict, MalformedReviseResponseError } from "./datasets";

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

	// --- El `title` del dataset, normalizado en el borde (medido 2026-10-08) ---------
	//
	// CKAN **acepta y persiste** un `title` que no es texto: medido contra la 2.12.0,
	// `package_patch {title: {"x": 1}}` responde `200` y guarda el diccionario, y la ficha del
	// dataset pinta `[object Object]` en su `<h1>` (medido en jsdom con un `package_show`
	// simulado). El tipo `CkanPackage.title` dice `string`, así que la mentira está en el borde.

	it("show cae al `name` si CKAN devuelve un `title` que no es texto", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({ id: "ds-1", name: "matricula-2026", title: { x: 1 } });
		const api = createDatasetApi(client);

		const result = await api.show("ds-1");

		expect(result.title).toBe("matricula-2026");
	});

	it("show conserva un `title` que sí es texto", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({ id: "ds-1", name: "matricula-2026", title: "Matrícula 2026" });
		const api = createDatasetApi(client);

		const result = await api.show("ds-1");

		expect(result.title).toBe("Matrícula 2026");
	});

	it("show cae al `name` cuando el `title` viene vacío", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({ id: "ds-1", name: "matricula-2026", title: "" });
		const api = createDatasetApi(client);

		const result = await api.show("ds-1");

		expect(result.title).toBe("matricula-2026");
	});

	it("show cae al literal `Dataset` cuando ni el `title` ni el `name` sirven", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({ id: "ds-1", name: "", title: { x: 1 } });
		const api = createDatasetApi(client);

		const result = await api.show("ds-1");

		expect(result.title).toBe("Dataset");
	});

	it("show sólo toca `title`: el resto del paquete pasa intacto", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({
			id: "ds-1",
			name: "matricula-2026",
			title: { x: 1 },
			private: true,
		});
		const api = createDatasetApi(client);

		const result = await api.show("ds-1");

		expect(result).toMatchObject({ id: "ds-1", name: "matricula-2026", private: true });
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

	// --- Edición parcial: `package_revise` (slice 1b-A) ---------------------------
	//
	// La edición NO puede usar `package_update` (borra todo campo ausente) ni `package_patch`
	// (su firma plana descarta `metadata_modified` y no puede expresar la precondición de
	// concurrencia). El wrapper sólo reenvía el `match` y el `update` que armó el builder.

	it("revise postea package_revise con el match, el filter y el update que recibe", async () => {
		const { client, post } = makeClient();
		// Medido en CKAN 2.12.0: el cliente entrega `result`, que es el sobre `{ package }`.
		post.mockResolvedValueOnce({
			package: { id: "ds-1", name: "ds-1", metadata_modified: "2026-10-02T08:00:00.000000" },
		});
		const api = createDatasetApi(client);

		const match = { id: "ds-1", metadata_modified: "2026-10-01T09:30:00.000000" };
		const filter = ["-extras", "-tags"];
		const update = {
			title: "Nuevo título",
			extras: [{ key: "summary", value: "Resumen editado" }],
			tags: [],
		};

		const result = await api.revise({ match, filter, update });

		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("package_revise");
		// El cuerpo lleva las TRES piezas: `filter` es lo que hace que CKAN instale la lista de
		// extras verbatim (sin él, `update.extras` se mezclaría por índice).
		expect(params).toEqual({ match, filter, update });
		expect(result.name).toBe("ds-1");
		expect(result.metadata_modified).toBe("2026-10-02T08:00:00.000000");
	});

	it("revise no usa las acciones que borran o no pueden afirmar el estado", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({ package: { id: "ds-1", name: "ds-1" } });
		const api = createDatasetApi(client);

		await api.revise({
			match: { id: "ds-1" },
			filter: ["-extras"],
			update: { title: "Nuevo título" },
		});

		const actions = post.mock.calls.map(([action]) => action);
		expect(actions).toEqual(["package_revise"]);
		expect(actions).not.toContain("package_update");
		expect(actions).not.toContain("package_patch");
	});

	it("revise falla con un error nombrado si el sobre no trae un paquete", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValueOnce({ help: "..." });
		const api = createDatasetApi(client);

		const error = await api
			.revise({ match: { id: "ds-1" }, filter: ["-extras"], update: { title: "x" } })
			.catch((err: unknown) => err);

		expect(error).toBeInstanceOf(MalformedReviseResponseError);
		expect((error as Error).name).toBe("MalformedReviseResponseError");
	});

	// --- Conflicto de compare-and-set: `isEditConflict` ---------------------------
	//
	// Los tres cuerpos de abajo son los medidos VERBATIM contra CKAN 2.12.0 el 2026-10-03.
	// El conflicto y el error genérico de esquema comparten status 409 **y** `__type`
	// "Validation Error": sólo el `error.match` los distingue. El conflicto medido no traía
	// `error.message`, pero eso se observa y no se exige: requerirlo convertiría un conflicto
	// con prosa en un fallo genérico. Por eso el payload crudo tiene que sobrevivir al throw.

	const REVISE_409_MATCH = {
		help: "https://api.odp.hs.lan/api/3/action/help_show?name=package_revise",
		error: { match: ["metadata_modified"], __type: "Validation Error" },
		success: false,
	};

	const REVISE_409_SCHEMA = {
		error: { update: ["Expected list for extras"], __type: "Validation Error" },
		success: false,
	};

	const REVISE_404 = {
		help: "https://api.odp.hs.lan/api/3/action/help_show?name=package_revise",
		error: { __type: "Not Found Error", message: "Not found" },
		success: false,
	};

	describe("isEditConflict", () => {
		it("reconoce el conflicto de compare-and-set medido", () => {
			const error = new CkanApiError("HTTP 409", 409, "Validation Error", REVISE_409_MATCH.error);

			expect(isEditConflict(error)).toBe(true);
		});

		it("no confunde el error de esquema, que comparte 409 y __type", () => {
			const error = new CkanApiError("HTTP 409", 409, "Validation Error", REVISE_409_SCHEMA.error);

			expect(isEditConflict(error)).toBe(false);
		});

		it("no confunde el 404 por id inexistente", () => {
			const error = new CkanApiError("Not found", 404, "Not Found Error", REVISE_404.error);

			expect(isEditConflict(error)).toBe(false);
		});

		it("exige metadata_modified, no cualquier match", () => {
			const error = new CkanApiError("HTTP 409", 409, "Validation Error", {
				match: ["name"],
				__type: "Validation Error",
			});

			expect(isEditConflict(error)).toBe(false);
		});

		it("con prosa en el payload sigue siendo conflicto: la ausencia de message era una observación, no un requisito", () => {
			const error = new CkanApiError("Conflict", 409, "Validation Error", {
				match: ["metadata_modified"],
				message: "Conflict",
				__type: "Validation Error",
			});

			expect(isEditConflict(error)).toBe(true);
		});

		it("devuelve false sin payload preservado, aunque el 409 y el tipo coincidan", () => {
			const error = new CkanApiError("HTTP 409", 409, "Validation Error");

			expect(isEditConflict(error)).toBe(false);
		});

		it.each([
			["un Error genérico", new Error("boom")],
			["null", null],
			["undefined", undefined],
		])("devuelve false para %s", (_label, value) => {
			expect(isEditConflict(value)).toBe(false);
		});
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
