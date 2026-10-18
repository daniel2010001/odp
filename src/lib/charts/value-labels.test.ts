import { describe, expect, it } from "vitest";
import { barValueFormatter, valueLabelsFit } from "./value-labels";

describe("barValueFormatter", () => {
	it("«completo» escribe el número como el resto del gráfico (es-BO, a lo sumo dos decimales)", () => {
		expect(barValueFormatter("full")(8496.754044)).toBe("8.496,75");
	});

	it("«compacto» abrevia miles y millones con un decimal, siempre con la misma unidad", () => {
		// `Intl` en es-BO escribe «1,2 K» y «45,2 k» (medido el 2026-10-18): la abreviatura es propia.
		const compact = barValueFormatter("compact");
		expect(compact(950)).toBe("950");
		expect(compact(1234)).toBe("1,2 mil");
		expect(compact(45210)).toBe("45,2 mil");
		expect(compact(1234567)).toBe("1,2 M");
		expect(compact(-98765432.1)).toBe("-98,8 M");
		expect(compact(0.456)).toBe("0,46");
	});

	it("un valor ausente se rotula como el resto de lo que no tiene dato, en los dos formatos", () => {
		expect(barValueFormatter("full")(null)).toBe(barValueFormatter("compact")(null));
	});
});

describe("valueLabelsFit", () => {
	it("caben cuando la barra es m\u00e1s ancha que el r\u00f3tulo m\u00e1s largo", () => {
		expect(valueLabelsFit(80, ["1.234", "12.345"])).toBe(true);
	});

	it("no caben cuando el r\u00f3tulo m\u00e1s largo excede el ancho de la barra", () => {
		expect(valueLabelsFit(20, ["1.234", "12.345"])).toBe(false);
	});

	it("sin barras o sin ancho medido, no se dibujan", () => {
		expect(valueLabelsFit(0, ["1"])).toBe(false);
		expect(valueLabelsFit(80, [])).toBe(false);
	});
});
