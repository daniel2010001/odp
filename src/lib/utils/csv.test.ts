import { describe, expect, it } from "vitest";
import { getNumericStats, parseCsv } from "./csv";

const CSV = [
	"id,nombre,fecha,activo,altura,comentario",
	"1,Manzana,2024-01-01,true,10,",
	"2,Pera,2024-02-02,false,20,",
	"3,Uva,2024-03-03,true,30,",
].join("\n");

describe("parseCsv", () => {
	it("detecta headers correctos", () => {
		const result = parseCsv(CSV);

		expect(result.headers).toEqual(["id", "nombre", "fecha", "activo", "altura", "comentario"]);
	});

	it("devuelve totalRows correcto", () => {
		const result = parseCsv(CSV);

		expect(result.totalRows).toBe(3);
	});

	it("limita el preview a las primeras N filas", () => {
		const result = parseCsv(CSV, 2);

		expect(result.preview).toHaveLength(2);
		expect(result.preview[0]).toMatchObject({ id: "1", nombre: "Manzana" });
	});

	it("detecta tipos de columna (número, texto, fecha, booleano, vacío)", () => {
		const result = parseCsv(CSV);

		expect(result.types).toEqual({
			id: "number",
			nombre: "text",
			fecha: "date",
			activo: "boolean",
			altura: "number",
			comentario: "empty",
		});
	});
});

describe("getNumericStats", () => {
	it("calcula min/max/mean/median/count", () => {
		const stats = getNumericStats([2, 4, 6, 8, 10]);

		expect(stats).toEqual({ min: 2, max: 10, mean: 6, median: 6, count: 5 });
	});

	it("ignora valores NaN", () => {
		const stats = getNumericStats([1, 2, Number.NaN, 3]);

		expect(stats).toEqual({ min: 1, max: 3, mean: 2, median: 2, count: 3 });
	});

	it("devuelve null para lista vacía", () => {
		expect(getNumericStats([])).toBeNull();
	});

	it("devuelve null cuando no hay números", () => {
		expect(getNumericStats([Number.NaN, Number.NaN])).toBeNull();
	});
});
