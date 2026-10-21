// Los gráficos en la página del recurso (S1, P3): quién los ve y quién puede administrarlos. El detalle de
// cada gráfico (versión desconocida, borrado con confirmación, números) lo fija `ResourceCharts.test.ts`; acá
// se mide lo que sólo la página decide: cuándo aparece la sección y a quién se le ofrecen las acciones.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import type { ChartView } from "$lib/api/charts";
import type { ChartData, NormalizedChartConfig } from "$lib/charts/contract";
import { auth } from "$lib/stores/auth";
import type { CkanPackage, CkanResource, CkanUser } from "$lib/types/ckan";
import ResourcePage from "./+page.svelte";

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	showResource: vi.fn(),
	showDataset: vi.fn(),
	updatableOrganizations: vi.fn(),
	listViews: vi.fn(),
	data: vi.fn(),
	deleteView: vi.fn(),
	search: vi.fn(),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "http://localhost:5000" } }));
vi.mock("$lib/api/resources", () => ({ createResourceApi: () => ({ show: mocks.showResource }) }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/api/datastore", () => ({ createDatastoreApi: () => ({ search: mocks.search }) }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ listUpdatableOrganizationIds: mocks.updatableOrganizations }),
}));
vi.mock("$lib/api/charts", () => ({
	createChartApi: () => ({
		listViews: mocks.listViews,
		data: mocks.data,
		deleteView: mocks.deleteView,
	}),
}));

const user: CkanUser = {
	id: "u-1",
	name: "editor",
	display_name: "Editora",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

const resource = (overrides: Partial<CkanResource> = {}): CkanResource =>
	({
		id: "res-1",
		package_id: "pkg-1",
		name: "Planilla docente",
		format: "CSV",
		url: "http://x/planilla.csv",
		url_type: "upload",
		datastore_active: true,
		state: "active",
		...overrides,
	}) as CkanResource;

const dataset = {
	id: "pkg-1",
	name: "planilla",
	title: "Planilla docente",
	private: false,
	owner_org: "org-1",
	resources: [],
} as unknown as CkanPackage;

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
const DATA: ChartData = {
	version: 1,
	config: CONFIG,
	groups: [{ key: "mañana", value: 8496.754044 }],
	truncated: false,
	total_rows: 2500,
};
const view: ChartView = {
	id: "view-1",
	resource_id: "res-1",
	view_type: "umss_chart",
	title: "Salario por turno",
	description: "Promedio mensual.",
	config: { ...CONFIG },
};

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
	pageStore.set({
		params: { id: "planilla", resourceId: "res-1" },
		url: new URL("http://localhost/dataset/planilla/resource/res-1"),
	});
	mocks.showResource.mockResolvedValue(resource());
	mocks.showDataset.mockResolvedValue(dataset);
	mocks.updatableOrganizations.mockResolvedValue({ state: "known", ids: ["org-1"] });
	mocks.listViews.mockResolvedValue([view]);
	mocks.data.mockResolvedValue(DATA);
	mocks.search.mockResolvedValue({ fields: [], records: [], total: 0 });
});

afterEach(() => auth.reset());

const openChart = async () =>
	fireEvent.click(await screen.findByRole("tab", { name: "Salario por turno" }));
const heroBand = () =>
	screen.getByRole("link", { name: "Descargar recurso" }).parentElement as HTMLElement;

