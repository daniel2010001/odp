// Tests del playground de la barra del buscador (`/dev/search-bar`, S24 de
// `odd/tasks/prototype-presentation.md`): la propiedad útil es que el autor compare la barra de hoy contra la
// animada con un interruptor, que la animada ate el campo compacto al momento en que la barra se pega, que con
// movimiento reducido no haya transición y que el foco no se pierda. jsdom no tiene layout: se controlan
// `matchMedia` y `getBoundingClientRect`, como en `src/routes/search/search-page.test.ts`. La medición real
// (Chromium) queda en el log del expediente.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`.

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { afterNavigate, replaceState } from "$app/navigation";
import { page } from "$app/stores";
import type { CkanPackage } from "$lib/types/ckan";
import SearchBarPlayground from "./+page.svelte";

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}

beforeAll(() => {
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
});

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "http://localhost:5000" } }));
vi.mock("$lib/api/client", () => ({ createCkanClient: () => ({}) }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ search: mocks.search }) }));
vi.mock("$lib/mock/data", () => ({
	getMockSearchResult: () => ({ count: 0, results: [], search_facets: {} }),
}));

const dataset: CkanPackage = {
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
};

const matchMediaOriginal = window.matchMedia;
let rectSpy: ReturnType<typeof vi.spyOn> | undefined;
let header: HTMLElement | undefined;

/** `(min-width: Npx)` coincide si N ≤ ancho; `reducido` fija `prefers-reduced-motion`. */
function fijarVentana(ancho: number, reducido = false) {
	window.matchMedia = ((query: string) => {
		const min = query.match(/min-width:\s*(\d+)px/);
		const matches = min
			? Number(min[1]) <= ancho
			: /prefers-reduced-motion/.test(query) && reducido;
		return {
			matches,
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
		} as unknown as MediaQueryList;
	}) as typeof window.matchMedia;
}

