// Los gráficos en la página del recurso (S1, P3): lo que ve el visitante, lo que ve quien puede editar, y el
// borrado con confirmación. El servidor es un doble del cliente de la API (`createChartApi`).

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartApi, ChartView } from "$lib/api/charts";
import type { ChartData, NormalizedChartConfig } from "$lib/charts/contract";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import ResourceCharts from "./ResourceCharts.svelte";

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const CONFIG: NormalizedChartConfig = {
	version: 1,
	chart_type: "bar",
	x_field: "turno",
	x_bucket: "value",
	x_fold_case: false,
	y_agg: "avg",
	y_field: "salario",
	include_null: true,
};

function makeView(overrides: Partial<ChartView> = {}): ChartView {
	return {
		id: "view-1",
		resource_id: "res-1",
		view_type: "umss_chart",
		title: "Salario por turno",
		description: "Promedio mensual del salario.",
		config: { ...CONFIG },
		...overrides,
	};
}

const DATA: ChartData = {
	version: 1,
	config: CONFIG,
	groups: [
		{ key: "mañana", value: 8496.754044 },
		{ key: "noche", value: 3986.38 },
	],
	truncated: false,
	total_rows: 2500,
};

type Api = Pick<ChartApi, "listViews" | "data" | "deleteView">;

function makeApi(overrides: Partial<Api> = {}): Api {
	return {
		listViews: vi.fn(async () => [makeView()]),
		data: vi.fn(async () => DATA),
		deleteView: vi.fn(async () => {}),
		...overrides,
	};
}

function renderCharts(api: Api, canEdit = false) {
	return render(ResourceCharts, {
		props: { resourceId: "res-1", datasetId: "planilla", api, canEdit },
	});
}

beforeEach(() => auth.reset());
afterEach(() => auth.reset());

describe("ResourceCharts — el visitante", () => {
	it("lista las vistas del recurso y dibuja cada una con los datos de su vista, con su título y descripción", async () => {
		const api = makeApi();
		renderCharts(api);

		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
		expect(screen.getByText("Promedio mensual del salario.")).toBeInTheDocument();
		await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
		expect(api.listViews).toHaveBeenCalledWith("res-1");
		expect(api.data).toHaveBeenCalledWith("view-1");
		// Los números salen en es-BO y con a lo sumo dos decimales.
		expect(screen.getByRole("table")).toHaveTextContent("8.496,75");
	});

	it("un visitante no ve «Crear gráfico», «Editar» ni «Eliminar»", async () => {
		renderCharts(makeApi(), false);

		await screen.findByRole("heading", { name: "Salario por turno" });
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
		expect(screen.queryByRole("link", { name: /Editar/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Eliminar/ })).toBeNull();
	});

	it("mientras carga muestra un estado de carga", () => {
		renderCharts(makeApi({ listViews: vi.fn(() => new Promise<ChartView[]>(() => {})) }));

		expect(screen.getByText("Cargando los gráficos…")).toBeInTheDocument();
	});

	it("sin vistas dice que el recurso todavía no tiene gráficos", async () => {
		renderCharts(makeApi({ listViews: vi.fn(async () => []) }));

		expect(await screen.findByText("Este recurso todavía no tiene gráficos")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
	});

	it("si la lista falla muestra el aviso del portal y permite reintentar", async () => {
		const listViews = vi
			.fn()
			.mockRejectedValueOnce(new CkanApiError("Server Error", 500))
			.mockResolvedValue([makeView()]);
		renderCharts(makeApi({ listViews }));

		expect(await screen.findByText("No se pudieron cargar los gráficos")).toBeInTheDocument();
		expect(screen.queryByText("Server Error")).toBeNull();

		await fireEvent.click(screen.getByRole("button", { name: "Intentar nuevamente" }));

		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
	});

	it("si los datos de una vista fallan, el error queda en esa vista y la lista sigue", async () => {
		const api = makeApi({
			listViews: vi.fn(async () => [makeView(), makeView({ id: "view-2", title: "Otra vista" })]),
			data: vi.fn(async (id: string) => {
				if (id === "view-1") throw new CkanApiError("boom", 500);
				return DATA;
			}),
		});
		renderCharts(api);

		expect(await screen.findByText("No se pudo mostrar este gráfico")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Otra vista" })).toBeInTheDocument();
		await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));
	});

	it("una vista de una versión desconocida no se dibuja ni pide datos, y se avisa", async () => {
		const api = makeApi({
			listViews: vi.fn(async () => [makeView({ config: { ...CONFIG, version: 2 } })]),
		});
		renderCharts(api);

		expect(
			await screen.findByText(/versión del formato que el portal no reconoce/),
		).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
		expect(screen.queryByRole("img")).toBeNull();
		expect(api.data).not.toHaveBeenCalled();
	});

	it("si el servidor responde con una versión desconocida tampoco se dibuja", async () => {
		const api = makeApi({ data: vi.fn(async () => ({ ...DATA, version: 7 })) });
		renderCharts(api);

		expect(
			await screen.findByText(/versión del formato que el portal no reconoce/),
		).toBeInTheDocument();
		expect(screen.queryByRole("img")).toBeNull();
	});
});