// T25 / S24: el contenedor `#preview` abarca las pestañas y la ventana activa, así que el salto y «Ajustar a la
// pantalla» funcionan con un gráfico elegido.
describe("Página de recurso — el contenedor con un gráfico activo", () => {
	it("#preview contiene las pestañas y la ventana #chart-<id>; «Ir a la vista previa» apunta a él", async () => {
		render(ResourcePage);
		await openChart();

		const container = document.getElementById("preview") as HTMLElement;
		const win = await waitFor(() => {
			const el = document.getElementById("chart-view-1");
			expect(el).not.toBeNull();
			return el as HTMLElement;
		});
		expect(container.contains(win)).toBe(true);
		expect(container.contains(screen.getByRole("tablist"))).toBe(true);
		expect(screen.getByRole("link", { name: "Ir a la vista previa" })).toHaveAttribute(
			"href",
			"#preview",
		);
		expect(container.className).toContain("@container");
	});

	it("«Ajustar a la pantalla» de un gráfico sube el contenedor, no sólo la ventana", async () => {
		const scrollIntoView = vi.fn();
		Element.prototype.scrollIntoView = scrollIntoView;
		render(ResourcePage);
		await openChart();

		const win = await waitFor(() => {
			const el = document.getElementById("chart-view-1");
			expect(el).not.toBeNull();
			return el as HTMLElement;
		});
		await fireEvent.click(within(win).getByRole("button", { name: "Ajustar a la pantalla" }));
		expect((scrollIntoView.mock.contexts.at(-1) as HTMLElement).id).toBe("preview");
	});
});

