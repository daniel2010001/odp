// Tests de las maquetas de colecciones (P5, S4 y L3 de `odd/tasks/prototype-presentation.md`): lo que
// importa capturar es que una colección reúne datasets de varias organizaciones, que la relación se recorre
// en los dos sentidos —«También en» desde la colección, «Aparece en las colecciones» desde el dataset— y
// que el mismo dataset está en colecciones de curadores distintos sin duplicarse. Ninguna pantalla promete
// circulación de documentos.

import { render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "$app/stores";
import CollectionMock from "../collection/+page.svelte";
import DatasetCollectionsMock from "../dataset-collections/+page.svelte";
import CollectionsMock from "./+page.svelte";

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function at(url: string) {
	pageStore.set({ params: {}, url: new URL(url) });
}

const TRAMITE = /recibid|enviado a|derivad|en tr[aá]mite/i;

describe("maqueta — colecciones", () => {
	afterEach(() => at("http://localhost/"));

	it("lista las colecciones con sus datasets y organizaciones, y permite crear una", () => {
		at("http://localhost/dev/prototype/collections");
		render(CollectionsMock);

		expect(screen.getByRole("heading", { level: 1, name: "Colecciones" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Nueva colección" })).toBeTruthy();
		expect(screen.getByRole("textbox", { name: "Buscar colecciones" })).toBeTruthy();

		const list = screen.getByTestId("collections-list");
		expect(within(list).getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(2);
		expect(within(list).getAllByText("4 datasets de 3 organizaciones").length).toBe(2);
		expect(within(list).getByText("2 datasets de 2 organizaciones")).toBeTruthy();
		expect(within(list).getAllByText("Interna").length).toBeGreaterThan(0);
		expect(within(list).getAllByText("Pública").length).toBeGreaterThan(0);
		expect(document.body.textContent).not.toMatch(TRAMITE);
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

	it("muestra la aprobación por organización con una pendiente", () => {
		at("http://localhost/dev/prototype/collection");
		render(CollectionMock);

		const block = screen.getByTestId("publication-status");
		expect(within(block).getByTestId("approval-summary")).toHaveTextContent(
			"2 de 3 organizaciones aprobaron",
		);
		expect(within(block).getByTestId("approval-fcs")).toHaveTextContent("Pendiente");
		expect(within(block).getByTestId("approval-fcyt")).toHaveTextContent("Aprobada");
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});

	it("elige la colección con ?c=", () => {
		at("http://localhost/dev/prototype/collection?c=investigacion-laboratorios-fcyt");
		render(CollectionMock);

		expect(
			screen.getByRole("heading", { level: 1, name: "Investigación y laboratorios de la FCyT" }),
		).toBeTruthy();
	});
});

describe("maqueta — colecciones de un dataset", () => {
	afterEach(() => at("http://localhost/"));

	it("el mismo dataset aparece en colecciones de curadores distintos, publicado una vez", () => {
		at("http://localhost/dev/prototype/dataset-collections");
		render(DatasetCollectionsMock);

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
		expect(document.body.textContent).not.toMatch(TRAMITE);
	});
});
