// El contraste de un color de gráfico contra el fondo (WCAG 1.4.11: ≥ 3:1 para objetos gráficos).
//
// Los tokens del portal son `oklch`, y el criterio de WCAG se define sobre luminancia relativa en sRGB, así
// que el cálculo pasa por oklch → sRGB lineal → luminancia. Las referencias son valores conocidos, no los que
// salen de la propia función.

import { describe, expect, it } from "vitest";
import { contrastRatio, parseOklch, relativeLuminance } from "./contrast";

describe("parseOklch", () => {
	it("lee un token oklch con luminosidad decimal, croma y matiz", () => {
		expect(parseOklch("oklch(0.62 0.08 257)")).toEqual({ l: 0.62, c: 0.08, h: 257 });
	});

	it("acepta porcentajes y espacios alrededor", () => {
		expect(parseOklch("  oklch(62% 0.08 257)  ")).toEqual({ l: 0.62, c: 0.08, h: 257 });
	});

	it("rechaza lo que no es oklch", () => {
		expect(() => parseOklch("#ffffff")).toThrow();
	});
});

describe("relativeLuminance", () => {
	it("el negro es 0 y el blanco es 1", () => {
		expect(relativeLuminance(parseOklch("oklch(0 0 0)"))).toBeCloseTo(0, 4);
		expect(relativeLuminance(parseOklch("oklch(1 0 0)"))).toBeCloseTo(1, 3);
	});

	it("el gris medio sRGB (#777777 ≈ oklch 0.5693) ronda 0.184", () => {
		expect(relativeLuminance(parseOklch("oklch(0.5693 0 0)"))).toBeCloseTo(0.184, 2);
	});
});

describe("contrastRatio", () => {
	it("negro sobre blanco es 21:1, en cualquier orden", () => {
		expect(contrastRatio(parseOklch("oklch(0 0 0)"), parseOklch("oklch(1 0 0)"))).toBeCloseTo(
			21,
			1,
		);
		expect(contrastRatio(parseOklch("oklch(1 0 0)"), parseOklch("oklch(0 0 0)"))).toBeCloseTo(
			21,
			1,
		);
	});

	it("un color contra sí mismo es 1:1", () => {
		const color = parseOklch("oklch(0.62 0.08 257)");
		expect(contrastRatio(color, color)).toBeCloseTo(1, 5);
	});

	it("#777777 sobre blanco ronda 4.48:1 (referencia WCAG conocida)", () => {
		expect(contrastRatio(parseOklch("oklch(0.5693 0 0)"), parseOklch("oklch(1 0 0)"))).toBeCloseTo(
			4.48,
			1,
		);
	});
});
