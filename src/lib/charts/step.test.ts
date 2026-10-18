// El paso de rango por defecto (L49): un número redondo —1, 2 o 5 por una potencia de diez— que da unos 10
// rangos entre el mínimo y el máximo de la columna, y `1` cuando no se puede calcular.

import { describe, expect, it } from "vitest";
import { defaultRangeStep, TARGET_RANGES } from "./step";

describe("defaultRangeStep — un paso redondo para unos 10 rangos", () => {
	it.each([
		[3000, 10000, 1000],
		[0, 1, 0.1],
		[1, 8, 1],
		[0, 100, 10],
		[0, 1000, 100],
		[0, 25, 5],
		[0, 40, 5],
		[0, 0.3, 0.05],
		[-50, 50, 10],
		[-10000, -3000, 1000],
		[0, 1_000_000, 100_000],
	])("de %s a %s: %s", (min, max, expected) => {
		expect(defaultRangeStep(min, max)).toBe(expected);
	});

	it("apunta a unos 10 rangos", () => {
		expect(TARGET_RANGES).toBe(10);
	});

	it("con el mínimo igual al máximo cae a 1", () => {
		expect(defaultRangeStep(5, 5)).toBe(1);
	});

	it.each([
		[Number.NaN, 3],
		[3, Number.NaN],
		[Number.POSITIVE_INFINITY, 3],
		[10, 3],
	])("con %s y %s, que no son un rango, cae a 1", (min, max) => {
		expect(defaultRangeStep(min, max)).toBe(1);
	});
});
