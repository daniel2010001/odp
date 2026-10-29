// El tipo de una organización (Q11 de `design-system/datos-umss/preguntas-abiertas.md`): mientras el campo
// propio no exista, se **deduce del título** con la misma regla que ya usaba la tarjeta. Estos tests fijan
// esa regla en su único lugar.

import { describe, expect, it } from "vitest";
import { ORG_TYPES, orgTypeInfo, orgTypeOf } from "./org-type";

describe("orgTypeOf — el tipo deducido del título", () => {
	it.each([
		["Facultad de Ciencias y Tecnología", "facultad"],
		["Rectorado UMSS", "rectorado"],
		["Dirección de Investigación", "direccion"],
		["Direccion de Planificación", "direccion"],
		["Instituto de Investigaciones Biomédicas", "instituto"],
		["Centro de Aguas y Saneamiento Ambiental", "instituto"],
		["Unidad de Transparencia", "unidad"],
		["", "unidad"],
	])("«%s» → %s", (title, type) => {
		expect(orgTypeOf(title)).toBe(type);
	});

	it("no distingue mayúsculas", () => {
		expect(orgTypeOf("FACULTAD DE MEDICINA")).toBe("facultad");
	});

	it("«facultad» gana sobre las otras palabras, como en la regla original", () => {
		expect(orgTypeOf("Centro de cómputo de la Facultad")).toBe("facultad");
	});
});

describe("ORG_TYPES — el orden y los rótulos", () => {
	it("sigue el orden institucional, con las demás unidades al final", () => {
		expect(ORG_TYPES.map((type) => type.id)).toEqual([
			"rectorado",
			"facultad",
			"direccion",
			"instituto",
			"unidad",
		]);
	});

	it("da el rótulo de la tarjeta y el encabezado del grupo", () => {
		expect(orgTypeInfo("facultad")).toMatchObject({ label: "Facultad", plural: "Facultades" });
		expect(orgTypeInfo("unidad")).toMatchObject({ label: "Unidad", plural: "Otras unidades" });
	});
});
