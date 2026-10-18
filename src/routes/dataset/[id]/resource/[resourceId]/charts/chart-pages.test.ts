// Las dos páginas del formulario del publicador (L21): `…/charts/new` y `…/charts/[viewId]/edit`.
//
// Se monta la página real con un doble de cada llamada del catálogo. Lo que se fija es lo que la página
// promete: crear y editar guardan con la configuración plana y vuelven al recurso, cancelar no guarda, y cada
// estado sin formulario (sin permiso, sin tabla, sin vista, sesión muerta) lo dice sin mostrar el formulario.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import type { ChartView } from "$lib/api/charts";
import type { ChartData, NormalizedChartConfig } from "$lib/charts/contract";
import { sessionExpiredLoginUrl } from "$lib/session";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage, CkanResource, CkanUser } from "$lib/types/ckan";
import EditPage from "./[viewId]/edit/+page.svelte";
import NewPage from "./new/+page.svelte";

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
	search: vi.fn(),
	check: vi.fn(),
	preview: vi.fn(),
	createView: vi.fn(),
	updateView: vi.fn(),
	listViews: vi.fn(),
	fetch: vi.fn(),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "http://localhost:5000" } }));
vi.mock("$lib/api/resources", () => ({ createResourceApi: () => ({ show: mocks.showResource }) }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ listUpdatableOrganizationIds: mocks.updatableOrganizations }),
}));
vi.mock("$lib/api/datastore", () => ({ createDatastoreApi: () => ({ search: mocks.search }) }));
vi.mock("$lib/api/session", () => ({ createSessionApi: () => ({ check: mocks.check }) }));
vi.mock("$lib/api/charts", () => ({
	createChartApi: () => ({
		preview: mocks.preview,
		createView: mocks.createView,
		updateView: mocks.updateView,
		listViews: mocks.listViews,
	}),
}));

const RESOURCE_PATH = "/dataset/planilla/resource/res-1";
const NEW_PATH = `${RESOURCE_PATH}/charts/new`;
const EDIT_PATH = `${RESOURCE_PATH}/charts/view-1/edit`;

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

const savedView = (overrides: Partial<ChartView> = {}): ChartView => ({
	id: "view-1",
	resource_id: "res-1",
	view_type: "umss_chart",
	title: "Salario por turno",
	description: "Promedio mensual.",
	config: { ...CONFIG },
	...overrides,
});

function setPath(path: string, params: Record<string, string>) {
	pageStore.set({ params, url: new URL(`http://localhost${path}`) });
}
const openNew = () => setPath(NEW_PATH, { id: "planilla", resourceId: "res-1" });
const openEdit = () =>
	setPath(EDIT_PATH, { id: "planilla", resourceId: "res-1", viewId: "view-1" });

const saveButton = () => screen.getByRole("button", { name: "Guardar" });

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
	auth.setUser(user);
	mocks.showResource.mockResolvedValue(resource());
	mocks.showDataset.mockResolvedValue(dataset);
	mocks.updatableOrganizations.mockResolvedValue({ state: "known", ids: ["org-1"] });
	mocks.search.mockResolvedValue({
		fields: [
			{ id: "_id", type: "int4" },
			{ id: "turno", type: "text" },
			{ id: "salario", type: "numeric" },
		],
		records: [],
		total: 2500,
	});
	mocks.preview.mockResolvedValue(DATA);
	mocks.createView.mockResolvedValue(savedView());
	mocks.updateView.mockResolvedValue(savedView());
	mocks.listViews.mockResolvedValue([savedView()]);
	mocks.check.mockResolvedValue({ state: "alive", user });
	mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, result: {} }) });
	vi.stubGlobal("fetch", mocks.fetch);
	openNew();
});

afterEach(() => {
	vi.unstubAllGlobals();
	auth.reset();
});

describe("Crear un gráfico (…/charts/new)", () => {
	it("carga las columnas con limit 0 y monta el formulario real", async () => {
		render(NewPage);

		expect(
			await screen.findByRole("heading", { name: "Nuevo gráfico", level: 1 }),
		).toBeInTheDocument();
		expect(mocks.search).toHaveBeenCalledWith("res-1", { limit: 0 });
		expect(await screen.findByLabelText(/Título de la vista/)).toBeInTheDocument();
	});

	it("«Guardar» llama a createView con la configuración plana y vuelve a la página del recurso", async () => {
		render(NewPage);
		await screen.findByLabelText(/Título de la vista/);
		await fireEvent.input(screen.getByLabelText(/Título de la vista/), {
			target: { value: "Docentes por turno" },
		});
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.click(saveButton());

		await waitFor(() => expect(mocks.createView).toHaveBeenCalledTimes(1));
		expect(mocks.createView).toHaveBeenCalledWith("res-1", "Docentes por turno", "", {
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			x_fold_case: false,
			y_agg: "count",
			include_null: true,
		});
		expect(mocks.updateView).not.toHaveBeenCalled();
		await waitFor(() => expect(goto).toHaveBeenCalledWith(RESOURCE_PATH));
	});

	it("«Cancelar» vuelve al recurso sin guardar nada", async () => {
		render(NewPage);
		await screen.findByLabelText(/Título de la vista/);

		await fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(goto).toHaveBeenCalledWith(RESOURCE_PATH);
		expect(mocks.createView).not.toHaveBeenCalled();
	});

	it("el breadcrumb vuelve al recurso y nombra la página", async () => {
		render(NewPage);

		await screen.findByLabelText(/Título de la vista/);
		const links = Array.from(document.querySelectorAll("a[href]")).map((a) =>
			a.getAttribute("href"),
		);
		expect(links).toContain(RESOURCE_PATH);
		expect(links).toContain("/dataset/planilla");
	});
});

