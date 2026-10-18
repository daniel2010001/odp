// Los números del gráfico se escriben en es-BO, con a lo sumo dos decimales (P3, punto 3).
//
// El servidor devuelve los promedios sin redondear (`8496.754044…`, L23): el redondeo y el separador son del
// portal, y viven en un solo lugar para que el tooltip, la tabla accesible, el total de la dona y el eje
// vertical digan el mismo número.

import { describe, expect, it } from "vitest";
import { formatChartNumber } from "./format";

describe("formatChartNumber", () => {
	it("redondea a dos decimales y usa coma decimal y punto de millares", () => {
		expect(formatChartNumber(8496.754044)).toBe("8.496,75");
		expect(formatChartNumber(1234567.891)).toBe("1.234.567,89");
	});

	it("agrupa los millares también con cuatro cifras", () => {
		expect(formatChartNumber(1266)).toBe("1.266");
	});

	it("no agrega decimales que el número no tiene", () => {
		expect(formatChartNumber(3)).toBe("3");
		expect(formatChartNumber(3.5)).toBe("3,5");
	});

	it("escribe el cero y los negativos", () => {
		expect(formatChartNumber(0)).toBe("0");
		expect(formatChartNumber(-3.456)).toBe("-3,46");
	});

	it("un valor ausente o no finito se rotula «Sin dato» y no «NaN»", () => {
		expect(formatChartNumber(null)).toBe("Sin dato");
		expect(formatChartNumber(undefined)).toBe("Sin dato");
		expect(formatChartNumber(Number.NaN)).toBe("Sin dato");
		expect(formatChartNumber(Number.POSITIVE_INFINITY)).toBe("Sin dato");
	});

	it("acepta un número que llega como texto (la clave de un grupo numérico)", () => {
		expect(formatChartNumber("8496.754044")).toBe("8.496,75");
	});
});
