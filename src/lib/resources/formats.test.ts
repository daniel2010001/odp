import { describe, expect, it } from "vitest";
import type { CkanResource } from "$lib/types/ckan";
import { formatChips, normalizeFormats } from "./formats";

type Chipable = Pick<CkanResource, "format" | "url_type">;

/**
 * Fixture mínimo: `formatChips` sólo lee `format` y `url_type`, así que el resto del recurso no
 * participa de la decisión. Se construye con el tipo real para que un cambio de forma en CKAN rompa
 * acá y no en silencio. Son archivos subidos (`url_type: "upload"`): sólo un archivo conserva su
 * formato en el chip.
 */
function withFormats(...formats: (string | undefined)[]): Chipable[] {
	return formats.map((format) => ({ format, url_type: "upload" }));
}

/** Un enlace: la ausencia de `url_type` es la forma en que CKAN guarda una URL externa. */
function link(format?: string): Chipable {
	return { format };
}

function upload(format?: string): Chipable {
	return { format, url_type: "upload" };
}

describe("normalizeFormats", () => {
	it("recorta, pasa a mayúsculas y deduplica conservando el orden de aparición", () => {
		expect(normalizeFormats(withFormats(" pdf ", "CSV", "PDF"))).toEqual(["PDF", "CSV"]);
	});

	it("descarta los formatos en blanco y los ausentes", () => {
		expect(normalizeFormats(withFormats(" ", undefined, "csv"))).toEqual(["CSV"]);
	});

	it("no aplica el tope de chips: devuelve todos los formatos distintos", () => {
		expect(normalizeFormats(withFormats("CSV", "PDF", "JSON", "XLSX", "XML", "GEOJSON"))).toEqual([
			"CSV",
			"PDF",
			"JSON",
			"XLSX",
			"XML",
			"GEOJSON",
		]);
	});

	it("una lista ausente o vacía da una lista vacía", () => {
		expect(normalizeFormats(undefined)).toEqual([]);
		expect(normalizeFormats([])).toEqual([]);
	});
});

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

describe("formatChips — un enlace aporta «Enlace», no su formato (2026-09-22)", () => {
	it("un enlace CSV y un PDF subido dan «Enlace» y «PDF»", () => {
		expect(formatChips([link("CSV"), upload("PDF")])).toEqual({
			chips: ["Enlace", "PDF"],
			more: 0,
		});
	});

	it("si todos los recursos son enlaces, el único chip es «Enlace»", () => {
		expect(formatChips([link("CSV"), link("JSON"), link("pdf")])).toEqual({
			chips: ["Enlace"],
			more: 0,
		});
	});

	it("un enlace sin formato también es «Enlace»: lo decide el tipo, no el formato", () => {
		expect(formatChips([link(), link(" ")])).toEqual({ chips: ["Enlace"], more: 0 });
	});

	it("la posición del chip es la de la primera aparición del recurso", () => {
		expect(formatChips([upload("PDF"), link("CSV"), upload("CSV")])).toEqual({
			chips: ["PDF", "Enlace", "CSV"],
			more: 0,
		});
	});

	it("un `url_type` vacío (subida que se limpió) es un enlace, como en `resourceKind`", () => {
		expect(formatChips([{ format: "CSV", url_type: "" }])).toEqual({
			chips: ["Enlace"],
			more: 0,
		});
	});

	it("«Enlace» cuenta como un chip más para el tope y para `more`", () => {
		expect(
			formatChips([link("CSV"), upload("PDF"), upload("JSON"), upload("XLSX"), upload("XML")]),
		).toEqual({ chips: ["Enlace", "PDF", "JSON", "XLSX"], more: 1 });
	});

	it("normalizeFormats lista «Enlace» una sola vez, para el tooltip de lo oculto", () => {
		expect(normalizeFormats([link("CSV"), upload("PDF"), link("JSON")])).toEqual(["Enlace", "PDF"]);
	});
});
