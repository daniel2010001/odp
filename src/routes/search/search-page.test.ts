import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { afterNavigate, replaceState } from "$app/navigation";
import { page } from "$app/stores";
import type { ApiClientConfig } from "$lib/types/api";
import type { CkanFacet, CkanOrganization, CkanPackage } from "$lib/types/ckan";
import SearchPage from "./+page.svelte";

/**
 * jsdom no implementa `ResizeObserver`, que el `bind:clientHeight` de la barra pegajosa usa para
 * medir (su alto entra en el margen de los saltos del vacío). El stub **no mide layout**: entrega
 * el alto que el test controla, y eso es justo lo que vuelve significativa la aserción del margen
 * medido (si no, cualquier constante la pasaría).
 *
 * Svelte 5.56.3 (`bind_element_size`) ignora el `entry` del observer y lee `element.clientHeight`
 * dentro del listener; por eso hay que fijar esa propiedad en el elemento observado antes de
 * disparar el callback, no inventar un `contentRect`.
 */
class ResizeObserverStub {
	static targets: Element[] = [];
	static callback: ResizeObserverCallback | null = null;

	constructor(callback: ResizeObserverCallback) {
		ResizeObserverStub.callback = callback;
	}

	observe(target: Element) {
		ResizeObserverStub.targets.push(target);
	}

	unobserve(target: Element) {
		ResizeObserverStub.targets = ResizeObserverStub.targets.filter((t) => t !== target);
	}

	/**
	 * Svelte usa un **singleton de módulo** (`resize_observer_border_box`): el callback se fija una
	 * sola vez, en el primer `new ResizeObserver(...)`, y sigue siendo válido después de
	 * `disconnect()`. Por eso acá se limpian los destinos y **no** el callback — limpiarlo rompería
	 * las mediciones siguientes, porque el singleton no vuelve a construirse.
	 */
	disconnect() {
		ResizeObserverStub.targets = [];
	}
}

/**
 * jsdom tampoco implementa `Element.prototype.scrollIntoView` (el navegador lo usa para aterrizar
 * en el `#id` de un enlace copiado). El doble **no mide**: sólo registra el elemento destino, que
 * es lo que la aserción necesita.
 */
const scrollIntoView = vi.fn();

/** Simula una medición: fija el alto en el elemento observado y dispara el callback del observer. */
function medirAltoBarra(alto: number) {
	for (const target of ResizeObserverStub.targets) {
		Object.defineProperty(target, "clientHeight", {
			configurable: true,
			get: () => alto,
		});
	}
	ResizeObserverStub.callback?.(
		ResizeObserverStub.targets.map((target) => ({ target }) as ResizeObserverEntry),
		{} as ResizeObserver,
	);
}

