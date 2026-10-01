// Contrato de `resourceKind`: qué recurso es un archivo alojado y cuál es una referencia externa.
//
// La regla es la de CKAN (`url_type === "upload"`), no un marcador propio del portal: un marcador
// sólo cubriría los recursos creados después de que se implementara y dejaría dos fuentes de verdad
// para un mismo hecho. Estos tests fijan las dos formas de «no es un archivo alojado» —la cadena
// vacía de una subida limpiada y el campo ausente de un `resource_create` con URL— y, sobre todo,
// que un `format` y un `size` no puedan promover un enlace a archivo: el catálogo sembrado miente
// exactamente así.

import { describe, expect, it } from "vitest";
import type { CkanResource } from "$lib/types/ckan";
import { resourceKind } from "./kind";

/** Un recurso cualquiera: sólo importa `url_type`; el resto de los campos existe para tipar. */
function makeResource(overrides: Partial<CkanResource> = {}): CkanResource {
	return {
		id: "res-1",
		package_id: "pkg-1",
		name: "Recurso de prueba",
		url: "https://data.umss.edu.bo/dataset/x/resource/res-1",
		resource_type: "file",
		created: "2026-01-01T00:00:00Z",
		last_modified: "2026-01-01T00:00:00Z",
		state: "active",
		position: 0,
		...overrides,
	};
}

describe("resourceKind — archivo alojado o referencia externa", () => {
	it('un recurso subido a CKAN (`url_type: "upload"`) es un archivo', () => {
		expect(resourceKind(makeResource({ url_type: "upload" }))).toBe("file");
	});

	it("un recurso cuyo `url_type` es la cadena vacía —una subida limpiada— es un enlace", () => {
		expect(resourceKind(makeResource({ url_type: "" }))).toBe("link");
	});

	it("un recurso con `url_type` ausente es un enlace", () => {
		expect(resourceKind(makeResource({ url_type: undefined }))).toBe("link");
	});

	it("un recurso que no declara la clave `url_type` es un enlace", () => {
		// La forma exacta del catálogo: la clave no existe, no es un `undefined` explícito.
		const sinUrlType = makeResource();
		expect("url_type" in sinUrlType).toBe(false);
		expect(resourceKind(sinUrlType)).toBe("link");
	});

	it("un `url_type` no vacío y distinto de «upload» es un enlace: la prueba no es la veracidad del campo", () => {
		// Mata la mutación plausible `resource.url_type ? "file" : "link"`, que pasaría los cuatro
		// casos de arriba y clasificaría como archivo cualquier valor no vacío.
		expect(resourceKind(makeResource({ url_type: "other" }))).toBe("link");
	});

	it("la forma sembrada en el catálogo es un enlace: un `format` y un `size` no la promueven a archivo", () => {
		const sembrado = makeResource({
			url: "https://data.umss.edu.bo/dataset/matricula/resource/res-1",
			format: "CSV",
			size: 4_200_000,
			resource_type: "file",
		});
		expect("url_type" in sembrado).toBe(false);
		expect(resourceKind(sembrado)).toBe("link");
	});
});
