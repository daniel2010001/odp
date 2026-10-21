// Los gráficos en la página del recurso (S1, P3): lo que ve el visitante, lo que ve quien puede editar, y el
// borrado con confirmación. El servidor es un doble del cliente de la API (`createChartApi`).

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
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

// La tabla es la primera pestaña: el gráfico se ve al elegir la suya.
async function openChart(name = "Salario por turno") {
	await fireEvent.click(await screen.findByRole("tab", { name }));
}

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};
const at = (hash = "") =>
	pageStore.set({
		params: {},
		url: new URL(`http://localhost/dataset/planilla/resource/res-1${hash}`),
	});

beforeEach(() => {
	auth.reset();
	at();
	Element.prototype.scrollIntoView = vi.fn();
	vi.mocked(replaceState).mockClear();
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText: vi.fn(async () => {}) },
		configurable: true,
	});
});
afterEach(() => auth.reset());

describe("ResourceCharts — el visitante", () => {
	it("lista las vistas del recurso y dibuja cada una con los datos de su vista, con su título y descripción", async () => {
		const api = makeApi();
		renderCharts(api);

		await openChart();
		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
		expect(screen.getByText("Promedio mensual del salario.")).toBeInTheDocument();
		await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
		expect(api.listViews).toHaveBeenCalledWith("res-1");
		expect(api.data).toHaveBeenCalledWith("view-1");
		// Los números salen en es-BO y con a lo sumo dos decimales.
		expect(screen.getByRole("table")).toHaveTextContent("8.496,75");
	});

	it("un visitante no ve «Editar» ni «Eliminar»", async () => {
		renderCharts(makeApi(), false);

		await openChart();
		await screen.findByRole("heading", { name: "Salario por turno" });
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
		expect(screen.queryByRole("link", { name: /Editar/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Eliminar/ })).toBeNull();
	});

	it("mientras carga muestra un estado de carga", () => {
		renderCharts(makeApi({ listViews: vi.fn(() => new Promise<ChartView[]>(() => {})) }));

		expect(screen.getByText("Cargando los gráficos…")).toBeInTheDocument();
	});

	// S8 (odd/tasks/demo-honest-data.md): sin vistas no se dibuja ningún aviso, ni para el visitante ni para quien
	// edita. El aviso daba la impresión de que ahí debía ir un gráfico; quien edita tiene «Crear gráfico» en el hero.
	it("sin vistas no muestra ningún aviso de «todavía no tiene gráficos»", async () => {
		const listViews = vi.fn(async () => []);
		renderCharts(makeApi({ listViews }));

		await waitFor(() => expect(listViews).toHaveBeenCalled());
		await waitFor(() => expect(screen.queryByText("Cargando los gráficos…")).toBeNull());
		expect(screen.queryByText("Este recurso todavía no tiene gráficos")).toBeNull();
		expect(screen.queryByText(/Cuando quien publica el recurso configure uno/)).toBeNull();
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

		await openChart();
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

		await openChart();
		expect(await screen.findByText("No se pudo mostrar este gráfico")).toBeInTheDocument();
		await openChart("Otra vista");
		expect(await screen.findByRole("heading", { name: "Otra vista" })).toBeInTheDocument();
		await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));
	});

	it("una vista de una versión desconocida no se dibuja ni pide datos, y se avisa", async () => {
		const api = makeApi({
			listViews: vi.fn(async () => [makeView({ config: { ...CONFIG, version: 2 } })]),
		});
		renderCharts(api);

		await openChart();
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

		await openChart();
		expect(
			await screen.findByText(/versión del formato que el portal no reconoce/),
		).toBeInTheDocument();
		expect(screen.queryByRole("img")).toBeNull();
	});
});

