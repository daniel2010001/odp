import { FileText } from "@lucide/svelte";
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

	it("sin hermanos, la miga actual sigue siendo texto y el recorrido no ofrece desplegable", () => {
		const { container } = render(Breadcrumb, { props: { items } });
		const list = trail(container);

		expect(within(list).queryByRole("button")).toBeNull();
		expect(within(list).getByText(items[3].label)).toHaveAttribute("aria-current", "page");
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

	it("el disparador de móvil es la fila de texto del A7: sin chip y con los íconos a `size-4`", () => {
		// Decisión del autor (A7 de la revisión de navegación): el título completo es la zona de toque —por eso el
		// disparador es la fila entera— y el aspecto deja de ser un botón con borde y fondo: texto con
		// relleno vertical y el `hover` como única retroalimentación. jsdom no maqueta, así que la clase es
		// lo que fija la forma y este test impide que vuelva el chip.
		const { container } = render(Breadcrumb, { props: { items, icon: FileText } });
		const chip = container.querySelector("nav > div") as HTMLElement;
		const trigger = within(chip).getByRole("button");

		expect(trigger.className).toContain("py-1");
		expect(trigger.className).not.toContain("border");
		expect(trigger.className).not.toContain("bg-background");
		expect(trigger.className).toContain("hover:text-foreground");
		// Sigue pudiendo encogerse: sin `min-w-0`/`max-w-full` el título no trunca y la fila desborda.
		expect(trigger.className).toContain("min-w-0");
		expect(trigger.className).toContain("max-w-full");
		// Los dos íconos —el del tipo y el chevron— al tamaño del A7, no al `size-3.5` del chip.
		expect(trigger.querySelectorAll(".size-4")).toHaveLength(2);
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

describe("Breadcrumb — el desplegable no desborda el viewport", () => {
	/** El contenido del desplegable abierto: bits-ui lo monta en un portal y sólo cuando está abierto. */
	function openContent(): HTMLElement {
		const content = document.querySelector(".z-50");
		if (!content) throw new Error("No se encontró el contenido del desplegable");
		return content as HTMLElement;
	}

	it("el desplegable del chip no puede exceder el ancho del viewport", async () => {
		// El autor reportó, a ancho de teléfono, que el menú «desborda la pantalla y no se leen los
		// títulos». Un ancho fijo sin tope (`min-w-72`, ~288px) se sale de un viewport de 375px: el
		// `max-w` relativo al viewport es lo que lo impide. jsdom no maqueta, así que la clase es la
		// que fija la restricción.
		const { container } = render(Breadcrumb, { props: { items } });
		const chip = container.querySelector("nav > div") as HTMLElement;

		await fireEvent.click(within(chip).getByRole("button"));
		await screen.findByText("Recorrido");

		const content = openContent();
		expect(content.className).toContain("w-72");
		expect(content.className).toContain("max-w-[calc(100vw-2rem)]");
	});

	it("la columna de rol es angosta y trunca para devolverle el ancho a la etiqueta", async () => {
		// La columna del rol decía el nivel de cada fila (decisión deliberada) pero a `w-24` se comía un
		// tercio de un teléfono. Se conserva el rol, más angosto y truncable.
		render(Breadcrumb, { props: { items } });

		await fireEvent.click(screen.getByRole("button"));
		const role = await screen.findByText("Organización");

		expect(role.className).toContain("w-14");
		expect(role.className).toContain("shrink-0");
		expect(role.className).toContain("truncate");
	});

	it("la etiqueta truncable puede encogerse por debajo de su contenido (`min-w-0`)", async () => {
		// Sin `min-w-0`, un item flexible conserva `min-width: auto`: su min-content es la etiqueta
		// entera, el `truncate` nunca actúa y la fila crece más allá del menú. La consulta va acotada al
		// desplegable: la misma etiqueta también está en el recorrido de escritorio.
		render(Breadcrumb, { props: { items } });

		await fireEvent.click(screen.getByRole("button"));
		await screen.findByText("Recorrido");
		const label = within(openContent()).getByText("Observatorio de Movilidad Urbana Cochabamba");

		expect(label.className).toContain("min-w-0");
		expect(label.className).toContain("truncate");
	});
});

describe("Breadcrumb — plegar las migas del medio (collapseMiddle)", () => {
	// Las páginas de gráficos: Datasets › Organización › Dataset › Recurso › Gráfico.
	const chartItems: BreadcrumbItem[] = [
		{ label: "Datasets", href: "/search", role: "Catálogo" },
		{ label: "Observatorio de Movilidad Urbana", href: "/organization/obs", role: "Organización" },
		{ label: "Encuesta de movilidad urbana 2026", href: "/dataset/encuesta", role: "Dataset" },
		{ label: "viajes.csv", href: "/dataset/encuesta/resource/r1", role: "Recurso" },
		{ label: "Nuevo gráfico", role: "Gráfico" },
	];

	it("con la opción, la fila muestra la primera miga, el «…» y las dos últimas", () => {
		const { container } = render(Breadcrumb, {
			props: { items: chartItems, collapseMiddle: true },
		});
		const list = trail(container);

		expect(within(list).getByRole("link", { name: "Datasets" })).toBeInTheDocument();
		expect(within(list).getByRole("link", { name: "viajes.csv" })).toBeInTheDocument();
		expect(within(list).getByText("Nuevo gráfico")).toHaveAttribute("aria-current", "page");
		expect(within(list).queryByText(chartItems[1].label)).toBeNull();
		expect(within(list).queryByText(chartItems[2].label)).toBeNull();
		expect(
			within(list).getByRole("button", { name: "Mostrar las secciones ocultas de la ruta" }),
		).toBeInTheDocument();
	});

	it("las migas plegadas son enlaces dentro del menú del «…»", async () => {
		const { container } = render(Breadcrumb, {
			props: { items: chartItems, collapseMiddle: true },
		});
		const list = trail(container);

		await fireEvent.click(
			within(list).getByRole("button", { name: "Mostrar las secciones ocultas de la ruta" }),
		);

		expect(
			await screen.findByRole("link", { name: /Observatorio de Movilidad Urbana/ }),
		).toHaveAttribute("href", "/organization/obs");
		expect(screen.getByRole("link", { name: /Encuesta de movilidad urbana 2026/ })).toHaveAttribute(
			"href",
			"/dataset/encuesta",
		);
	});

	it("el texto completo de cada miga visible va en `title`", () => {
		const { container } = render(Breadcrumb, {
			props: { items: chartItems, collapseMiddle: true },
		});
		const list = trail(container);

		expect(within(list).getByRole("link", { name: "viajes.csv" })).toHaveAttribute(
			"title",
			"viajes.csv",
		);
		expect(within(list).getByText("Nuevo gráfico")).toHaveAttribute("title", "Nuevo gráfico");
	});

	it("la fila no se parte en líneas", () => {
		const { container } = render(Breadcrumb, {
			props: { items: chartItems, collapseMiddle: true },
		});
		expect(trail(container)).toHaveClass("lg:flex-nowrap");
		expect(trail(container)).not.toHaveClass("lg:flex-wrap");
	});

	it("con tres migas o menos no hay nada que plegar", () => {
		const { container } = render(Breadcrumb, {
			props: { items: chartItems.slice(2), collapseMiddle: true },
		});
		expect(within(trail(container)).queryByRole("button")).toBeNull();
	});

	it("SIN la opción, las mismas migas se muestran todas (las demás páginas no cambian)", () => {
		const { container } = render(Breadcrumb, { props: { items: chartItems } });
		const list = trail(container);

		for (const item of chartItems) {
			expect(within(list).getByText(item.label)).toBeInTheDocument();
		}
		expect(within(list).queryByRole("button")).toBeNull();
		expect(list).toHaveClass("lg:flex-wrap");
	});
});
