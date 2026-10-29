// Tests de las maquetas de colecciones (P5, S4 y L3 de `odd/tasks/prototype-presentation.md`): lo que
// importa capturar es que una colección reúne datasets de varias organizaciones, que la relación se recorre
// en los dos sentidos —«También en» desde la colección, «Aparece en las colecciones» desde el dataset— y
// que el mismo dataset está en colecciones de curadores distintos sin duplicarse. Ninguna pantalla promete
// circulación de documentos. La ficha se compara en dos vistas (S10): la pública, sin el avance de las
// aprobaciones, y la del curador, con el bloque «Publicación».

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import CollectionMock from "../collection/+page.svelte";
import DatasetCollectionsMock from "../dataset-collections/+page.svelte";
import CollectionsMock from "./+page.svelte";
import {
	COLLECTIONS,
	canSee,
	collectionBySlug,
	collectionsOf,
	DATASETS,
	datasetBySlug,
	ownerOrgs,
} from "./data";
import VisibilityBadge from "./VisibilityBadge.svelte";

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function at(url: string) {
	pageStore.set({ params: {}, url: new URL(url) });
}

// Las pestañas de organización (`OverflowTabs` de bits-ui) miden con `ResizeObserver`, que jsdom no trae: el
// mismo doble que `RequestsQueue.test.ts`.
beforeAll(() => {
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});

const TRAMITE = /recibid|enviado a|derivad|en tr[aá]mite/i;

// Las pestañas de organización (S22): las de «Solicitudes» (`OverflowTabs`), con el conteo de colecciones.
const orgTabs = () => screen.getByRole("tablist", { name: "Organización" });
const tabTexts = () =>
	within(orgTabs())
		.getAllByRole("tab")
		.map((t) => t.textContent?.replace(/\s+/g, " ").trim());
async function chooseTab(name: RegExp) {
	const tab = within(orgTabs()).getByRole("tab", { name });
	await fireEvent.mouseDown(tab);
	await fireEvent.click(tab);
	await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
}

