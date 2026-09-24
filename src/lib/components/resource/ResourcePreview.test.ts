// Tests del panel de vista previa. La propiedad que importa es que **`preview.ts` sea la única
// compuerta**: la tabla la decide `datastore_active === true` (ya no `format === "csv"`), el tipo del
// archivo decide el embed (PDF → `<iframe>`, imagen → `<img>`, TXT/JSON → texto en `<iframe>`), y todo
// embed pasa por `safeExternalUrl`. Los dos bordes de seguridad tienen su caso: una URL `javascript:`
// no se embebe —cae al estado «none»— y un enlace (`url_type` ausente) tampoco, porque sus bytes no
// viven en CKAN.
//
// Las fixtures de los casos que renderizan algo declaran `url_type: "upload"`: sin eso `previewKind`
// los clasifica como enlace y devuelve «none» antes de mirar el formato.

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { DatastoreApi } from "$lib/api/datastore";
import type { CkanResource } from "$lib/types/ckan";
import ResourcePreview from "./ResourcePreview.svelte";

function makeResource(overrides: Partial<CkanResource> = {}): CkanResource {
	return {
		id: "res-1",
		package_id: "pkg-1",
		name: "Flujos vehiculares",
		format: "CSV",
		url: "https://example.com/flujos.csv",
		url_type: "upload",
		created: "2024-01-01T00:00:00Z",
		last_modified: "2024-01-01T00:00:00Z",
		state: "active",
		position: 0,
		...overrides,
	};
}

function makeDatastore() {
	const search = vi.fn();
	return {
		api: { search } as unknown as DatastoreApi,
		search,
	};
}

const NONE_TITLE = /Sin vista previa disponible/i;
// Primera variante del estado «none»: formato tabular que todavía no tiene tabla.
const NONE_TABULAR = /todavía no tiene datos cargados/i;
// Segunda variante: un tipo de archivo que el portal no previsualiza en absoluto.
const NONE_OTHER = /no puede previsualizar este tipo de archivo/i;

describe("ResourcePreview — la tabla la decide `datastore_active`", () => {
	it("con `datastore_active: true` consulta el datastore y renderiza la tabla, sin embeber nada", async () => {
		const { api, search } = makeDatastore();
		search.mockResolvedValue({
			fields: [{ id: "ciudad", type: "text" }],
			records: [{ ciudad: "Cochabamba" }],
			total: 1,
		});
		const { container } = render(ResourcePreview, {
			props: { resource: makeResource({ datastore_active: true }), datastore: api },
		});

		expect(await screen.findByText("Cochabamba")).toBeInTheDocument();
		expect(search).toHaveBeenCalledWith("res-1", { limit: 20 });
		expect(container.querySelector("iframe")).toBeNull();
		expect(container.querySelector("img")).toBeNull();
	});

	it("sin `datastore_active`, un CSV no consulta el datastore y muestra el estado tabular", async () => {
		const { api, search } = makeDatastore();
		render(ResourcePreview, {
			props: { resource: makeResource({ format: "CSV" }), datastore: api },
		});

		expect(await screen.findByText(NONE_TABULAR)).toBeInTheDocument();
		expect(screen.getByText(NONE_TITLE)).toBeInTheDocument();
		expect(search).not.toHaveBeenCalled();
	});

	it("muestra el estado vacío cuando no hay registros", async () => {
		const { api, search } = makeDatastore();
		search.mockResolvedValue({ fields: [], records: [], total: 0 });
		render(ResourcePreview, {
			props: { resource: makeResource({ datastore_active: true }), datastore: api },
		});

		expect(await screen.findByText(/aún no tiene datos cargados/i)).toBeInTheDocument();
	});

	it("muestra el estado de error cuando el datastore falla", async () => {
		const { api, search } = makeDatastore();
		search.mockRejectedValue(new Error("boom"));
		render(ResourcePreview, {
			props: { resource: makeResource({ datastore_active: true }), datastore: api },
		});

		expect(
			await screen.findByText(/No se pudo cargar la vista previa de datos/i),
		).toBeInTheDocument();
	});
});

