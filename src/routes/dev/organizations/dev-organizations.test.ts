// Tests del playground de organizaciones (`/dev/organizations`, S9 de
// `odd/tasks/prototype-presentation.md`): la propiedad útil es que el autor pueda comparar la cuadrícula
// **actual** —con la tarjeta real— contra la **propuesta**: buscador y filtro por tipo con su cantidad,
// grupos por tipo con un encabezado cada uno, la jerarquía en la tarjeta de una facultad y la sigla con
// la fecha de la última actualización. El estado sale de la URL, así que cada test fija la suya.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`.

import { render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import OrganizationsPlayground from "./+page.svelte";
import { CURRENT_ORG_NAMES, orgsForCase } from "./orgs";

// La barra pegada mide su alto con `bind:clientHeight`, que usa un `ResizeObserver` que jsdom no
// implementa; acá no se mide el layout (eso se mide en Chromium).
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function at(query: string) {
	pageStore.set({ params: {}, url: new URL(`http://localhost/dev/organizations${query}`) });
}

const CURRENT_TITLES = [
	"Facultad de Ciencias y Tecnología",
	"Facultad de Ciencias de la Salud",
	"Facultad de Ciencias Agrícolas",
	"Rectorado UMSS",
	"Dirección de Investigación",
];

afterEach(() => at(""));

describe("playground de organizaciones — datos de ejemplo", () => {
	it("el caso completo incluye las cinco organizaciones de hoy", () => {
		const names = orgsForCase("completa").map((org) => org.name);
		for (const name of CURRENT_ORG_NAMES) expect(names).toContain(name);
		expect(names.length).toBeGreaterThanOrEqual(14);
		expect(names.length).toBeLessThanOrEqual(20);
	});
});

describe("playground de organizaciones — la cuadrícula actual", () => {
	it("muestra las cinco organizaciones de hoy con la tarjeta real y sin buscador", () => {
		at("?vista=actual&caso=actual");
		render(OrganizationsPlayground);

		const grid = screen.getByTestId("org-current-grid");
		const links = within(grid).getAllByRole("link");
		expect(links).toHaveLength(5);
		for (const title of CURRENT_TITLES) {
			expect(within(grid).getByRole("heading", { name: title })).toBeTruthy();
		}
		expect(screen.queryByRole("searchbox")).toBeNull();
		expect(screen.queryByTestId("org-proposed")).toBeNull();
	});

	it("no pega nada: la barra y los títulos pegados son sólo de la propuesta", () => {
		at("?vista=actual&caso=completa");
		render(OrganizationsPlayground);

		const product = screen.getByTestId("org-page");
		expect(screen.queryByTestId("org-sticky-bar")).toBeNull();
		expect(product.querySelector(".sticky")).toBeNull();
		expect(product.innerHTML).not.toMatch(/--org-bar-h|--sticky-air/);
	});
});

describe("playground de organizaciones — la propuesta", () => {
	it("agrupa por tipo, con un encabezado y una cantidad por grupo", () => {
		at("?vista=propuesta&caso=completa");
		render(OrganizationsPlayground);

		const faculties = screen.getByTestId("org-group-facultad");
		expect(within(faculties).getByRole("heading", { level: 2 })).toHaveTextContent(/Facultades/);
		const facultyCount = orgsForCase("completa").filter((org) => org.type === "facultad").length;
		expect(within(faculties).getByRole("heading", { level: 2 })).toHaveTextContent(
			String(facultyCount),
		);
		expect(within(faculties).getAllByRole("article")).toHaveLength(facultyCount);
		expect(screen.getByTestId("org-group-direccion")).toBeTruthy();
	});

	it("ofrece el buscador y un filtro por tipo con la cantidad de cada uno", () => {
		at("?vista=propuesta&caso=completa");
		render(OrganizationsPlayground);

		expect(screen.getByRole("searchbox", { name: "Buscar organizaciones" })).toBeTruthy();
		const filter = screen.getByRole("group", { name: "Filtrar por tipo" });
		const facultyCount = orgsForCase("completa").filter((org) => org.type === "facultad").length;
		expect(within(filter).getByRole("button", { name: `Facultad ${facultyCount}` })).toBeTruthy();
		expect(within(filter).getByRole("button", { name: /^Todas/ })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("sin agrupar, muestra una sola cuadrícula", () => {
		at("?vista=propuesta&caso=completa&grupos=no");
		render(OrganizationsPlayground);

		expect(screen.queryByTestId("org-group-facultad")).toBeNull();
		expect(screen.getByTestId("org-flat-grid")).toBeTruthy();
	});

	it("la tarjeta de una facultad indica sus unidades dependientes y las enlaza", () => {
		at("?vista=propuesta&caso=completa");
		render(OrganizationsPlayground);

		const card = screen.getByTestId("org-card-fcyt");
		expect(card).toHaveTextContent("3 unidades dependientes");
		const dependents = within(card).getByRole("list", { name: "Unidades dependientes" });
		const links = within(dependents).getAllByRole("link");
		expect(links).toHaveLength(3);
		for (const link of links) expect(link.getAttribute("href")).toMatch(/^\/organization\//);
	});

	it("sin jerarquía, la tarjeta no la menciona", () => {
		at("?vista=propuesta&caso=completa&jerarquia=no");
		render(OrganizationsPlayground);

		expect(screen.getByTestId("org-card-fcyt")).not.toHaveTextContent(/unidades dependientes/);
	});

	it("la tarjeta agrega la sigla y la fecha de la última actualización, y se pueden quitar", () => {
		at("?vista=propuesta&caso=completa");
		const { unmount } = render(OrganizationsPlayground);

		// La descripción de la FCyT ya nombra la sigla: se mira el elemento propio de la sigla.
		const card = screen.getByTestId("org-card-fcyt");
		expect(card.querySelector("[data-org-acronym]")).toHaveTextContent("FCyT");
		expect(card.querySelector("time")).toBeTruthy();
		unmount();

		at("?vista=propuesta&caso=completa&campos=no");
		render(OrganizationsPlayground);
		const plain = screen.getByTestId("org-card-fcyt");
		expect(plain.querySelector("[data-org-acronym]")).toBeNull();
		expect(plain.querySelector("time")).toBeNull();
	});

	it("una búsqueda sin resultados muestra un estado vacío con salida", () => {
		at("?vista=propuesta&caso=completa&q=astronom%C3%ADa");
		render(OrganizationsPlayground);

		const empty = screen.getByTestId("org-empty");
		expect(empty).toHaveTextContent("No encontramos organizaciones");
		expect(within(empty).getByRole("button", { name: "Limpiar búsqueda y filtros" })).toBeTruthy();
		expect(screen.queryAllByRole("article")).toHaveLength(0);
	});

	it("la búsqueda encuentra por sigla sin distinguir acentos", () => {
		at("?vista=propuesta&caso=completa&q=dicyt");
		render(OrganizationsPlayground);

		expect(screen.getByTestId("org-card-direccion-investigacion")).toBeTruthy();
		expect(screen.getAllByRole("article")).toHaveLength(1);
	});

	it("una organización sin datasets lo dice en vez de mostrar una fecha", () => {
		at("?vista=propuesta&caso=sin-datos");
		render(OrganizationsPlayground);

		const card = screen.getByTestId("org-card-cep");
		expect(card).toHaveTextContent("Aún sin datasets publicados");
		expect(card.querySelector("time")).toBeNull();
	});

	it("el buscador y el filtro se pegan bajo el encabezado, con fondo opaco y el aire común", () => {
		at("?vista=propuesta&caso=completa");
		render(OrganizationsPlayground);

		const bar = screen.getByTestId("org-sticky-bar");
		expect(within(bar).getByRole("searchbox", { name: "Buscar organizaciones" })).toBeTruthy();
		expect(within(bar).getByRole("group", { name: "Filtrar por tipo" })).toBeTruthy();
		expect(bar).toHaveClass(
			"sticky",
			"top-[calc(var(--header-h)+1px)]",
			"pt-[var(--sticky-air)]",
			"bg-background",
			"motion-reduce:transition-none",
		);
		// El alto de la barra se mide en una variable: de ahí sale el tope de los títulos de grupo.
		expect(screen.getByTestId("org-proposed").style.getPropertyValue("--org-bar-h")).toMatch(/px$/);
	});

	it("cada título de grupo se pega justo debajo de la barra", () => {
		at("?vista=propuesta&caso=completa");
		render(OrganizationsPlayground);

		for (const id of ["rectorado", "facultad", "direccion"]) {
			const title = within(screen.getByTestId(`org-group-${id}`)).getByRole("heading", {
				level: 2,
			});
			expect(title).toHaveClass(
				"sticky",
				"top-[calc(var(--header-h)+1px+var(--org-bar-h,0px))]",
				"bg-background",
				"motion-reduce:transition-none",
			);
		}
	});

	it("el área de producto no nombra la implementación", () => {
		at("?vista=propuesta&caso=completa");
		render(OrganizationsPlayground);

		expect(screen.getByTestId("org-page")).not.toHaveTextContent(/ckan|extras/i);
	});
});

describe("playground de organizaciones — la ruta no existe en producción", () => {
	it("deja pasar la carga en desarrollo", async () => {
		const { load } = await import("./+page");
		expect(() => load(undefined as never)).not.toThrow();
	});

	it("lanza un 404 cuando el entorno no es de desarrollo", async () => {
		vi.stubEnv("DEV", false);
		try {
			const { load } = await import("./+page");
			expect(() => load(undefined as never)).toThrowError(expect.objectContaining({ status: 404 }));
		} finally {
			vi.unstubAllEnvs();
		}
	});
});
