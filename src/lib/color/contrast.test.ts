// Tests del módulo puro de contraste (`contrast.ts`).
//
// El instrumento de `/dev/error` mide los colores reales del DOM con `getComputedStyle` y necesita
// dos cosas que el navegador no le da resueltas: convertir cualquier notación CSS a sRGB y calcular
// el ratio WCAG. Este archivo fija esa matemática con valores deterministas —sin DOM—, para que el
// instrumento no dependa de un navegador para saber si un par de colores pasa AA.
//
// Los pares «calculados a mano» llevan el razonamiento en el test: si `oklch` o la linealización se
// rompen, el número mágico deja de coincidir y el test lo dice.

import { describe, expect, it } from "vitest";
import {
	compositeOver,
	contrastRatio,
	isLargeText,
	parseCssColor,
	relativeLuminance,
	requiredRatio,
} from "./contrast";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

function expectColor(
	value: string,
	expected: { r: number; g: number; b: number; a?: number },
): void {
	const parsed = parseCssColor(value);
	expect(parsed, `parseCssColor(${JSON.stringify(value)})`).not.toBeNull();
	if (!parsed) return;
	expect(parsed.r).toBeCloseTo(expected.r, 4);
	expect(parsed.g).toBeCloseTo(expected.g, 4);
	expect(parsed.b).toBeCloseTo(expected.b, 4);
	expect(parsed.a).toBeCloseTo(expected.a ?? 1, 4);
}

describe("parseCssColor — hex", () => {
	it("acepta #rgb y #rrggbb", () => {
		expectColor("#fff", { r: 255, g: 255, b: 255 });
		expectColor("#000", { r: 0, g: 0, b: 0 });
		expectColor("#0a141e", { r: 10, g: 20, b: 30 });
		expectColor("#FFFFFF", { r: 255, g: 255, b: 255 });
	});
});

describe("parseCssColor — rgb() y rgba()", () => {
	it("acepta la sintaxis con comas", () => {
		expectColor("rgb(255, 0, 0)", { r: 255, g: 0, b: 0 });
		expectColor("rgba(10, 20, 30, 0.25)", { r: 10, g: 20, b: 30, a: 0.25 });
	});

	it("acepta la sintaxis moderna con espacios y barra", () => {
		expectColor("rgb(255 0 0)", { r: 255, g: 0, b: 0 });
		expectColor("rgb(255 0 0 / 0.5)", { r: 255, g: 0, b: 0, a: 0.5 });
	});

	it("acepta porcentajes de canal y de alfa", () => {
		expectColor("rgb(100% 0% 0%)", { r: 255, g: 0, b: 0 });
		expectColor("rgba(0, 0, 0, 50%)", { r: 0, g: 0, b: 0, a: 0.5 });
	});
});

