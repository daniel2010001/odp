import { describe, expect, it } from "vitest";
import type { DatastoreField } from "$lib/api/datastore";
import { eligibleXColumns, isNumericType, numericColumns, parseNumber } from "./columns";

const f = (id: string, type: string): DatastoreField => ({ id, type });

describe("parseNumber", () => {
	it("acepta números y cadenas numéricas decimales", () => {
		expect(parseNumber(12)).toBe(12);
		expect(parseNumber("184320")).toBe(184320);
		expect(parseNumber(" -3.5 ")).toBe(-3.5);
		expect(parseNumber("1e3")).toBe(1000);
	});

	it("devuelve null para vacíos, texto y no finitos", () => {
		for (const v of [
			null,
			undefined,
			"",
			"  ",
			"n/d",
			"12 km",
			"1,5",
			Number.NaN,
			Infinity,
			true,
			{},
		]) {
			expect(parseNumber(v)).toBeNull();
		}
	});
});

describe("numericColumns", () => {
	it("incluye las columnas de tipo numérico declarado, aunque no haya filas", () => {
		const fields = [f("_id", "int"), f("anio", "int4"), f("monto", "numeric"), f("tasa", "float8")];
		expect(numericColumns(fields, [])).toEqual(["anio", "monto", "tasa"]);
	});

	it("excluye _id aunque sea entero", () => {
		expect(numericColumns([f("_id", "int")], [{ _id: 1 }])).toEqual([]);
	});

	it("una columna text es numérica si todos sus valores no vacíos se leen como número", () => {
		const fields = [f("municipio", "text"), f("vehiculos", "text")];
		const records = [
			{ municipio: "Sacaba", vehiculos: "38950" },
			{ municipio: "Quillacollo", vehiculos: "" },
			{ municipio: "Tiquipaya", vehiculos: "12000.5" },
		];
		expect(numericColumns(fields, records)).toEqual(["vehiculos"]);
	});

	it("una columna text con un valor no numérico no es elegible", () => {
		const fields = [f("v", "text")];
		expect(numericColumns(fields, [{ v: "1" }, { v: "n/d" }])).toEqual([]);
	});

	it("una columna text totalmente vacía no es elegible", () => {
		expect(numericColumns([f("v", "text")], [{ v: "" }, { v: null }])).toEqual([]);
	});

	it("excluye timestamp y bool", () => {
		expect(
			numericColumns([f("t", "timestamp"), f("b", "bool")], [{ t: "2024-01-01", b: true }]),
		).toEqual([]);
	});
});

describe("eligibleXColumns", () => {
	it("ofrece todas las columnas salvo _id, en el orden del recurso", () => {
		expect(eligibleXColumns([f("_id", "int"), f("a", "text"), f("b", "int4")])).toEqual(["a", "b"]);
	});
});

describe("isNumericType", () => {
	it("distingue los tipos numéricos declarados de text, timestamp y bool", () => {
		expect(isNumericType("numeric")).toBe(true);
		expect(isNumericType("int4")).toBe(true);
		expect(isNumericType("float8")).toBe(true);
		for (const t of ["text", "timestamp", "bool", "json"]) expect(isNumericType(t)).toBe(false);
	});
});