/** El encabezado termina en 65 px; la barra y el campo del hero, donde el test diga. */
function fijarGeometria({ barTop, heroBottom }: { barTop: number; heroBottom: number }) {
	rectSpy?.mockRestore();
	if (!header) {
		header = document.createElement("header");
		header.setAttribute("data-site-header", "");
		document.body.append(header);
	}
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

async function montar(query = "") {
	pageStore.set({ params: {}, url: new URL(`http://localhost/dev/search-bar${query}`) });
	mocks.search.mockResolvedValue({
		count: 1,
		results: [dataset],
		search_facets: {
			organization: { title: "Organización", items: [{ name: "x", display_name: "X", count: 1 }] },
		},
	});
	render(SearchBarPlayground);
	(vi.mocked(afterNavigate).mock.calls[0]?.[0] as (() => void) | undefined)?.();
	await screen.findByRole("heading", { name: "Matrícula 2026" });
	await tick();
}

async function desplazar(geometria: { barTop: number; heroBottom: number }) {
	fijarGeometria(geometria);
	window.dispatchEvent(new Event("scroll"));
	await tick();
	await tick();
}

const barra = () => document.querySelector("[data-results-bar]") as HTMLElement;
const fondo = () => document.querySelector("[data-bar-bg]") as HTMLElement;
const campo = () => document.querySelector("[data-bar-search]") as HTMLElement;
const inerte = () => (campo() as HTMLElement & { inert?: boolean }).inert === true;
const heroInput = () =>
	within(document.querySelector("[data-hero-search]") as HTMLElement).getByRole("searchbox");
const interruptor = (nombre: string) =>
	within(screen.getByTestId("toggle-barra")).getByRole("button", { name: nombre });

// La barra pegada con el campo del hero todavía visible: sólo ahí «como hoy» y «animada» se separan.
const PEGADA_HERO_VISIBLE = { barTop: 65, heroBottom: 300 };
const EN_REPOSO = { barTop: 400, heroBottom: 300 };

beforeEach(() => {
	vi.clearAllMocks();
	fijarVentana(1280);
});

afterEach(() => {
	window.matchMedia = matchMediaOriginal;
	rectSpy?.mockRestore();
	rectSpy = undefined;
	header?.remove();
	header = undefined;
});

describe("playground de la barra — el interruptor", () => {
	it("«Como hoy» es el defecto: la barra de la página real, que espera a que el campo del hero salga de la vista", async () => {
		await montar("?q=matrícula");
		await desplazar(PEGADA_HERO_VISIBLE);

		expect(interruptor("Como hoy")).toHaveAttribute("aria-pressed", "true");
		expect(barra().dataset.variant).toBe("hoy");
		expect(barra().dataset.state).toBe("compacta");
		expect(inerte()).toBe(true);
		expect(fondo().getAttribute("style")).toContain("clip-path 250ms");
	});

	it("«Animada» se elige con el interruptor, queda en la URL y entra el campo en el mismo momento en que la barra se pega", async () => {
		await montar("?q=matrícula");
		await fireEvent.click(interruptor("Animada"));
		await desplazar(PEGADA_HERO_VISIBLE);

		expect(interruptor("Animada")).toHaveAttribute("aria-pressed", "true");
		expect(barra().dataset.variant).toBe("animada");
		expect(String(vi.mocked(replaceState).mock.calls.at(-1)?.[0])).toContain("barra=animada");
		expect(barra().dataset.state).toBe("compacta");
		expect(inerte()).toBe(false);
		expect(campo().style.opacity).toBe("1");
		expect(campo().style.transition).toContain("opacity 320ms");
		expect(campo().style.transition).toContain("transform 320ms");
		expect(fondo().getAttribute("style")).toContain("clip-path 320ms");
	});

	it("«animada» en reposo: la barra ocupa las dos columnas y el campo está escondido, fuera del foco y sin clics", async () => {
		await montar("?barra=animada&q=matrícula");
		await desplazar(EN_REPOSO);

		expect(barra().dataset.state).toBe("expandida");
		expect(fondo().getAttribute("style")).toMatch(
			/clip-path:\s*inset\(0(px)? 0(px)? 0(px)? 0(px)?\)/,
		);
		expect(inerte()).toBe(true);
		expect(campo().style.opacity).toBe("0");
		expect(campo().style.transform).toBe("translateY(-0.5rem)");
		expect(campo().className).toContain("pointer-events-none");
		// El hueco está reservado en los dos estados: el campo no cambia el ancho de nada.
		expect(campo().className).toContain("max-w-md");
		expect(campo().className).toContain("flex-1");
		expect(screen.getByTestId("instrumento-estado")).toHaveTextContent("expandida");

		await desplazar(PEGADA_HERO_VISIBLE);

		expect(campo().className).toContain("max-w-md");
		expect(campo().className).not.toContain("pointer-events-none");
		expect(screen.getByTestId("instrumento-estado")).toHaveTextContent("compacta");
		expect(screen.getByTestId("instrumento-campo")).toHaveTextContent("sí");
		expect(screen.getByTestId("instrumento-cambio")).toHaveTextContent(/scrollY \d+ px/);
	});

	it("con movimiento reducido, «animada» cambia de estado sin transición", async () => {
		fijarVentana(1280, true);
		await montar("?barra=animada&q=matrícula");
		await desplazar(PEGADA_HERO_VISIBLE);

		expect(barra().dataset.state).toBe("compacta");
		expect(inerte()).toBe(false);
		expect(campo().style.transition).toBe("none");
		expect(fondo().style.transition).toBe("none");
		expect(barra().querySelector("p")?.style.transition).toBe("none");
	});
});

describe("playground de la barra — el teclado", () => {
	it("el campo compacto tiene nombre y, si se esconde con el foco adentro, el foco pasa al del hero", async () => {
		await montar("?barra=animada&q=matrícula");
		await desplazar(PEGADA_HERO_VISIBLE);

		const compacto = within(campo()).getByRole("searchbox", { name: "Buscar datasets" });
		compacto.focus();
		expect(document.activeElement).toBe(compacto);

		await desplazar(EN_REPOSO);

		expect(document.activeElement).toBe(heroInput());
	});
});
