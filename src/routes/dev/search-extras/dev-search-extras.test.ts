// Tests del playground de los bloques del vacío (`/dev/search-extras`, S41 de `odd/tasks/prototype-presentation.md`):
// la propiedad útil es que el autor vea, con resultados, «Pruebe con» y «lo más reciente» por separado, cada uno con
// su interruptor al lado, con el estado en la URL, y que sin resultados el vacío siga siendo el de hoy. La medición
// real (dónde cae cada bloque a 1440 px) se hace en Chromium y queda en el log del expediente.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`.

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { afterNavigate, replaceState } from "$app/navigation";
import { page } from "$app/stores";
import type { CkanPackage } from "$lib/types/ckan";
import ExtrasPlayground from "./+page.svelte";

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}

beforeAll(() => {
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
	Element.prototype.scrollIntoView = vi.fn();
});

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({ search: vi.fn(), listOrganizations: vi.fn() }));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "http://localhost:5000" } }));
vi.mock("$lib/api/client", () => ({ createCkanClient: () => ({}) }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ search: mocks.search }) }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ list: mocks.listOrganizations }),
}));
vi.mock("$lib/mock/data", () => ({
	getMockSearchResult: () => ({ count: 0, results: [], search_facets: {} }),
	MOCK_ORGS: [],
}));

function dataset(id: string, title: string): CkanPackage {
	return {
		id,
		name: id,
		title,
		private: false,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
	};
}

const MATRICULA = dataset("pkg-m", "Matrícula 2026");

/**
 * La búsqueda principal, el total del catálogo y la carga del vacío comparten `search`; la del vacío se distingue
 * por `limit: 3`, y es la que trae las facetas de los chips. Uno de sus recientes ya está en los resultados.
 */
function responder(conResultados: boolean) {
	return (params: { limit?: number } | undefined) => {
		if (params?.limit === 3) {
			return Promise.resolve({
				count: 3,
				results: [MATRICULA, dataset("pkg-a", "Censo 2026"), dataset("pkg-b", "Becas 2026")],
				search_facets: {
					res_format: { title: "Formato", items: [{ name: "CSV", display_name: "CSV", count: 9 }] },
					tags: { title: "Etiquetas", items: [{ name: "salud", display_name: "salud", count: 5 }] },
				},
			});
		}
		if (params?.limit === 0) return Promise.resolve({ count: 12, results: [], search_facets: {} });
		return Promise.resolve(
			conResultados
				? { count: 1, results: [MATRICULA], search_facets: {} }
				: { count: 0, results: [], search_facets: {} },
		);
	};
}

async function montar(search: string, conResultados = true) {
	pageStore.set({ params: {}, url: new URL(`http://localhost/dev/search-extras${search}`) });
	mocks.search.mockImplementation(responder(conResultados));
	const result = render(ExtrasPlayground);
	(vi.mocked(afterNavigate).mock.calls[0]?.[0] as (() => void) | undefined)?.();
	if (conResultados) await screen.findByRole("heading", { name: "Matrícula 2026" });
	else await screen.findByText("Sin resultados");
	return result;
}

/** Las llamadas de la carga del vacío (`limit: 3`). */
function cargasDelVacio() {
	return mocks.search.mock.calls.filter(([p]) => (p as { limit?: number })?.limit === 3).length;
}

function ultimaUrl(): string {
	return String(vi.mocked(replaceState).mock.calls.at(-1)?.[0] ?? "");
}

function sigue(a: Element, b: Element): boolean {
	return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.listOrganizations.mockResolvedValue([]);
});

afterEach(() => {
	document.body.innerHTML = "";
});

