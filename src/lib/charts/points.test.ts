import { describe, expect, it } from "vitest";
import { buildPoints, hasRepeatedX, MISSING_X_LABEL } from "./points";

const rows = [
	{ m: "Cochabamba", v: "10" },
	{ m: "Sacaba", v: "5" },
	{ m: "Cochabamba", v: "2.5" },
];

describe("buildPoints", () => {
	it("sin agregar, un punto por fila y en el orden de las filas", () => {
		const r = buildPoints(rows, { x: "m", y: "v", type: "bar", aggregate: "none" });
		expect(r.points).toEqual([
			{ label: "Cochabamba", value: 10 },
			{ label: "Sacaba", value: 5 },
			{ label: "Cochabamba", value: 2.5 },
		]);
		expect(r.skipped).toBe(0);
	});

	it("sumando, agrupa por X conservando el orden de primera aparición", () => {
		const r = buildPoints(rows, { x: "m", y: "v", type: "bar", aggregate: "sum" });
		expect(r.points).toEqual([
			{ label: "Cochabamba", value: 12.5 },
			{ label: "Sacaba", value: 5 },
		]);
	});

	it("omite las filas con Y vacío o no numérico y las cuenta", () => {
		const r = buildPoints(
			[
				{ m: "a", v: "" },
				{ m: "b", v: "x" },
				{ m: "c", v: null },
				{ m: "d", v: 4 },
			],
			{ x: "m", y: "v", type: "line", aggregate: "none" },
		);
		expect(r.points).toEqual([{ label: "d", value: 4 }]);
		expect(r.skipped).toBe(3);
	});

	it("un X vacío se rotula con el texto de ausencia", () => {
		const r = buildPoints(
			[
				{ m: "", v: 1 },
				{ m: null, v: 2 },
			],
			{ x: "m", y: "v", type: "bar", aggregate: "sum" },
		);
		expect(r.points).toEqual([{ label: MISSING_X_LABEL, value: 3 }]);
	});

	it("el pastel descarta valores no positivos y los cuenta como omitidos", () => {
		const r = buildPoints(
			[
				{ m: "a", v: 3 },
				{ m: "b", v: 0 },
				{ m: "c", v: -1 },
			],
			{
				x: "m",
				y: "v",
				type: "pie",
				aggregate: "sum",
			},
		);
		expect(r.points).toEqual([{ label: "a", value: 3 }]);
		expect(r.skipped).toBe(2);
	});

	it("agregar no aplica a líneas: se grafican las filas tal cual", () => {
		const r = buildPoints(rows, { x: "m", y: "v", type: "line", aggregate: "sum" });
		expect(r.points).toHaveLength(3);
	});

	it("sin filas devuelve listas vacías", () => {
		expect(buildPoints([], { x: "m", y: "v", type: "bar", aggregate: "none" })).toEqual({
			points: [],
			skipped: 0,
		});
	});
});

describe("hasRepeatedX", () => {
	it("detecta valores de X repetidos", () => {
		expect(hasRepeatedX(rows, "m")).toBe(true);
		expect(hasRepeatedX(rows.slice(0, 2), "m")).toBe(false);
		expect(hasRepeatedX([], "m")).toBe(false);
	});
});
