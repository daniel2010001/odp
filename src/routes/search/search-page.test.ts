import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterNavigate } from "$app/navigation";
import { page } from "$app/stores";
import type { ApiClientConfig } from "$lib/types/api";
import type { CkanFacet, CkanPackage } from "$lib/types/ckan";
import SearchPage from "./+page.svelte";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el
// tipo real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	createCkanClient: vi.fn<(config: ApiClientConfig) => object>(),
	search: vi.fn(),
	getMockSearchResult: vi.fn(),
}));

// Se mockea en el borde de módulo para que la búsqueda nunca dispare HTTP real. El mock de DEV se
// fija a un vacío centinela: si la página cayera al respaldo, no aparecería ninguna faceta y el
// test lo notaría en vez de pasar por accidente.
vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000" },
}));
vi.mock("$lib/api/client", () => ({ createCkanClient: mocks.createCkanClient }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ search: mocks.search }) }));
vi.mock("$lib/mock/data", () => ({ getMockSearchResult: mocks.getMockSearchResult }));

function makeFacet(overrides: Partial<CkanFacet> = {}): CkanFacet {
	return {
		title: "Faceta",
		items: [{ name: "x", display_name: "X", count: 1 }],
		...overrides,
	};
}

function makeDataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: false,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

function setUrl(search: string) {
	pageStore.set({ params: {}, url: new URL(`http://localhost/search${search}`) });
}

/**
 * Monta la página y despierta la búsqueda.
 *
 * El stub de `$app/navigation` expone `afterNavigate` como `vi.fn()` que no ejecuta su callback;
 * la página arranca la búsqueda sólo cuando ese callback corre (`routerReady`). El test lo invoca
 * una vez, igual que haría el router real al entrar a la ruta.
 */
function renderSearch() {
	const result = render(SearchPage);
	const onReady = vi.mocked(afterNavigate).mock.calls[0]?.[0] as (() => void) | undefined;
	onReady?.();
	return result;
}

/** La oración del estado vacío, no la acción «Limpiar búsqueda y filtros» que la acompaña. */
function emptyMessage(): string {
	return screen.getByText(/^No encontramos datasets/).textContent ?? "";
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.createCkanClient.mockReturnValue({});
	mocks.search.mockResolvedValue({ count: 0, results: [], search_facets: {} });
	mocks.getMockSearchResult.mockReturnValue({ count: 0, results: [], search_facets: {} });
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("Página de búsqueda — el panel de filtros sin facetas", () => {
	it("no renderiza el panel de filtros cuando la búsqueda no devuelve ninguna faceta", async () => {
		setUrl("?q=matricula");

		const { container } = renderSearch();

		expect(await screen.findByText("Sin resultados")).toBeTruthy();
		// Sin facetas no hay nada que filtrar: el marco con el título «Filtros» no debe quedar solo.
		expect(container.querySelector("aside")).toBeNull();
		expect(screen.queryByRole("heading", { name: "Filtros" })).toBeNull();
	});

	it("colapsa el contenedor a una sola columna, sin reservar el ancho del panel", async () => {
		setUrl("?q=matricula");

		renderSearch();

		const resultsColumn = (await screen.findByText("Sin resultados")).closest(
			"div.min-w-0",
		) as HTMLElement | null;
		expect(resultsColumn).not.toBeNull();
		const wrapper = resultsColumn?.parentElement as HTMLElement;
		// El área de resultados toma todo el ancho: ni `lg:grid` ni la plantilla de 280px.
		expect(wrapper.className).not.toContain("lg:grid");
		expect(wrapper.className).not.toContain("280px");
	});

	it("con facetas conserva el panel y la plantilla de dos columnas", async () => {
		setUrl("?q=matricula");
		mocks.search.mockResolvedValue({
			count: 1,
			results: [makeDataset()],
			search_facets: { organization: makeFacet({ title: "Organización" }) },
		});

		const { container } = renderSearch();

		expect(await screen.findByRole("heading", { name: "Matrícula 2026" })).toBeTruthy();
		const aside = container.querySelector("aside") as HTMLElement | null;
		expect(aside).not.toBeNull();
		expect((aside as HTMLElement).parentElement?.className).toContain("lg:grid-cols-[280px_1fr]");
	});
});

describe("Página de búsqueda — el texto del estado vacío", () => {
	it("con una búsqueda sin filtros activos no menciona los filtros", async () => {
		setUrl("?q=matricula");

		renderSearch();

		await screen.findByText("Sin resultados");
		const message = emptyMessage();
		expect(message).toContain("Pruebe con otros términos");
		// Los filtros no están aplicados ni visibles: invitarlos sería una promesa vacía.
		expect(message).not.toMatch(/filtros?/i);
	});

	it("con filtros activos invita a limpiarlos, porque la acción existe", async () => {
		setUrl("?q=matricula&org=rectorado");

		renderSearch();

		await screen.findByText("Sin resultados");
		expect(emptyMessage()).toMatch(/limpie los filtros/i);
		// La acción prometida sigue en pie.
		expect(screen.getByRole("button", { name: "Limpiar búsqueda y filtros" })).toBeTruthy();
	});

	it("sin búsqueda ni filtros activos se limita a decir que no hay datasets", async () => {
		// Sin `q`: es la rama que `emptyMessage()` (que exige «No encontramos datasets») no cubre.
		setUrl("");

		renderSearch();

		await screen.findByText("Sin resultados");
		expect(screen.getByText("No hay datasets disponibles en este momento.")).toBeTruthy();
		// Sin filtros aplicados ni panel visible, invitar a limpiarlos sería una promesa vacía.
		expect(screen.queryByText(/limpie los filtros/i)).toBeNull();
	});

	it("sin búsqueda pero con filtros activos invita a limpiarlos", async () => {
		setUrl("?org=rectorado");

		renderSearch();

		await screen.findByText("Sin resultados");
		expect(
			screen.getByText(
				"No hay datasets disponibles con los filtros aplicados. Limpie los filtros para ver todo el catálogo.",
			),
		).toBeTruthy();
	});
});