beforeAll(() => {
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
	Element.prototype.scrollIntoView = scrollIntoView;
});

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
	// Aislamiento del stub de medición (`R3-001` de `review-5c51328ff49347d3`): los destinos
	// observados por un render anterior no deben seguir midiéndose en el test siguiente. El callback
	// no se toca: el singleton de Svelte lo fija una sola vez para todo el archivo.
	ResizeObserverStub.targets = [];
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
		// Hay dos campos —el del hero y el de la barra de resultados—; el foco vuelve al primero.
		expect(document.activeElement).toBe(screen.getAllByRole("searchbox")[0]);
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

	it("la llamada del catálogo pide las facetas que alimentan los chips", async () => {
		// La propiedad que hace funcionar los chips: si estos parámetros se quitan o se renombran, la
		// respuesta deja de traer facetas y el bloque desaparece (`R3-001` de `review-a4119e82b86ac72e`).
		setUrl("?q=matricula");
		mocks.search.mockImplementation(respondBySignature);

		renderSearch();

		await screen.findByText("Sin resultados");
		await waitFor(() => {
			expect(
				mocks.search.mock.calls.some(([params]) => {
					const p = params as { limit?: number; facet_field?: string[] } | undefined;
					return p?.limit === 3 && (p.facet_field ?? []).includes("res_format");
				}),
			).toBe(true);
		});
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

	it("con un texto buscado y sin orden elegido, el orden por defecto es «Relevancia»", async () => {
		// Decisión del autor (L70 de `odd/tasks/v0.1.1-polish.md`): «relevancia como default». Sin texto no hay
		// relevancia que medir, así que el catálogo vacío sigue empezando por lo más reciente.
		setUrl("?q=matricula");
		renderSearch();

		await waitFor(() => expect(mocks.search).toHaveBeenCalled());
		const sort = (
			mocks.search.mock.calls.find(([p]) => (p as { limit?: number }).limit === 20)?.[0] as
				| { sort?: string }
				| undefined
		)?.sort;
		expect(sort).toBe("score desc");
		expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("score desc");
	});

	it("sin texto, el orden por defecto sigue siendo «Más recientes»", async () => {
		setUrl("");
		renderSearch();

		await waitFor(() => expect(mocks.search).toHaveBeenCalled());
		const sort = (
			mocks.search.mock.calls.find(([p]) => (p as { limit?: number }).limit === 20)?.[0] as
				| { sort?: string }
				| undefined
		)?.sort;
		expect(sort).toBe("metadata_modified desc");
	});

	it("un orden elegido en la URL manda aunque haya texto", async () => {
		setUrl("?q=matricula&sort=title_string%20asc");
		renderSearch();

		await waitFor(() => expect(mocks.search).toHaveBeenCalled());
		const sort = (
			mocks.search.mock.calls.find(([p]) => (p as { limit?: number }).limit === 20)?.[0] as
				| { sort?: string }
				| undefined
		)?.sort;
		expect(sort).toBe("title_string asc");
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

	it("fuera de desarrollo, un catálogo caído dice la frase de failure.ts", async () => {
		vi.stubEnv("DEV", false);
		setUrl("?q=matricula");
		mocks.search.mockRejectedValue(new Error("sin red"));

		renderSearch();

		expect(
			await screen.findByText(
				"No se pudo completar la consulta al catálogo de datos. Intente nuevamente más tarde.",
			),
		).toBeTruthy();
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

describe("Página de búsqueda — el vacío como una sección con saltos", () => {
	/**
	 * Los tres bloques encendidos: la búsqueda del catálogo (`limit: 3`) trae los datasets recientes
	 * y las facetas que alimentan los chips; las organizaciones responden con un dato propio. Con los
	 * tres bloques condicionales presentes, los tres saltos deben existir.
	 */
	function responderConTodo(params: { limit?: number } | undefined) {
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
						items: [{ name: "CSV", display_name: "CSV", count: 9 }],
					}),
				},
			});
		}
		return Promise.resolve({ count: 0, results: [], search_facets: {} });
	}

	/** El nombre accesible de la fila de saltos, y los destinos con la etiqueta visible de su bloque. */
	const ROTULO_SALTOS = "Otras formas de encontrar datos";
	const DESTINOS = [
		{ id: "pruebe-con", label: "Pruebe con" },
		{ id: "recientes", label: "Mientras tanto, lo más reciente" },
		{ id: "organizaciones", label: "Explorar por organización" },
	];

	/** Monta el vacío con los tres bloques ya pintados. */
	async function montarVacíoConTodo(fragmento = "") {
		setUrl(`?q=matricula${fragmento}`);
		mocks.search.mockImplementation(responderConTodo);
		mocks.listOrganizations.mockResolvedValue([
			makeOrg({
				id: "org-a",
				name: "fcyt",
				title: "Facultad de Ciencias y Tecnología",
				package_count: 50,
			}),
		]);
		renderSearch();
		// Los tres bloques salen de dos fuentes independientes: la búsqueda del catálogo (`limit: 3`)
		// alimenta «Pruebe con» y «lo más reciente», y `listOrganizations` alimenta «Explorar por
		// organización». Esperar a que aparezca un encabezado no garantiza los otros, así que se espera
		// a la fila de saltos completa: sus tres enlaces sólo existen cuando los tres bloques están
		// pintados y no se observa un estado a medio renderizar.
		const fila = await screen.findByRole("navigation", { name: ROTULO_SALTOS });
		await waitFor(() => {
			expect(within(fila).getAllByRole("link")).toHaveLength(3);
		});
	}

	it("el aviso del vacío es el nombre accesible de la sección y ahora es un encabezado de nivel 2", async () => {
		setUrl("?q=matricula");

		renderSearch();

		// El `<p>` promovido: el copy y la apariencia no cambian, el nivel semántico sí.
		const titulo = await screen.findByRole("heading", { level: 2, name: "Sin resultados" });
		expect(titulo.id).toBe("sin-resultados-titulo");
		const seccion = screen.getByRole("region", { name: "Sin resultados" });
		expect(seccion.tagName).toBe("SECTION");
		expect(seccion.id).toBe("sin-resultados");
	});

	it("con los tres bloques, la fila ofrece un enlace por bloque y ninguno apunta a un destino ausente", async () => {
		await montarVacíoConTodo();

		const fila = screen.getByRole("navigation", { name: ROTULO_SALTOS });
		const enlaces = within(fila).getAllByRole("link");

		expect(enlaces).toHaveLength(3);
		expect(enlaces.map((enlace) => enlace.getAttribute("href"))).toEqual(
			DESTINOS.map((destino) => `#${destino.id}`),
		);
		// La etiqueta visible es el mismo texto del `<h3>` del bloque destino.
		expect(enlaces.map((enlace) => enlace.textContent?.trim())).toEqual(
			DESTINOS.map((destino) => destino.label),
		);
		// La regla de oro: cada `href` resuelve a un elemento que existe. Un salto muerto es un
		// affordance muerto, igual que el control deshabilitado de la paginación.
		for (const destino of DESTINOS) {
			expect(document.getElementById(destino.id)).not.toBeNull();
		}
	});

	it("con un solo bloque visible ofrece un solo salto, y apunta al bloque que existe", async () => {
		vi.stubEnv("DEV", false);
		setUrl("?q=matricula");
		mocks.search.mockImplementation((params: { limit?: number } | undefined) => {
			// «lo más reciente» falla —y sus facetas con él, así que tampoco hay chips—: sólo las
			// organizaciones responden y son el único destino posible.
			if (params?.limit === 3) return Promise.reject(new Error("sin red"));
			return Promise.resolve({ count: 0, results: [], search_facets: {} });
		});
		mocks.listOrganizations.mockResolvedValue([makeOrg({ id: "org-sola", name: "fcyt" })]);

		renderSearch();

		await screen.findByRole("heading", { name: "Explorar por organización" });

		const fila = screen.getByRole("navigation", { name: ROTULO_SALTOS });
		const enlaces = within(fila).getAllByRole("link");

		expect(enlaces).toHaveLength(1);
		expect(enlaces[0].getAttribute("href")).toBe("#organizaciones");
		expect(document.getElementById("organizaciones")).not.toBeNull();
		// Los bloques ausentes no reciben salto.
		expect(within(fila).queryByRole("link", { name: "Pruebe con" })).toBeNull();
		expect(
			within(fila).queryByRole("link", { name: "Mientras tanto, lo más reciente" }),
		).toBeNull();
	});

	it("sin ningún bloque no hay destinos, y la fila de saltos no se dibuja", async () => {
		vi.stubEnv("DEV", false);
		setUrl("?q=matricula");
		mocks.search.mockImplementation((params: { limit?: number } | undefined) => {
			if (params?.limit === 3) return Promise.reject(new Error("sin red"));
			return Promise.resolve({ count: 0, results: [], search_facets: {} });
		});
		mocks.listOrganizations.mockRejectedValue(new Error("sin red"));

		renderSearch();

		await screen.findByText("Sin resultados");
		await waitFor(() => {
			expect(mocks.listOrganizations).toHaveBeenCalledTimes(1);
		});

		// La sección sigue existiendo con su aviso; lo que no existe es una fila de saltos vacía.
		expect(screen.getByRole("region", { name: "Sin resultados" })).toBeTruthy();
		expect(screen.queryByRole("navigation", { name: ROTULO_SALTOS })).toBeNull();
	});

	it("cada bloque alcanzable reserva el margen del chrome pegajoso, con el token y el alto medido", async () => {
		await montarVacíoConTodo();

		for (const destino of DESTINOS) {
			const style = document.getElementById(destino.id)?.getAttribute("style") ?? "";
			expect(style).toContain("scroll-margin-top");
			// El alto de la barra se mide (`bind:clientHeight`), no se escribe a mano: el margen
			// se expresa con el token `--header-h` más el valor medido.
			expect(style).toContain("calc(var(--header-h)");
			// El aire es el token compartido, no el `1rem` de antes (T17 / S15).
			expect(style).toContain("var(--sticky-air)");
			expect(style).not.toContain("1rem");
		}

		// Dos medidas distintas tienen que producir dos márgenes distintos. Si el alto medido dejara
		// de alimentar la interpolación (o se hardcodeara), ambos disparos darían el mismo `style` y
		// esta aserción fallaría; por eso se usa más de un valor y no un único 0px de jsdom.
		medirAltoBarra(68);
		await waitFor(() => {
			expect(document.getElementById("pruebe-con")?.getAttribute("style")).toContain(
				"calc(var(--header-h) + 1px + 68px + var(--sticky-air))",
			);
		});

		medirAltoBarra(100);
		await waitFor(() => {
			expect(document.getElementById("pruebe-con")?.getAttribute("style")).toContain(
				"calc(var(--header-h) + 1px + 100px + var(--sticky-air))",
			);
		});
	});

	it("re-aplica el fragmento de un enlace copiado cuando el destino y el margen ya existen", async () => {
		// Orden A — «destino, después barra»: los tres bloques (y con ellos el `#organizaciones`) ya
		// están pintados, y recién entonces se mide la barra. El test que le sigue cubre el orden
		// inverso (barra, después destino) y **no lo reemplaza**: con el destino ya presente, un efecto
		// al que le falte la dependencia `saltos.length` pasaría igual. No los consolide.
		//
		// El navegador resuelve el `#organizaciones` del enlace copiado antes de que los bloques
		// perezosos existan; la página tiene que re-aplicarlo (`R3-001` de `review-fda3530895a9b51f`).
		await montarVacíoConTodo("#organizaciones");
		const destino = document.getElementById("organizaciones");
		// El margen sólo es usable con la barra pegajosa medida; hasta entonces el efecto se detiene.
		medirAltoBarra(68);

		await waitFor(() => {
			expect(scrollIntoView.mock.contexts).toContain(destino);
		});
	});

	it("re-aplica el fragmento cuando la barra se mide antes de que lleguen los bloques perezosos", async () => {
		// Orden B — «barra, después destino»: es el orden real de una carga fresca de un enlace
		// copiado. La barra se mide con la página recién pintada, cuando los bloques perezosos
		// **todavía no llegaron** y el `#organizaciones` no existe; el aterrizaje sólo puede ocurrir
		// cuando esos bloques aparecen. Este es el único de los dos que ejerce la dependencia reactiva
		// de `saltos.length`: al llegar los bloques, nada más cambia, así que un efecto al que le falte
		// esa lectura no vuelve a correr y el fragmento queda sin aplicar. No consolide este test con el
		// anterior.
		let resolverBusqueda: ((valor: unknown) => void) | undefined;
		let resolverOrgs: ((valor: unknown) => void) | undefined;
		setUrl("?q=matricula#organizaciones");
		mocks.search.mockImplementation((params: { limit?: number } | undefined) => {
			// La búsqueda del catálogo (`limit: 3`) queda pendiente a propósito: los bloques perezosos
			// no llegan hasta que el test lo decide.
			if (params?.limit === 3) {
				return new Promise<unknown>((resolve) => {
					resolverBusqueda = resolve;
				});
			}
			return Promise.resolve({ count: 0, results: [], search_facets: {} });
		});
		mocks.listOrganizations.mockImplementation(
			() =>
				new Promise<unknown>((resolve) => {
					resolverOrgs = resolve;
				}),
		);

		renderSearch();
		// La barra se mide ya, con el vacío pintado pero sin destino.
		medirAltoBarra(68);
		await tick();
		await waitFor(() => expect(resolverBusqueda).toBeDefined());
		// El efecto ya corrió con la barra medida y sin destino: todavía no debe haber aterrizado.
		expect(document.getElementById("organizaciones")).toBeNull();
		expect(scrollIntoView).not.toHaveBeenCalled();

		// Recién ahora llegan los bloques: el destino nace **después** de la medición.
		resolverBusqueda?.({
			count: 3,
			results: [makeDataset({ id: "pkg-a", title: "Censo 2026" })],
			search_facets: {
				res_format: makeFacet({
					title: "Formato",
					items: [{ name: "CSV", display_name: "CSV", count: 9 }],
				}),
			},
		});
		await waitFor(() => expect(resolverOrgs).toBeDefined());
		resolverOrgs?.([
			makeOrg({
				id: "org-a",
				name: "fcyt",
				title: "Facultad de Ciencias y Tecnología",
				package_count: 50,
			}),
		]);

		const fila = await screen.findByRole("navigation", { name: ROTULO_SALTOS });
		await waitFor(() => {
			expect(within(fila).getAllByRole("link")).toHaveLength(3);
		});
		const destino = document.getElementById("organizaciones");

		await waitFor(() => {
			expect(scrollIntoView.mock.contexts).toContain(destino);
		});
	});

	it("sin fragmento en la URL no desplaza por su cuenta", async () => {
		await montarVacíoConTodo();
		medirAltoBarra(68);

		// El efecto ya corrió (bloques y barra listos); que no haya desplazado es el contrato.
		await waitFor(() => {
			expect(document.getElementById("organizaciones")).not.toBeNull();
		});
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it("al sincronizar la URL conserva el fragmento del enlace copiado", async () => {
		// `syncUrl` rearma la URL desde el estado de los filtros; si no re-adjunta el hash, el
		// enlace copiado pierde el ancla aunque el navegador haya aterrizado en ella.
		setUrl("?q=matricula#organizaciones");

		renderSearch();

		await waitFor(() => {
			expect(replaceState).toHaveBeenCalled();
		});
		// URL exacta: un `toContain` también lo satisfaría un hash viejo en `$page.url` que el
		// router nunca recibió, que es justo el accidente que la URL conservada evita.
		expect(vi.mocked(replaceState).mock.calls.at(-1)?.[0]).toBe(
			"/search?q=matricula#organizaciones",
		);
	});

	it("sin fragmento, la URL sincronizada no arrastra un #", async () => {
		setUrl("?q=matricula");

		renderSearch();

		await waitFor(() => {
			expect(replaceState).toHaveBeenCalled();
		});
		const url = vi.mocked(replaceState).mock.calls.at(-1)?.[0] as string;
		expect(url).toBe("/search?q=matricula");
		expect(url.endsWith("#")).toBe(false);
	});

	it("el salto es un enlace con borde, no el enlace de texto que comparte estilo con «Limpiar»", async () => {
		// Codifica la decisión del autor del 2026-10-01 (lectura A, variante V3 «botón secundario»):
		// el enlace de texto compartía color y ausencia de subrayado con «Limpiar búsqueda y filtros»,
		// así que dos acciones distintas se leían igual. No lo «limpie» de vuelta al enlace de texto.
		await montarVacíoConTodo();

		const fila = screen.getByRole("navigation", { name: ROTULO_SALTOS });
		const enlace = within(fila).getByRole("link", { name: "Pruebe con" });

		expect(enlace.tagName).toBe("A");
		expect(enlace.className).toContain("border");
		expect(enlace.className).toContain("rounded-lg");
		expect(enlace.className).not.toContain("hover:underline");
	});
});

// ─── Los pegados del buscador (T17 / S15 de `odd/tasks/v0.1.1-polish.md`) ──────────────────────
// jsdom no tiene layout: no hay media queries ni rectángulos. Se anclan la estructura que garantiza
// la geometría (tokens, clases, qué elemento vive dónde por estado) y, con `matchMedia` y
// `getBoundingClientRect` controlados, las decisiones que la página toma a partir de ellos. La
// medición real (Chromium) queda en el log del expediente.
describe("Página de búsqueda — los pegados", () => {
	const css = readFileSync(join(import.meta.dirname, "..", "..", "app.css"), "utf8");
	const matchMediaOriginal = window.matchMedia;
	let rectSpy: ReturnType<typeof vi.spyOn> | undefined;
	let header: HTMLElement | undefined;

	/** Ancho de ventana simulado: `(min-width: Npx)` coincide si N ≤ ancho; `reducido` fija el resto. */
	function fijarVentana(ancho: number, reducido = false) {
		window.matchMedia = ((query: string) => {
			const min = query.match(/min-width:\s*(\d+)px/);
			const matches = min
				? Number(min[1]) <= ancho
				: /prefers-reduced-motion/.test(query) && reducido;
			return {
				matches,
				media: query,
				onchange: null,
				addEventListener: () => {},
				removeEventListener: () => {},
				addListener: () => {},
				removeListener: () => {},
				dispatchEvent: () => false,
			} as unknown as MediaQueryList;
		}) as typeof window.matchMedia;
	}

	/** Rectángulos controlados: el encabezado baja hasta 65 px; la barra y el hero, donde el test diga. */
	function fijarGeometria({ barTop, heroBottom }: { barTop: number; heroBottom: number }) {
		header = document.createElement("header");
		header.setAttribute("data-site-header", "");
		document.body.append(header);
		const rect = (top: number, bottom: number, left = 0, right = 1000) =>
			({
				top,
				bottom,
				left,
				right,
				width: right - left,
				height: bottom - top,
				x: left,
				y: top,
			}) as DOMRect;
		rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
			this: Element,
		) {
			if (this.matches("[data-site-header]")) return rect(0, 65);
			if (this.matches("[data-results-bar]")) return rect(barTop, barTop + 68);
			if (this.matches("[data-hero-search]")) return rect(heroBottom - 56, heroBottom);
			if (this.matches("[data-results-column]")) return rect(400, 2000, 312, 1000);
			if (this.matches("aside")) return rect(400, 1000, 32, 312);
			return rect(0, 0);
		});
	}

	async function montarConFacetas() {
		setUrl("?q=matricula");
		mocks.search.mockResolvedValue({
			count: 1,
			results: [makeDataset()],
			search_facets: { organization: makeFacet({ title: "Organización" }) },
		});
		const view = renderSearch();
		await screen.findByRole("heading", { name: "Matrícula 2026" });
		await tick();
		return view;
	}

	const barra = () => document.querySelector("[data-results-bar]") as HTMLElement;
	const fondo = () => document.querySelector("[data-bar-bg]") as HTMLElement;
	const filete = () => document.querySelector("[data-bar-line]") as HTMLElement;
	const columna = () => document.querySelector("[data-results-column]") as HTMLElement;
	const aside = () => document.querySelector("aside") as HTMLElement;
	const campo = () => document.querySelector("[data-bar-search]") as HTMLElement;
	// jsdom no implementa `inert`: Svelte lo asigna como propiedad y no se refleja como atributo.
	const inerte = () => (campo() as HTMLElement & { inert?: boolean }).inert === true;

	async function desplazar() {
		window.dispatchEvent(new Event("scroll"));
		await tick();
	}

	afterEach(() => {
		window.matchMedia = matchMediaOriginal;
		rectSpy?.mockRestore();
		rectSpy = undefined;
		header?.remove();
		header = undefined;
	});

	describe("los tokens", () => {
		it("el aire es un solo valor global, en :root", () => {
			const root = (css.match(/:root\s*\{([^}]*)\}/gs) ?? []).join(" ");

			expect(root).toMatch(/--sticky-air\s*:\s*12px/);
			expect(css.match(/--sticky-air\s*:/g) ?? []).toHaveLength(1);
		});

		it("el alto bajo del encabezado es un token y vale lo que el estado achicado", () => {
			const root = (css.match(/:root\s*\{([^}]*)\}/gs) ?? []).join(" ");
			const shrunk = (css.match(/\[data-header-shrunk\][^{]*\{([^}]*)\}/gs) ?? []).join(" ");

			const min = root.match(/--header-h-min\s*:\s*([\d.]+)rem/);
			const bajo = shrunk.match(/--header-h\s*:\s*([\d.]+)rem/);
			expect(min).not.toBeNull();
			expect(min?.[1]).toBe(bajo?.[1]);
		});
	});

	describe("la fila de filtros activos", () => {
		const fila = () =>
			screen.getByText("Filtros activos:").parentElement?.parentElement as HTMLElement;
		const sigue = (a: Element, b: Element) =>
			Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

		async function montarConFiltro() {
			setUrl("?q=matricula&org=rectorado");
			mocks.search.mockResolvedValue({
				count: 1,
				results: [makeDataset()],
				search_facets: { organization: makeFacet({ title: "Organización" }) },
			});
			renderSearch();
			await screen.findByRole("heading", { name: "Matrícula 2026" });
			await tick();
		}

		it("desde 1024 px va dentro de la columna de resultados, debajo de la barra, para que ésta no salte", async () => {
			fijarVentana(1280);
			await montarConFiltro();

			expect(columna().contains(fila())).toBe(true);
			expect(sigue(barra(), fila())).toBe(true);
			expect(barra().contains(fila())).toBe(false);
		});

		it("desde 1024 px arranca a 2rem de la barra, como el panel de filtros, y deja 1rem hasta la primera card (L83)", async () => {
			// El panel baja `--bar-h + 2rem` (su margen superior): con 1.5rem su borde cortaba el texto de la fila.
			fijarVentana(1280);
			await montarConFiltro();

			expect(fila().className).toContain("pt-8");
			const resultados = document.querySelector("[data-results]")?.parentElement as HTMLElement;
			expect(resultados.className).toContain("pt-4");
			expect(resultados.className).not.toContain("pt-8");
		});

		it("sin filtros, la primera card sigue a 2rem de la barra, a la altura del panel", async () => {
			fijarVentana(1280);
			setUrl("?q=matricula");
			mocks.search.mockResolvedValue({
				count: 1,
				results: [makeDataset()],
				search_facets: { organization: makeFacet({ title: "Organización" }) },
			});
			renderSearch();
			await screen.findByRole("heading", { name: "Matrícula 2026" });
			await tick();

			const resultados = document.querySelector("[data-results]")?.parentElement as HTMLElement;
			expect(resultados.className).toContain("pt-8");
		});

		it("bajo 1024 px conserva el orden: barra y luego la fila, fuera de la columna", async () => {
			fijarVentana(768);
			await montarConFiltro();

			expect(sigue(barra(), fila())).toBe(true);
			expect(columna().contains(fila())).toBe(false);
		});

		it("«Limpiar todos» quita los filtros y la fila desaparece", async () => {
			fijarVentana(1280);
			await montarConFiltro();

			await fireEvent.click(screen.getByRole("button", { name: "Limpiar todos" }));
			await tick();

			expect(screen.queryByText("Filtros activos:")).toBeNull();
		});
	});

	describe("la barra de resultados", () => {
		it("bajo 1024 px va sobre el bloque de filtros, fuera de la columna de resultados", async () => {
			fijarVentana(768);
			await montarConFacetas();

			expect(barra()).not.toBeNull();
			expect(columna().contains(barra())).toBe(false);
			expect(
				barra().compareDocumentPosition(aside()) & Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
		});

		it("desde 1024 px vive sólo en la columna de resultados y su fondo llega a los bordes de la ventana", async () => {
			fijarVentana(1280);
			await montarConFacetas();

			expect(columna().contains(barra())).toBe(true);
			expect(document.querySelectorAll("[data-results-bar]")).toHaveLength(1);
			expect(fondo().getAttribute("style")).toContain("left: calc(-1 * var(--bleed-l");
			expect(fondo().getAttribute("style")).toContain("right: calc(-1 * var(--bleed-r");
		});

		it("el fondo es opaco: el contenido que pasa por debajo no se transparenta junto al filete", async () => {
			fijarVentana(1280);
			await montarConFacetas();

			// Medido en Chromium (2026-10-20): con `bg-background/95` + `backdrop-blur` el texto de las
			// tarjetas se veía fantasma sobre el filete inferior de la barra.
			expect(fondo().className).toContain("bg-background");
			expect(fondo().className).not.toMatch(/bg-background\/\d+/);
			expect(fondo().className).not.toContain("backdrop-blur");
			// El filete es su propia capa, para recortarse justo a la columna (ver el test siguiente).
			expect(fondo().className).not.toContain("border-b");
			expect(filete().className).toContain("bg-border");
		});

		it("nada sobresale de la columna: el filete se recorta justo y el fondo cubre las sombras de las tarjetas", async () => {
			fijarVentana(1280);
			fijarGeometria({ barTop: 65, heroBottom: 300 });
			await montarConFacetas();
			await desplazar();

			// Medido en Chromium (2026-10-20): con el fondo recortado exacto, la sombra de las tarjetas
			// (`shadow-sm`, 3px) asomaba como una línea tenue a cada lado de la barra en modo claro.
			expect(barra().style.getPropertyValue("--bleed-l")).toBe("312px");
			expect(barra().style.getPropertyValue("--bleed-r")).toBe("0px");
			expect(barra().style.getPropertyValue("--cover-l")).toBe("304px");
			expect(barra().style.getPropertyValue("--cover-r")).toBe("0px");
			expect(fondo().getAttribute("style")).toContain(
				"clip-path: inset(0 var(--cover-r, 0px) 0 var(--cover-l, 0px))",
			);
			expect(filete().getAttribute("style")).toContain(
				"clip-path: inset(0 var(--bleed-r, 0px) 0 var(--bleed-l, 0px))",
			);
		});

		it("en reposo el fondo no se recorta; pegada, se recorta a la columna con clip-path en 320 ms", async () => {
			fijarVentana(1280);
			fijarGeometria({ barTop: 400, heroBottom: 300 });
			await montarConFacetas();
			await desplazar();

			expect(fondo().getAttribute("style")).toMatch(
				/clip-path:\s*inset\(0(px)? 0(px)? 0(px)? 0(px)?\)/,
			);

			rectSpy?.mockRestore();
			fijarGeometria({ barTop: 65, heroBottom: 300 });
			await desplazar();

			const style = fondo().getAttribute("style") ?? "";
			expect(style).toContain("clip-path: inset(0 var(--cover-r");
			expect(style).toContain("clip-path 320ms cubic-bezier(0.22, 1, 0.36, 1)");
		});

		it("con movimiento reducido el recorte es instantáneo", async () => {
			fijarVentana(1280, true);
			fijarGeometria({ barTop: 65, heroBottom: 300 });
			await montarConFacetas();
			await desplazar();

			const style = fondo().getAttribute("style") ?? "";
			expect(style).not.toMatch(/\d+ms/);
			expect(fondo().style.transition).toBe("none");
			expect(aside().getAttribute("style") ?? "").not.toMatch(/\d+ms/);
		});

		it("no cambia nada del flujo al pegarse: la transición sólo toca clip-path y transform", async () => {
			fijarVentana(1280);
			fijarGeometria({ barTop: 400, heroBottom: 300 });
			await montarConFacetas();
			await desplazar();
			const claseEnReposo = barra().className;
			const controlEnReposo = barra().querySelector("select")?.className;

			rectSpy?.mockRestore();
			fijarGeometria({ barTop: 65, heroBottom: 300 });
			await desplazar();

			// Misma caja pegada y reposo: ninguna clase de alto ni de relleno depende del estado.
			expect(barra().className).toBe(claseEnReposo);
			expect(barra().querySelector("select")?.className).toBe(controlEnReposo);
			// El alto es constante con y sin buscador: todos los controles miden 44 px.
			expect(controlEnReposo).toContain("h-11");
			const props = (fondo().style.transition || fondo().getAttribute("style") || "").match(
				/(?:^|[;\s])(clip-path|transform|height|top|padding)\s/g,
			);
			expect(props?.map((p) => p.trim().replace(/^;/, ""))).toEqual(["clip-path"]);
		});
	});

	describe("la columna de filtros", () => {
		it("su tope y su alto salen de los tokens, con alto estático de pantalla completa", async () => {
			fijarVentana(1280);
			await montarConFacetas();

			expect(aside().className).toContain("lg:top-[calc(var(--header-h)+1px+var(--sticky-air))]");
			// El alto se calcula sobre el encabezado BAJO: no se anima al achicarse.
			expect(aside().className).toContain(
				"lg:h-[calc(100dvh-var(--header-h-min)-1px-2*var(--sticky-air))]",
			);
			expect(aside().className).not.toContain("lg:top-40");
			expect(aside().className).not.toContain("max-h-[calc(100vh-11rem)]");
			expect(aside().querySelector(".lg\\:overflow-y-auto")).not.toBeNull();
		});

		// S20 de `odd/tasks/prototype-presentation.md` («sticky con top muy bajo»). La bajada en reposo era un
		// `transform` que el script ponía y quitaba según la barra estuviera pegada; una captura sin script
		// (el lienzo) congela el reposo y la columna quedaba pegada 100 px más abajo (medido en Chromium a
		// 1440×900: 193 px contra los 93 del encabezado + borde + aire). La bajada es ahora un margen en CSS:
		// pegada, la columna queda a un solo `--sticky-air` del encabezado, con o sin script.
		it("en reposo baja la barra más 2rem con un margen en CSS; pegada queda a un aire del encabezado, sin depender del script", async () => {
			fijarVentana(1280);
			fijarGeometria({ barTop: 400, heroBottom: 300 });
			await montarConFacetas();
			await desplazar();
			const enReposo = { clase: aside().className, estilo: aside().getAttribute("style") ?? "" };

			expect(enReposo.clase).toContain("lg:mt-[calc(var(--bar-h)+2rem)]");
			expect(enReposo.clase).not.toMatch(/translateY|--aside-y/);
			expect(enReposo.estilo).not.toMatch(/--aside-y|transform/);
			// La fórmula del tope pegado: encabezado + su borde + un aire. Ni la barra ni un segundo aire.
			const tope = enReposo.clase.match(/lg:top-\[([^\]]+)\]/);
			expect(tope?.[1]).toBe("calc(var(--header-h)+1px+var(--sticky-air))");

			rectSpy?.mockRestore();
			fijarGeometria({ barTop: 65, heroBottom: 300 });
			await desplazar();

			// Pegada o en reposo, la columna es la misma: nada que una captura sin script pueda congelar.
			expect(aside().className).toBe(enReposo.clase);
			expect(aside().getAttribute("style") ?? "").toBe(enReposo.estilo);
		});

		it("con pocos resultados la columna de filtros igual llega a pegarse: le queda el recorrido de la barra", async () => {
			// Un `sticky` sólo se mueve lo que su caja (con margen) le deja libre en la fila. La columna de
			// resultados mide su margen + su alto + un recorrido de otro `--bar-h + 2rem`: el mismo que tenía
			// con el `transform` (medido a 1440×900 con «matrícula», sin él la columna nunca se pegaba).
			fijarVentana(1280);
			await montarConFacetas();

			expect(columna().className).toContain(
				"lg:min-h-[calc(2*(var(--bar-h)+2rem)+100dvh-var(--header-h-min)-1px-2*var(--sticky-air))]",
			);
		});

		it("bajo 1024 px no se baja: el margen sólo existe desde lg y el bloque queda como hoy", async () => {
			fijarVentana(768);
			fijarGeometria({ barTop: 400, heroBottom: 300 });
			await montarConFacetas();
			await desplazar();

			expect(aside().className).not.toMatch(/(?:^|\s)mt-\[/);
			expect(aside().getAttribute("style") ?? "").not.toMatch(/--aside-y|transform/);
		});
	});

	// S24/S35 de `odd/tasks/prototype-presentation.md`: «pasar de ocupar ambas columnas a solo una y mostrar el
	// input del buscador», en un solo movimiento. Es la variante «animada» que el autor aprobó en el playground.
	describe("la barra animada", () => {
		// La barra pegada con el campo del hero todavía a la vista: el campo entra igual, atado a la barra.
		const PEGADA_HERO_VISIBLE = { barTop: 65, heroBottom: 300 };
		const EN_REPOSO = { barTop: 400, heroBottom: 300 };

		async function mover(geometria: { barTop: number; heroBottom: number }) {
			rectSpy?.mockRestore();
			header?.remove();
			fijarGeometria(geometria);
			await desplazar();
			await tick();
		}

		it("al pegarse pasa a la columna y entra el campo en el mismo momento, aunque el del hero se vea", async () => {
			fijarVentana(1280);
			fijarGeometria(EN_REPOSO);
			await montarConFacetas();
			await mover(PEGADA_HERO_VISIBLE);

			expect(barra().dataset.state).toBe("compacta");
			expect(inerte()).toBe(false);
			expect(campo().style.opacity).toBe("1");
			expect(campo().style.transform).toBe("none");
			expect(campo().className).not.toContain("pointer-events-none");
			expect(campo().style.transition).toContain("opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)");
			expect(campo().style.transition).toContain("transform 320ms cubic-bezier(0.22, 1, 0.36, 1)");
			expect(barra().querySelector("p")?.style.transition).toContain("transform 320ms");
		});

		it("en reposo ocupa las dos columnas y el campo está escondido en un hueco ya reservado, fuera del foco y sin clics", async () => {
			fijarVentana(1280);
			fijarGeometria(EN_REPOSO);
			await montarConFacetas();
			await desplazar();

			expect(barra().dataset.state).toBe("expandida");
			expect(inerte()).toBe(true);
			expect(campo().style.opacity).toBe("0");
			expect(campo().style.transform).toBe("translateY(-0.5rem)");
			expect(campo().className).toContain("pointer-events-none");
			// El hueco no depende del estado: el campo no cambia el ancho de nada al entrar.
			const clase = (c: string) =>
				c
					.replace(/\s*pointer-events-none/, "")
					.trim()
					.split(/\s+/)
					.sort()
					.join(" ");
			const enReposo = clase(campo().className);
			expect(enReposo).toContain("max-w-md");
			expect(enReposo).toContain("flex-1");
			expect(enReposo).not.toContain("max-w-0");

			await mover(PEGADA_HERO_VISIBLE);
			expect(clase(campo().className)).toBe(enReposo);

			await mover(EN_REPOSO);
			expect(barra().dataset.state).toBe("expandida");
			expect(inerte()).toBe(true);
			expect(campo().style.opacity).toBe("0");
		});

		it("con movimiento reducido cambia de estado sin transición", async () => {
			fijarVentana(1280, true);
			fijarGeometria(EN_REPOSO);
			await montarConFacetas();
			await mover(PEGADA_HERO_VISIBLE);

			expect(barra().dataset.state).toBe("compacta");
			expect(inerte()).toBe(false);
			expect(campo().style.transition).toBe("none");
			expect(fondo().style.transition).toBe("none");
			expect(filete().style.transition).toBe("none");
			expect(barra().querySelector("p")?.style.transition).toBe("none");
		});

		it("si el campo se esconde con el foco adentro, el foco pasa al del hero", async () => {
			fijarVentana(1280);
			fijarGeometria(EN_REPOSO);
			await montarConFacetas();
			await mover(PEGADA_HERO_VISIBLE);

			const compacto = within(campo()).getByRole("searchbox", { name: "Buscar datasets" });
			compacto.focus();
			expect(document.activeElement).toBe(compacto);

			await mover(EN_REPOSO);

			const hero = document.querySelector("[data-hero-search]") as HTMLElement;
			expect(document.activeElement).toBe(within(hero).getByRole("searchbox"));
		});
	});

	describe("el buscador en la barra", () => {
		it("mientras el del hero se ve, el de la barra existe pero no es alcanzable", async () => {
			fijarVentana(1280);
			fijarGeometria({ barTop: 400, heroBottom: 300 });
			await montarConFacetas();
			await desplazar();

			expect(inerte()).toBe(true);
		});

		it("cuando el del hero sale de la vista, aparece en la barra y busca igual que el del hero", async () => {
			fijarVentana(1280);
			fijarGeometria({ barTop: 65, heroBottom: 30 });
			await montarConFacetas();
			await desplazar();

			expect(inerte()).toBe(false);
			const input = within(campo()).getByRole("searchbox") as HTMLInputElement;
			await fireEvent.input(input, { target: { value: "becas" } });
			await fireEvent.submit(input.closest("form") as HTMLFormElement);

			await waitFor(() =>
				expect(mocks.search.mock.calls.at(-1)?.[0]).toMatchObject({ q: "becas" }),
			);
		});

		it("bajo 640 px no entra en la barra aunque el del hero ya no se vea", async () => {
			fijarVentana(375);
			fijarGeometria({ barTop: 65, heroBottom: 30 });
			await montarConFacetas();
			await desplazar();

			expect(inerte()).toBe(true);
			expect(campo().className).toContain("max-sm:hidden");
		});
	});

	describe("el cambio de página", () => {
		async function montarConPaginas(reducido = false) {
			fijarVentana(1280, reducido);
			setUrl("");
			mocks.search.mockResolvedValue({
				count: 45,
				results: [makeDataset()],
				search_facets: { organization: makeFacet({ title: "Organización" }) },
			});
			renderSearch();
			await screen.findByRole("heading", { name: "Matrícula 2026" });
			await tick();
		}

		it("lleva al inicio de los resultados, no al tope absoluto de la página", async () => {
			const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
			await montarConPaginas();
			scrollIntoView.mockClear();

			await fireEvent.click(screen.getByRole("button", { name: "Ir a página 2" }));

			await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
			expect(scrollTo).not.toHaveBeenCalled();
			const destino = scrollIntoView.mock.contexts[0] as HTMLElement;
			expect(destino.hasAttribute("data-results")).toBe(true);
			expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
			scrollTo.mockRestore();
		});

		it("desplaza cuando llegan los resultados de la página nueva, no antes", async () => {
			const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
			await montarConPaginas();
			scrollIntoView.mockClear();
			let resolver: (v: unknown) => void = () => {};
			mocks.search.mockReturnValueOnce(new Promise((r) => (resolver = r)));

			await fireEvent.click(screen.getByRole("button", { name: "Ir a página 2" }));
			await tick();
			expect(scrollIntoView).not.toHaveBeenCalled();

			resolver({
				count: 45,
				results: [makeDataset({ id: "d2", title: "Página dos" })],
				search_facets: {},
			});
			await screen.findByRole("heading", { name: "Página dos" });
			await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
			expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
			expect(scrollTo).not.toHaveBeenCalled();
			scrollTo.mockRestore();
		});

		it("no pelea con el lector: si desplaza durante la carga, no se desplaza al llegar", async () => {
			await montarConPaginas();
			scrollIntoView.mockClear();
			let resolver: (v: unknown) => void = () => {};
			mocks.search.mockReturnValueOnce(new Promise((r) => (resolver = r)));

			await fireEvent.click(screen.getByRole("button", { name: "Ir a página 2" }));
			await tick();
			await fireEvent.wheel(window);
			resolver({
				count: 45,
				results: [makeDataset({ id: "d2", title: "Página dos" })],
				search_facets: {},
			});
			await screen.findByRole("heading", { name: "Página dos" });
			await tick();
			expect(scrollIntoView).not.toHaveBeenCalled();
		});

		it("el destino deja la primera tarjeta bajo la barra pegada: el mismo margen que los saltos del vacío", async () => {
			await montarConPaginas();
			medirAltoBarra(68);

			await waitFor(() => {
				expect(document.querySelector("[data-results]")?.getAttribute("style")).toContain(
					"scroll-margin-top: calc(var(--header-h) + 1px + 68px + var(--sticky-air))",
				);
			});
		});

		it("con movimiento reducido el desplazamiento es instantáneo", async () => {
			await montarConPaginas(true);
			scrollIntoView.mockClear();

			await fireEvent.click(screen.getByRole("button", { name: "Ir a página 2" }));

			await waitFor(() =>
				expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" }),
			);
		});

		it("cambiar un filtro no desplaza la página", async () => {
			await montarConPaginas();
			scrollIntoView.mockClear();

			await fireEvent.click(screen.getByRole("checkbox", { name: /X/ }));

			expect(scrollIntoView).not.toHaveBeenCalled();
		});
	});
});

describe("Página de búsqueda — «Ordenar»", () => {
	it("ofrece «Relevancia» primero y conserva los pares A-Z / Z-A", async () => {
		setUrl("?q=matricula");
		renderSearch();

		const select = (await screen.findAllByRole("combobox")).find((c) =>
			within(c).queryByRole("option", { name: "Relevancia" }),
		) as HTMLElement;
		expect(
			within(select)
				.getAllByRole("option")
				.map((o) => o.textContent?.trim()),
		).toEqual(["Relevancia", "Más recientes", "Más antiguos", "A-Z", "Z-A"]);
	});
});
