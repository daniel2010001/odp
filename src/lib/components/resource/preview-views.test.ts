// La lógica pura de los enlaces de la vista previa: qué id lleva cada ventana y cómo un fragmento
// (`#grafico-…`) se resuelve a una vista.
import { describe, expect, it } from "vitest";
import {
	CONTAINER_ID,
	chartWindowId,
	type PreviewView,
	resolveHash,
	shareLink,
	windowIdFor,
} from "./preview-views";

const views: PreviewView[] = [
	{ key: "table", id: "tabla", kind: "table", label: "Tabla" },
	{
		key: "c1",
		id: "grafico-3f1a9c52-7b0e-4d2a-9a61-0c5e8b7d1a01",
		kind: "chart",
		label: "Producción por año",
	},
	{
		key: "c2",
		id: "grafico-8d27e4b0-51c3-4f6a-b2d9-6a14c9e03b02",
		kind: "chart",
		label: "Publicaciones",
	},
];

describe("ids de las ventanas", () => {
	it("el contenedor es #vista-previa", () => {
		expect(CONTAINER_ID).toBe("vista-previa");
	});
	it("el id de un gráfico es grafico-<id de la vista>, sin tocar el título", () => {
		expect(chartWindowId("3f1a9c52-7b0e")).toBe("grafico-3f1a9c52-7b0e");
	});
	it("cada tipo de vista tiene su id y su etiqueta", () => {
		expect(windowIdFor("table")).toEqual({ id: "tabla", label: "Tabla" });
		expect(windowIdFor("pdf")).toEqual({ id: "pdf", label: "PDF" });
		expect(windowIdFor("image")).toEqual({ id: "imagen", label: "Imagen" });
		expect(windowIdFor("text")).toEqual({ id: "texto", label: "Texto" });
	});
	it("sin vista previa no hay ventana con id", () => {
		expect(windowIdFor("none")).toBeNull();
	});
});

describe("resolveHash", () => {
	it("el id de una ventana resuelve a su vista", () => {
		expect(resolveHash("#grafico-8d27e4b0-51c3-4f6a-b2d9-6a14c9e03b02", views)).toEqual({
			view: views[2],
			container: false,
		});
	});
	it("el id del contenedor no cambia de vista", () => {
		expect(resolveHash(`#${CONTAINER_ID}`, views)).toEqual({ view: null, container: true });
	});
	it("un fragmento desconocido o vacío no resuelve nada", () => {
		expect(resolveHash("#licencia", views)).toEqual({ view: null, container: false });
		expect(resolveHash("", views)).toEqual({ view: null, container: false });
	});
});

describe("shareLink", () => {
	it("reemplaza el fragmento y conserva la ruta y la consulta", () => {
		expect(shareLink("http://x.test/dataset/a/resource/b?x=1#tabla", "grafico-c5b6")).toBe(
			"http://x.test/dataset/a/resource/b?x=1#grafico-c5b6",
		);
	});
});