describe("Editar un gráfico (…/charts/[viewId]/edit)", () => {
	beforeEach(openEdit);

	it("precarga el título, la descripción y la configuración de la vista, encontrada con listViews", async () => {
		render(EditPage);

		expect(
			await screen.findByRole("heading", { name: "Editar gráfico", level: 1 }),
		).toBeInTheDocument();
		expect(await screen.findByLabelText(/Título de la vista/)).toHaveValue("Salario por turno");
		expect(screen.getByLabelText(/Descripción de la vista/)).toHaveValue("Promedio mensual.");
		expect(mocks.listViews).toHaveBeenCalledWith("res-1");
		await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith("res-1", CONFIG));
	});

	it("«Guardar» llama a updateView con el id de la vista y vuelve al recurso", async () => {
		render(EditPage);
		await screen.findByLabelText(/Título de la vista/);
		await fireEvent.input(screen.getByLabelText(/Título de la vista/), {
			target: { value: "Otro título" },
		});
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.click(saveButton());

		await waitFor(() => expect(mocks.updateView).toHaveBeenCalledTimes(1));
		expect(mocks.updateView).toHaveBeenCalledWith("view-1", {
			title: "Otro título",
			description: "Promedio mensual.",
			config: CONFIG,
		});
		expect(mocks.createView).not.toHaveBeenCalled();
		await waitFor(() => expect(goto).toHaveBeenCalledWith(RESOURCE_PATH));
	});

	it("una vista que no existe se dice y no muestra el formulario", async () => {
		mocks.listViews.mockResolvedValue([savedView({ id: "otra" })]);
		render(EditPage);

		expect(await screen.findByText("No se encontró el gráfico")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
	});

	it("una vista de una versión desconocida no se edita", async () => {
		mocks.listViews.mockResolvedValue([savedView({ config: { ...CONFIG, version: 2 } })]);
		render(EditPage);

		expect(await screen.findByText("Este gráfico no se puede editar")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
	});
});

describe("Estados sin formulario", () => {
	it("quien no puede editar el dataset lee un mensaje honesto y no ve el formulario", async () => {
		mocks.updatableOrganizations.mockResolvedValue({ state: "known", ids: ["otra-org"] });
		render(NewPage);

		expect(
			await screen.findByText("No puede configurar los gráficos de este recurso"),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
		expect(mocks.search).not.toHaveBeenCalled();
	});

	it("un visitante sin sesión tampoco ve el formulario, y no se le pregunta nada a la organización", async () => {
		auth.reset();
		render(NewPage);

		expect(
			await screen.findByText("No puede configurar los gráficos de este recurso"),
		).toBeInTheDocument();
		expect(mocks.updatableOrganizations).not.toHaveBeenCalled();
		expect(screen.getByRole("link", { name: "Volver al recurso" })).toHaveAttribute(
			"href",
			RESOURCE_PATH,
		);
	});

	it("si la consulta de permisos falla, no se ofrece el formulario", async () => {
		mocks.updatableOrganizations.mockResolvedValue({ state: "unknown" });
		render(NewPage);

		expect(
			await screen.findByText("No puede configurar los gráficos de este recurso"),
		).toBeInTheDocument();
	});

	it("un recurso sin tabla en el DataStore lo dice y no ofrece el formulario", async () => {
		mocks.showResource.mockResolvedValue(resource({ datastore_active: false }));
		render(NewPage);

		expect(await screen.findByText("Este recurso no tiene una tabla de datos")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
		expect(mocks.search).not.toHaveBeenCalled();
	});

	it("si la tabla no existe (el catálogo responde «no encontrado») también lo dice", async () => {
		mocks.search.mockRejectedValue(new CkanApiError("Not found", 404, "Not Found Error"));
		render(NewPage);

		expect(await screen.findByText("Este recurso no tiene una tabla de datos")).toBeInTheDocument();
	});

	it("una falla del catálogo al cargar el recurso se dice con el texto del portal y permite reintentar", async () => {
		mocks.showResource.mockRejectedValue(new CkanApiError("Server Error", 500));
		render(NewPage);

		expect(await screen.findByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
		expect(screen.queryByText("Server Error")).toBeNull();
		expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
	});

	it("ante una sesión muerta expulsa al login y no dibuja ningún estado", async () => {
		mocks.check.mockResolvedValue({ state: "dead" });
		mocks.showResource.mockRejectedValue(new CkanApiError("Access denied", 403));
		const { container } = render(NewPage);

		await waitFor(() => expect(goto).toHaveBeenCalledTimes(1));
		expect(vi.mocked(goto).mock.calls[0][0]).toBe(sessionExpiredLoginUrl(NEW_PATH));
		expect(container.querySelector(".animate-pulse")).toBeNull();
		expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
	});
});