describe("playground de los bloques del vacío — con resultados", () => {
	it("como hoy: ningún bloque y ninguna llamada extra, pero los dos interruptores están en su sitio", async () => {
		const { container } = await montar("?q=matrícula");

		expect(screen.queryByRole("heading", { name: "Pruebe con" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Lo más reciente del catálogo" })).toBeNull();
		expect(cargasDelVacio()).toBe(0);
		expect(screen.getByTestId("toggle-pruebe")).toBeTruthy();
		expect(screen.getByTestId("toggle-recientes")).toBeTruthy();
		expect(container.querySelector("[data-extra]")).toBeNull();
	});

	it("«Pruebe con» va arriba de la lista, con su interruptor al lado, y sus chips conservan los interruptores", async () => {
		await montar("?q=matrícula&pruebe=on");

		const titulo = await screen.findByRole("heading", { name: "Pruebe con" });
		const tarjeta = screen.getByRole("heading", { name: "Matrícula 2026" });
		expect(sigue(titulo, tarjeta)).toBe(true);
		const seccion = titulo.closest("[data-extra-section]") as HTMLElement;
		expect(seccion.dataset.extraSection).toBe("pruebe");
		expect(within(seccion).getByTestId("toggle-pruebe")).toBeTruthy();
		expect(within(seccion).getByRole("link", { name: "CSV" }).getAttribute("href")).toBe(
			"/dev/search-extras?format=CSV&pruebe=on",
		);
		expect(screen.queryByRole("heading", { name: "Lo más reciente del catálogo" })).toBeNull();
	});

	it("«Lo más reciente» va después de la lista, con otro título y sin repetir las tarjetas de la página", async () => {
		await montar("?q=matrícula&recientes=on");

		const titulo = await screen.findByRole("heading", { name: "Lo más reciente del catálogo" });
		const tarjeta = screen.getAllByRole("heading", { name: "Matrícula 2026" });
		expect(tarjeta).toHaveLength(1);
		expect(sigue(tarjeta[0], titulo)).toBe(true);
		const seccion = titulo.closest("[data-extra-section]") as HTMLElement;
		expect(seccion.dataset.extraSection).toBe("recientes");
		expect(within(seccion).getByTestId("toggle-recientes")).toBeTruthy();
		expect(within(seccion).getByRole("heading", { name: "Censo 2026" })).toBeTruthy();
		expect(within(seccion).getByRole("heading", { name: "Becas 2026" })).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "Mientras tanto, lo más reciente" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Pruebe con" })).toBeNull();
	});

	it("el interruptor de cada sección prende y apaga sólo su bloque, y la URL lo guarda", async () => {
		await montar("?q=matrícula");

		const pruebe = screen.getByTestId("toggle-pruebe");
		await fireEvent.click(within(pruebe).getByRole("button", { name: "Siempre" }));
		expect(await screen.findByRole("heading", { name: "Pruebe con" })).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "Lo más reciente del catálogo" })).toBeNull();
		expect(ultimaUrl()).toBe("/dev/search-extras?q=matr%C3%ADcula&pruebe=on");

		const recientes = screen.getByTestId("toggle-recientes");
		await fireEvent.click(within(recientes).getByRole("button", { name: "Siempre" }));
		expect(
			await screen.findByRole("heading", { name: "Lo más reciente del catálogo" }),
		).toBeTruthy();
		expect(ultimaUrl()).toBe("/dev/search-extras?q=matr%C3%ADcula&pruebe=on&recientes=on");

		await fireEvent.click(within(pruebe).getByRole("button", { name: "Como hoy" }));
		expect(screen.queryByRole("heading", { name: "Pruebe con" })).toBeNull();
		expect(screen.getByRole("heading", { name: "Lo más reciente del catálogo" })).toBeTruthy();
		expect(ultimaUrl()).toBe("/dev/search-extras?q=matr%C3%ADcula&recientes=on");
		// Los datos son del catálogo entero: se cargan una sola vez, por más que se muevan los interruptores.
		expect(cargasDelVacio()).toBe(1);
	});

	it("los ajustes del panel: «Todo» prende los dos y «Como hoy» los apaga", async () => {
		await montar("?q=matrícula");
		const panel = screen.getByTestId("control-panel");

		await fireEvent.click(within(panel).getByTestId("preset-todo"));
		expect(await screen.findByRole("heading", { name: "Pruebe con" })).toBeTruthy();
		expect(
			await screen.findByRole("heading", { name: "Lo más reciente del catálogo" }),
		).toBeTruthy();
		expect(ultimaUrl()).toBe("/dev/search-extras?q=matr%C3%ADcula&pruebe=on&recientes=on");
		expect(within(panel).getByTestId("preset-todo").getAttribute("aria-pressed")).toBe("true");

		await fireEvent.click(within(panel).getByTestId("preset-hoy"));
		expect(screen.queryByRole("heading", { name: "Pruebe con" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Lo más reciente del catálogo" })).toBeNull();
		expect(ultimaUrl()).toBe("/dev/search-extras?q=matr%C3%ADcula");
		expect(within(panel).getByTestId("preset-hoy").getAttribute("aria-pressed")).toBe("true");
	});

	it("un chip lleva a esta misma ruta y la página vuelve a leer la URL (en `/search` el chip no hace nada)", async () => {
		await montar("?q=matrícula&pruebe=on");
		mocks.search.mockClear();

		const alNavegar = vi.mocked(afterNavigate).mock.calls[0]?.[0] as (n: unknown) => void;
		alNavegar({
			type: "link",
			from: { url: new URL("http://localhost/dev/search-extras?q=matr%C3%ADcula&pruebe=on") },
			to: { url: new URL("http://localhost/dev/search-extras?format=CSV&pruebe=on") },
		});

		await vi.waitFor(() =>
			expect(mocks.search).toHaveBeenCalledWith(
				expect.objectContaining({ q: "*:*", fq: expect.stringContaining("CSV") }),
			),
		);
		await vi.waitFor(() => expect(ultimaUrl()).toBe("/dev/search-extras?format=CSV&pruebe=on"));
	});
});

describe("playground de los bloques del vacío — sin resultados, el vacío de hoy", () => {
	it("con los dos interruptores prendidos, el vacío es el de hoy: aviso, saltos y los bloques con sus títulos", async () => {
		const { container } = await montar("?q=zzqqxx&pruebe=on&recientes=on", false);

		const seccion = container.querySelector("#sin-resultados") as HTMLElement;
		expect(within(seccion).getByRole("heading", { level: 2, name: "Sin resultados" })).toBeTruthy();
		expect(
			await within(seccion).findByRole("heading", {
				level: 3,
				name: "Mientras tanto, lo más reciente",
			}),
		).toBeTruthy();
		expect(within(seccion).getByRole("heading", { level: 3, name: "Pruebe con" })).toBeTruthy();
		const saltos = within(seccion).getByRole("navigation", {
			name: "Otras formas de encontrar datos",
		});
		expect(within(saltos).getByRole("link", { name: "Pruebe con" }).getAttribute("href")).toBe(
			"#pruebe-con",
		);
		// En el vacío, «lo más reciente» no se recorta: los tres, como hoy.
		expect(within(seccion).getAllByRole("heading", { level: 3 }).length).toBeGreaterThanOrEqual(2);
		expect(within(seccion).getByRole("heading", { name: "Matrícula 2026" })).toBeTruthy();
		// Ni los interruptores ni el título nuevo: eso es sólo con resultados.
		expect(container.querySelector("[data-extra-section]")).toBeNull();
		expect(screen.queryByRole("heading", { name: "Lo más reciente del catálogo" })).toBeNull();
		expect(cargasDelVacio()).toBe(1);
	});
});
