// Tests de las maquetas de colecciones (P5, S4 y L3 de `odd/tasks/prototype-presentation.md`): lo que
// importa capturar es que una colección reúne datasets de varias organizaciones, que la relación se recorre
// en los dos sentidos —«También en» desde la colección, «Aparece en las colecciones» desde el dataset— y
// que el mismo dataset está en colecciones de curadores distintos sin duplicarse. Ninguna pantalla promete
// circulación de documentos. La ficha se compara en dos vistas (S10): la pública, sin el avance de las
// aprobaciones, y la del curador, con el bloque «Publicación».

import { render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "$app/stores";
import CollectionMock from "../collection/+page.svelte";
import DatasetCollectionsMock from "../dataset-collections/+page.svelte";
import CollectionsMock from "./+page.svelte";
import { COLLECTIONS, canSee, collectionBySlug, DATASETS } from "./data";

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function at(url: string) {
	pageStore.set({ params: {}, url: new URL(url) });
}

const TRAMITE = /recibid|enviado a|derivad|en tr[aá]mite/i;

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
		expect(screen.getByRole("textbox", { name: "Buscar colecciones" })).toBeTruthy();
		expect(screen.queryByRole("combobox", { name: "Visibilidad" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Nueva colección" })).toBeNull();

		expect(listNames()).toEqual(
			COLLECTIONS.filter((c) => canSee(c, { kind: "visitor" })).map((c) => c.name),
		);
		const list = screen.getByTestId("collections-list");
		expect(within(list).getByText("4 datasets de 4 organizaciones")).toBeTruthy();
		expect(list.textContent).not.toMatch(/Privada|Interna/);
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});

	it("«Mis colecciones» del panel lista las que cura la persona y las de su organización, con el filtro de visibilidad", () => {
		at("http://localhost/dev/prototype/collections?vista=panel");
		render(CollectionsMock);

		expect(screen.getByTestId("view-panel").getAttribute("aria-current")).toBe("page");
		expect(screen.getByTestId("review-note")).toHaveTextContent("María Fernanda Rojas Vargas");
		expect(screen.getByRole("heading", { level: 1, name: "Mis colecciones" })).toBeTruthy();
		const crumbs = screen.getByRole("navigation", { name: "Ruta de navegación" });
		expect(within(crumbs).getByRole("link", { name: /Panel/ }).getAttribute("href")).toBe(
			"/dashboard",
		);
		expect(crumbs).toHaveTextContent("Mis colecciones");
		expect(screen.getByRole("button", { name: "Nueva colección" })).toBeTruthy();

		const visibility = screen.getByRole("combobox", { name: "Visibilidad" });
		for (const option of ["Privada", "Interna", "Pública"]) {
			expect(within(visibility).getByRole("option", { name: option })).toBeTruthy();
		}
		const curator = screen.getByRole("combobox", { name: "Curador" });
		expect(within(curator).getByRole("option", { name: "Curadas por mí" })).toBeTruthy();
		expect(within(curator).getByRole("option", { name: "De mis organizaciones" })).toBeTruthy();

		// Las suyas (una pública y una privada, su lista de trabajo) y la privada del Rectorado; no las ajenas.
		expect(listNames()).toEqual([
			"Rendición pública de cuentas 2025",
			"Indicadores académicos para tesis",
			"Lista de trabajo: capítulo de eficiencia terminal",
		]);
		const list = screen.getByTestId("collections-list");
		expect(within(list).getByText("3 datasets de 2 organizaciones")).toBeTruthy();
		expect(within(list).getAllByText("Privada").length).toBe(2);
		// Desde el panel se abre la ficha en la vista del curador.
		expect(within(list).getAllByRole("link")[0].getAttribute("href")).toBe(
			"/dev/prototype/collection?c=rendicion-cuentas-2025&vista=curador",
		);
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});

	it("la lista de trabajo privada de una persona no la ve nadie más (Q10)", () => {
		const draft = collectionBySlug("capitulo-eficiencia-terminal");
		expect(draft.visibility).toBe("Privada");
		expect(draft.approvals).toBeUndefined();
		expect(canSee(draft, { kind: "visitor" })).toBe(false);
		expect(canSee(draft, { kind: "member", org: "rectorado" })).toBe(false);
		expect(
			canSee(draft, { kind: "member", org: "rectorado", name: "María Fernanda Rojas Vargas" }),
		).toBe(true);
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
		expect(screen.getByTestId("visibility-badge")).toHaveTextContent("Pública");
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
		expect(items.map((item) => item.textContent)).toEqual([
			expect.stringContaining("Indicadores académicos para tesis"),
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
		// La del Rectorado es privada: la ve porque es miembro.
		expect(within(section).getByText("Privada")).toBeTruthy();
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});
});
