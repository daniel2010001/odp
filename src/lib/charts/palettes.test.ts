// Las paletas candidatas del gráfico: lo que se promete a quien las compara en el playground.

import { describe, expect, it } from "vitest";
import { GRAPHICAL_OBJECT_MIN_CONTRAST } from "./contrast";
import { findPalette, PALETTES, paletteContrast, paletteStyle } from "./palettes";

describe("paletas candidatas", () => {
	it("son tres, con cinco colores en cada modo", () => {
		expect(PALETTES.map((palette) => palette.id)).toEqual(["current", "vivid", "brand"]);
		for (const palette of PALETTES) {
			expect(palette.light).toHaveLength(5);
			expect(palette.dark).toHaveLength(5);
		}
	});

	it("las dos propuestas pasan 3:1 contra el fondo, en claro y en oscuro", () => {
		for (const id of ["vivid", "brand"] as const) {
			for (const mode of ["light", "dark"] as const) {
				for (const ratio of paletteContrast(findPalette(id), mode)) {
					expect(ratio).toBeGreaterThanOrEqual(GRAPHICAL_OBJECT_MIN_CONTRAST);
				}
			}
		}
	});

	it("la actual se mide tal cual: en claro hay colores bajo 3:1", () => {
		expect(paletteContrast(findPalette("current"), "light").some((ratio) => ratio < 3)).toBe(true);
	});

	it("«De la marca» abre con azul y coral", () => {
		const [first, second] = findPalette("brand").light;
		expect(first).toContain(" 257)");
		expect(second).toContain(" 25)");
	});

	it("un id desconocido cae en la actual", () => {
		expect(findPalette("otra").id).toBe("current");
		expect(findPalette(null).id).toBe("current");
	});

	it("el estilo en línea lleva las diez variables", () => {
		expect(paletteStyle(findPalette("vivid")).match(/--palette-/g)).toHaveLength(10);
	});
});
