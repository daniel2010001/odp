// Tests de la hoja de revisión de la tarjeta de fila del dashboard.
//
// La propiedad que la hace útil es que las tres formas de ofrecer «Editar» queden distinguibles y
// revisables. El test fija la invariante que no puede romperse —la acción es hermana de la tarjeta,
// nunca anidada dentro del `<a>`, porque un interactivo dentro de un `<a>` es HTML inválido— y que
// el interruptor de cada variante cambie lo que se renderiza. El instrumento se prueba aparte, con
// entradas conocidas, porque en jsdom no hay layout.
//
// La variante «menú de tres puntos» no existe: el componente vendorizado `dropdown-menu` no está en
// el repo y esta hoja no vendoriza componentes nuevos.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CardsSheet from "./+page.svelte";
import { formatCardActionMeasurement } from "./measures";

const VARIANT_IDS = ["a", "b", "d"] as const;

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
	it("renderiza las tres variantes construidas y no la del menú de tres puntos", () => {
		render(CardsSheet);

		for (const id of VARIANT_IDS) {
			expect(screen.getByTestId(`card-variant-${id}`)).toBeInTheDocument();
		}
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

			expect(link.contains(edit)).toBe(false);
			expect(edit.parentElement).toBe(link.parentElement);
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
			}),
		).toEqual({
			variant: "b",
			label: "B · Botón sólo ícono",
			target: "36.00 × 36.00 px",
			touch: "no cumple 44 px",
			visibility: "visible en reposo",
		});
	});

	it("marca como suficiente un objetivo de 44 px y detecta la acción oculta", () => {
		const formatted = formatCardActionMeasurement({
			variant: "d",
			label: "D · Acción revelada",
			width: 44,
			height: 44,
			opacity: 0,
		});

		expect(formatted.touch).toBe("cumple 44 px");
		expect(formatted.visibility).toBe("oculta en reposo");
	});

	it("sin layout no inventa un veredicto", () => {
		const formatted = formatCardActionMeasurement({
			variant: "a",
			label: "A · Botón de texto (hoy)",
			width: 0,
			height: 0,
			opacity: 1,
		});

		expect(formatted.target).toBe("—");
		expect(formatted.touch).toBe("—");
		expect(formatted.visibility).toBe("—");
	});
});
