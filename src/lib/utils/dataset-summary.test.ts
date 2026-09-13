import { describe, expect, it } from "vitest";
import { MAX_SUMMARY_LENGTH } from "$lib/schemas/dataset";
import { datasetSummary, SUMMARY_EXTRA_KEY } from "./dataset-summary";

describe("datasetSummary — texto de las cards (RF-40)", () => {
	it("usa el resumen editorial cuando existe", () => {
		expect(
			datasetSummary({
				extras: [{ key: SUMMARY_EXTRA_KEY, value: "  Resumen editorial  " }],
				notes: "Una descripción larga que no debería usarse.",
			}),
		).toBe("Resumen editorial");
	});

	it("cae al extracto de la descripción si no hay resumen", () => {
		expect(datasetSummary({ notes: "# Título\n\n**Matrícula** por facultad." })).toBe(
			"Título Matrícula por facultad.",
		);
	});

	it("ignora un resumen vacío y usa la descripción", () => {
		expect(
			datasetSummary({ extras: [{ key: SUMMARY_EXTRA_KEY, value: "   " }], notes: "Descripción" }),
		).toBe("Descripción");
	});

	it("ignora otros extras", () => {
		expect(
			datasetSummary({ extras: [{ key: "otra-clave", value: "x" }], notes: "Descripción" }),
		).toBe("Descripción");
	});

	it("acota el extracto de la descripción al tope del resumen", () => {
		const largo = "palabra ".repeat(100);
		expect(datasetSummary({ notes: largo }).length).toBeLessThanOrEqual(MAX_SUMMARY_LENGTH);
	});

	it("devuelve cadena vacía si no hay ni resumen ni descripción", () => {
		expect(datasetSummary({})).toBe("");
		expect(datasetSummary({ notes: "   " })).toBe("");
	});
});
