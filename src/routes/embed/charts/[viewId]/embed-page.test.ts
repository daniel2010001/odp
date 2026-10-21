// La página incrustable de un gráfico (P4): `/embed/charts/[viewId]`. Se monta la página real con un doble de
// cada llamada del catálogo. Se fija lo que promete: título, gráfico y atribución con enlace al recurso; un
// estado claro para cada fallo, y que funciona sin sesión.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import type { ChartView } from "$lib/api/charts";
import { describeFailure } from "$lib/api/failure";
import type { ChartData, NormalizedChartConfig } from "$lib/charts/contract";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import EmbedPage from "./+page.svelte";

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
	getView: vi.fn(),
	data: vi.fn(),
	showResource: vi.fn(),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "" } }));
vi.mock("$lib/api/charts", () => ({
	createChartApi: () => ({ getView: mocks.getView, data: mocks.data }),
}));
vi.mock("$lib/api/resources", () => ({ createResourceApi: () => ({ show: mocks.showResource }) }));

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

const view = (overrides: Partial<ChartView> = {}): ChartView => ({
	id: "view-1",
	resource_id: "res-1",
	view_type: "umss_chart",
	title: "Salario por turno",
	description: "Promedio mensual.",
	config: { ...CONFIG },
	...overrides,
});

const DATA: ChartData = {
	version: 1,
	config: CONFIG,
	groups: [
		{ key: "mañana", value: 8496.75 },
		{ key: "noche", value: 3986.38 },
	],
	truncated: false,
	total_rows: 2500,
};

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
	pageStore.set({
		params: { viewId: "view-1" },
		url: new URL("http://localhost/embed/charts/view-1"),
	});
	mocks.getView.mockResolvedValue(view());
	mocks.data.mockResolvedValue(DATA);
	mocks.showResource.mockResolvedValue({
		id: "res-1",
		package_id: "pkg-1",
		name: "Planilla 2026",
	});
});
afterEach(() => auth.reset());

describe("/embed/charts/[viewId]", () => {
	it("muestra el título, el gráfico y la atribución con enlace al recurso en el portal", async () => {
		render(EmbedPage);

		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
		await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
		expect(mocks.getView).toHaveBeenCalledWith("view-1");
		expect(mocks.data).toHaveBeenCalledWith("view-1");
		expect(mocks.showResource).toHaveBeenCalledWith("res-1");

		const link = await screen.findByRole("link", { name: /Planilla 2026/ });
		expect(link).toHaveAttribute("href", "/dataset/pkg-1/resource/res-1");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
		expect(screen.getByText(/Datos UMSS/)).toBeInTheDocument();
	});

	it("funciona sin sesión: no pide nada del usuario ni muestra enlaces al sitio", async () => {
		expect(auth.reset).toBeDefined();
		render(EmbedPage);

		await screen.findByRole("heading", { name: "Salario por turno" });
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
		expect(screen.queryByRole("navigation")).toBeNull();
	});

	it("si no se puede leer el recurso, igual muestra el gráfico y la atribución sin enlace", async () => {
		mocks.showResource.mockRejectedValue(new CkanApiError("x", 403));
		render(EmbedPage);

		await screen.findByRole("heading", { name: "Salario por turno" });
		await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
		expect(screen.getByText(/Datos UMSS/)).toBeInTheDocument();
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("mientras carga dice que carga", () => {
		mocks.getView.mockReturnValue(new Promise(() => {}));
		render(EmbedPage);

		expect(screen.getByText("Cargando el gráfico…")).toBeInTheDocument();
	});

	it.each([
		["no existe o se eliminó", 404],
		["es privado", 403],
		["pide sesión", 401],
	])("una vista que %s dice lo mismo, sin confirmar cuál es el caso", async (_name, status) => {
		mocks.getView.mockRejectedValue(new CkanApiError("x", status));
		render(EmbedPage);

		expect(await screen.findByText("Gráfico no disponible")).toBeInTheDocument();
		expect(
			screen.getByText("No se encontró el gráfico solicitado, o no tiene permiso para verlo."),
		).toBeInTheDocument();
		expect(mocks.data).not.toHaveBeenCalled();
		expect(screen.queryByRole("button", { name: "Intentar nuevamente" })).toBeNull();
	});

	it("una vista que no es de gráfico (getView devuelve null) es la misma pantalla", async () => {
		mocks.getView.mockResolvedValue(null);
		render(EmbedPage);

		expect(await screen.findByText("Gráfico no disponible")).toBeInTheDocument();
		expect(mocks.data).not.toHaveBeenCalled();
	});

	it("un fallo del catálogo se dice aparte y permite reintentar", async () => {
		mocks.getView
			.mockRejectedValueOnce(new CkanApiError("Server Error", 500))
			.mockResolvedValue(view());
		render(EmbedPage);

		expect(await screen.findByText("No se pudo cargar el gráfico")).toBeInTheDocument();
		// La frase es la de `failure.ts`, no una copia local.
		expect(
			screen.getByText(
				describeFailure(new CkanApiError("x", 500), "resource", "anonymous").message,
			),
		).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Intentar nuevamente" }));

		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
	});

	it("una versión del formato desconocida no se dibuja y se avisa, sin pedir datos", async () => {
		mocks.getView.mockResolvedValue(view({ config: { ...CONFIG, version: 99 as 1 } }));
		render(EmbedPage);

		expect(
			await screen.findByText(/versión del formato que el portal no reconoce/),
		).toBeInTheDocument();
		expect(screen.queryByRole("img")).toBeNull();
		expect(mocks.data).not.toHaveBeenCalled();
	});

	it("si los datos fallan, el título queda y el error es el del gráfico", async () => {
		mocks.data.mockRejectedValue(new CkanApiError("boom", 500));
		render(EmbedPage);

		expect(await screen.findByRole("heading", { name: "Salario por turno" })).toBeInTheDocument();
		expect(await screen.findByText("No se pudo mostrar este gráfico")).toBeInTheDocument();
	});
});
