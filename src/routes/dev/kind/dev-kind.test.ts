// Tests de la hoja de revisión del chip de tipo: la propiedad que la hace útil es que muestre el
// **componente real** (`$lib/components/resource/ResourceKindChip.svelte`) para las etiquetas que el
// autor quiere comparar —incluida la de un archivo sin formato («Archivo») y la de un enlace
// («Enlace»)— y que la sección de comparación quede rotulada como lo que es: cómo se veía antes, no
// el componente real. Igual que `/dev/copy` y `/dev/error`, la hoja es permanente porque sus
// variantes no se producen a mano desde el catálogo.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`.

import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import KindSheet from "./+page.svelte";

// La anchura uniforme es la propiedad que solo tiene el componente real: si la hoja dejara de
// renderizarlo, esta clase desaparecería y el test caería.
const REAL_CHIP_WIDTH_CLASS = "w-20";

describe("hoja del chip de tipo — el componente real", () => {
	it("muestra el chip real para la etiqueta de enlace y para la de un archivo sin formato", () => {
		render(KindSheet);

		const row = screen.getByTestId("kind-real-row");

		// La etiqueta del enlace es la decisión del autor: un enlace dice «Enlace».
		const linkChip = within(row).getByText("Enlace");
		expect(linkChip).toBeTruthy();
		// Un archivo sin formato no puede quedar en blanco ni en inglés: dice «Archivo».
		expect(within(row).getByText("Archivo")).toBeTruthy();

		// El chip real usa ancho uniforme y no lleva ícono: el enlace es texto.
		expect(linkChip.className).toContain(REAL_CHIP_WIDTH_CLASS);
		expect(linkChip.querySelector("svg")).toBeNull();
	});

	it("la matriz del componente real se ve en fila y en columna", () => {
		render(KindSheet);

		const row = screen.getByTestId("kind-real-row");
		const column = screen.getByTestId("kind-real-column");

		expect(within(row).getAllByText("Enlace").length).toBeGreaterThan(0);
		expect(within(column).getAllByText("Enlace").length).toBeGreaterThan(0);
		expect(within(row).getAllByText("Archivo").length).toBeGreaterThan(0);
		expect(within(column).getAllByText("Archivo").length).toBeGreaterThan(0);
		// GEOJSON es el formato más largo del catálogo y el que motivó la anchura uniforme.
		expect(within(row).getAllByText("GEOJSON").length).toBeGreaterThan(0);
	});
});

describe("hoja del chip de tipo — la comparación no es el componente real", () => {
	it("la sección de comparación se rotula como anterior y no usa la anchura uniforme", () => {
		render(KindSheet);

		const legacy = screen.getByTestId("kind-legacy");

		// El rótulo dice, en palabras, que esa sección no es el componente real.
		expect(legacy).toHaveTextContent(/no es el componente real/i);

		// La variante vieja del enlace conserva su ícono; el chip real no lo tiene.
		expect(legacy.querySelector("svg")).toBeTruthy();

		// Y las chips viejas no tienen la anchura uniforme: por eso el cambio se puede ver.
		const legacyChips = legacy.querySelectorAll("[data-legacy-chip]");
		expect(legacyChips.length).toBeGreaterThan(0);
		for (const chip of legacyChips) {
			expect(chip.className).not.toContain(REAL_CHIP_WIDTH_CLASS);
		}
	});
});

describe("hoja del chip de tipo — la ruta no existe en producción", () => {
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
