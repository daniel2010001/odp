import { describe, expect, it } from "vitest";
import { formatChartNumber } from "./format";
import { formatCompactNumber, valueLabelsFit } from "./value-labels";

describe("formatCompactNumber", () => {
	it("abrevia con tres cifras significativas, siempre con la misma unidad", () => {
		// `Intl` en es-BO escribe «1,2 K» y «45,2 k» (medido el 2026-10-18): la abreviatura es propia.
		// Con un solo decimal, 1.049 se leía «1 mil», un 4,7 % menos (duda del autor sobre el redondeo).
		const compact = formatCompactNumber;
		expect(compact(950)).toBe("950");
		expect(compact(1049)).toBe("1,05 mil");
		expect(compact(1234)).toBe("1,23 mil");
		expect(compact(45210)).toBe("45,2 mil");
		expect(compact(1234567)).toBe("1,23 M");
		expect(compact(-98765432.1)).toBe("-98,8 M");
		expect(compact(1234567890)).toBe("1,23 mil M");
	});

	it("sube de unidad cuando el redondeo la alcanza, en vez de escribir «1.000 mil»", () => {
		const compact = formatCompactNumber;
		expect(compact(999.996)).toBe("1 mil");
		expect(compact(999950)).toBe("1 M");
	});

	it("no abrevia por debajo de mil: dos decimales, como el resto del gráfico", () => {
		const compact = formatCompactNumber;
		expect(compact(Math.PI)).toBe("3,14");
		expect(compact(0.456)).toBe("0,46");
		expect(compact(999.4)).toBe("999,4");
	});

	it("un valor ausente o no finito se rotula como el resto de lo que no tiene dato", () => {
		expect(formatCompactNumber(null)).toBe(formatChartNumber(null));
		expect(formatCompactNumber(Number.NaN)).toBe(formatChartNumber(Number.NaN));
	});
});

describe("valueLabelsFit", () => {
	it("caben cuando la barra es más ancha que el rótulo más largo", () => {
		expect(valueLabelsFit(80, ["1.234", "12.345"])).toBe(true);
	});

	it("no caben cuando el rótulo más largo excede el ancho de la barra", () => {
		expect(valueLabelsFit(20, ["1.234", "12.345"])).toBe(false);
	});

	it("sin barras o sin ancho medido, no se dibujan", () => {
		expect(valueLabelsFit(0, ["1"])).toBe(false);
		expect(valueLabelsFit(80, [])).toBe(false);
	});
});