describe("parseCssColor — oklch", () => {
	it("oklch(1 0 0) es blanco puro", () => {
		expectColor("oklch(1 0 0)", { r: 255, g: 255, b: 255 });
	});

	it("oklch(0 0 0) es negro puro", () => {
		expectColor("oklch(0 0 0)", { r: 0, g: 0, b: 0 });
	});

	it("acepta L en porcentaje", () => {
		expectColor("oklch(100% 0 0)", { r: 255, g: 255, b: 255 });
	});

	it("acepta alfa numérica y en porcentaje", () => {
		const decimal = parseCssColor("oklch(0.5 0.1 200 / 0.5)");
		const percent = parseCssColor("oklch(0.5 0.1 200 / 50%)");
		expect(decimal?.a).toBeCloseTo(0.5, 4);
		expect(percent?.a).toBeCloseTo(0.5, 4);
	});

	it("acepta el matiz con todas las unidades", () => {
		const degrees = parseCssColor("oklch(0.5 0.1 200deg)");
		// 200° = 0.5555…turn = 3.4906…rad = 222.22…grad.
		for (const value of [
			"oklch(0.5 0.1 200)",
			"oklch(0.5 0.1 0.5555555556turn)",
			"oklch(0.5 0.1 3.490658504rad)",
			"oklch(0.5 0.1 222.2222222grad)",
		]) {
			const parsed = parseCssColor(value);
			expect(parsed, value).not.toBeNull();
			if (!parsed || !degrees) continue;
			expect(parsed.r).toBeCloseTo(degrees.r, 3);
			expect(parsed.g).toBeCloseTo(degrees.g, 3);
			expect(parsed.b).toBeCloseTo(degrees.b, 3);
		}
	});

	it("oklch(0.5 0 0) contra blanco da 6.00:1, calculado a mano", () => {
		// oklch con C=0 es un gris: l_ = m_ = s_ = L = 0.5 → cubos = 0.125 →
		// r = g = b lineales = 0.125 (los coeficientes del LMS suman 1). La luminancia relativa,
		// por definición, vuelve a ser exactamente 0.125. Ratio = (1.05) / (0.125 + 0.05) = 6.
		const gray = parseCssColor("oklch(0.5 0 0)");
		expect(gray).not.toBeNull();
		if (!gray) return;
		expect(relativeLuminance(gray)).toBeCloseTo(0.125, 2);
		expect(contrastRatio(gray, WHITE)).toBeCloseTo(6, 1);
	});
});

describe("parseCssColor — oklab", () => {
	it("parsea el valor exacto que Chromium emite para bg-destructive/10", () => {
		// Tailwind v4 compila `bg-destructive/10` a `color-mix(in oklab, … 10%, transparent)` y
		// Chromium lo serializa con esta cadena. Antes del arreglo el parser devolvía null, el
		// instrumento descartaba el fondo propio del pill y subía al de la card: reportaba 5.01 «ok»
		// cuando el compuesto real queda por debajo del umbral AA. Este es el test de regresión.
		const parsed = parseCssColor("oklab(0.55 0.0869333 0.0232937 / 0.1)");
		expect(parsed).not.toBeNull();
		if (!parsed) return;
		expect(parsed.a).toBeCloseTo(0.1, 4);

		// #fdfdfe es el fondo de la card; el compuesto tiene que dar #f4edee (244, 237, 238) con
		// tolerancia ±2 por canal: las matrices de Oklab→sRGB redondean.
		const composed = compositeOver(parsed, { r: 253, g: 253, b: 254, a: 1 });
		for (const [actual, expected] of [
			[composed.r, 244],
			[composed.g, 237],
			[composed.b, 238],
		] as const) {
			expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2);
		}

		// #9f5b60 es el texto coral: el compuesto queda por debajo del umbral AA (4.5).
		const ratio = contrastRatio(composed, { r: 159, g: 91, b: 96 });
		expect(ratio).toBeCloseTo(4.41, 1);
		expect(ratio).toBeLessThan(4.5);
	});

	it("oklab(1 0 0) es blanco y oklab(0 0 0) es negro", () => {
		expectColor("oklab(1 0 0)", { r: 255, g: 255, b: 255 });
		expectColor("oklab(0 0 0)", { r: 0, g: 0, b: 0 });
	});

	it("acepta L en porcentaje y alfa en porcentaje", () => {
		const white = parseCssColor("oklab(100% 0 0)");
		expect(white?.r).toBeCloseTo(255, 4);
		expect(white?.a).toBeCloseTo(1, 4);
		const half = parseCssColor("oklab(0.5 0 0 / 50%)");
		expect(half?.a).toBeCloseTo(0.5, 4);
	});
});

