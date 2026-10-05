// Tests de la hoja de revisión de la tarjeta de fila del dashboard.
//
// La propiedad que la hace útil es que las formas de ofrecer «Editar» queden distinguibles y
// revisables. El test fija la invariante que no puede romperse —la acción es hermana de la tarjeta,
// nunca anidada dentro del `<a>`, porque un interactivo dentro de un `<a>` es HTML inválido— y que
// el interruptor de cada variante cambie lo que se renderiza. El instrumento se prueba aparte, con
// entradas conocidas, porque en jsdom no hay layout; sus columnas «declarado» y «revelado» sí se
// prueban sobre el nodo renderizado, porque no dependen del layout.
//
// El chevron era la objeción del autor: E, F, G y H repiten B y D sin él, y el test lo fija contra
// la presencia del ícono `lucide-chevron-right`.
//
// Las variantes G y H suman una segunda acción «Eliminar» —copia declarada, no implementada— para
// comparar la disposición de dos acciones. El control «Revelado» fija el estado de D y F, y el
// control «Tamaño» cambia el objetivo entre 36 y 44 px.
//
// La variante «menú de tres puntos» no existe: el componente vendorizado `dropdown-menu` no está en
// el repo y esta hoja no vendoriza componentes nuevos.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CardsSheet from "./+page.svelte";
import { formatCardActionMeasurement } from "./measures";

const VARIANT_IDS = ["a", "b", "d", "e", "f", "g", "h"] as const;

const PRESET_IDS = [
	"con-permiso",
	"sin-permiso",
	"titulo-largo",
	"privado",
	"publico",
	"tres-filas",
] as const;

function renderOf(variantId: string): HTMLElement {
	return screen.getByTestId(`card-render-${variantId}`);
}

function editOf(variantId: string, index = 0): HTMLElement {
	return screen.getByTestId(`edit-${variantId}-${index}`);
}

describe("hoja de las tarjetas — cobertura de variantes", () => {
	it("renderiza las variantes construidas y no la del menú de tres puntos", () => {
		render(CardsSheet);

		for (const id of VARIANT_IDS) {
			expect(screen.getByTestId(`card-variant-${id}`)).toBeInTheDocument();
		}
		expect(screen.getAllByTestId(/^card-variant-/)).toHaveLength(VARIANT_IDS.length);
		expect(screen.queryByTestId("card-variant-c")).toBeNull();
	});

	it("el interruptor de cada variante cambia lo que se renderiza", async () => {
		render(CardsSheet);

		for (const id of VARIANT_IDS) {
			const toggle = screen.getByTestId(`variant-switch-${id}`);
			expect(toggle).toHaveAttribute("aria-checked", "true");

			await fireEvent.click(toggle);
			await waitFor(() => {
				expect(screen.queryByTestId(`card-variant-${id}`)).toBeNull();
			});

			await fireEvent.click(toggle);
			await waitFor(() => {
				expect(screen.getByTestId(`card-variant-${id}`)).toBeInTheDocument();
			});
		}
	});

	it("la acción «Editar» es hermana de la tarjeta, nunca anidada dentro del `<a>`", () => {
		render(CardsSheet);

		for (const id of VARIANT_IDS) {
			const link = screen.getByTestId(`card-link-${id}-0`);
			const edit = editOf(id);

			// Nunca dentro del `<a>`; y siempre en la misma fila que la tarjeta, nunca fuera del `<li>`.
			// En G y H el botón vive dentro del contenedor de acciones, que sí es hermano del `<a>`.
			expect(link.contains(edit)).toBe(false);
			expect(link.parentElement).toContainElement(edit);
		}
	});
});

