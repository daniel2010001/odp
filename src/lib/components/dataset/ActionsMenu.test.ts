// Pruebas de los menús «Más acciones» (T13): el del hero del dataset (`ActionsMenu`, pegado a «Editar» como
// botón dividido) y el de la banda del recurso (`MoreMenu`, que reemplaza a las acciones secundarias bajo 32 rem).
// jsdom no aplica Tailwind: los umbrales se prueban por contrato de clases; el comportamiento, por el DOM.

import { Plus, Share2 } from "@lucide/svelte";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ActionsMenu from "./ActionsMenu.svelte";
import MoreMenu from "./MoreMenu.svelte";

const ITEMS = [
	{ label: "Compartir", icon: Share2, href: "/compartir" },
	{ label: "Crear gráfico", icon: Plus, href: "/charts/new" },
];

describe("ActionsMenu — «Más acciones» del hero", () => {
	it("el disparador es un botón de 44 px con nombre accesible «Más acciones» y no muestra el menú cerrado", () => {
		render(ActionsMenu, { props: { items: ITEMS } });

		const trigger = screen.getByRole("button", { name: "Más acciones" });
		expect(trigger.className).toContain("size-11");
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("al abrirlo ofrece cada acción como enlace, con su destino y alto táctil de 44 px", async () => {
		render(ActionsMenu, { props: { items: ITEMS } });

		await fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));

		const menu = await screen.findByRole("menu");
		const links = within(menu).getAllByRole("link");
		expect(links.map((l) => [l.textContent?.trim(), l.getAttribute("href")])).toEqual([
			["Compartir", "/compartir"],
			["Crear gráfico", "/charts/new"],
		]);
		for (const link of links) expect(link.className).toContain("min-h-11");
	});
});

describe("MoreMenu — «Más acciones» de la banda del recurso", () => {
	it("es un botón de 44 px que se oculta desde el umbral, y su menú lista las acciones como enlaces", async () => {
		render(MoreMenu, { props: { items: ITEMS, hideFrom: "32rem" } });

		const trigger = screen.getByRole("button", { name: "Más acciones" });
		expect(trigger.className).toContain("size-11");
		expect(trigger.className).toContain("@[32rem]:hidden");

		await fireEvent.click(trigger);
		const menu = await screen.findByRole("menu");
		expect(
			within(menu)
				.getAllByRole("link")
				.map((l) => l.getAttribute("href")),
		).toEqual(["/compartir", "/charts/new"]);
	});
});
