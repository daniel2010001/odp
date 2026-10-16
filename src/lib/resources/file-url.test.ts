// Pruebas de `fileUrl`: de dónde saca el cliente la URL de un recurso.
//
// Un archivo alojado sale del **portal** (`/catalog/download/<id>`), que autentica contra el catálogo y
// devuelve los bytes; un enlace sigue siendo el enlace externo, saneado. El `id` se codifica porque va en un
// segmento de ruta, y la `url` de un archivo no se mira: el host que traiga CKAN no es el que el navegador
// necesita (ni el que el servidor del portal debe pedir).

import { describe, expect, it } from "vitest";
import type { CkanResource } from "$lib/types/ckan";
import { fileUrl } from "./file-url";

function makeResource(overrides: Partial<CkanResource> = {}): CkanResource {
	return {
		id: "res-1",
		package_id: "pkg-1",
		name: "Flujos",
		format: "PDF",
		url: "http://localhost:5000/dataset/x/resource/res-1/download/flujos.pdf",
		url_type: "upload",
		created: "2024-01-01T00:00:00Z",
		last_modified: "2024-01-01T00:00:00Z",
		state: "active",
		position: 0,
		...overrides,
	};
}

describe("fileUrl", () => {
	it("un archivo alojado apunta a la ruta de descarga del portal, no a la `url` de CKAN", () => {
		expect(fileUrl(makeResource())).toBe("/catalog/download/res-1");
	});

	it("codifica el `id` como segmento de ruta", () => {
		expect(fileUrl(makeResource({ id: "a/b c" }))).toBe("/catalog/download/a%2Fb%20c");
	});

	it("un enlace conserva su URL externa", () => {
		expect(
			fileUrl(makeResource({ url_type: undefined, url: "https://datos.umss.edu/x.pdf" })),
		).toBe("https://datos.umss.edu/x.pdf");
	});

	it("un enlace con un esquema peligroso no tiene URL", () => {
		expect(fileUrl(makeResource({ url_type: undefined, url: "javascript:alert(1)" }))).toBeNull();
	});

	it("un enlace sin URL no tiene URL", () => {
		expect(fileUrl(makeResource({ url_type: undefined, url: "" }))).toBeNull();
	});
});
