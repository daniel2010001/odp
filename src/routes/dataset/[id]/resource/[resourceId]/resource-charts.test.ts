// Los gráficos en la página del recurso (S1, P3): quién los ve y quién puede administrarlos. El detalle de
// cada gráfico (versión desconocida, borrado con confirmación, números) lo fija `ResourceCharts.test.ts`; acá
// se mide lo que sólo la página decide: cuándo aparece la sección y a quién se le ofrecen las acciones.

import { render, screen, waitFor } from "@testing-library/svelte";
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

describe("Página de recurso — gráficos", () => {
	it("un visitante anónimo ve los gráficos del recurso y ninguna acción", async () => {
		render(ResourcePage);

		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
		await waitFor(() => expect(mocks.data).toHaveBeenCalledWith("view-1"));
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
		expect(screen.queryByRole("link", { name: /Editar el gráfico/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Eliminar el gráfico/ })).toBeNull();
		expect(mocks.updatableOrganizations).not.toHaveBeenCalled();
	});

	it("quien puede editar el dataset ve «Crear gráfico», «Editar» y «Eliminar»", async () => {
		auth.setUser(user);
		render(ResourcePage);

		expect(await screen.findByRole("link", { name: /Crear gráfico/ })).toHaveAttribute(
			"href",
			"/dataset/planilla/resource/res-1/charts/new",
		);
		expect(screen.getByRole("link", { name: /Editar el gráfico/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Eliminar el gráfico/ })).toBeInTheDocument();
	});

	it("un usuario con sesión que no puede editar ese dataset no ve ninguna acción", async () => {
		auth.setUser(user);
		mocks.updatableOrganizations.mockResolvedValue({ state: "known", ids: ["otra-org"] });
		render(ResourcePage);

		await screen.findByRole("heading", { name: "Salario por turno" });
		await waitFor(() => expect(mocks.updatableOrganizations).toHaveBeenCalled());
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
		expect(screen.queryByRole("link", { name: /Editar el gráfico/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Eliminar el gráfico/ })).toBeNull();
	});

	it("un recurso sin tabla en el DataStore no tiene sección de gráficos ni ofrece crear uno", async () => {
		auth.setUser(user);
		mocks.showResource.mockResolvedValue(resource({ datastore_active: false }));
		render(ResourcePage);

		await screen.findByRole("heading", { level: 1, name: "Planilla docente" });
		expect(screen.queryByRole("heading", { name: "Gráficos del recurso" })).toBeNull();
		expect(screen.queryByRole("link", { name: /Crear gráfico/ })).toBeNull();
		expect(mocks.listViews).not.toHaveBeenCalled();
	});
});
