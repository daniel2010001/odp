// Contrato de `previewKind` e `isTabularFormat`: qué previsualiza el portal y qué no.
//
// Las dos reglas que estos tests protegen son las que la plataforma ya decidió, no ocurrencias
// nuestras. `previewKind` consume `resources/kind.ts` para la pregunta archivo/enlace (una sola
// regla, no dos) y pone `datastore_active` **antes** del formato para la tabla: medido el
// 2026-09-23, el DataPusher carga `csv, xls, xlsx, tsv, ods` por defecto, así que un XLSX puede
// tener una tabla y el viejo filtro `format === "csv"` era un falso negativo. Por eso cada regla se
// prueba en las dos direcciones: el acierto y el casi-acierto que no debe coincidir.

import { describe, expect, it } from "vitest";
import type { CkanResource } from "$lib/types/ckan";
import { isTabularFormat, previewKind } from "./preview";

type PreviewInput = Pick<CkanResource, "url_type" | "format" | "datastore_active">;

/** Un recurso alojado por defecto: los casos de enlace pisan `url_type` a `undefined`. */
function makeResource(overrides: PreviewInput = {}): PreviewInput {
	return { url_type: "upload", ...overrides };
}

describe("previewKind — la regla del enlace va primero", () => {
	it('un enlace con `format: "PDF"` no se previsualiza: no se incrusta una URL externa', () => {
		expect(previewKind(makeResource({ url_type: undefined, format: "PDF" }))).toBe("none");
	});

	it("un enlace no se vuelve tabla aunque `datastore_active` sea `true`", () => {
		// El orden es la regla: la decisión del enlace (C2) gana sobre el marcador de la tabla.
		expect(
			previewKind(makeResource({ url_type: undefined, format: "CSV", datastore_active: true })),
		).toBe("none");
	});

	it('un enlace con `format: "PNG"` tampoco se vuelve imagen', () => {
		expect(previewKind(makeResource({ url_type: undefined, format: "PNG" }))).toBe("none");
	});
});

describe("previewKind — la tabla la decide el dato, no el formato", () => {
	it('`datastore_active: true` con `format: "XLSX"` es una tabla', () => {
		expect(previewKind(makeResource({ format: "XLSX", datastore_active: true }))).toBe("table");
	});

	it("`datastore_active: true` gana incluso con un formato sin vista previa (`ZIP`)", () => {
		expect(previewKind(makeResource({ format: "ZIP", datastore_active: true }))).toBe("table");
	});

	it("`datastore_active: true` sin `format` sigue siendo una tabla", () => {
		expect(previewKind(makeResource({ datastore_active: true }))).toBe("table");
	});

	it('`format: "CSV"` sin tabla es «none»: no se vuelca el CSV crudo como texto', () => {
		expect(previewKind(makeResource({ format: "CSV", datastore_active: false }))).toBe("none");
	});

	it('`format: "CSV"` con `datastore_active` ausente también es «none»', () => {
		expect(previewKind(makeResource({ format: "CSV", datastore_active: undefined }))).toBe("none");
	});
});

describe("previewKind — el tipo lo decide el formato (normalizado)", () => {
	it('`format: "PDF"` es «pdf»', () => {
		expect(previewKind(makeResource({ format: "PDF" }))).toBe("pdf");
	});

	it("un formato sin vista previa conocido (`ZIP`) es «none»", () => {
		expect(previewKind(makeResource({ format: "ZIP" }))).toBe("none");
	});

	it.each([
		"png",
		"jpg",
		"jpeg",
		"gif",
		"webp",
		"svg",
		"avif",
		"bmp",
	])("`format: %s` es «image»", (fmt) => {
		expect(previewKind(makeResource({ format: fmt }))).toBe("image");
	});

	it('`format: "SVG"` en mayúsculas es «image»', () => {
		expect(previewKind(makeResource({ format: "SVG" }))).toBe("image");
	});

	it('`format: " Png "` (espacios y mayúsculas) es «image»', () => {
		expect(previewKind(makeResource({ format: " Png " }))).toBe("image");
	});

	it.each(["txt", "json", "geojson"])("`format: %s` es «text»", (fmt) => {
		expect(previewKind(makeResource({ format: fmt }))).toBe("text");
	});

	it('`format: "JSON"` en mayúsculas es «text»', () => {
		expect(previewKind(makeResource({ format: "JSON" }))).toBe("text");
	});

	it("un recurso sin `format` es «none»", () => {
		expect(previewKind(makeResource())).toBe("none");
	});
});

describe("isTabularFormat — los formatos que el DataPusher intentaría cargar", () => {
	it.each(["csv", "xls", "xlsx", "tsv", "ods"])("`format: %s` es tabular", (fmt) => {
		expect(isTabularFormat({ format: fmt })).toBe(true);
	});

	it('`format: "CSV"` en mayúsculas es tabular (normalizado)', () => {
		expect(isTabularFormat({ format: "CSV" })).toBe(true);
	});

	it('`format: " XLSX "` (espacios) es tabular', () => {
		expect(isTabularFormat({ format: " XLSX " })).toBe(true);
	});

	it('`format: "PDF"` no es tabular', () => {
		expect(isTabularFormat({ format: "PDF" })).toBe(false);
	});

	it("sin `format` pero con `mimetype: application/vnd.ms-excel` es tabular", () => {
		expect(isTabularFormat({ mimetype: "application/vnd.ms-excel" })).toBe(true);
	});

	it.each([
		"application/csv",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.oasis.opendocument.spreadsheet",
	])("`mimetype: %s` es tabular", (mimetype) => {
		expect(isTabularFormat({ mimetype })).toBe(true);
	});

	it("un `mimetype` no tabular con un `format` no tabular es falso", () => {
		expect(isTabularFormat({ format: "PDF", mimetype: "application/pdf" })).toBe(false);
	});

	it("un recurso sin `format` ni `mimetype` es falso", () => {
		expect(isTabularFormat({})).toBe(false);
	});
});
