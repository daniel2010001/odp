// API: las vistas de gráfico de un recurso (`umss_chart`) y la acción que las agrega en el DataStore.
//
// El contrato que estos métodos hablan está en `$lib/charts/contract.ts` y en
// `odd/tasks/csv-charts.md`, § «El contrato entre el portal y `ckanext-umss` (versión 1, 2026-10-17)».
// Lo que se fija acá es la forma exacta del pedido: el nombre de la acción y las claves del payload. Una
// clave mal puesta —`view_id` en vez de `id`, o la `config` anidada en vez de plana— no falla en el
// cliente: la rechaza el catálogo, o peor, guarda una vista sin configuración (L9/L10).

import { describe, expect, it, vi } from "vitest";
import type { ChartConfig, NormalizedChartConfig } from "$lib/charts/contract";
import { createChartApi } from "./charts";
import type { CkanClient } from "./client";

const CONFIG: ChartConfig = {
	version: 1,
	chart_type: "bar",
	x_field: "departamento",
	x_bucket: "value",
	y_agg: "count",
};

const NORMALIZED: NormalizedChartConfig = { ...CONFIG, x_fold_case: false, include_null: true };

const DATA = {
	version: 1,
	config: NORMALIZED,
	groups: [
		{ key: "Cochabamba", value: 12 },
		{ key: null, value: 3 },
	],
	truncated: false,
	total_rows: 15,
};

/** Cliente falso: registra la acción y el payload de cada llamada. */
function makeClient(response: unknown = {}) {
	const post = vi.fn().mockResolvedValue(response);
	return { client: { post } as unknown as CkanClient, post };
}

function callAt(post: ReturnType<typeof makeClient>["post"], index = 0) {
	const [action, payload] = post.mock.calls[index] as [string, Record<string, unknown>];
	return { action, payload };
}

describe("createChartApi.listViews", () => {
	it("pide resource_view_list con el id del recurso y sólo devuelve las vistas umss_chart", async () => {
		const { client, post } = makeClient([
			{
				id: "v1",
				resource_id: "res-1",
				view_type: "umss_chart",
				title: "Empleo por turno",
				description: "",
				// Las claves de la config vienen **al tope** del diccionario de la vista (O1, CKAN 2.12).
				version: 1,
				chart_type: "bar",
				x_field: "turno",
				x_bucket: "value",
				x_fold_case: false,
				y_agg: "sum",
				y_field: "salario",
				include_null: true,
				// Metadatos de CKAN que la config no tiene que arrastrar.
				order: 0,
				plugin: "umss_chart",
			},
			{
				id: "v2",
				resource_id: "res-1",
				view_type: "datatables_view",
				title: "Tabla",
				description: "",
				// El mismo tipo de vista nativa: aunque su `config` no viva al tope, se descarta por `view_type`.
				config: {},
			},
		]);

		const views = await createChartApi(client).listViews("res-1");

		const { action, payload } = callAt(post);
		expect(action).toBe("resource_view_list");
		expect(payload).toEqual({ id: "res-1" });
		expect(views).toEqual([
			{
				id: "v1",
				resource_id: "res-1",
				view_type: "umss_chart",
				title: "Empleo por turno",
				description: "",
				config: {
					version: 1,
					chart_type: "bar",
					x_field: "turno",
					x_bucket: "value",
					x_fold_case: false,
					y_agg: "sum",
					y_field: "salario",
					include_null: true,
				},
			},
		]);
	});

	it("convierte la config plana en un objeto tipado, sin `config` anidada ni metadatos", async () => {
		const { client } = makeClient([
			{
				id: "v1",
				resource_id: "res-1",
				view_type: "umss_chart",
				title: "T",
				description: "D",
				version: 1,
				chart_type: "line",
				x_field: "fecha",
				x_bucket: "year",
				x_fold_case: false,
				y_agg: "count",
				include_null: true,
				plugin: "umss_chart",
				order: 3,
			},
		]);

		const [view] = await createChartApi(client).listViews("res-1");

		expect(view?.config.chart_type).toBe("line");
		expect(view?.config.x_step).toBeUndefined();
		expect(view?.config).not.toHaveProperty("plugin");
		expect(view?.config).not.toHaveProperty("order");
	});
});

describe("createChartApi.getView", () => {
	it("pide resource_view_show con el id de la vista y devuelve la vista con la config tipada", async () => {
		const { client, post } = makeClient({
			id: "v1",
			resource_id: "res-1",
			view_type: "umss_chart",
			title: "T",
			description: "D",
			...CONFIG,
			plugin: "umss_chart",
		});

		const view = await createChartApi(client).getView("v1");

		const { action, payload } = callAt(post);
		expect(action).toBe("resource_view_show");
		expect(payload).toEqual({ id: "v1" });
		expect(view).toEqual({
			id: "v1",
			resource_id: "res-1",
			view_type: "umss_chart",
			title: "T",
			description: "D",
			config: CONFIG,
		});
	});

	it("una vista que no es umss_chart es null: para la página incrustable no existe", async () => {
		const { client } = makeClient({ id: "v2", view_type: "datatables_view", title: "Tabla" });

		expect(await createChartApi(client).getView("v2")).toBeNull();
	});
});

