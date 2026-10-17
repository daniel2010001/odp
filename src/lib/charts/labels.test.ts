// Los rótulos de los ejes del gráfico: texto del portal, no del servidor.
//
// El contrato deja que el servidor devuelva `key`s crudas y que sea el portal quien las rotule
// (`groupLabel`). Los nombres de los ejes tienen el mismo dueño: el cálculo elegido y la columna elegida
// tienen que leerse como una frase, no como dos identificadores pegados.

import { describe, expect, it } from "vitest";
import { xAxisLabel, yAxisLabel } from "./labels";

describe("yAxisLabel — qué mide el eje vertical", () => {
	it("contar filas no nombra una columna", () => {
		expect(yAxisLabel("count")).toBe("Cantidad de filas");
	});

	it("los cálculos sin columna a la vista nombran la columna elegida", () => {
		expect(yAxisLabel("count_distinct", "departamento")).toBe("Valores distintos de departamento");
		expect(yAxisLabel("sum", "salario")).toBe("Suma de salario");
		expect(yAxisLabel("avg", "salario")).toBe("Promedio de salario");
		expect(yAxisLabel("min", "salario")).toBe("Mínimo de salario");
		expect(yAxisLabel("max", "salario")).toBe("Máximo de salario");
	});

	it("un cálculo que necesita columna y no la tiene no inventa un nombre", () => {
		expect(yAxisLabel("avg")).toBe("Promedio");
		expect(yAxisLabel("avg", "  ")).toBe("Promedio");
	});
});

describe("xAxisLabel — cómo se agrupa el eje horizontal", () => {
	it("el valor tal cual se rotula con la columna, que es lo que el publicador eligió", () => {
		expect(xAxisLabel("value", "turno")).toBe("turno");
	});

	it("el rango numérico nombra el paso", () => {
		expect(xAxisLabel("number_step", "salario", 5000)).toBe("salario por rango de 5000");
	});

	it("una fecha agrupada nombra la unidad, no el paso", () => {
		expect(xAxisLabel("year", "fecha_ingreso")).toBe("Año de fecha_ingreso");
		expect(xAxisLabel("quarter", "fecha_ingreso")).toBe("Trimestre de fecha_ingreso");
		expect(xAxisLabel("month", "fecha_ingreso")).toBe("Mes de fecha_ingreso");
	});
});
