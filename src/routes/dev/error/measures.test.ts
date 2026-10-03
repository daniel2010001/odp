// Tests de la conversión medida cruda → texto de la hoja de revisión.
//
// El instrumento de `/dev/error` no puede medir layout en jsdom (todo vale 0), pero el texto que
// imprime sí es una función pura. Estos tests fijan ese contrato con entradas conocidas: si alguien
// cambia el formato, el acoplamiento medida→texto se rompe acá antes que en el navegador.

import { describe, expect, it } from "vitest";
import { formatMeasures, type SheetMeasures } from "./measures";

function measures(overrides: Partial<SheetMeasures> = {}): SheetMeasures {
	return {
		columnWidth: 0,
		cardScrollWidth: 0,
		cardClientWidth: 0,
		pageScrollWidth: 0,
		pageClientWidth: 0,
		...overrides,
	};
}

describe("formatMeasures", () => {
	it("formatea el ancho de columna en píxeles con dos decimales", () => {
		expect(formatMeasures(measures({ columnWidth: 384 })).columnWidth).toBe("384.00 px");
		expect(formatMeasures(measures({ columnWidth: 383.5 })).columnWidth).toBe("383.50 px");
	});

	it("muestra el 0 honestamente, sin esconderlo ni sustituirlo por un guion", () => {
		const formatted = formatMeasures(measures());

		expect(formatted.columnWidth).toBe("0.00 px");
		expect(formatted.cardOverflow).toBe("0 / 0");
		expect(formatted.documentOverflow).toBe("0 / 0");
	});

	it("no inventa un cero cuando falta uno de los lados del desborde", () => {
		expect(
			formatMeasures(measures({ cardScrollWidth: 1280, cardClientWidth: 0 })).cardOverflow,
		).toBe("1280 / 0");
		expect(formatMeasures(measures({ pageClientWidth: 360 })).documentOverflow).toBe("0 / 360");
	});

	it("conserva los valores grandes sin truncarlos", () => {
		const formatted = formatMeasures(
			measures({
				columnWidth: 987654.321,
				cardScrollWidth: 1234567,
				cardClientWidth: 1024,
				pageScrollWidth: 100000,
				pageClientWidth: 99999,
			}),
		);

		expect(formatted.columnWidth).toBe("987654.32 px");
		expect(formatted.cardOverflow).toBe("1234567 / 1024");
		expect(formatted.documentOverflow).toBe("100000 / 99999");
	});

	it("redondea al centésimo y no arrastra el ruido binario del punto flotante", () => {
		// `0.1 + 0.2` es 0.30000000000000004; el texto tiene que ser 0.30, no el número crudo.
		expect(formatMeasures(measures({ columnWidth: 0.1 + 0.2 })).columnWidth).toBe("0.30 px");
		expect(formatMeasures(measures({ columnWidth: 1234.5678 })).columnWidth).toBe("1234.57 px");
	});
});