describe("createChartApi.data", () => {
	it("pide umss_chart_data con view_id (la forma del visitante)", async () => {
		const { client, post } = makeClient(DATA);

		const result = await createChartApi(client).data("v1");

		const { action, payload } = callAt(post);
		expect(action).toBe("umss_chart_data");
		expect(payload).toEqual({ view_id: "v1" });
		expect(result).toEqual(DATA);
	});
});

describe("createChartApi.preview", () => {
	it("pide umss_chart_data con resource_id y config (la forma del editor)", async () => {
		const { client, post } = makeClient(DATA);

		const result = await createChartApi(client).preview("res-1", CONFIG);

		const { action, payload } = callAt(post);
		expect(action).toBe("umss_chart_data");
		expect(payload).toEqual({ resource_id: "res-1", config: CONFIG });
		expect(result.groups).toEqual(DATA.groups);
	});
});

describe("createChartApi.createView", () => {
	it("pide resource_view_create con el view_type y la config plana al tope del payload", async () => {
		const { client, post } = makeClient({
			id: "v1",
			resource_id: "res-1",
			view_type: "umss_chart",
			title: "Empleo por turno",
			description: "Descripción",
			...CONFIG,
		});

		const view = await createChartApi(client).createView(
			"res-1",
			"Empleo por turno",
			"Descripción",
			CONFIG,
		);

		const { action, payload } = callAt(post);
		expect(action).toBe("resource_view_create");
		// La config va **plana**: CKAN sólo guarda en `config` lo que el `schema` del plugin declara, y eso
		// es lo que el plugin lee del payload de la acción.
		expect(payload).toEqual({
			resource_id: "res-1",
			title: "Empleo por turno",
			description: "Descripción",
			view_type: "umss_chart",
			version: 1,
			chart_type: "bar",
			x_field: "departamento",
			x_bucket: "value",
			y_agg: "count",
		});
		expect(payload).not.toHaveProperty("config");
		// Y la respuesta, que también llega plana, se devuelve tipada como el resto.
		expect(view.id).toBe("v1");
		expect(view.config.chart_type).toBe("bar");
	});
});

describe("createChartApi.updateView", () => {
	it("pide resource_view_update con el id de la vista y la config plana", async () => {
		const { client, post } = makeClient({
			id: "v1",
			resource_id: "res-1",
			view_type: "umss_chart",
			title: "Otro título",
			description: "Otra descripción",
			...CONFIG,
		});

		const view = await createChartApi(client).updateView("v1", {
			title: "Otro título",
			description: "Otra descripción",
			config: CONFIG,
		});

		const { action, payload } = callAt(post);
		expect(action).toBe("resource_view_update");
		expect(payload).toEqual({
			id: "v1",
			title: "Otro título",
			description: "Otra descripción",
			version: 1,
			chart_type: "bar",
			x_field: "departamento",
			x_bucket: "value",
			y_agg: "count",
		});
		expect(view.config.x_field).toBe("departamento");
	});
});

describe("createChartApi.deleteView", () => {
	it("pide resource_view_delete con el id de la vista", async () => {
		const { client, post } = makeClient();

		await createChartApi(client).deleteView("v1");

		const { action, payload } = callAt(post);
		expect(action).toBe("resource_view_delete");
		expect(payload).toEqual({ id: "v1" });
	});
});

describe("createChartApi — errores", () => {
	it("propaga el error de CKAN sin tragárselo", async () => {
		const post = vi.fn().mockRejectedValue(new Error("NotAuthorized"));

		await expect(createChartApi({ post } as unknown as CkanClient).data("v1")).rejects.toThrow(
			"NotAuthorized",
		);
	});

	it("un recurso sin tabla en el DataStore llega como ObjectNotFound, no se disfraza", async () => {
		// La acción responde `ObjectNotFound` igual que `datastore_search`; el portal no lo convierte en
		// «no hay gráficos»: son dos mensajes distintos para el visitante y para el publicador.
		const error = Object.assign(new Error("No encontrado"), { type: "ObjectNotFound" });
		const post = vi.fn().mockRejectedValue(error);

		await expect(
			createChartApi({ post } as unknown as CkanClient).preview("res-sin-tabla", CONFIG),
		).rejects.toBe(error);
	});
});