describe("ResourcePreview — el tipo del archivo decide el embed", () => {
	it("un PDF embebe su propia URL en un `<iframe>` y no consulta el datastore", async () => {
		const { api, search } = makeDatastore();
		render(ResourcePreview, {
			props: {
				resource: makeResource({ format: "PDF", url: "https://example.com/flujos.pdf" }),
				datastore: api,
			},
		});

		const iframe = await screen.findByTitle("Vista previa de Flujos vehiculares");
		expect(iframe).toHaveAttribute("src", "https://example.com/flujos.pdf");
		expect(search).not.toHaveBeenCalled();
	});

	it("una imagen usa `<img>` con la URL y el nombre como `alt`", async () => {
		const { api, search } = makeDatastore();
		render(ResourcePreview, {
			props: {
				resource: makeResource({ format: "PNG", url: "https://example.com/flujos.png" }),
				datastore: api,
			},
		});

		const image = await screen.findByAltText("Flujos vehiculares");
		expect(image).toHaveAttribute("src", "https://example.com/flujos.png");
		expect(search).not.toHaveBeenCalled();
	});

	const TEXT_CASES: [string, string][] = [
		["TXT", "https://example.com/flujos.txt"],
		["JSON", "https://example.com/flujos.json"],
	];

	it.each(TEXT_CASES)("un %s se muestra como texto en un `<iframe>`", async (format, url) => {
		const { api, search } = makeDatastore();
		render(ResourcePreview, {
			props: { resource: makeResource({ format, url }), datastore: api },
		});

		const iframe = await screen.findByTitle("Vista previa de Flujos vehiculares");
		expect(iframe).toHaveAttribute("src", url);
		expect(search).not.toHaveBeenCalled();
	});

	it("un ZIP no se previsualiza y lo explica sin hablar de datos cargados", async () => {
		const { api, search } = makeDatastore();
		const { container } = render(ResourcePreview, {
			props: {
				resource: makeResource({ format: "ZIP", url: "https://example.com/flujos.zip" }),
				datastore: api,
			},
		});

		expect(await screen.findByText(NONE_OTHER)).toBeInTheDocument();
		expect(screen.getByText(NONE_TITLE)).toBeInTheDocument();
		expect(container.querySelector("iframe")).toBeNull();
		expect(search).not.toHaveBeenCalled();
	});
});

describe("ResourcePreview — bordes de seguridad del embed", () => {
	it("una URL `javascript:` no se embebe: cae al estado «none»", async () => {
		const { api, search } = makeDatastore();
		const { container } = render(ResourcePreview, {
			props: {
				resource: makeResource({ format: "PDF", url: "javascript:alert(1)" }),
				datastore: api,
			},
		});

		expect(await screen.findByText(NONE_OTHER)).toBeInTheDocument();
		expect(screen.getByText(NONE_TITLE)).toBeInTheDocument();
		expect(container.querySelector("iframe")).toBeNull();
		expect(container.querySelector("img")).toBeNull();
		expect(search).not.toHaveBeenCalled();
	});

	it("un enlace (`url_type` ausente) con formato PDF no embebe y cae al estado «none»", async () => {
		const { api, search } = makeDatastore();
		const { container } = render(ResourcePreview, {
			props: {
				resource: makeResource({
					format: "PDF",
					url: "https://otro-sitio.example/flujos.pdf",
					url_type: undefined,
				}),
				datastore: api,
			},
		});

		expect(await screen.findByText(NONE_TITLE)).toBeInTheDocument();
		expect(container.querySelector("iframe")).toBeNull();
		expect(container.querySelector("img")).toBeNull();
		expect(search).not.toHaveBeenCalled();
	});
});
