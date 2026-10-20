// La leyenda de la dona: dónde va según el ancho. En una fila cabe en una pantalla ancha; en una angosta,
// una fila de 8 rótulos mide más de 1.000 px y se sale del gráfico (S20, medido en 375/414/768 px).

import { describe, expect, it } from "vitest";
import { legendLayout } from "./legend";

const LABELS = [
	"Artículo científico",
	"Capítulo de libro",
	"Informe técnico",
	"Libro",
	"Patente",
	"Tesis de doctorado",
	"Tesis de maestría",
	"Ponencia en congreso",
];

describe("legendLayout", () => {
	it("en una pantalla ancha la leyenda va en una fila, dentro de la dona", () => {
		expect(legendLayout(LABELS, 1400)).toBe("inline");
	});

	it("8 rótulos no caben en una fila a 768, 414 ni 375 px: pasan debajo y se parten en renglones", () => {
		for (const width of [720, 382, 343]) expect(legendLayout(LABELS, width)).toBe("stacked");
	});

	it("pocos rótulos cortos sí caben en una fila angosta", () => {
		expect(legendLayout(["Sí", "No"], 343)).toBe("inline");
	});

	it("sin ancho medido (primer pintado, jsdom) se queda en una fila: no se decide a ciegas", () => {
		expect(legendLayout(LABELS, 0)).toBe("inline");
	});
});