describe("maqueta — colecciones", () => {
	afterEach(() => at("http://localhost/"));

	const listNames = () =>
		within(screen.getByTestId("collections-list"))
			.getAllByRole("heading", { level: 2 })
			.map((el) => el.textContent?.trim());

	it("la vista del menú principal (por defecto) sólo lista las públicas, sin filtro de visibilidad ni alta (Q18)", () => {
		at("http://localhost/dev/prototype/collections");
		render(CollectionsMock);

		expect(screen.getByTestId("view-publica").getAttribute("aria-current")).toBe("page");
		expect(screen.getByTestId("review-note")).toHaveTextContent("menú principal");
		expect(screen.getByRole("heading", { level: 1, name: "Colecciones" })).toBeTruthy();
		// S42: una lista es un buscador, como `/search` y `/organizations`: sin ruta de navegación.
		expect(screen.queryByRole("navigation", { name: "Ruta de navegación" })).toBeNull();
		expect(document.body.textContent).not.toMatch(/Inicio/);
		expect(screen.getByRole("textbox", { name: "Buscar colecciones" })).toBeTruthy();
		expect(screen.queryByRole("combobox", { name: "Visibilidad" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Nueva colección" })).toBeNull();

		expect(listNames()).toEqual(
			COLLECTIONS.filter((c) => canSee(c, { kind: "visitor" })).map((c) => c.name),
		);
		const list = screen.getByTestId("collections-list");
		expect(within(list).getByText("4 datasets de 4 organizaciones")).toBeTruthy();
		expect(list.textContent).not.toMatch(/Privada|Interna/);
		// S22: una colección pública no lleva etiqueta de visibilidad.
		expect(within(list).queryByText("Pública")).toBeNull();
		expect(document.body.textContent).not.toMatch(TRAMITE);
		// El primer render compila la page y sus pestañas: con la máquina cargada pasa de los 5 s por defecto.
	}, 15_000);

	it("la vista del menú principal filtra por quien cura con las pestañas de organización de «Solicitudes» (S22)", async () => {
		at("http://localhost/dev/prototype/collections");
		render(CollectionsMock);

		expect(tabTexts()).toEqual([
			"Todas 7",
			"Personales 1",
			"Dirección de Investigación 2",
			"Facultad de Ciencias Agrícolas 1",
			"Facultad de Ciencias de la Salud 1",
			"Facultad de Ciencias y Tecnología 1",
			"Vicerrectorado 1",
		]);
		const dicyt = within(orgTabs()).getByRole("tab", { name: /Dirección de Investigación/ });
		expect(within(dicyt).getByLabelText("2 colecciones")).toBeTruthy();
		// La misma pestaña que las vistas del recurso y «Solicitudes».
		expect(dicyt.className).toContain("h-12");
		expect(dicyt.className).toContain("data-[state=active]:border-primary");
		expect(screen.getByRole("button", { name: "Organización" })).toHaveTextContent(
			"Todas (7 colecciones)",
		);

		await chooseTab(/Dirección de Investigación/);
		expect(listNames()).toEqual([
			"Investigación y laboratorios de la FCyT",
			"Producción científica 2025",
		]);
		await chooseTab(/Personales/);
		expect(listNames()).toEqual(["Indicadores académicos para tesis"]);
	});

	it("«Mis colecciones» del panel lista las que cura la persona y las de sus organizaciones, con el filtro de visibilidad", () => {
		at("http://localhost/dev/prototype/collections?vista=panel");
		render(CollectionsMock);

		expect(screen.getByTestId("view-panel").getAttribute("aria-current")).toBe("page");
		expect(screen.getByTestId("review-note")).toHaveTextContent("María Fernanda Rojas Vargas");
		expect(screen.getByRole("heading", { level: 1, name: "Mis colecciones" })).toBeTruthy();
		// S42: tampoco la lista del panel lleva ruta de navegación.
		expect(screen.queryByRole("navigation", { name: "Ruta de navegación" })).toBeNull();
		expect(screen.getByRole("button", { name: "Nueva colección" })).toBeTruthy();

		const visibility = screen.getByRole("combobox", { name: "Visibilidad" });
		for (const option of ["Privada", "Interna", "Pública"]) {
			expect(within(visibility).getByRole("option", { name: option })).toBeTruthy();
		}
		// S22: el desplegable «Curador» se reemplaza por las pestañas de organización.
		expect(screen.queryByRole("combobox", { name: "Curador" })).toBeNull();

		// Las suyas, las de sus tres organizaciones (Q8: es miembro de varias); no las ajenas.
		expect(listNames()).toEqual([
			"Rendición pública de cuentas 2025",
			"Investigación y laboratorios de la FCyT",
			"Indicadores académicos para tesis",
			"Lista de trabajo: capítulo de eficiencia terminal",
			"Producción científica 2025",
			"Autoevaluación para la acreditación de la FCyT",
		]);
		const list = screen.getByTestId("collections-list");
		expect(within(list).getAllByText("3 datasets de 2 organizaciones").length).toBeGreaterThan(0);
		expect(within(list).getAllByText("Privada").length).toBe(2);
		expect(within(list).queryByText("Pública")).toBeNull();
		// Desde el panel se abre la ficha en la vista del curador.
		expect(within(list).getAllByRole("link")[0].getAttribute("href")).toBe(
			"/dev/prototype/collection?c=rendicion-cuentas-2025&vista=curador",
		);
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});

	it("«Mis colecciones»: Todas · Personales · una pestaña por organización de quien mira, con su conteo (S22)", async () => {
		at("http://localhost/dev/prototype/collections?vista=panel");
		render(CollectionsMock);

		expect(tabTexts()).toEqual([
			"Todas 6",
			"Personales 2",
			"Dirección de Investigación 2",
			"Facultad de Ciencias y Tecnología 1",
			"Rectorado UMSS 1",
		]);
		await chooseTab(/Rectorado UMSS/);
		expect(listNames()).toEqual(["Rendición pública de cuentas 2025"]);
		await chooseTab(/Personales/);
		expect(listNames()).toEqual([
			"Indicadores académicos para tesis",
			"Lista de trabajo: capítulo de eficiencia terminal",
		]);
	});

	it("«Mis colecciones»: el filtro de visibilidad se suma a la pestaña", async () => {
		at("http://localhost/dev/prototype/collections?vista=panel");
		render(CollectionsMock);

		const visibility = screen.getByRole("combobox", { name: "Visibilidad" });
		await fireEvent.change(visibility, { target: { value: "Privada" } });
		expect(listNames()).toEqual([
			"Rendición pública de cuentas 2025",
			"Lista de trabajo: capítulo de eficiencia terminal",
		]);
		await chooseTab(/Personales/);
		expect(listNames()).toEqual(["Lista de trabajo: capítulo de eficiencia terminal"]);
	});

	it("la lista de trabajo privada de una persona no la ve nadie más (Q10)", () => {
		const draft = collectionBySlug("capitulo-eficiencia-terminal");
		expect(draft.visibility).toBe("Privada");
		expect(draft.approvals).toBeUndefined();
		expect(canSee(draft, { kind: "visitor" })).toBe(false);
		expect(canSee(draft, { kind: "member", orgs: ["rectorado"] })).toBe(false);
		expect(
			canSee(draft, {
				kind: "member",
				orgs: ["rectorado"],
				name: "María Fernanda Rojas Vargas",
			}),
		).toBe(true);
	});
});

describe("maqueta — etiqueta de visibilidad (S22)", () => {
	it("una colección pública no lleva etiqueta", () => {
		const { container } = render(VisibilityBadge, { visibility: "Pública", testid: "badge" });
		expect(screen.queryByTestId("badge")).toBeNull();
		expect(container.textContent?.trim()).toBe("");
	});

	it.each([
		"Privada",
		"Interna",
	] as const)("«%s» es un chip como los demás, sin ícono", (visibility) => {
		render(VisibilityBadge, { visibility, testid: "badge" });
		const badge = screen.getByTestId("badge");
		expect(badge).toHaveTextContent(visibility);
		expect(badge.querySelector("svg")).toBeNull();
		// El chip de las siglas y formatos de estas pantallas: borde, radio `md`, texto `xs`.
		for (const c of ["rounded-md", "border", "border-border", "px-2", "py-0.5", "text-xs"]) {
			expect(badge.classList).toContain(c);
		}
	});
});

describe("maqueta — un visitante nunca ve una colección privada (Q10)", () => {
	afterEach(() => at("http://localhost/"));

	const hidden = COLLECTIONS.filter((c) => !canSee(c, { kind: "visitor" })).map((c) => c.name);

	it.each(DATASETS.map((d) => d.slug))("«Aparece en las colecciones» de %s", (slug) => {
		at(`http://localhost/dev/prototype/dataset-collections?d=${slug}`);
		render(DatasetCollectionsMock);

		const section = screen.getByTestId("dataset-collections");
		for (const name of hidden) expect(section.textContent).not.toContain(name);
	});

	it.each(COLLECTIONS.map((c) => c.slug))("«También en» de %s", (slug) => {
		at(`http://localhost/dev/prototype/collection?c=${slug}`);
		render(CollectionMock);

		for (const el of screen.queryAllByTestId("also-in")) {
			for (const name of hidden) expect(el.textContent).not.toContain(name);
		}
	});
});

describe("maqueta — ficha de colección", () => {
	afterEach(() => at("http://localhost/"));

	it("lista datasets de más de una organización con «También en» hacia otras colecciones", () => {
		at("http://localhost/dev/prototype/collection");
		render(CollectionMock);

		expect(
			screen.getByRole("heading", { level: 1, name: "Rendición pública de cuentas 2025" }),
		).toBeTruthy();
		const orgs = screen.getAllByTestId("dataset-org").map((el) => el.textContent);
		expect(new Set(orgs).size).toBeGreaterThan(1);

		const alsoIn = screen
			.getAllByTestId("also-in")
			.find((el) => /También en/.test(el.textContent ?? ""));
		expect(alsoIn).toBeTruthy();
		const link = within(alsoIn as HTMLElement).getAllByRole("link")[0];
		expect(link.getAttribute("href")).toMatch(/^\/dev\/prototype\/collection\?c=/);
	});

	it("«También en» separa las colecciones con coma y espacio", () => {
		at("http://localhost/dev/prototype/collection");
		render(CollectionMock);

		const many = screen
			.getAllByTestId("also-in")
			.find((el) => within(el).queryAllByRole("link").length > 1) as HTMLElement;
		expect(many.textContent).toMatch(/[^\s], \S/);
		expect(many.textContent).not.toMatch(/\S,\S/);
	});

	it("renderiza la descripción en markdown como HTML, no como texto crudo", () => {
		at("http://localhost/dev/prototype/collection");
		render(CollectionMock);

		const card = screen.getByTestId("collection-description");
		expect(within(card).getByRole("heading", { level: 3, name: "Qué reúne" })).toBeTruthy();
		expect(within(card).getAllByRole("listitem").length).toBeGreaterThan(1);
		expect(card.querySelector("strong")).toHaveTextContent("rendición pública de cuentas");
		expect(card.textContent).not.toMatch(/(^|\n)\s*(#{1,6} |- )|\*\*/);
	});

	it("la vista pública (por defecto) no muestra el avance de las aprobaciones y sí la tarjeta de información", () => {
		at("http://localhost/dev/prototype/collection");
		render(CollectionMock);

		expect(screen.getByTestId("view-publica").getAttribute("aria-current")).toBe("page");
		expect(screen.queryByTestId("publication-status")).toBeNull();
		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(document.body.textContent).not.toMatch(
			/organizaciones aprobaron|Pendiente|Solicitar publicación/,
		);
		expect(screen.queryByRole("button", { name: "Agregar dataset" })).toBeNull();

		const info = screen.getByTestId("collection-info");
		expect(info).toHaveTextContent("Curada por");
		expect(info).toHaveTextContent("Rectorado UMSS");
		expect(info).toHaveTextContent("Creada");
		expect(info).toHaveTextContent("Última actualización");
		expect(info).toHaveTextContent("Cada dataset conserva su licencia");
		// S22: publicada, sin etiqueta de visibilidad.
		expect(screen.queryByTestId("visibility-badge")).toBeNull();
		const hero = screen.getByRole("heading", { level: 1 }).closest("header") as HTMLElement;
		expect(hero.textContent).not.toMatch(/Pública/);
		// La colección no está publicada: lo dice la franja de revisión, no el producto.
		expect(screen.getByTestId("review-note")).toHaveTextContent(
			"se muestra como se verá una vez publicada",
		);
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});

	it("la vista del curador muestra la aprobación por organización con una pendiente", () => {
		at("http://localhost/dev/prototype/collection?vista=curador");
		render(CollectionMock);

		expect(screen.getByTestId("view-curador").getAttribute("aria-current")).toBe("page");
		expect(screen.queryByTestId("collection-info")).toBeNull();
		// Q10: una colección privada de una organización la ven sólo sus miembros.
		expect(screen.getByTestId("visibility-badge")).toHaveTextContent("Privada");
		expect(screen.getByTestId("visibility-badge").querySelector("svg")).toBeNull();
		expect(screen.getByTestId("visibility-audience")).toHaveTextContent(
			"Sólo la ven los miembros de Rectorado UMSS",
		);
		const block = screen.getByTestId("publication-status");
		expect(within(block).getByTestId("approval-summary")).toHaveTextContent(
			"2 de 3 organizaciones aprobaron",
		);
		expect(within(block).getByTestId("approval-fcs")).toHaveTextContent("Pendiente");
		expect(within(block).getByTestId("approval-fcyt")).toHaveTextContent("Aprobada");
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});

	it("«También en» no le muestra a un visitante una colección privada (Q10)", () => {
		at("http://localhost/dev/prototype/collection?c=indicadores-academicos");
		render(CollectionMock);

		expect(document.body.textContent).not.toContain("Rendición pública de cuentas 2025");
	});

	it("la vista del curador ofrece «Solicitar publicación» si no se pidió", () => {
		at("http://localhost/dev/prototype/collection?c=seguridad-alimentaria-salud&vista=curador");
		render(CollectionMock);

		expect(screen.getByRole("button", { name: "Solicitar publicación" })).toBeTruthy();
		expect(screen.getByTestId("visibility-badge")).toHaveTextContent("Interna");
		expect(screen.getByTestId("visibility-audience")).toHaveTextContent(
			"La ven los usuarios con sesión",
		);
	});

	it("la columna derecha queda pegada bajo el encabezado, como la de la ficha del dataset (S22)", () => {
		at("http://localhost/dev/prototype/collection?vista=publica");
		render(CollectionMock);

		const aside = screen.getByTestId("collection-aside");
		expect(aside.classList).toContain("lg:sticky");
		expect(aside.classList).toContain("lg:top-[calc(var(--header-h)+1px+var(--sticky-air))]");
	});

	it("la vista pública lista las organizaciones dueñas de los datasets, con la tarjeta de la ficha del dataset (S22)", () => {
		at("http://localhost/dev/prototype/collection?c=rendicion-cuentas-2025&vista=publica");
		render(CollectionMock);

		const card = screen.getByTestId("collection-orgs");
		expect(card).toHaveTextContent("Organizaciones");
		const items = within(card).getAllByTestId("collection-org");
		expect(items.map((el) => el.getAttribute("href"))).toEqual([
			"/organization/fcyt",
			"/organization/fcs",
			"/organization/rectorado",
		]);
		expect(items[0]).toHaveTextContent("Facultad de Ciencias y Tecnología");
		// El mosaico con la sigla, como `OrganizationLogo` en la tarjeta de la ficha.
		expect(items[0]).toHaveTextContent("FCyT");
		expect(items[0]).toHaveTextContent("1 dataset en esta colección");
		expect(items[1]).toHaveTextContent("2 datasets en esta colección");
	});

	it("la vista del curador no repite la lista de organizaciones: la tiene el bloque de aprobación", () => {
		at("http://localhost/dev/prototype/collection?vista=curador");
		render(CollectionMock);

		expect(screen.queryByTestId("collection-orgs")).toBeNull();
	});

	it("«Curada por» dice si la cura una organización o una persona, con su ícono (Q10, S22)", () => {
		at("http://localhost/dev/prototype/collection?c=rendicion-cuentas-2025");
		const first = render(CollectionMock);
		const org = screen.getByTestId("hero-curator");
		expect(org.textContent?.replace(/\s+/g, " ").trim()).toBe(
			"Curada por la organización Rectorado UMSS",
		);
		expect(org.querySelector("[data-icon=org]")).toBeTruthy();
		first.unmount();

		at("http://localhost/dev/prototype/collection?c=indicadores-academicos");
		render(CollectionMock);
		const person = screen.getByTestId("hero-curator");
		expect(person.textContent?.replace(/\s+/g, " ").trim()).toBe(
			"Curada por María Fernanda Rojas Vargas, a título personal",
		);
		expect(person.querySelector("[data-icon=user]")).toBeTruthy();
	});

	it("elige la colección con ?c=", () => {
		at("http://localhost/dev/prototype/collection?c=investigacion-laboratorios-fcyt");
		render(CollectionMock);

		expect(
			screen.getByRole("heading", { level: 1, name: "Investigación y laboratorios de la FCyT" }),
		).toBeTruthy();
		// El interruptor de vista conserva la colección elegida.
		expect(screen.getByTestId("view-curador").getAttribute("href")).toBe(
			"/dev/prototype/collection?c=investigacion-laboratorios-fcyt&vista=curador",
		);
	});
});

// S36: la ruta de navegación de la ficha no empieza en «Inicio». S42: empieza en la raíz, «Colecciones» (la lista).
// Después, la de una colección curada por una organización es el árbol de esa organización, de la más alta hasta la
// curadora (Q6: jerarquía figurativa, sólo navegación); la de una curada por una persona, la pestaña «Personales».
describe("maqueta — ruta de navegación de la ficha de colección (S36)", () => {
	afterEach(() => at("http://localhost/"));

	const trail = () => {
		const nav = screen.getByRole("navigation", { name: "Ruta de navegación" });
		const list = nav.querySelector("ol") as HTMLElement;
		return {
			nav,
			links: within(list)
				.getAllByRole("link")
				.map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
			current: list.querySelector("[aria-current=page]")?.textContent?.trim(),
		};
	};

	it("ninguna colección lleva «Inicio» en la ruta; todas empiezan en «Colecciones» (S42)", () => {
		for (const collection of COLLECTIONS) {
			at(`http://localhost/dev/prototype/collection?c=${collection.slug}`);
			const view = render(CollectionMock);
			const { nav, current } = trail();
			expect(nav.textContent).not.toMatch(/Inicio/);
			expect(within(nav).queryByRole("link", { name: "Inicio" })).toBeNull();
			expect(trail().links[0]).toEqual(["Colecciones", "/dev/prototype/collections"]);
			expect(current).toBe(collection.name);
			view.unmount();
		}
	});

	it("curada por una organización: el árbol de la organización, de la más alta a la curadora, con enlaces", () => {
		at("http://localhost/dev/prototype/collection?c=investigacion-laboratorios-fcyt");
		render(CollectionMock);

		// «Vicerrectorado» es un nivel sólo de la maqueta: no existe en el catálogo, así que se nombra sin enlace
		// (un clic en vivo llevaría a «no encontrada»).
		expect(trail().links).toEqual([
			["Colecciones", "/dev/prototype/collections"],
			["Rectorado UMSS", "/organization/rectorado"],
			["Dirección de Investigación", "/organization/direccion-investigacion"],
		]);
		expect(trail().nav.querySelector("ol")?.textContent).toMatch(
			/Colecciones.*Rectorado UMSS.*Vicerrectorado.*Dirección de Investigación/s,
		);
		expect(trail().current).toBe("Investigación y laboratorios de la FCyT");
	});

	it("curada por una facultad: la facultad bajo el Rectorado; curada por la organización raíz: sólo ella", () => {
		at("http://localhost/dev/prototype/collection?c=autoevaluacion-acreditacion-fcyt");
		const fcyt = render(CollectionMock);
		expect(trail().links).toEqual([
			["Colecciones", "/dev/prototype/collections"],
			["Rectorado UMSS", "/organization/rectorado"],
			["Facultad de Ciencias y Tecnología", "/organization/fcyt"],
		]);
		fcyt.unmount();

		at("http://localhost/dev/prototype/collection?c=rendicion-cuentas-2025");
		render(CollectionMock);
		expect(trail().links).toEqual([
			["Colecciones", "/dev/prototype/collections"],
			["Rectorado UMSS", "/organization/rectorado"],
		]);
		expect(trail().current).toBe("Rendición pública de cuentas 2025");
	});

	it("curada por una persona: «Colecciones › Personales», sin árbol de organizaciones", () => {
		at("http://localhost/dev/prototype/collection?c=indicadores-academicos");
		render(CollectionMock);

		expect(trail().links).toEqual([
			["Colecciones", "/dev/prototype/collections"],
			["Personales", "/dev/prototype/collections?curador=personales"],
		]);
		expect(trail().current).toBe("Indicadores académicos para tesis");
	});

	it("«Personales» de la ruta abre la lista con esa pestaña elegida", () => {
		at("http://localhost/dev/prototype/collections?curador=personales");
		render(CollectionsMock);

		expect(within(orgTabs()).getByRole("tab", { name: /Personales/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		const names = within(screen.getByTestId("collections-list"))
			.getAllByRole("heading", { level: 2 })
			.map((el) => el.textContent?.trim());
		const personal = COLLECTIONS.filter(
			(c) => c.curator.kind === "user" && c.visibility === "Pública",
		).map((c) => c.name);
		expect(names).toEqual(personal);
	});
});

describe("maqueta — colecciones de un dataset", () => {
	afterEach(() => at("http://localhost/"));

	it("un visitante sin sesión (por defecto) sólo ve las colecciones públicas", () => {
		at("http://localhost/dev/prototype/dataset-collections?d=matricula-por-carrera");
		render(DatasetCollectionsMock);

		// Alineado con el dataset real de la instancia de demostración (guión, historia 2).
		expect(
			screen.getByRole("heading", {
				level: 1,
				name: "Matrícula estudiantil por carrera y gestión",
			}),
		).toBeTruthy();
		expect(document.body.textContent).toContain("Facultad de Ciencias de la Salud");
		expect(screen.getByTestId("viewer-visitante").getAttribute("aria-current")).toBe("page");

		const section = screen.getByTestId("dataset-collections");
		const items = within(section).getAllByTestId("dataset-collection");
		// S42: H2-4 muestra que el dataset está en varias colecciones públicas, de curadores distintos.
		expect(items.map((item) => item.textContent)).toEqual([
			expect.stringContaining("Indicadores académicos para tesis"),
			expect.stringContaining("Estadísticas académicas de pregrado"),
			expect.stringContaining("La Facultad de Ciencias de la Salud en cifras"),
		]);
		expect(
			within(section)
				.getAllByTestId("collection-curator")
				.map((el) => el.textContent),
		).toEqual([
			"María Fernanda Rojas Vargas",
			"Vicerrectorado",
			"Facultad de Ciencias de la Salud",
		]);
		expect(section.textContent).not.toMatch(/Rendición pública de cuentas|Interna|Privada/);
	});

	it("el mismo dataset aparece en colecciones de curadores distintos, publicado una vez", () => {
		at("http://localhost/dev/prototype/dataset-collections?como=rectorado");
		render(DatasetCollectionsMock);

		expect(screen.getByTestId("viewer-rectorado").getAttribute("aria-current")).toBe("page");

		expect(
			screen.getByRole("heading", {
				level: 1,
				name: "Informe de gestión 2025 — Facultad de Ciencias y Tecnología",
			}),
		).toBeTruthy();
		const section = screen.getByTestId("dataset-collections");
		expect(
			within(section).getByRole("heading", { name: /Aparece en las colecciones/ }),
		).toBeTruthy();

		const items = within(section).getAllByTestId("dataset-collection");
		expect(items.length).toBeGreaterThanOrEqual(2);
		const curators = within(section)
			.getAllByTestId("collection-curator")
			.map((el) => el.textContent);
		expect(new Set(curators).size).toBeGreaterThanOrEqual(2);
		for (const item of items) {
			expect(item.getAttribute("href")).toMatch(/^\/dev\/prototype\/collection\?c=/);
		}
		// La del Rectorado es privada: la ve porque es miembro. Las públicas no llevan etiqueta (S22).
		expect(within(section).getByText("Privada").querySelector("svg")).toBeNull();
		expect(within(section).queryByText("Pública")).toBeNull();
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});
});

// S27 de `odd/tasks/prototype-presentation.md`: cada sección de las maquetas se comparte como las de la ficha
// del dataset —el ícono de enlace junto a la línea del título copia la URL actual con su fragmento—.
describe("maqueta — compartir las secciones (S27)", () => {
	const writeText = vi.fn();
	const SCROLL_MT = "scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))]";

	beforeEach(() => {
		writeText.mockReset().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
	});
	afterEach(() => at("http://localhost/"));

	async function expectShared(url: string, id: string, label: string) {
		const section = document.getElementById(id) as HTMLElement;
		expect(section, id).not.toBeNull();
		expect(section.className).toContain(SCROLL_MT);
		expect(section.className).toContain("group/tarjeta");
		const button = within(section).getByRole("button", {
			name: `Copiar enlace a la sección ${label}`,
		});
		await fireEvent.click(button);
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${url}#${id}`));
	}

	it("«Aparece en las colecciones» del dataset se comparte con #collections", async () => {
		const url = "http://localhost/dev/prototype/dataset-collections?d=matricula-por-carrera";
		at(url);
		render(DatasetCollectionsMock);

		expect(screen.getByTestId("dataset-collections").id).toBe("collections");
		await expectShared(url, "collections", "Colecciones");
	});

	it.each([
		["description", "Descripción"],
		["datasets", "Contenido"],
		["information", "Información"],
		["organizations", "Organizaciones"],
	])("ficha de colección, vista pública: #%s se comparte", async (id, label) => {
		const url = "http://localhost/dev/prototype/collection?c=investigacion-laboratorios-fcyt";
		at(url);
		render(CollectionMock);

		await expectShared(url, id, label);
	});

	it("ficha de colección, vista del curador: #publication se comparte", async () => {
		const url = "http://localhost/dev/prototype/collection?vista=curador";
		at(url);
		render(CollectionMock);

		await expectShared(url, "publication", "Publicación");
	});
});

// S42: H2-4 (la ficha real de la matrícula en modo prototipo) muestra el dataset en varias colecciones. Los datos de
// la maqueta tienen que ser coherentes en los dos sentidos y con las reglas de la ficha.
describe("maqueta — coherencia de los datos (S42)", () => {
	afterEach(() => at("http://localhost/"));

	it("la matrícula está en al menos tres colecciones públicas: una de una persona y una de otra unidad", () => {
		const matricula = datasetBySlug("matricula-por-carrera");
		const publicas = collectionsOf(matricula.slug).filter((c) => canSee(c, { kind: "visitor" }));
		expect(publicas.length).toBeGreaterThanOrEqual(3);
		expect(publicas.some((c) => c.curator.kind === "user")).toBe(true);
		expect(publicas.some((c) => c.curator.kind === "org" && c.curator.org !== matricula.org)).toBe(
			true,
		);
		const curators = publicas.map((c) => JSON.stringify(c.curator));
		expect(new Set(curators).size).toBe(publicas.length);
	});

	it.each(
		collectionsOf("matricula-por-carrera").map((c) => c.slug),
	)("la ficha de %s lista la matrícula", (slug) => {
		at(`http://localhost/dev/prototype/collection?c=${slug}&vista=curador`);
		render(CollectionMock);

		const list = screen.getByTestId("collection-datasets");
		expect(list).toHaveTextContent("Matrícula estudiantil por carrera y gestión");
	});

	it.each(
		COLLECTIONS.map((c) => c.slug),
	)("%s: sus datasets existen y cada dueña tiene su decisión", (slug) => {
		const collection = collectionBySlug(slug);
		expect(collection.slug).toBe(slug);
		const owners = ownerOrgs(collection).map((o) => o.name);
		if (collection.approvals) {
			expect(Object.keys(collection.approvals).sort()).toEqual([...owners].sort());
		}
		// Una pública ya la aprobaron todas sus dueñas (RF-23).
		if (collection.visibility === "Pública") {
			expect(Object.values(collection.approvals ?? {})).not.toContain("Pendiente");
			expect(collection.approvals).toBeDefined();
		}
	});
});