describe("parseCssColor — hsl() y color(srgb)", () => {
	it("acepta hsl() con espacios y con comas, y hsla() con alfa", () => {
		expectColor("hsl(0 100% 50%)", { r: 255, g: 0, b: 0 });
		expectColor("hsl(120 100% 50%)", { r: 0, g: 255, b: 0 });
		expectColor("hsl(240, 100%, 50%)", { r: 0, g: 0, b: 255 });
		expectColor("hsla(120, 50%, 50%, 0.5)", { r: 63.75, g: 191.25, b: 63.75, a: 0.5 });
	});

	it("acepta color(srgb) con canales 0..1 y con porcentaje", () => {
		expectColor("color(srgb 0.5 0 0.5)", { r: 127.5, g: 0, b: 127.5 });
		expectColor("color(srgb 100% 0% 0% / 0.25)", { r: 255, g: 0, b: 0, a: 0.25 });
	});
});

describe("parseCssColor — entradas que no entiende", () => {
	it("devuelve null sin lanzar", () => {
		for (const value of [
			"",
			"   ",
			"not-a-color",
			"oklch(abc)",
			"rgb(1,2)",
			"#12",
			"hsl(1 2 3)",
			"color-mix(in oklab, red, blue)",
			"lab(50% 40 59.5)",
		]) {
			expect(() => parseCssColor(value)).not.toThrow();
			expect(parseCssColor(value)).toBeNull();
		}
	});
});

describe("compositeOver — composición alfa estándar", () => {
	it("compone el primer plano translúcido sobre un fondo opaco", () => {
		const blackHalf = { r: 0, g: 0, b: 0, a: 0.5 };
		const composed = compositeOver(blackHalf, { ...WHITE, a: 1 });
		expect(composed).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
	});

	it("un primer plano opaco tapa el fondo", () => {
		const composed = compositeOver({ ...BLACK, a: 1 }, { ...WHITE, a: 1 });
		expect(composed).toEqual({ r: 0, g: 0, b: 0, a: 1 });
	});

	it("compone sin fondo opaco acumulando alfa por debajo de 1", () => {
		const composed = compositeOver({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 0, b: 0, a: 0.5 });
		// alfa = 0.5 + 0.5 * 0.5 = 0.75; r = (0*0.5 + 255*0.5*0.5) / 0.75 = 85
		expect(composed.r).toBeCloseTo(85, 4);
		expect(composed.a).toBeCloseTo(0.75, 4);
	});
});

describe("relativeLuminance — WCAG 2.1", () => {
	it("blanco es 1 y negro es 0", () => {
		expect(relativeLuminance(WHITE)).toBeCloseTo(1, 6);
		expect(relativeLuminance(BLACK)).toBeCloseTo(0, 6);
	});
});

describe("contrastRatio — WCAG 2.1", () => {
	it("blanco contra negro es 21:1", () => {
		expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 10);
	});

	it("un color contra sí mismo es 1:1", () => {
		expect(contrastRatio({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBeCloseTo(1, 10);
	});

	it("es simétrico", () => {
		const a = { r: 12, g: 200, b: 40 };
		const b = { r: 250, g: 10, b: 120 };
		expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 12);
	});

	it("nunca baja de 1", () => {
		expect(contrastRatio(WHITE, WHITE)).toBeGreaterThanOrEqual(1);
		expect(contrastRatio(BLACK, BLACK)).toBeGreaterThanOrEqual(1);
	});
});

describe("isLargeText / requiredRatio — AA", () => {
	it("24px o más es texto grande sin importar el peso", () => {
		expect(isLargeText(24, 400)).toBe(true);
		expect(isLargeText(32, "300")).toBe(true);
		expect(isLargeText(23.99, 400)).toBe(false);
	});

	it("18.66px es grande sólo si el peso es ≥700", () => {
		expect(isLargeText(18.66, 700)).toBe(true);
		expect(isLargeText(18.66, "700")).toBe(true);
		expect(isLargeText(18.66, 400)).toBe(false);
	});

	it("exige 3:1 para texto grande y 4.5:1 para el resto", () => {
		expect(requiredRatio(24, 400)).toBe(3);
		expect(requiredRatio(18.66, 700)).toBe(3);
		expect(requiredRatio(16, 400)).toBe(4.5);
		expect(requiredRatio(18.66, 400)).toBe(4.5);
	});
});