describe("ResourceCharts — quien puede editar", () => {
	it("ve «Editar» y «Eliminar» en cada gráfico, y «Crear gráfico» ya no es de este componente", async () => {
		renderCharts(makeApi(), true);

		await openChart();
		await screen.findByRole("heading", { name: "Salario por turno" });
		expect(screen.getByRole("link", { name: /Editar el gráfico/ })).toHaveAttribute(
			"href",
			"/dataset/planilla/resource/res-1/charts/view-1/edit",
		);
		expect(screen.getByRole("button", { name: /Eliminar el gráfico/ })).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
	});

	it("«Eliminar» pregunta antes: cancelar no borra nada", async () => {
		const api = makeApi();
		renderCharts(api, true);
		await openChart();
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
		await openChart();
		await screen.findByRole("heading", { name: "Salario por turno" });

		await fireEvent.click(screen.getByRole("button", { name: /Eliminar el gráfico/ }));
		const dialog = await screen.findByRole("dialog");
		await fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		await waitFor(() => expect(api.deleteView).toHaveBeenCalledWith("view-1"));
		await waitFor(() => expect(listViews).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(screen.queryByRole("tablist")).toBeNull());
		expect(screen.queryByText("Este recurso todavía no tiene gráficos")).toBeNull();
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("si el borrado falla, el diálogo sigue abierto con el aviso del portal y la lista no cambia", async () => {
		const api = makeApi({
			deleteView: vi.fn(async () => {
				throw new CkanApiError("Authorization Error", 403);
			}),
		});
		renderCharts(api, true);
		await openChart();
		await screen.findByRole("heading", { name: "Salario por turno" });

		await fireEvent.click(screen.getByRole("button", { name: /Eliminar el gráfico/ }));
		const dialog = await screen.findByRole("dialog");
		await fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
		expect(within(dialog).queryByText("Authorization Error")).toBeNull();
		expect(api.listViews).toHaveBeenCalledTimes(1);
	});
});

describe("ResourceCharts — las pestañas", () => {
	const TABLE = createRawSnippet(() => ({ render: () => "<p>Contenido de la tabla</p>" }));

	function renderTabs(api: Api, canEdit = false) {
		return render(ResourceCharts, {
			props: { resourceId: "res-1", datasetId: "planilla", api, canEdit, table: TABLE },
		});
	}

	it("con gráficos hay una barra con «Tabla» primero y una pestaña por gráfico, cada una con su ícono", async () => {
		const api = makeApi({
			listViews: vi.fn(async () => [
				makeView(),
				makeView({ id: "view-2", title: "Evolución", config: { ...CONFIG, chart_type: "line" } }),
				makeView({ id: "view-3", title: "Reparto", config: { ...CONFIG, chart_type: "pie" } }),
			]),
		});
		renderTabs(api);

		const tabs = await screen.findAllByRole("tab");
		expect(tabs.map((t) => t.textContent?.trim())).toEqual([
			"Tabla",
			"Salario por turno",
			"Evolución",
			"Reparto",
		]);
		for (const tab of tabs) expect(tab.querySelector("svg")).not.toBeNull();
		expect(tabs[1].querySelector("svg")).toHaveClass("lucide-chart-column");
		expect(tabs[2].querySelector("svg")).toHaveClass("lucide-chart-line");
		expect(tabs[3].querySelector("svg")).toHaveClass("lucide-chart-pie");
		// La tabla es lo que se ve primero; el gráfico espera a su pestaña.
		expect(screen.getByText("Contenido de la tabla")).toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: "Salario por turno" })).toBeNull();
	});

	it("la pestaña de un gráfico muestra el gráfico y la de «Tabla» vuelve a la tabla", async () => {
		renderTabs(makeApi());

		await fireEvent.click(await screen.findByRole("tab", { name: "Salario por turno" }));
		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
		await waitFor(() => expect(screen.getByText("Contenido de la tabla")).not.toBeVisible());

		await fireEvent.click(screen.getByRole("tab", { name: "Tabla" }));
		await waitFor(() => expect(screen.getByText("Contenido de la tabla")).toBeVisible());
	});

	it.each([
		["el visitante", false],
		["quien edita", true],
	])("sin gráficos no hay barra ni aviso: la tabla va sola, para %s", async (_quien, canEdit) => {
		const listViews = vi.fn(async () => []);
		renderTabs(makeApi({ listViews }), canEdit);

		await waitFor(() => expect(listViews).toHaveBeenCalled());
		await waitFor(() => expect(screen.queryByText("Cargando los gráficos…")).toBeNull());
		expect(screen.getByText("Contenido de la tabla")).toBeInTheDocument();
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(screen.queryByText("Este recurso todavía no tiene gráficos")).toBeNull();
		expect(screen.queryByText(/Cree el primero/)).toBeNull();
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
	});

	it("mientras carga y si falla, la tabla sigue visible sin barra", async () => {
		const { unmount } = renderTabs(
			makeApi({ listViews: vi.fn(() => new Promise<ChartView[]>(() => {})) }),
		);
		expect(screen.getByText("Contenido de la tabla")).toBeInTheDocument();
		expect(screen.queryByRole("tablist")).toBeNull();
		unmount();

		renderTabs(makeApi({ listViews: vi.fn().mockRejectedValue(new CkanApiError("x", 500)) }));
		expect(await screen.findByText("No se pudieron cargar los gráficos")).toBeInTheDocument();
		expect(screen.getByText("Contenido de la tabla")).toBeInTheDocument();
		expect(screen.queryByRole("tablist")).toBeNull();
	});
});

