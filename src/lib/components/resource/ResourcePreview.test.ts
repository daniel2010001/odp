// Tests del panel de vista previa. La propiedad que importa es que **`preview.ts` sea la única
// compuerta**: la tabla la decide `datastore_active === true` (ya no `format === "csv"`), el tipo del
// archivo decide el embed (PDF → `<iframe>`, imagen → `<img>`, TXT/JSON → texto en `<iframe>`), y todo
// embed pasa por `safeExternalUrl`. Los dos bordes de seguridad tienen su caso: una URL `javascript:`
// no se embebe —cae al estado «none»— y un enlace (`url_type` ausente) tampoco, porque sus bytes no
// viven en CKAN.
//
// Las fixtures de los casos que renderizan algo declaran `url_type: "upload"`: sin eso `previewKind`
// los clasifica como enlace y devuelve «none» antes de mirar el formato.

import { render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { DatastoreApi, DatastoreSearchResult } from "$lib/api/datastore";
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

// Promesa que el test resuelve a mano: deja el datastore «pendiente» sin depender de un timeout.
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
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
		// Un archivo alojado sale del portal, no de la `url` de CKAN.
		expect(iframe).toHaveAttribute("src", "/catalog/download/res-1");
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
		expect(image).toHaveAttribute("src", "/catalog/download/res-1");
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
		expect(iframe).toHaveAttribute("src", "/catalog/download/res-1");
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

describe("ResourcePreview — estados de carga y carrera de consultas", () => {
	it("muestra el estado de carga mientras el datastore responde y luego la tabla", async () => {
		const { api, search } = makeDatastore();
		const pending = deferred<DatastoreSearchResult>();
		search.mockReturnValue(pending.promise);
		const { container } = render(ResourcePreview, {
			props: { resource: makeResource({ datastore_active: true }), datastore: api },
		});

		expect(await screen.findByText("Cargando vista previa…")).toBeInTheDocument();
		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(screen.queryByRole("table")).toBeNull();

		pending.resolve({
			fields: [{ id: "ciudad", type: "text" }],
			records: [{ ciudad: "Cochabamba" }],
			total: 1,
		});

		expect(await screen.findByText("Cochabamba")).toBeInTheDocument();
		expect(screen.queryByText("Cargando vista previa…")).toBeNull();
		expect(container.querySelector('[aria-busy="true"]')).toBeNull();
	});

	it("una respuesta vieja no pisa las filas del recurso nuevo", async () => {
		const { api, search } = makeDatastore();
		const vieja = deferred<DatastoreSearchResult>();
		const nueva = deferred<DatastoreSearchResult>();
		search.mockImplementation((id: string) => (id === "res-a" ? vieja.promise : nueva.promise));

		const { rerender } = render(ResourcePreview, {
			props: {
				resource: makeResource({ id: "res-a", datastore_active: true }),
				datastore: api,
			},
		});
		await rerender({
			resource: makeResource({ id: "res-b", datastore_active: true }),
			datastore: api,
		});

		// B resuelve primero y ya pinta sus filas...
		nueva.resolve({
			fields: [{ id: "ciudad", type: "text" }],
			records: [{ ciudad: "Quillacollo" }],
			total: 1,
		});
		expect(await screen.findByText("Quillacollo")).toBeInTheDocument();

		// ...y A resuelve después: la respuesta vieja no debe pisarlas.
		vieja.resolve({
			fields: [{ id: "ciudad", type: "text" }],
			records: [{ ciudad: "Cochabamba" }],
			total: 1,
		});
		await waitFor(() => {
			expect(screen.queryByText("Cochabamba")).toBeNull();
		});
		expect(screen.getByText("Quillacollo")).toBeInTheDocument();
	});
});

describe("ResourcePreview — bordes de seguridad del embed", () => {
	it("una URL `javascript:` guardada en un archivo no llega al embed: el `<iframe>` apunta al portal", async () => {
		// La `url` de un archivo alojado ya no se usa en el cliente: el embed sale de la ruta de descarga del
		// portal, que construye la URL del archivo en el servidor. El `javascript:` almacenado no tiene por
		// dónde llegar a un `src`.
		const { api, search } = makeDatastore();
		const { container } = render(ResourcePreview, {
			props: {
				resource: makeResource({ format: "PDF", url: "javascript:alert(1)" }),
				datastore: api,
			},
		});

		const iframe = await screen.findByTitle("Vista previa de Flujos vehiculares");
		expect(iframe).toHaveAttribute("src", "/catalog/download/res-1");
		expect(container.innerHTML).not.toContain("javascript:");
		expect(search).not.toHaveBeenCalled();
	});

	it("una URL `javascript:` en un enlace no se embebe: cae al estado «none»", async () => {
		const { api, search } = makeDatastore();
		const { container } = render(ResourcePreview, {
			props: {
				resource: makeResource({ format: "PDF", url: "javascript:alert(1)", url_type: undefined }),
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

// Alto de la vista previa (v0.1.1, T6, estrategia D). Los números viven en clases de Tailwind y jsdom no
// calcula `dvh` ni `cqw`, así que lo que se ancla es la fórmula escrita, no un alto medido (eso se midió en
// Chromium). `140px` = 65 (encabezado encogido, con su borde) + 41 (barra de la tarjeta) + 2 (bordes de la tarjeta) + 2 × 16 (aire).
describe("ResourcePreview — alto por tipo (estrategia D)", () => {
	it("el PDF llena la pantalla sin pasar de 1,3 × el ancho de la columna ni bajar de 520px", () => {
		const { api } = makeDatastore();
		render(ResourcePreview, {
			props: { resource: makeResource({ format: "PDF" }), datastore: api },
		});

		const iframe = screen.getByTitle("Vista previa de Flujos vehiculares");
		expect(iframe.className).toContain("h-[min(max(240px,calc(100dvh-140px)),max(520px,130cqw))]");
		// `cqw` mide el contenedor que lo envuelve.
		expect(iframe.parentElement?.className).toContain("@container");
	});

	it("la imagen ocupa el ancho, con alto automático y tope `max(360px, pantalla)`", () => {
		const { api } = makeDatastore();
		render(ResourcePreview, {
			props: { resource: makeResource({ format: "PNG" }), datastore: api },
		});

		const image = screen.getByAltText("Flujos vehiculares");
		expect(image.className).toContain("w-full");
		expect(image.className).toContain("h-auto");
		expect(image.className).toContain("max-h-[max(360px,calc(100dvh-140px))]");
		expect(image.className).toContain("object-contain");
	});

	it("el texto mide `clamp(360px, 55dvh, 720px)`", () => {
		const { api } = makeDatastore();
		render(ResourcePreview, {
			props: { resource: makeResource({ format: "TXT" }), datastore: api },
		});

		const iframe = screen.getByTitle("Vista previa de Flujos vehiculares");
		expect(iframe.className).toContain("h-[clamp(360px,55dvh,720px)]");
	});
});
