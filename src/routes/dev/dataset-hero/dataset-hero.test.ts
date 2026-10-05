// Tests de la hoja de revisión del hero del dataset.
//
// La propiedad que la hace útil es que las tres colocaciones del botón «Copiar enlace» sean
// distinguibles y revisables: junto al título (hoy), en el grupo de acciones y en la fila de
// insignias. El test fija la estructura —no la apariencia—: que el interruptor de cada variante
// cambie lo que se renderiza, que el botón de copiar caiga en la fila que la variante declara, y
// que el permiso siga gobernando la acción «Editar». El instrumento se prueba aparte, con entradas
// conocidas, porque en jsdom no hay layout.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import HeroSheet from "./+page.svelte";
import { formatHeroMeasurement } from "./measures";

const VARIANT_IDS = ["a", "b", "c"] as const;

const PRESET_IDS = [
	"puede-editar",
	"no-puede-editar",
	"permiso-fallo",
	"titulo-largo",
	"privado",
	"publico",
] as const;

function renderOf(variantId: string): HTMLElement {
	return screen.getByTestId(`hero-render-${variantId}`);
}

describe("hoja del hero — cobertura de variantes", () => {
	it("renderiza las tres variantes, y ninguna de más", () => {
		render(HeroSheet);

		for (const id of VARIANT_IDS) {
			expect(screen.getByTestId(`hero-variant-${id}`)).toBeInTheDocument();
		}
		expect(screen.queryByTestId("hero-variant-d")).toBeNull();
	});

	it("el interruptor de cada variante cambia lo que se renderiza", async () => {
		render(HeroSheet);

		for (const id of VARIANT_IDS) {
			const toggle = screen.getByTestId(`variant-switch-${id}`);
			expect(toggle).toHaveAttribute("aria-checked", "true");

			await fireEvent.click(toggle);
			await waitFor(() => {
				expect(screen.queryByTestId(`hero-variant-${id}`)).toBeNull();
			});
			expect(toggle).toHaveAttribute("aria-checked", "false");

			await fireEvent.click(toggle);
			await waitFor(() => {
				expect(screen.getByTestId(`hero-variant-${id}`)).toBeInTheDocument();
			});
		}
	});

	it("cada variante coloca el botón de copiar en el lugar que declara", () => {
		render(HeroSheet);

		// A · la fila única de hoy: copiar, título y «Editar» comparten fila.
		expect(within(renderOf("a")).getByTestId("hero-row-a")).toContainElement(
			within(renderOf("a")).getByTestId("hero-copy-a"),
		);
		expect(within(renderOf("a")).getByTestId("hero-row-a")).toContainElement(
			within(renderOf("a")).getByTestId("hero-title-a"),
		);

		// B · copiar sube al grupo de acciones de la derecha.
		expect(within(renderOf("b")).getByTestId("hero-actions-b")).toContainElement(
			within(renderOf("b")).getByTestId("hero-copy-b"),
		);
		expect(
			within(renderOf("b"))
				.getByTestId("hero-badges-b")
				.querySelector('[data-testid="hero-copy-b"]'),
		).toBeNull();

		// C · copiar baja a la fila de insignias.
		expect(within(renderOf("c")).getByTestId("hero-badges-c")).toContainElement(
			within(renderOf("c")).getByTestId("hero-copy-c"),
		);
		expect(
			within(renderOf("c"))
				.getByTestId("hero-badges-c")
				.querySelector('[data-testid="hero-title-c"]'),
		).toBeNull();
	});
});