describe("Página de recurso — gráficos", () => {
	it("un visitante anónimo ve las pestañas con íconos, el gráfico y ninguna acción", async () => {
		render(ResourcePage);

		const tabs = await screen.findAllByRole("tab");
		expect(tabs.map((t) => t.textContent?.trim())).toEqual(["Tabla", "Salario por turno"]);
		for (const tab of tabs) expect(tab.querySelector("svg")).not.toBeNull();
		await openChart();
		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
		await waitFor(() => expect(mocks.data).toHaveBeenCalledWith("view-1"));
		expect(screen.getByRole("button", { name: /^Insertar el gráfico/ })).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
		expect(screen.queryByRole("link", { name: /Editar el gráfico/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Eliminar el gráfico/ })).toBeNull();
		expect(mocks.updatableOrganizations).not.toHaveBeenCalled();
	});

	it("la pestaña «Tabla» aloja la vista previa de hoy", async () => {
		render(ResourcePage);

		await screen.findAllByRole("tab");
		expect(screen.getByRole("tab", { name: "Tabla" })).toHaveAttribute("data-state", "active");
		expect(screen.getByText("Vista previa · Tabla")).toBeInTheDocument();
	});

	it("quien puede editar ve «Crear gráfico» en el encabezado, y «Editar» y «Eliminar» en el gráfico", async () => {
		auth.setUser(user);
		render(ResourcePage);

		const create = await screen.findByRole("link", { name: /Crear gráfico/ });
		expect(create).toHaveAttribute("href", "/dataset/planilla/resource/res-1/charts/new");
		// Vive en la banda de acciones del encabezado, junto a la descarga, y es el único.
		expect(heroBand()).toContainElement(create);
		expect(screen.getAllByRole("link", { name: /Crear gráfico/ })).toHaveLength(1);
		await openChart();
		expect(await screen.findByRole("link", { name: /Editar el gráfico/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Eliminar el gráfico/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^Insertar el gráfico/ })).toBeInTheDocument();
	});

	// Banda C (T13, L30/L42): todas las acciones miden 44 px y comparten forma; la descarga conserva el coral. Bajo
	// 32 rem de la banda «Crear gráfico» pasa a «Más acciones» (jsdom no aplica Tailwind: contrato de clases).
	it("la banda es C: descarga coral y «Crear gráfico» de 44 px, y bajo 32 rem «Crear gráfico» pasa a «Más acciones»", async () => {
		auth.setUser(user);
		render(ResourcePage);

		const download = await screen.findByRole("link", { name: "Descargar recurso" });
		const create = await screen.findByRole("link", { name: /Crear gráfico/ });
		for (const action of [download, create]) {
			expect(action.className).toContain("h-11");
			expect(action.className).not.toContain("h-9");
			expect(action.className).toContain("rounded-lg");
		}
		expect(download.className).toContain("bg-destructive");
		expect(create.className).not.toContain("bg-destructive");
		// En la fila sólo desde @lg; bajo ese ancho vive en el menú.
		expect(create.className).toContain("hidden");
		expect(create.className).toContain("@lg:inline-flex");

		const more = screen.getByRole("button", { name: "Más acciones" });
		expect(more.className).toContain("size-11");
		expect(more.className).toContain("@[32rem]:hidden");
		await fireEvent.click(more);
		const item = await within(await screen.findByRole("menu")).findByRole("link", {
			name: "Crear gráfico",
		});
		expect(item).toHaveAttribute("href", "/dataset/planilla/resource/res-1/charts/new");
	});

	it("sin permiso para crear gráficos no hay «Más acciones»: la descarga va sola", async () => {
		render(ResourcePage);

		await screen.findByRole("link", { name: "Descargar recurso" });
		expect(screen.queryByRole("button", { name: "Más acciones" })).toBeNull();
	});

	it("«Copiar enlace del recurso» sigue donde estaba, junto al título", async () => {
		auth.setUser(user);
		render(ResourcePage);

		await screen.findByRole("link", { name: /Crear gráfico/ });
		const title = screen.getByRole("heading", { level: 1, name: "Planilla docente" });
		expect(title.parentElement).toContainElement(
			screen.getByRole("button", { name: "Copiar enlace del recurso" }),
		);
	});

	it("un usuario con sesión que no puede editar ese dataset no ve ninguna acción", async () => {
		auth.setUser(user);
		mocks.updatableOrganizations.mockResolvedValue({ state: "known", ids: ["otra-org"] });
		render(ResourcePage);

		await openChart();
		await screen.findByRole("heading", { name: "Salario por turno" });
		await waitFor(() => expect(mocks.updatableOrganizations).toHaveBeenCalled());
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
		expect(screen.queryByRole("link", { name: /Editar el gráfico/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Eliminar el gráfico/ })).toBeNull();
	});

	// S8 (odd/tasks/demo-honest-data.md): sin gráficos no hay aviso para nadie; quien edita tiene «Crear gráfico».
	it("sin gráficos hay una sola vista: sin pestañas, sin aviso, y quien edita sigue viendo «Crear gráfico»", async () => {
		auth.setUser(user);
		mocks.listViews.mockResolvedValue([]);
		render(ResourcePage);

		expect(await screen.findByRole("link", { name: /Crear gráfico/ })).toBeInTheDocument();
		await waitFor(() => expect(mocks.listViews).toHaveBeenCalled());
		expect(screen.queryByText("Este recurso todavía no tiene gráficos")).toBeNull();
		expect(screen.queryByText(/Cree el primero/)).toBeNull();
		expect(screen.getByText("Vista previa · Tabla")).toBeInTheDocument();
		expect(screen.queryByRole("tab")).toBeNull();
		expect(await screen.findByRole("link", { name: /Crear gráfico/ })).toBeInTheDocument();
	});

	it("sin gráficos, el visitante no ve aviso, ni pestañas ni botón", async () => {
		mocks.listViews.mockResolvedValue([]);
		render(ResourcePage);

		await screen.findByText("Vista previa · Tabla");
		await waitFor(() => expect(mocks.listViews).toHaveBeenCalled());
		expect(screen.queryByText("Este recurso todavía no tiene gráficos")).toBeNull();
		expect(screen.queryByText(/Cuando quien publica el recurso configure uno/)).toBeNull();
		expect(screen.queryByRole("tab")).toBeNull();
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
	});

	it("un recurso sin tabla en el DataStore no tiene pestañas ni gráficos ni ofrece crear uno, y conserva su vista previa", async () => {
		auth.setUser(user);
		mocks.showResource.mockResolvedValue(resource({ datastore_active: false }));
		render(ResourcePage);

		await screen.findByRole("heading", { level: 1, name: "Planilla docente" });
		expect(screen.getByText("Vista previa")).toBeInTheDocument();
		expect(screen.queryByRole("tab")).toBeNull();
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
		expect(mocks.listViews).not.toHaveBeenCalled();
	});
});
