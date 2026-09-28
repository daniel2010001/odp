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

	it("con hermanos suma un segundo grupo, y el actual va sin enlace", async () => {
		// El salto entre recursos vive en el mismo desplegable que el recorrido: contesta «¿dónde estoy?» y
		// «¿qué más hay?» de una sola vez. El rótulo del rol entra en el nombre accesible del enlace, así
		// que las consultas van con expresión regular.
		const { container } = render(Breadcrumb, {
			props: {
				items,
				related: {
					heading: "Recursos de este dataset",
					items: [
						{ label: "Flujos vehiculares por punto de conteo", href: "/r/1", role: "CSV" },
						{ label: items[3].label, role: "CSV" },
					],
				},
			},
		});
		// Con hermanos, el RECORRIDO de escritorio también trae un disparador (D4): este test es del
		// chip, así que se acota a él para no confundir los dos botones con el mismo nombre accesible.
		const chip = container.querySelector("nav > div") as HTMLElement;

		await fireEvent.click(within(chip).getByRole("button"));

		expect(await screen.findByText("Recursos de este dataset")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Flujos vehiculares/ })).toHaveAttribute(
			"href",
			"/r/1",
		);
		// El actual es información, no destino: no es enlace.
		expect(screen.queryByRole("link", { name: /movilidad_urbana_2026/ })).toBeNull();
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

	it("el desplegable de la miga actual de escritorio (D4) tiene el mismo tope de ancho", async () => {
		const related = {
			heading: "Recursos de este dataset",
			items: [
				{ label: "Flujos vehiculares por punto de conteo", href: "/r/1", role: "CSV" },
				{ label: items[3].label, role: "CSV" },
			],
		};
		const { container } = render(Breadcrumb, { props: { items, related } });
		const list = trail(container);

		await fireEvent.click(within(list).getByRole("button", { name: items[3].label }));
		await screen.findByText("Recursos de este dataset");

		const content = openContent();
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

describe("Breadcrumb — el desplegable de hermanos en la miga actual (escritorio, D4)", () => {
	const related = {
		heading: "Recursos de este dataset",
		items: [
			{ label: "Flujos vehiculares por punto de conteo", href: "/r/1", role: "CSV" },
			{ label: items[3].label, role: "CSV" },
		],
	};

	it("la miga actual del recorrido de escritorio es el disparador del grupo de hermanos", async () => {
		// Decisión del autor (hoja `/dev/nav`, D4): los hermanos SON del nivel del recurso, así que el
		// desplegable vive en la miga ACTUAL del recorrido de escritorio, no sólo en el chip de móvil.
		const { container } = render(Breadcrumb, { props: { items, related } });
		const list = trail(container);

		const trigger = within(list).getByRole("button", { name: items[3].label });
		// La miga actual sigue anunciándose como la página: el disparador no la convierte en un destino.
		expect(trigger).toHaveAttribute("aria-current", "page");

		await fireEvent.click(trigger);

		expect(await screen.findByText("Recursos de este dataset")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Flujos vehiculares/ })).toHaveAttribute(
			"href",
			"/r/1",
		);
		// El actual es información, no destino: en la fila del grupo va sin enlace.
		expect(screen.queryByRole("link", { name: /movilidad_urbana_2026/ })).toBeNull();
	});

	it("sin hermanos, la miga actual sigue siendo texto y el recorrido no ofrece desplegable", () => {
		const { container } = render(Breadcrumb, { props: { items } });
		const list = trail(container);

		expect(within(list).queryByRole("button")).toBeNull();
		expect(within(list).getByText(items[3].label)).toHaveAttribute("aria-current", "page");
	});
});