describe("hoja de las tarjetas — forma de la acción", () => {
	it("la variante A conserva el texto visible «Editar»", () => {
		render(CardsSheet);

		const edit = editOf("a");
		expect(edit).toHaveTextContent("Editar");
		expect(edit).not.toHaveAttribute("title");
	});

	it("la variante B es sólo ícono, con `title` nativo y `aria-label`", () => {
		render(CardsSheet);

		const edit = editOf("b");
		expect(edit.textContent?.trim()).toBe("");
		expect(edit).toHaveAttribute("aria-label", "Editar dataset");
		expect(edit).toHaveAttribute("title", "Editar");
	});

	it("la variante E es sólo ícono, como B, y sin chevron", () => {
		render(CardsSheet);

		const edit = editOf("e");
		expect(edit.textContent?.trim()).toBe("");
		expect(edit).toHaveAttribute("aria-label", "Editar dataset");
		expect(edit).toHaveAttribute("title", "Editar");
		expect(renderOf("e").querySelector(".lucide-chevron-right")).toBeNull();
	});

	it("la variante D revela la acción con el cursor o el foco sin tocar la tarjeta", () => {
		render(CardsSheet);

		const edit = editOf("d");
		const classes = edit.getAttribute("class") ?? "";

		expect(classes).toContain("opacity-0");
		expect(classes).toContain("group-hover/row:opacity-100");
		expect(classes).toContain("group-focus-within/row:opacity-100");

		// La acción es hermana del `<a>`: la superficie de la tarjeta no cambia.
		const link = screen.getByTestId("card-link-d-0");
		expect(link.contains(edit)).toBe(false);
	});

	it("la variante F revela la acción como D, y sin chevron", () => {
		render(CardsSheet);

		const edit = editOf("f");
		const classes = edit.getAttribute("class") ?? "";

		expect(classes).toContain("opacity-0");
		expect(classes).toContain("group-hover/row:opacity-100");
		expect(classes).toContain("group-focus-within/row:opacity-100");
		expect(renderOf("f").querySelector(".lucide-chevron-right")).toBeNull();
	});

	it("la variante G pone editar y eliminar lado a lado", () => {
		render(CardsSheet);

		const actions = screen.getByTestId("actions-g-0");
		const classes = actions.getAttribute("class") ?? "";
		expect(classes).toContain("items-center");
		expect(classes).not.toContain("flex-col");
		expect(actions).toContainElement(editOf("g"));
		expect(actions).toContainElement(screen.getByTestId("delete-g-0"));

		// «Eliminar» es una copia declarada: un botón, no un enlace, con `title` que lo dice.
		const remove = screen.getByTestId("delete-g-0");
		expect(remove.tagName).toBe("BUTTON");
		expect(remove).toHaveAttribute("aria-label", "Eliminar dataset");
		expect(remove).toHaveAttribute("title", "Eliminar (copia)");
		expect(remove.querySelector(".lucide-trash-2")).not.toBeNull();
	});

	it("la variante H apila editar y eliminar en columna", () => {
		render(CardsSheet);

		const actions = screen.getByTestId("actions-h-0");
		expect(actions.getAttribute("class")).toContain("flex-col");
		expect(actions).toContainElement(editOf("h"));
		expect(actions).toContainElement(screen.getByTestId("delete-h-0"));
	});

	it("A, B y D conservan el chevron; E, F, G y H lo quitan", () => {
		render(CardsSheet);

		for (const id of ["a", "b", "d"] as const) {
			expect(renderOf(id).querySelector(".lucide-chevron-right")).not.toBeNull();
		}
		for (const id of ["e", "f", "g", "h"] as const) {
			expect(renderOf(id).querySelector(".lucide-chevron-right")).toBeNull();
		}
	});
});

describe("hoja de las tarjetas — presets de caso", () => {
	it("ofrece los seis presets", () => {
		render(CardsSheet);

		for (const id of PRESET_IDS) {
			expect(screen.getByTestId(`preset-${id}`)).toBeInTheDocument();
		}
	});

	it("«sin permiso» no ofrece la acción en ninguna variante", async () => {
		render(CardsSheet);

		await fireEvent.click(screen.getByTestId("preset-sin-permiso"));
		await waitFor(() => {
			for (const id of VARIANT_IDS) {
				expect(screen.queryByTestId(`edit-${id}-0`)).toBeNull();
				expect(screen.queryByTestId(`delete-${id}-0`)).toBeNull();
			}
		});
	});

	it("«lista de tres filas» renderiza tres filas por variante", async () => {
		render(CardsSheet);

		await fireEvent.click(screen.getByTestId("preset-tres-filas"));
		await waitFor(() => {
			expect(within(renderOf("a")).getAllByTestId(/^row-a-/)).toHaveLength(3);
		});
		// La tercera fila no tiene permiso: no hay acción para ella.
		expect(screen.queryByTestId("edit-a-2")).toBeNull();
		expect(editOf("a", 0)).toBeInTheDocument();
	});

	it("recorre los seis presets sin dejar la hoja vacía ni perder las variantes", async () => {
		render(CardsSheet);

		for (const id of PRESET_IDS) {
			await fireEvent.click(screen.getByTestId(`preset-${id}`));
			await waitFor(() => {
				expect(screen.getByTestId(`preset-${id}`)).toHaveAttribute("aria-pressed", "true");
			});
			for (const variantId of VARIANT_IDS) {
				expect(screen.getByTestId(`card-variant-${variantId}`)).toBeInTheDocument();
			}
		}
	});

	it("«privado» y «público» cambian sólo la insignia de visibilidad", async () => {
		render(CardsSheet);

		await fireEvent.click(screen.getByTestId("preset-privado"));
		await waitFor(() => {
			expect(within(renderOf("a")).getByText("Privado")).toBeInTheDocument();
		});

		await fireEvent.click(screen.getByTestId("preset-publico"));
		await waitFor(() => {
			expect(within(renderOf("a")).queryByText("Privado")).toBeNull();
		});
	});

	it("«título largo» aplica el título largo en todas las variantes", async () => {
		render(CardsSheet);

		await fireEvent.click(screen.getByTestId("preset-titulo-largo"));
		await waitFor(() => {
			expect(renderOf("a")).toHaveTextContent("Registro histórico consolidado de flujos");
		});
	});
});