describe("ResourceCharts — quien puede editar", () => {
	it("ve «Crear gráfico» hacia la página propia, y «Editar» y «Eliminar» en cada gráfico", async () => {
		renderCharts(makeApi(), true);

		await screen.findByRole("heading", { name: "Salario por turno" });
		expect(screen.getByRole("link", { name: /Crear gráfico/ })).toHaveAttribute(
			"href",
			"/dataset/planilla/resource/res-1/charts/new",
		);
		expect(screen.getByRole("link", { name: /Editar el gráfico/ })).toHaveAttribute(
			"href",
			"/dataset/planilla/resource/res-1/charts/view-1/edit",
		);
		expect(screen.getByRole("button", { name: /Eliminar el gráfico/ })).toBeInTheDocument();
	});

	it("«Eliminar» pregunta antes: cancelar no borra nada", async () => {
		const api = makeApi();
		renderCharts(api, true);
		await screen.findByRole("heading", { name: "Salario por turno" });

		await fireEvent.click(screen.getByRole("button", { name: /Eliminar el gráfico/ }));

		const dialog = await screen.findByRole("dialog", { name: "Eliminar el gráfico" });
		expect(dialog).toHaveTextContent("«Salario por turno»");
		expect(api.deleteView).not.toHaveBeenCalled();

		await fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(api.deleteView).not.toHaveBeenCalled();
	});

	it("confirmar borra la vista y refresca la lista", async () => {
		const listViews = vi.fn().mockResolvedValueOnce([makeView()]).mockResolvedValueOnce([]);
		const api = makeApi({ listViews });
		renderCharts(api, true);
		await screen.findByRole("heading", { name: "Salario por turno" });

		await fireEvent.click(screen.getByRole("button", { name: /Eliminar el gráfico/ }));
		const dialog = await screen.findByRole("dialog");
		await fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		await waitFor(() => expect(api.deleteView).toHaveBeenCalledWith("view-1"));
		expect(await screen.findByText("Este recurso todavía no tiene gráficos")).toBeInTheDocument();
		expect(listViews).toHaveBeenCalledTimes(2);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("si el borrado falla, el diálogo sigue abierto con el aviso del portal y la lista no cambia", async () => {
		const api = makeApi({
			deleteView: vi.fn(async () => {
				throw new CkanApiError("Authorization Error", 403);
			}),
		});
		renderCharts(api, true);
		await screen.findByRole("heading", { name: "Salario por turno" });

		await fireEvent.click(screen.getByRole("button", { name: /Eliminar el gráfico/ }));
		const dialog = await screen.findByRole("dialog");
		await fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
		expect(within(dialog).queryByText("Authorization Error")).toBeNull();
		expect(api.listViews).toHaveBeenCalledTimes(1);
	});
});

describe("ResourceCharts — los valores por defecto son la página de hoy", () => {
	it("apilado: sin pestañas, con el título de la sección y «Crear gráfico» a su derecha, y sin tarjeta punteada", async () => {
		const { container } = renderCharts(makeApi(), true);

		const heading = await screen.findByRole("heading", { name: "Gráficos del recurso", level: 2 });
		await screen.findByRole("heading", { name: "Salario por turno", level: 3 });
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(screen.queryByRole("tab")).toBeNull();
		// El enlace comparte la fila del título (hijo del mismo contenedor flex), no la lista ni una tarjeta.
		const row = heading.parentElement?.parentElement as HTMLElement;
		expect(within(row).getByRole("link", { name: /Crear gráfico/ })).toBeInTheDocument();
		expect(container.querySelector(".border-dashed")).toBeNull();
		expect(screen.getAllByRole("link", { name: /Crear gráfico/ })).toHaveLength(1);
	});
});
