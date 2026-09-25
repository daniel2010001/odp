import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Breadcrumb, { type BreadcrumbItem } from "./Breadcrumb.svelte";

// Los cuatro items reales de la ficha del recurso, con los nombres largos del catálogo: es el caso
// que el autor reportó («en móviles se ve mal, ocupa mucho espacio»).
const items: BreadcrumbItem[] = [
	{ label: "Datasets", href: "/search", role: "Catálogo" },
	{ label: "Observatorio de Movilidad Urbana Cochabamba", role: "Organización" },
	{ label: "Encuesta de movilidad urbana 2026", href: "/dataset/encuesta", role: "Dataset" },
	{ label: "movilidad_urbana_2026_viajes_por_zona_consolidado.csv", role: "Recurso" },
];

function trail(container: HTMLElement): HTMLElement {
	const list = container.querySelector("ol");
	if (!list) throw new Error("No se encontró el recorrido de escritorio");
	return list as HTMLElement;
}

describe("Breadcrumb — el recorrido (escritorio)", () => {
	it("conserva las migas intermedias como enlaces navegables", () => {
		const { container } = render(Breadcrumb, { props: { items } });
		const list = trail(container);

		expect(within(list).getByRole("link", { name: "Datasets" })).toHaveAttribute("href", "/search");
		expect(
			within(list).getByRole("link", { name: "Encuesta de movilidad urbana 2026" }),
		).toHaveAttribute("href", "/dataset/encuesta");
	});

	it("la miga final no es enlace y se anuncia como la página actual", () => {
		const { container } = render(Breadcrumb, { props: { items } });
		const list = trail(container);

		expect(within(list).queryByRole("link", { name: items[3].label })).toBeNull();
		expect(within(list).getByText(items[3].label)).toHaveAttribute("aria-current", "page");
	});

	it("el nombre accesible de cada miga queda ENTERO aunque se recorte a la vista", () => {
		// Esta es la razón por la que truncar es seguro y colapsar no: `truncate` recorta lo pintado,
		// no el texto, así que el nombre accesible —y el lector de pantalla— siguen leyendo la etiqueta
		// completa. Si alguien «mejorara» esto recortando la cadena en JS, este test cae.
		const { container } = render(Breadcrumb, { props: { items } });
		const list = trail(container);

		expect(within(list).getByRole("link", { name: "Datasets" })).toBeInTheDocument();
		expect(
			within(list).getByText("Observatorio de Movilidad Urbana Cochabamba"),
		).toBeInTheDocument();
		expect(within(list).getByText(items[3].label)).toBeInTheDocument();
	});

	it("cada miga puede encogerse hasta el truncado, y el recorrido es sólo de escritorio", () => {
		// jsdom no maqueta nada, así que la mitad visual se ancla por clase: es lo que impide que la fila
		// desborde en horizontal en vez de recortar.
		const { container } = render(Breadcrumb, { props: { items } });
		const list = trail(container);
		const crumbs = list.querySelectorAll("li");

		expect(list.className).toContain("lg:flex");
		expect(list.className).toContain("hidden");
		expect(crumbs).toHaveLength(items.length);
		for (const crumb of crumbs) {
			expect(crumb.className).toContain("min-w-0");
		}
		// Las cuatro etiquetas truncables (la última también: es la más larga del catálogo).
		expect(list.querySelectorAll(".truncate")).toHaveLength(items.length);
	});

	it("la raíz puede encogerse: sin eso el truncado de adentro no actúa y la fila desborda", () => {
		// Lo encontró la revisión nativa del slice E5 (`R3-001`, CRITICAL, `review-5ab16f231f1adb49`): el
		// `<nav>` es el item flexible de la fila que lo contiene, y sin `min-w-0` su `min-width: auto` no
		// lo deja bajar de su ancho de contenido.
		const { container } = render(Breadcrumb, { props: { items } });

		expect(container.querySelector("nav")?.className).toContain("min-w-0");
	});
});

describe("Breadcrumb — el chip de móvil", () => {
	it("muestra el nivel ACTUAL, no una flecha de volver", () => {
		// La decisión del autor (2026-09-24): el breadcrumb dice dónde estás —con el ícono del tipo— y el
		// recorrido va adentro. «Volver» es el botón del navegador, y por eso no hay flecha.
		const { container } = render(Breadcrumb, { props: { items } });
		const chip = container.querySelector("nav > div");

		expect(chip?.className).toContain("lg:hidden");
		expect(within(chip as HTMLElement).getByRole("button")).toHaveTextContent(items[3].label);
		expect(container.textContent).not.toContain("←");
	});

	it("el chip no duplica el recorrido en el árbol de accesibilidad mientras está cerrado", () => {
		// Sólo el recorrido de escritorio tiene los enlaces; el chip aporta un botón. Si el desplegable
		// renderizara sus items siempre, el lector de pantalla oiría las migas dos veces.
		render(Breadcrumb, { props: { items } });

		expect(screen.getAllByRole("link")).toHaveLength(2);
	});

	it("al abrirlo, lista los ancestros con el rótulo de su nivel y cada uno como enlace", async () => {
		render(Breadcrumb, { props: { items } });

		await fireEvent.click(screen.getByRole("button"));

		const headings = await screen.findAllByText("Recorrido");
		expect(headings.length).toBeGreaterThan(0);
		// La miga actual NO está en la lista: ya es el chip.
		expect(screen.queryByRole("link", { name: items[3].label })).toBeNull();
		expect(screen.getByText("Organización")).toBeInTheDocument();
	});
});