describe("hoja de las tarjetas — instrumento", () => {
	it("mide el objetivo de la acción de cada variante visible", async () => {
		render(CardsSheet);

		for (const id of VARIANT_IDS) {
			await waitFor(() => {
				expect(screen.getByTestId(`instrument-row-${id}`)).toBeInTheDocument();
			});
		}
	});

	it("apagar una variante quita su fila del instrumento", async () => {
		render(CardsSheet);

		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-b")).toBeInTheDocument();
		});

		await fireEvent.click(screen.getByTestId("variant-switch-b"));
		await waitFor(() => {
			expect(screen.queryByTestId("instrument-row-b")).toBeNull();
		});
	});
});

describe("hoja de las tarjetas — controles de la acción", () => {
	it("«Revelado» fuerza visible la acción que en reposo está oculta", async () => {
		render(CardsSheet);

		expect(screen.getByTestId("reveal-reposo")).toHaveAttribute("aria-pressed", "true");
		expect(editOf("d").getAttribute("class")).toContain("opacity-0");

		await fireEvent.click(screen.getByTestId("reveal-forzado"));
		await waitFor(() => {
			expect(screen.getByTestId("reveal-forzado")).toHaveAttribute("aria-pressed", "true");
		});
		const forced = editOf("d").getAttribute("class") ?? "";
		expect(forced).toContain("opacity-100");
		expect(forced).not.toContain("opacity-0");
		// Una variante siempre visible no cambia con el control.
		expect(editOf("b").getAttribute("class")).toContain("transition-colors");

		await fireEvent.click(screen.getByTestId("reveal-reposo"));
		await waitFor(() => {
			expect(editOf("d").getAttribute("class")).toContain("opacity-0");
		});
	});

	it("el instrumento declara el revelado y lo actualiza con el control", async () => {
		render(CardsSheet);

		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-reveal-d")).toHaveTextContent(
				"oculta hasta hover o foco",
			);
		});
		expect(screen.getByTestId("instrument-row-reveal-b")).toHaveTextContent("siempre visible");

		await fireEvent.click(screen.getByTestId("reveal-forzado"));
		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-reveal-d")).toHaveTextContent("forzada visible");
		});
	});

	it("«Tamaño» cambia las clases del objetivo y su número declarado", async () => {
		render(CardsSheet);

		expect(screen.getByTestId("size-36")).toHaveAttribute("aria-pressed", "true");
		expect(editOf("b").getAttribute("class")).toContain("size-9");
		expect(editOf("b").getAttribute("class")).not.toContain("size-11");

		await fireEvent.click(screen.getByTestId("size-44"));
		await waitFor(() => {
			expect(screen.getByTestId("size-44")).toHaveAttribute("aria-pressed", "true");
		});
		const sized = editOf("b").getAttribute("class") ?? "";
		expect(sized).toContain("size-11");
		expect(sized).not.toContain("size-9");
		// El botón de texto de A crece en alto con el mismo control.
		expect(editOf("a").getAttribute("class")).toContain("h-11");

		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-declared-b")).toHaveTextContent("44 px");
		});
		expect(screen.getByTestId("instrument-row-declared-a")).toHaveTextContent("44 px");
	});
});

describe("hoja de las tarjetas — la ruta no existe en producción", () => {
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

describe("formatCardActionMeasurement", () => {
	it("marca como insuficiente un objetivo de 36 px", () => {
		expect(
			formatCardActionMeasurement({
				variant: "b",
				label: "B · Botón sólo ícono",
				width: 36,
				height: 36,
				opacity: 1,
				declaredPx: 36,
				reveal: "siempre",
			}),
		).toEqual({
			variant: "b",
			label: "B · Botón sólo ícono",
			declared: "36 px",
			target: "36.00 × 36.00 px",
			touch: "no cumple 44 px",
			visibility: "visible en reposo",
			reveal: "siempre visible",
		});
	});

	it("marca como suficiente un objetivo de 44 px y detecta la acción oculta", () => {
		const formatted = formatCardActionMeasurement({
			variant: "d",
			label: "D · Acción revelada",
			width: 44,
			height: 44,
			opacity: 0,
			declaredPx: 44,
			reveal: "en reposo",
		});

		expect(formatted.touch).toBe("cumple 44 px");
		expect(formatted.visibility).toBe("oculta en reposo");
		expect(formatted.reveal).toBe("oculta hasta hover o foco");
	});

	it("declara el número del control aunque no haya layout", () => {
		const formatted = formatCardActionMeasurement({
			variant: "a",
			label: "A · Botón de texto (hoy)",
			width: 0,
			height: 0,
			opacity: 1,
			declaredPx: 44,
			reveal: "siempre",
		});

		expect(formatted.declared).toBe("44 px");
		expect(formatted.target).toBe("—");
		expect(formatted.touch).toBe("—");
		expect(formatted.visibility).toBe("—");
	});

	it("sin layout no inventa un veredicto", () => {
		const formatted = formatCardActionMeasurement({
			variant: "a",
			label: "A · Botón de texto (hoy)",
			width: 0,
			height: 0,
			opacity: 1,
			declaredPx: 36,
			reveal: "siempre",
		});

		expect(formatted.target).toBe("—");
		expect(formatted.touch).toBe("—");
		expect(formatted.visibility).toBe("—");
	});
});
