import { describe, expect, it } from "vitest";
import type { CkanResource } from "$lib/types/ckan";
import { formatChips } from "./formats";

/**
 * Fixture mínimo: `formatChips` sólo lee `format`, así que el resto del recurso no participa de la
 * decisión. Se construye con el tipo real (`Pick<CkanResource, "format">`) para que un cambio de
 * forma en CKAN rompa acá y no en silencio.
 */
function withFormats(...formats: (string | undefined)[]): Pick<CkanResource, "format">[] {
	return formats.map((format) => ({ format }));
}

describe("formatChips", () => {
	it("deduplica los formatos repetidos, conservando el orden de primera aparición", () => {
		expect(formatChips(withFormats("PDF", "CSV", "PDF", "CSV"))).toEqual({
			chips: ["PDF", "CSV"],
			more: 0,
		});
	});

	it("deduplica sin distinguir mayúsculas y minúsculas", () => {
		expect(formatChips(withFormats("csv", "CSV", "Csv"))).toEqual({ chips: ["CSV"], more: 0 });
	});

	it("no cuenta como oculto un formato que sólo estaba repetido", () => {
		// El defecto medido: 5 recursos, un solo formato. `more` debe ser 0, no 1.
		expect(formatChips(withFormats("CSV", "CSV", "CSV", "CSV", "CSV"))).toEqual({
			chips: ["CSV"],
			more: 0,
		});
	});

	it("reconta los ocultos sobre formatos únicos, no sobre recursos", () => {
		// 7 recursos, 4 formatos únicos: no hay nada oculto, así que no debe aparecer «+N más».
		expect(formatChips(withFormats("CSV", "CSV", "PDF", "PDF", "JSON", "CSV", "XLSX"))).toEqual({
			chips: ["CSV", "PDF", "JSON", "XLSX"],
			more: 0,
		});
	});

	it("aplica el tope de 4 a los formatos únicos y cuenta el resto", () => {
		expect(formatChips(withFormats("CSV", "PDF", "JSON", "XLSX", "XML", "GEOJSON"))).toEqual({
			chips: ["CSV", "PDF", "JSON", "XLSX"],
			more: 2,
		});
	});

	it("cuenta los ocultos aunque haya repetidos entre los únicos", () => {
		// 6 recursos, 5 formatos únicos (CSV está repetido): se muestran 4 y queda 1 oculto.
		expect(formatChips(withFormats("CSV", "CSV", "PDF", "JSON", "XLSX", "XML"))).toEqual({
			chips: ["CSV", "PDF", "JSON", "XLSX"],
			more: 1,
		});
	});

	it("descarta los formatos en blanco en vez de pintar un chip vacío", () => {
		expect(formatChips(withFormats(" ", "", "   ", "csv"))).toEqual({ chips: ["CSV"], more: 0 });
	});

	it("recorta el valor antes de decidir, para que el chip no muestre espacios", () => {
		expect(formatChips(withFormats(" csv ", "pdf"))).toEqual({ chips: ["CSV", "PDF"], more: 0 });
	});

	it("un recurso ausente o una lista vacía dan un resumen vacío", () => {
		expect(formatChips(undefined)).toEqual({ chips: [], more: 0 });
		expect(formatChips([])).toEqual({ chips: [], more: 0 });
	});

	it("un recurso sin formato no aporta chip ni cuenta como oculto", () => {
		expect(formatChips(withFormats(undefined, "CSV"))).toEqual({ chips: ["CSV"], more: 0 });
	});
});
