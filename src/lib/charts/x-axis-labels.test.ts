import { describe, expect, it } from "vitest";
import { fitLabel, resolveAutoMode, wrapLabel, xAxisLayout } from "./x-axis-labels";

// Una medida falsa y determinista: 6 px por carácter. La real mide con la fuente del eje en un canvas.
const measure = (text: string) => text.length * 6;

describe("fitLabel", () => {
	it("deja intacto el rótulo que cabe", () => {
		expect(fitLabel("Ciencias Sociales", 200, measure)).toBe("Ciencias Sociales");
	});

	it("recorta con «…» el que no cabe, sin pasarse del ancho", () => {
		const fitted = fitLabel("Arquitectura y Ciencias del Hábitat", 60, measure);
		expect(fitted).toBe("Arquitect…");
		expect(measure(fitted)).toBeLessThanOrEqual(60);
	});

	it("no deja un espacio colgando antes de «…»", () => {
		// «Ciencias » cabe con 9 caracteres; el espacio no se escribe.
		expect(fitLabel("Ciencias Agrícolas", 60, measure)).toBe("Ciencias…");
	});

	it("con un ancho donde no cabe ni una letra, devuelve sólo «…»", () => {
		expect(fitLabel("Derecho", 4, measure)).toBe("…");
	});
});

describe("wrapLabel", () => {
	it("parte por palabras en renglones que caben", () => {
		expect(wrapLabel("Ciencias Jurídicas y Políticas", 90, 3, measure)).toBe(
			"Ciencias\nJurídicas y\nPolíticas",
		);
	});

	it("con más renglones que el tope, recorta el último con «…»", () => {
		const wrapped = wrapLabel("Humanidades y Ciencias de la Educación", 66, 2, measure);
		expect(wrapped).toBe("Humanidades\ny Ciencias…");
		for (const line of wrapped.split("\n")) expect(measure(line)).toBeLessThanOrEqual(66);
	});

	it("una palabra más ancha que el renglón se recorta en vez de desbordar", () => {
		expect(wrapLabel("Odontología", 42, 2, measure)).toBe("Odonto…");
	});

	it("un rótulo corto queda en un renglón", () => {
		expect(wrapLabel("2024", 90, 3, measure)).toBe("2024");
	});
});

describe("xAxisLayout", () => {
	it("rotula todas las categorías mientras haya lugar", () => {
		for (const mode of ["straight", "rotate", "wrap"] as const) {
			expect(xAxisLayout(mode, 12, 600).tickStep).toBe(1);
		}
	});

	it("si el lugar por categoría es menor que el mínimo de la forma, se saltean rótulos", () => {
		// 30 categorías en 300 px: 10 px por categoría; girado pide 18, derecho o en renglones 28.
		expect(xAxisLayout("rotate", 30, 300).tickStep).toBe(2);
		expect(xAxisLayout("wrap", 30, 300).tickStep).toBe(3);
	});

	it("sin ancho medido todavía, uno de cada N pasadas las 8 categorías, sea cual sea la forma", () => {
		for (const mode of ["straight", "rotate", "wrap"] as const) {
			expect(xAxisLayout(mode, 8, 0)).toEqual({ tickStep: 1, labelWidth: 0 });
			expect(xAxisLayout(mode, 12, 0)).toEqual({ tickStep: 2, labelWidth: 0 });
			expect(xAxisLayout(mode, 12, -5).tickStep).toBe(2);
		}
	});

	it("sin categorías, rotula todo y no falla", () => {
		expect(xAxisLayout("wrap", 0, 600)).toEqual({ tickStep: 1, labelWidth: 0 });
	});

	it("el ancho de rótulo es el lugar de la categoría menos un respiro", () => {
		expect(xAxisLayout("wrap", 8, 640).labelWidth).toBe(74);
	});
});

describe("resolveAutoMode", () => {
	it("rótulos cortos: derechos", () => {
		expect(resolveAutoMode(["Derecho", "Medicina", "Economía"], 600, measure, 3)).toBe("straight");
	});

	it("rótulos largos de varias palabras que caben en hasta 3 renglones: en renglones", () => {
		const labels = [
			"Ciencias Jurídicas y Políticas",
			"Humanidades y Ciencias",
			"Derecho",
			"Economía",
		];
		expect(resolveAutoMode(labels, 600, measure, 3)).toBe("wrap");
	});

	it("una palabra sola más ancha que el renglón obliga a recortar: girados", () => {
		const labels = ["Electromagnetoencefalografía", "Derecho", "Medicina", "Economía"];
		expect(resolveAutoMode(labels, 600, measure, 3)).toBe("rotate");
	});

	it("un rótulo con más renglones que el tope obliga a recortar: girados", () => {
		const labels = ["Uno dos tres cuatro cinco seis siete", "Derecho"];
		expect(resolveAutoMode(labels, 100, measure, 3)).toBe("rotate");
	});

	it("un solo rótulo malo arrastra a todo el eje a la forma de reserva", () => {
		const good = Array.from({ length: 5 }, () => "Derecho");
		expect(resolveAutoMode(good, 600, measure, 3)).toBe("straight");
		expect(resolveAutoMode([...good, "Electromagnetoencefalografía"], 600, measure, 3)).toBe(
			"rotate",
		);
		expect(resolveAutoMode([...good, "Ciencias Jurídicas y Políticas"], 600, measure, 3)).toBe(
			"wrap",
		);
	});

	it("un rótulo que ya trae «…» y cabe en renglones sin recortarse sigue siendo en renglones", () => {
		expect(resolveAutoMode(["Ciencias Sociales y Hum…", "Derecho"], 160, measure, 3)).toBe("wrap");
	});

	it("con demasiadas categorías para escribirlas todas, ni derechos ni en renglones: girados", () => {
		const labels = Array.from({ length: 30 }, (_, i) => String(i + 1));
		expect(resolveAutoMode(labels, 600, measure, 3)).toBe("rotate");
	});

	it("sin ancho medido todavía, derechos y sin fallar", () => {
		expect(resolveAutoMode(["Ciencias Jurídicas y Políticas"], 0, measure, 3)).toBe("straight");
		expect(resolveAutoMode([], 0, measure, 3)).toBe("straight");
		expect(resolveAutoMode([], 600, measure, 3)).toBe("straight");
	});
});
