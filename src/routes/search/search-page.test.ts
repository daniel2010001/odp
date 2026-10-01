import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterNavigate } from "$app/navigation";
import { page } from "$app/stores";
import type { ApiClientConfig } from "$lib/types/api";
import type { CkanFacet, CkanOrganization, CkanPackage } from "$lib/types/ckan";
import SearchPage from "./+page.svelte";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el
// tipo real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	createCkanClient: vi.fn<(config: ApiClientConfig) => object>(),
	search: vi.fn(),
	listOrganizations: vi.fn(),
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
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ list: mocks.listOrganizations }),
}));
vi.mock("$lib/mock/data", () => ({
	getMockSearchResult: mocks.getMockSearchResult,
	MOCK_ORGS: [
		{
			id: "org-fcyt",
			name: "fcyt",
			title: "Facultad de Ciencias y Tecnología",
			description: "Fixture de DEV",
			created: "2024-01-15T10:00:00Z",
			state: "active",
			package_count: 45,
		},
	],
}));

function makeFacet(overrides: Partial<CkanFacet> = {}): CkanFacet {
	return {
		title: "Faceta",
		items: [{ name: "x", display_name: "X", count: 1 }],
		...overrides,
	};
}

function makeOrg(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-1",
		name: "org-1",
		title: "Organización",
		description: "Descripción de la organización",
		created: "2024-01-15T10:00:00Z",
		state: "active",
		package_count: 0,
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

/** El `fq` de la última búsqueda disparada; `undefined` cuando no quedan filtros. */
function lastSearchFq(): string | undefined {
	const args = mocks.search.mock.calls.at(-1)?.[0] as { fq?: string } | undefined;
	return args?.fq;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.createCkanClient.mockReturnValue({});
	mocks.search.mockResolvedValue({ count: 0, results: [], search_facets: {} });
	mocks.listOrganizations.mockResolvedValue([]);
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

describe("Página de búsqueda — el panel cuando hay filtros aplicados y no hay facetas", () => {
	it("con un filtro activo y cero resultados vuelve a mostrar el panel y lista el filtro", async () => {
		setUrl("?org=rectorado");

		const { container } = renderSearch();

		expect(await screen.findByText("Sin resultados")).toBeTruthy();
		// El panel no depende sólo de `hasFacets`: con filtros aplicados debe volver.
		expect(container.querySelector("aside")).not.toBeNull();
		expect(screen.getByRole("heading", { name: "Filtros" })).toBeTruthy();
		// Se agrupa con los mismos nombres que usan las facetas.
		expect(screen.getByText("Organización")).toBeTruthy();
		// Chip con nombre accesible que dice qué quita, no un «×» mudo.
		expect(
			screen.getByRole("button", { name: "Quitar filtro Organización: rectorado" }),
		).toBeTruthy();
	});

	it("quitar el chip re-ejecuta la búsqueda con el filtro ya quitado", async () => {
		setUrl("?org=rectorado");

		renderSearch();
		await screen.findByText("Sin resultados");

		await fireEvent.click(
			screen.getByRole("button", { name: "Quitar filtro Organización: rectorado" }),
		);

		await waitFor(() => {
			expect(lastSearchFq()).toBeUndefined();
		});
		// Al desaparecer el chip, el foco no cae a <body>: vuelve al buscador (el panel se fue
		// porque ya no quedaban filtros ni facetas).
		expect(document.activeElement).toBe(screen.getByRole("searchbox"));
	});

	it("mantiene la plantilla de dos columnas cuando el panel se sostiene por los filtros aplicados", async () => {
		setUrl("?org=rectorado");

		renderSearch();

		const resultsColumn = (await screen.findByText("Sin resultados")).closest(
			"div.min-w-0",
		) as HTMLElement | null;
		expect(resultsColumn).not.toBeNull();
		const wrapper = resultsColumn?.parentElement as HTMLElement;
		expect(wrapper.className).toContain("lg:grid-cols-[280px_1fr]");
	});
});

describe("Página de búsqueda — el vacío con contenido", () => {
	/**
	 * La búsqueda principal con cero resultados. **`search_facets` va vacío a propósito, porque así
	 * responde CKAN**: con cero coincidencias no hay facetas que contar. Una fixture que las inventara
	 * acá bendeciría un bloque de chips que en el catálogo real no puede aparecer — que es exactamente
	 * el defecto que esta forma evita.
	 */
	function emptySearch() {
		return { count: 0, results: [], search_facets: {} };
	}

	/**
	 * La búsqueda principal y la del total del catálogo comparten el mismo `search`; el bloque «lo más
	 * reciente» se distingue por su firma (`limit: 3`). **Esa llamada es también la fuente de los
	 * chips**: recorre todo el catálogo, así que trae las facetas que la búsqueda vacía no tiene.
	 */
	function respondBySignature(params: { limit?: number } | undefined) {
		if (params?.limit === 3) {
			return Promise.resolve({
				count: 3,
				results: [
					makeDataset({ id: "pkg-a", title: "Censo 2026" }),
					makeDataset({ id: "pkg-b", title: "Becas 2026" }),
					makeDataset({ id: "pkg-c", title: "Presupuesto 2026" }),
				],
				search_facets: {
					res_format: makeFacet({
						title: "Formato",
						items: [
							{ name: "CSV", display_name: "CSV", count: 9 },
							{ name: "PDF", display_name: "PDF", count: 4 },
						],
					}),
					tags: makeFacet({
						title: "Etiquetas",
						items: [
							{ name: "salud", display_name: "salud", count: 5 },
							{ name: "educacion", display_name: "educacion", count: 2 },
						],
					}),
				},
			});
		}
		return Promise.resolve(emptySearch());
	}

	it("con cero resultados apila los tres bloques debajo del vacío, en orden", async () => {
		setUrl("?q=matricula");
		mocks.search.mockImplementation(respondBySignature);
		mocks.listOrganizations.mockResolvedValue([
			makeOrg({
				id: "org-a",
				name: "fcyt",
				title: "Facultad de Ciencias y Tecnología",
				package_count: 50,
			}),
		]);

		renderSearch();

		const vacio = await screen.findByText("Sin resultados");
		const chips = await screen.findByRole("heading", { name: "Pruebe con" });
		const recientes = await screen.findByRole("heading", {
			name: "Mientras tanto, lo más reciente",
		});
		const orgs = await screen.findByRole("heading", { name: "Explorar por organización" });

		// El vacío original queda primero; después «Pruebe con», lo reciente y las organizaciones.
		expect(vacio.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(
			chips.compareDocumentPosition(recientes) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(recientes.compareDocumentPosition(orgs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("los chips de «Pruebe con» llevan a la búsqueda filtrada por formato y por etiqueta", async () => {
		setUrl("?q=matricula");
		mocks.search.mockImplementation(respondBySignature);

		renderSearch();

		await screen.findByText("Sin resultados");

		expect(await screen.findByRole("link", { name: "CSV" })).toHaveAttribute(
			"href",
			"/search?format=CSV",
		);
		expect(await screen.findByRole("link", { name: "PDF" })).toHaveAttribute(
			"href",
			"/search?format=PDF",
		);
		expect(await screen.findByRole("link", { name: "salud" })).toHaveAttribute(
			"href",
			"/search?tags=salud",
		);
	});

	it("el bloque de organizaciones muestra como máximo las tres con más datasets", async () => {
		setUrl("?q=matricula");
		mocks.search.mockImplementation(respondBySignature);
		mocks.listOrganizations.mockResolvedValue([
			makeOrg({ id: "org-e", name: "e", title: "E", package_count: 5 }),
			makeOrg({ id: "org-a", name: "a", title: "A", package_count: 50 }),
			makeOrg({ id: "org-d", name: "d", title: "D", package_count: 10 }),
			makeOrg({ id: "org-b", name: "b", title: "B", package_count: 30 }),
			makeOrg({ id: "org-c", name: "c", title: "C", package_count: 20 }),
		]);

		renderSearch();

		await screen.findByText("Sin resultados");
		await screen.findByRole("heading", { name: "Explorar por organización" });

		const links = Array.from(document.querySelectorAll('a[href^="/organization/"]'));
		expect(links).toHaveLength(3);
		// Ordenadas por `package_count` descendente: entran las de 50, 30 y 20.
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/organization/a",
			"/organization/b",
			"/organization/c",
		]);
	});

	it("con resultados no aparece ningún bloque ni se disparan las llamadas extra", async () => {
		setUrl("?q=matricula");
		mocks.search.mockImplementation(() =>
			Promise.resolve({ count: 1, results: [makeDataset()], search_facets: {} }),
		);

		renderSearch();

		await screen.findByRole("heading", { name: "Matrícula 2026" });

		expect(screen.queryByRole("heading", { name: "Pruebe con" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Mientras tanto, lo más reciente" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Explorar por organización" })).toBeNull();
		// La llamada lazy se reconoce por su firma; la del total del catálogo usa `limit: 0`.
		const lazyCalls = mocks.search.mock.calls.filter(
			([params]) => (params as { limit?: number } | undefined)?.limit === 3,
		);
		expect(lazyCalls).toHaveLength(0);
		expect(mocks.listOrganizations).not.toHaveBeenCalled();
	});

	it("en desarrollo, una falla cae al contenido mock y no deja el vacío solo", async () => {
		vi.stubEnv("DEV", true);
		setUrl("?q=matricula");
		mocks.search.mockImplementation((params: { limit?: number } | undefined) => {
			if (params?.limit === 3) return Promise.reject(new Error("sin red"));
			if (params?.limit === 0) {
				return Promise.resolve({ count: 0, results: [], search_facets: {} });
			}
			return Promise.resolve(emptySearch());
		});
		mocks.listOrganizations.mockRejectedValue(new Error("sin red"));
		mocks.getMockSearchResult.mockReturnValue({
			count: 45,
			results: [makeDataset({ id: "mock-1", title: "Dataset mock" })],
			search_facets: {},
		});

		renderSearch();

		await screen.findByText("Sin resultados");

		expect(
			await screen.findByRole("heading", { name: "Mientras tanto, lo más reciente" }),
		).toBeTruthy();
		expect(await screen.findByRole("heading", { name: "Explorar por organización" })).toBeTruthy();
	});

	it("si una de las dos llamadas falla, la otra se muestra igual (los bloques son independientes)", async () => {
		vi.stubEnv("DEV", true);
		setUrl("?q=matricula");
		mocks.search.mockImplementation((params: { limit?: number } | undefined) => {
			// «lo más reciente» (limit 3) falla; la búsqueda principal y el conteo responden.
			if (params?.limit === 3) return Promise.reject(new Error("sin red"));
			if (params?.limit === 0) {
				return Promise.resolve({ count: 0, results: [], search_facets: {} });
			}
			return Promise.resolve(emptySearch());
		});
		// Las organizaciones, en cambio, responden bien: con un dato propio, no el mock.
		mocks.listOrganizations.mockResolvedValue([
			makeOrg({ id: "org-sola", name: "fcyt", title: "Facultad de Ciencias y Tecnología" }),
		]);
		mocks.getMockSearchResult.mockReturnValue({
			count: 45,
			results: [makeDataset({ id: "mock-1", title: "Dataset mock" })],
			search_facets: {},
		});

		renderSearch();

		await screen.findByText("Sin resultados");

		// El bloque que falló cae al contenido de desarrollo y se pinta igual…
		expect(
			await screen.findByRole("heading", { name: "Mientras tanto, lo más reciente" }),
		).toBeTruthy();
		// …y el que respondió bien muestra SU dato: ninguno tumbó al otro.
		expect(await screen.findByRole("heading", { name: "Explorar por organización" })).toBeTruthy();
		expect(screen.getByText("Facultad de Ciencias y Tecnología")).toBeTruthy();
	});

	it("mientras el vacío siga en pantalla, un cambio de orden no vuelve a cargar los bloques", async () => {
		setUrl("?q=matricula");
		mocks.search.mockImplementation(respondBySignature);

		renderSearch();

		await screen.findByText("Sin resultados");
		await screen.findByRole("heading", { name: "Mientras tanto, lo más reciente" });

		await fireEvent.change(screen.getByRole("combobox"), {
			target: { value: "title_string asc" },
		});
		await waitFor(() => {
			expect(
				mocks.search.mock.calls.some(
					([params]) => (params as { sort?: string } | undefined)?.sort === "title_string asc",
				),
			).toBe(true);
		});

		const lazyCalls = mocks.search.mock.calls.filter(
			([params]) => (params as { limit?: number } | undefined)?.limit === 3,
		);
		expect(lazyCalls).toHaveLength(1);
		expect(mocks.listOrganizations).toHaveBeenCalledTimes(1);
	});

	it("sin facetas ni datos no se anexa ningún bloque: queda el aviso original", async () => {
		setUrl("?q=matricula");

		renderSearch();

		await screen.findByText("Sin resultados");
		await waitFor(() => {
			expect(mocks.listOrganizations).toHaveBeenCalledTimes(1);
		});

		expect(screen.queryByRole("heading", { name: "Pruebe con" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Mientras tanto, lo más reciente" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Explorar por organización" })).toBeNull();
	});

	it("fuera de desarrollo, sin datos no se fabrica contenido", async () => {
		vi.stubEnv("DEV", false);
		setUrl("?q=matricula");
		mocks.search.mockImplementation((params: { limit?: number } | undefined) => {
			if (params?.limit === 3) return Promise.reject(new Error("sin red"));
			return Promise.resolve(emptySearch());
		});
		mocks.listOrganizations.mockRejectedValue(new Error("sin red"));

		renderSearch();

		await screen.findByText("Sin resultados");
		await waitFor(() => {
			expect(mocks.listOrganizations).toHaveBeenCalledTimes(1);
		});

		expect(screen.queryByRole("heading", { name: "Mientras tanto, lo más reciente" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Explorar por organización" })).toBeNull();
		expect(screen.getByText("Sin resultados")).toBeTruthy();
	});
});