describe("ResourceCharts — «Insertar»", () => {
	it("cualquier visitante ve «Insertar» en cada gráfico, y quien edita lo ve junto a Editar y Eliminar", async () => {
		const api = makeApi({
			listViews: vi.fn(async () => [makeView(), makeView({ id: "view-2", title: "Otra vista" })]),
		});
		const { unmount } = renderCharts(api, false);

		await openChart("Otra vista");
		expect(await screen.findByRole("button", { name: /^Insertar el gráfico/ })).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Editar/ })).toBeNull();
		unmount();

		renderCharts(api, true);
		await openChart("Otra vista");
		expect(await screen.findByRole("button", { name: /^Insertar el gráfico/ })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Editar/ })).toBeInTheDocument();
	});

	it("abre el diálogo con el código del gráfico elegido", async () => {
		renderCharts(makeApi());
		await openChart();
		await screen.findByRole("heading", { name: "Salario por turno" });

		await fireEvent.click(screen.getByRole("button", { name: /^Insertar el gráfico/ }));

		const code = (await screen.findByLabelText("Código para insertar")) as HTMLTextAreaElement;
		expect(code.value).toContain("/embed/charts/view-1");
	});
});

// ─── Ventanas (T25 / S24): un diseño para todas las vistas, con su id y su enlace ───────────────────
describe("ResourceCharts — ventanas, ids y enlaces", () => {
	const second = makeView({ id: "view-2", title: "Otro gráfico" });
	const two = () => makeApi({ listViews: vi.fn(async () => [makeView(), second]) });

	it("cada gráfico vive en una ventana #chart-<id de la vista> con «Copiar enlace» y «Ajustar a la pantalla»", async () => {
		renderCharts(makeApi());
		await openChart();

		const win = document.getElementById("chart-view-1") as HTMLElement;
		expect(win).not.toBeNull();
		expect(within(win).getByText("Vista previa · Salario por turno")).toBeInTheDocument();
		expect(
			within(win).getByRole("button", { name: "Copiar enlace de la vista" }),
		).toBeInTheDocument();
		expect(within(win).getByRole("button", { name: "Ajustar a la pantalla" })).toBeInTheDocument();
		// Sólo la pestaña activa dibuja su ventana: un solo id de gráfico en el documento.
		expect(document.querySelectorAll('[id^="chart-"]')).toHaveLength(1);
	});

	it("«Copiar enlace de la vista» copia la URL del recurso con el id de la ventana", async () => {
		at("?x=1");
		renderCharts(makeApi());
		await openChart();

		vi.mocked(replaceState).mockClear();
		await fireEvent.click(screen.getByRole("button", { name: "Copiar enlace de la vista" }));
		await waitFor(() =>
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				"http://localhost/dataset/planilla/resource/res-1?x=1#chart-view-1",
			),
		);
		// Copiar no cambia la URL.
		expect(replaceState).not.toHaveBeenCalled();
	});

	it("elegir una pestaña escribe su id en la URL con replaceState", async () => {
		renderCharts(two());
		await openChart("Otro gráfico");

		let url = vi.mocked(replaceState).mock.calls.at(-1)?.[0] as URL;
		expect(url.hash).toBe("#chart-view-2");
		await fireEvent.click(screen.getByRole("tab", { name: "Tabla" }));
		url = vi.mocked(replaceState).mock.calls.at(-1)?.[0] as URL;
		expect(url.hash).toBe("#table");
	});

	it("un enlace con #chart-<id> abre esa pestaña y baja hasta su ventana", async () => {
		at("#chart-view-2");
		renderCharts(two());

		await waitFor(() => expect(document.getElementById("chart-view-2")).not.toBeNull());
		expect(screen.getByRole("tab", { name: "Otro gráfico" })).toHaveAttribute(
			"data-state",
			"active",
		);
		await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
		const target = vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1) as HTMLElement;
		expect(target.id).toBe("chart-view-2");
	});

	it("con un enlace #chart-<id> abierto, elegir otra pestaña cambia de vista y la elegida gana (ida y vuelta)", async () => {
		at("#chart-view-2");
		renderCharts(two());
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Otro gráfico" })).toHaveAttribute(
				"data-state",
				"active",
			),
		);
		// SvelteKit vuelve a emitir `$page` al llamar `replaceState`, aún con la URL del enlace.
		vi.mocked(replaceState).mockImplementation(() => at("#chart-view-2"));

		await fireEvent.click(screen.getByRole("tab", { name: "Tabla" }));
		await new Promise((r) => setTimeout(r, 50));
		expect(screen.getByRole("tab", { name: "Tabla" })).toHaveAttribute("data-state", "active");
		expect((vi.mocked(replaceState).mock.calls.at(-1)?.[0] as URL).hash).toBe("#table");

		await fireEvent.click(screen.getByRole("tab", { name: "Otro gráfico" }));
		await new Promise((r) => setTimeout(r, 50));
		expect(screen.getByRole("tab", { name: "Otro gráfico" })).toHaveAttribute(
			"data-state",
			"active",
		);
		vi.mocked(replaceState).mockReset();
	});

	it("un enlace viejo #grafico-<id> abre esa pestaña, baja hasta su ventana y reescribe la URL a #chart-<id>", async () => {
		at("#grafico-view-2");
		vi.mocked(replaceState).mockClear();
		renderCharts(two());

		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Otro gráfico" })).toHaveAttribute(
				"data-state",
				"active",
			),
		);
		await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
		expect(
			(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1) as HTMLElement).id,
		).toBe("chart-view-2");
		expect((vi.mocked(replaceState).mock.calls[0]?.[0] as URL).hash).toBe("#chart-view-2");
	});

	it("con un enlace viejo #grafico-<id> abierto, elegir otra pestaña cambia de vista (ida y vuelta)", async () => {
		at("#grafico-view-2");
		renderCharts(two());
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Otro gráfico" })).toHaveAttribute(
				"data-state",
				"active",
			),
		);
		vi.mocked(replaceState).mockImplementation(() => at("#grafico-view-2"));

		await fireEvent.click(screen.getByRole("tab", { name: "Tabla" }));
		await new Promise((r) => setTimeout(r, 50));
		expect(screen.getByRole("tab", { name: "Tabla" })).toHaveAttribute("data-state", "active");
		await fireEvent.click(screen.getByRole("tab", { name: "Otro gráfico" }));
		await new Promise((r) => setTimeout(r, 50));
		expect(screen.getByRole("tab", { name: "Otro gráfico" })).toHaveAttribute(
			"data-state",
			"active",
		);
		vi.mocked(replaceState).mockReset();
	});

	it("un enlace viejo #tabla abre la tabla y reescribe la URL a #table", async () => {
		at("#tabla");
		vi.mocked(replaceState).mockClear();
		renderCharts(two());

		await screen.findAllByRole("tab");
		expect(screen.getByRole("tab", { name: "Tabla" })).toHaveAttribute("data-state", "active");
		expect((vi.mocked(replaceState).mock.calls[0]?.[0] as URL).hash).toBe("#table");
	});

	it("un enlace con el id de un gráfico que no existe deja la tabla", async () => {
		at("#chart-nada");
		renderCharts(two());

		await screen.findAllByRole("tab");
		expect(screen.getByRole("tab", { name: "Tabla" })).toHaveAttribute("data-state", "active");
	});

	it("bajo 32 rem de contenedor las pestañas son un desplegable «Vistas del recurso» de 44 px (misma regla: @lg)", async () => {
		renderCharts(two());

		const tablist = await screen.findByRole("tablist");
		expect(tablist.closest("[data-list]")?.parentElement?.className).toContain("@lg:block");
		const trigger = screen.getByRole("button", { name: "Vistas del recurso" });
		expect(trigger.parentElement?.className).toContain("@lg:hidden");
		expect(trigger.className).toContain("h-11");
		expect(trigger).toHaveTextContent("Tabla");
	});

	it("la barra de pestañas fija --tabs-h para las alturas y el scroll-margin de las ventanas", async () => {
		renderCharts(two());
		await screen.findAllByRole("tab");

		expect(document.querySelector("[style*='--tabs-h']")).not.toBeNull();
	});
});
