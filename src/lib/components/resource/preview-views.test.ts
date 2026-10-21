// La lógica pura de los enlaces de la vista previa: qué id lleva cada ventana y cómo un fragmento
// (`#chart-…`) se resuelve a una vista.
import { describe, expect, it } from "vitest";
import {
	CONTAINER_ID,
	chartWindowId,
	LEGACY_FRAGMENTS,
	type PreviewView,
	resolveHash,
	shareLink,
	upgradeFragment,
	windowIdFor,
} from "./preview-views";

const views: PreviewView[] = [
	{ key: "table", id: "table", kind: "table", label: "Tabla" },
	{
		key: "c1",
		id: "chart-3f1a9c52-7b0e-4d2a-9a61-0c5e8b7d1a01",
		kind: "chart",
		label: "Producción por año",
	},
	{
		key: "c2",
		id: "chart-8d27e4b0-51c3-4f6a-b2d9-6a14c9e03b02",
		kind: "chart",
		label: "Publicaciones",
	},
];

describe("ids de las ventanas", () => {
	it("el contenedor es #preview", () => {
		expect(CONTAINER_ID).toBe("preview");
	});
	it("el id de un gráfico es chart-<id de la vista>, sin tocar el título", () => {
		expect(chartWindowId("3f1a9c52-7b0e")).toBe("chart-3f1a9c52-7b0e");
	});
	it("cada tipo de vista tiene su id y su etiqueta", () => {
		expect(windowIdFor("table")).toEqual({ id: "table", label: "Tabla" });
		expect(windowIdFor("pdf")).toEqual({ id: "pdf", label: "PDF" });
		expect(windowIdFor("image")).toEqual({ id: "image", label: "Imagen" });
		expect(windowIdFor("text")).toEqual({ id: "text", label: "Texto" });
	});
	it("sin vista previa no hay ventana con id", () => {
		expect(windowIdFor("none")).toBeNull();
	});
});

describe("resolveHash", () => {
	it("el id de una ventana resuelve a su vista", () => {
		expect(resolveHash("#chart-8d27e4b0-51c3-4f6a-b2d9-6a14c9e03b02", views)).toEqual({
			view: views[2],
			container: false,
		});
	});
	it("el id del contenedor no cambia de vista", () => {
		expect(resolveHash(`#${CONTAINER_ID}`, views)).toEqual({ view: null, container: true });
	});
	it("un fragmento desconocido o vacío no resuelve nada", () => {
		expect(resolveHash("#license", views)).toEqual({ view: null, container: false });
		expect(resolveHash("", views)).toEqual({ view: null, container: false });
	});
});

describe("shareLink", () => {
	it("reemplaza el fragmento y conserva la ruta y la consulta", () => {
		expect(shareLink("http://x.test/dataset/a/resource/b?x=1#table", "chart-c5b6")).toBe(
			"http://x.test/dataset/a/resource/b?x=1#chart-c5b6",
		);
	});
});

describe("fragmentos heredados en español", () => {
	it("cada fragmento viejo tiene su equivalente en inglés", () => {
		expect(LEGACY_FRAGMENTS).toEqual({
			"vista-previa": "preview",
			tabla: "table",
			imagen: "image",
			texto: "text",
			resumen: "summary",
			licencia: "license",
			recursos: "resources",
			"info-tecnica": "technical-info",
			historial: "history",
			organizacion: "organization",
			citar: "cite",
		});
	});
	it("upgradeFragment mapea cada viejo, con o sin #", () => {
		for (const [old, now] of Object.entries(LEGACY_FRAGMENTS)) {
			expect(upgradeFragment(`#${old}`)).toBe(`#${now}`);
			expect(upgradeFragment(old)).toBe(`#${now}`);
		}
	});
	it("#grafico-<id> pasa a #chart-<id> conservando el id", () => {
		expect(upgradeFragment("#grafico-4afe6ba0-0fa2-48af-9b54-13c8c5059401")).toBe(
			"#chart-4afe6ba0-0fa2-48af-9b54-13c8c5059401",
		);
	});
	it("los fragmentos en inglés, #pdf y los desconocidos no cambian (null)", () => {
		for (const h of ["#preview", "#table", "#pdf", "#chart-abc", "#history", "#otra", "", "#"]) {
			expect(upgradeFragment(h)).toBeNull();
		}
	});
	it("resolveHash abre la vista de un fragmento viejo", () => {
		expect(resolveHash("#grafico-8d27e4b0-51c3-4f6a-b2d9-6a14c9e03b02", views).view).toBe(views[2]);
		expect(resolveHash("#tabla", views).view).toBe(views[0]);
		expect(resolveHash("#vista-previa", views)).toEqual({ view: null, container: true });
	});
});
