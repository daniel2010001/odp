// El adaptador de errores del servidor al formulario del publicador (contrato v1, L12 punto 3).
//
// El servidor devuelve un `ValidationError` con la clave culpable y **un arreglo de mensajes** por clave
// (`{"y_field": ["…"]}`); el formulario muestra un texto **por campo**. Este módulo es la única traducción
// entre las dos formas, así que lo que se fija acá es: qué se considera un error de validación, qué mensaje
// gana cuando hay varios, dónde caen las claves que no son de la configuración, y que lo que no es un error
// de validación no se inventa.

import { describe, expect, it } from "vitest";
import { CkanApiError } from "$lib/types/api";
import { adaptServerValidation } from "./validation";

function validationError(entries: Record<string, unknown>): CkanApiError {
	return new CkanApiError("HTTP 409", 409, "Validation Error", {
		__type: "Validation Error",
		message: "Bad request",
		...entries,
	});
}

describe("adaptServerValidation — no inventa errores", () => {
	it("un valor que no es un error del catálogo no se adapta", () => {
		expect(adaptServerValidation(null)).toBeNull();
		expect(adaptServerValidation(new Error("boom"))).toBeNull();
		expect(adaptServerValidation("texto")).toBeNull();
	});

	it("un 403 no es un error de validación", () => {
		const err = new CkanApiError("Not authorized", 403, "Authorization Error");
		expect(adaptServerValidation(err)).toBeNull();
	});

	it("un fallo de transporte tampoco", () => {
		expect(adaptServerValidation(new CkanApiError("Request timed out", 408))).toBeNull();
	});

	it("un error de validación sin ninguna clave culpable no deja nada que mostrar", () => {
		expect(adaptServerValidation(validationError({}))).toBeNull();
	});
});

describe("adaptServerValidation — una clave culpable, un mensaje", () => {
	it("toma el primer mensaje del arreglo", () => {
		const adapted = adaptServerValidation(
			validationError({ y_field: ["La columna debe ser numérica.", "otro detalle"] }),
		);

		expect(adapted?.errors).toEqual({ y_field: "La columna debe ser numérica." });
		expect(adapted?.rest).toEqual([]);
	});

	it("adapta varias claves a la vez", () => {
		const adapted = adaptServerValidation(
			validationError({
				x_bucket: ["La agrupación no corresponde al tipo de la columna."],
				y_field: ["La columna debe ser numérica."],
			}),
		);

		expect(adapted?.errors).toEqual({
			x_bucket: "La agrupación no corresponde al tipo de la columna.",
			y_field: "La columna debe ser numérica.",
		});
	});

	it("descarta los mensajes que no son texto y cae a un texto propio", () => {
		const adapted = adaptServerValidation(validationError({ x_step: [], chart_type: [null] }));

		expect(adapted?.errors.chart_type).toBe("El catálogo rechazó este campo.");
		expect(adapted?.errors.x_step).toBe("El catálogo rechazó este campo.");
	});
});

describe("adaptServerValidation — lo que no es una clave de la configuración", () => {
	it("una clave del propio catálogo (`title`) no se muestra bajo un campo del gráfico", () => {
		const adapted = adaptServerValidation(
			validationError({ title: ["Falta el título."], y_agg: ["Elija un cálculo."] }),
		);

		expect(adapted?.errors).toEqual({ y_agg: "Elija un cálculo." });
		expect(adapted?.rest).toEqual(["title: Falta el título."]);
	});

	it("`__extras` se aplana con su clave, porque es ahí donde cae una clave no declarada", () => {
		const adapted = adaptServerValidation(
			validationError({ __extras: { grafico_raro: ["Unexpected key"] } }),
		);

		expect(adapted?.errors).toEqual({});
		expect(adapted?.rest).toEqual(["grafico_raro: Unexpected key"]);
	});

	it("el `message` y el `__type` de arriba no son claves culpables", () => {
		const adapted = adaptServerValidation(
			validationError({ message: "Bad request", __type: "Validation Error", version: ["x"] }),
		);

		expect(adapted?.errors).toEqual({ version: "x" });
		expect(adapted?.rest).toEqual([]);
	});
});
