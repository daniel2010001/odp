import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb.svelte";

// Los cuatro items reales de la ficha del recurso, con los nombres largos del catálogo: es el caso
// que el autor reportó («en móviles se ve mal, ocupa mucho espacio»).
const items: BreadcrumbItem[] = [
	{ label: "Datasets", href: "/search" },
	{ label: "Observatorio de Movilidad Urbana Cochabamba" },
	{ label: "Encuesta de movilidad urbana 2026", href: "/dataset/encuesta" },
	{ label: "movilidad_urbana_2026_viajes_por_zona_consolidado.csv" },
];

describe("Breadcrumb", () => {
	it("conserva las migas intermedias como enlaces navegables", () => {
		render(Breadcrumb, { props: { items } });

		expect(screen.getByRole("link", { name: "Datasets" })).toHaveAttribute("href", "/search");
		expect(screen.getByRole("link", { name: "Encuesta de movilidad urbana 2026" })).toHaveAttribute(
			"href",
			"/dataset/encuesta",
		);
	});

	it("la miga final no es enlace y se anuncia como la página actual", () => {
		render(Breadcrumb, { props: { items } });

		expect(screen.queryByRole("link", { name: items[3].label })).toBeNull();
		expect(screen.getByText(items[3].label)).toHaveAttribute("aria-current", "page");
	});

	it("el nombre accesible de cada miga queda ENTERO aunque se recorte a la vista", () => {
		// Esta es la razón por la que truncar es seguro y colapsar no: `truncate` recorta lo pintado,
		// no el texto, así que el nombre accesible —y el lector de pantalla— siguen leyendo la etiqueta
		// completa. Si alguien «mejorara» esto recortando la cadena en JS, este test cae.
		render(Breadcrumb, { props: { items } });

		// Migas CON enlace: el nombre accesible es el texto completo, aunque se recorte lo pintado.
		expect(screen.getByRole("link", { name: "Datasets" })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Encuesta de movilidad urbana 2026" }),
		).toBeInTheDocument();
		// Y las que NO lo llevan —la organización no tiene `href` en el catálogo real, y la última miga
		// nunca lo tiene— conservan también el texto entero.
		expect(screen.getByText("Observatorio de Movilidad Urbana Cochabamba")).toBeInTheDocument();
		expect(screen.getByText(items[3].label)).toBeInTheDocument();
	});

	it("en móvil la lista no envuelve, y cada miga puede encogerse hasta el truncado", () => {
		// jsdom no maqueta nada, así que la mitad visual de la decisión se ancla por clase: es lo que
		// impide que la lista vuelva a partirse en varias líneas arriba del contenido.
		const { container } = render(Breadcrumb, { props: { items } });
		const list = container.querySelector("ol");
		const crumbs = container.querySelectorAll("li");

		expect(list?.className).toContain("sm:flex-wrap");
		expect(list?.className).not.toMatch(/(^|\s)flex-wrap(\s|$)/);
		expect(crumbs).toHaveLength(items.length);
		for (const crumb of crumbs) {
			expect(crumb.className).toContain("min-w-0");
		}
		// Las cuatro etiquetas truncables (la última también: es la más larga del catálogo).
		expect(container.querySelectorAll(".truncate")).toHaveLength(items.length);
	});
});