describe("hoja del hero — presets de caso", () => {
	it("ofrece los seis presets", () => {
		render(HeroSheet);

		for (const id of PRESET_IDS) {
			expect(screen.getByTestId(`preset-${id}`)).toBeInTheDocument();
		}
	});

	it("«puede editar» muestra «Editar» en cada variante visible", () => {
		render(HeroSheet);

		expect(screen.getAllByRole("link", { name: "Editar" })).toHaveLength(VARIANT_IDS.length);
	});

	it("«no puede editar» no muestra ninguna acción", async () => {
		render(HeroSheet);

		await fireEvent.click(screen.getByTestId("preset-no-puede-editar"));
		await waitFor(() => {
			expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
		});
		expect(screen.queryAllByRole("status")).toHaveLength(0);
	});

	it("«falló la verificación» no ofrece acción y explica que no pudo verificarse", async () => {
		render(HeroSheet);

		await fireEvent.click(screen.getByTestId("preset-permiso-fallo"));
		await waitFor(() => {
			expect(screen.queryAllByRole("link", { name: "Editar" })).toHaveLength(0);
		});

		const notes = screen.getAllByRole("status");
		expect(notes).toHaveLength(VARIANT_IDS.length);
		for (const note of notes) {
			expect(note).toHaveTextContent("No se pudo verificar si puede editar este dataset.");
		}
	});

	it("«título muy largo» aplica el título largo en todas las variantes", async () => {
		render(HeroSheet);

		await fireEvent.click(screen.getByTestId("preset-titulo-largo"));
		await waitFor(() => {
			expect(renderOf("a")).toHaveTextContent("Registro histórico consolidado de flujos");
		});
	});

	it("recorre los seis presets sin dejar la hoja vacía ni perder las variantes", async () => {
		render(HeroSheet);

		for (const id of PRESET_IDS) {
			await fireEvent.click(screen.getByTestId(`preset-${id}`));
			await waitFor(() => {
				expect(screen.getByTestId(`preset-${id}`)).toHaveAttribute("aria-pressed", "true");
			});
			for (const variantId of VARIANT_IDS) {
				expect(screen.getByTestId(`hero-variant-${variantId}`)).toBeInTheDocument();
			}
		}
	});

	it("«privado» y «público» cambian sólo la insignia de visibilidad", async () => {
		render(HeroSheet);

		expect(renderOf("a")).toHaveTextContent("Público");

		await fireEvent.click(screen.getByTestId("preset-privado"));
		await waitFor(() => {
			expect(renderOf("a")).toHaveTextContent("Privado");
		});
		expect(renderOf("a")).not.toHaveTextContent("Público");
	});
});

describe("hoja del hero — instrumento", () => {
	it("mide la separación título ↔ copiar de cada variante visible", async () => {
		render(HeroSheet);

		for (const id of VARIANT_IDS) {
			await waitFor(() => {
				expect(screen.getByTestId(`instrument-row-${id}`)).toBeInTheDocument();
			});
		}
	});

	it("apagar una variante quita su fila del instrumento", async () => {
		render(HeroSheet);

		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-a")).toBeInTheDocument();
		});

		await fireEvent.click(screen.getByTestId("variant-switch-a"));
		await waitFor(() => {
			expect(screen.queryByTestId("instrument-row-a")).toBeNull();
		});
	});
});

describe("hoja del hero — la ruta no existe en producción", () => {
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

describe("formatHeroMeasurement", () => {
	it("imprime la caja del título y la separación con dos decimales", () => {
		expect(
			formatHeroMeasurement({
				variant: "a",
				label: "A · Copiar junto al título (hoy)",
				titleWidth: 512,
				titleHeight: 72.5,
				gapX: 12,
				gapY: 0,
			}),
		).toEqual({
			variant: "a",
			label: "A · Copiar junto al título (hoy)",
			title: "512.00 × 72.50 px",
			gapX: "12.00 px",
			gapY: "0.00 px",
			sameRow: "sí",
		});
	});

	it("marca «no» cuando el botón de copiar no comparte fila con el título", () => {
		const formatted = formatHeroMeasurement({
			variant: "c",
			label: "C · Copiar en la fila de insignias",
			titleWidth: 480,
			titleHeight: 96,
			gapX: 0,
			gapY: 16,
		});

		expect(formatted.sameRow).toBe("no");
		expect(formatted.gapY).toBe("16.00 px");
	});
});
