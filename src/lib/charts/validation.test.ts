// El adaptador de errores del servidor al formulario del publicador (contrato v1, L12 punto 3).
//
// El servidor devuelve un `ValidationError` con la clave culpable y mensajes **en inglés**, parte de ellos de
// CKAN core («Missing value»). El contrato garantiza la **clave**, no el texto (L18). Así que lo que se fija
// acá es: qué se considera un error de validación; que el campo muestra el texto **del portal** para esa
// clave, nunca el del servidor; que las claves que no son de la configuración dan un aviso propio; que el
// texto del servidor sólo sobrevive como detalle técnico; y que lo que no es un error de validación no se
// inventa.

import { describe, expect, it } from "vitest";
import { CkanApiError } from "$lib/types/api";
import { CHART_CONFIG_KEYS } from "./contract";
import {
	adaptServerValidation,
	FIELD_MESSAGES,
	GENERAL_NOTICE,
	NOTICE_MESSAGES,
} from "./validation";

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

describe("adaptServerValidation — el campo muestra el texto del portal, no el del servidor", () => {
	it("una clave de la configuración muestra el mensaje propio de esa clave", () => {
		const adapted = adaptServerValidation(validationError({ y_field: ["Missing value"] }));
		expect(adapted?.errors).toEqual({ y_field: FIELD_MESSAGES.y_field });
		expect(JSON.stringify(adapted?.errors)).not.toContain("Missing value");
	});

	it("adapta varias claves a la vez, cada una con su texto", () => {
		const adapted = adaptServerValidation(
			validationError({ x_bucket: ["Value must be one of: value"], x_step: ["Missing value"] }),
		);
		expect(adapted?.errors).toEqual({
			x_bucket: FIELD_MESSAGES.x_bucket,
			x_step: FIELD_MESSAGES.x_step,
		});
	});

	it("cada clave de la configuración tiene su texto en español", () => {
		for (const key of CHART_CONFIG_KEYS) {
			expect(FIELD_MESSAGES[key]).toMatch(/\S/);
		}
	});

	it("el texto del servidor sobrevive sólo como detalle técnico, con su clave", () => {
		const adapted = adaptServerValidation(validationError({ y_field: ["Missing value", "otro"] }));
		expect(adapted?.technical).toEqual(["y_field: Missing value"]);
	});
});

describe("adaptServerValidation — las claves que no son de un campo", () => {
	it("el tope de tiempo (`query`) da un aviso propio, no un campo en rojo", () => {
		const adapted = adaptServerValidation(
			validationError({ query: ["canceling statement due to statement timeout"] }),
		);
		expect(adapted?.errors).toEqual({});
		expect(adapted?.notices).toEqual([NOTICE_MESSAGES.query]);
		expect(adapted?.technical).toEqual(["query: canceling statement due to statement timeout"]);
	});

	it("una clave propia de la vista (`title`) da su aviso", () => {
		const adapted = adaptServerValidation(validationError({ title: ["Missing value"] }));
		expect(adapted?.notices).toEqual([NOTICE_MESSAGES.title]);
	});

	it("una clave desconocida, o `__extras`, da el aviso general, una sola vez", () => {
		const adapted = adaptServerValidation(
			validationError({
				resource_id: ["Not found"],
				__extras: { grafico_raro: ["The input field grafico_raro was not expected."] },
			}),
		);
		expect(adapted?.errors).toEqual({});
		expect(adapted?.notices).toEqual([GENERAL_NOTICE]);
		expect(adapted?.technical).toEqual([
			"resource_id: Not found",
			"grafico_raro: The input field grafico_raro was not expected.",
		]);
	});

	it("el `message` y el `__type` del sobre no son claves culpables", () => {
		const adapted = adaptServerValidation(validationError({ version: ["x"] }));
		expect(adapted?.errors).toEqual({ version: FIELD_MESSAGES.version });
		expect(adapted?.notices).toEqual([]);
		expect(adapted?.technical).toEqual(["version: x"]);
	});

	it("una clave sin mensaje igual se adapta, sin detalle técnico", () => {
		const adapted = adaptServerValidation(validationError({ chart_type: [42] }));
		expect(adapted?.errors).toEqual({ chart_type: FIELD_MESSAGES.chart_type });
		expect(adapted?.technical).toEqual([]);
	});
});
