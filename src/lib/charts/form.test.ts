// El borrador del formulario del publicador y su paso a una configuración del contrato.
//
// El formulario no guarda una `ChartConfig` a medio armar: guarda un **borrador** con las claves de la
// interfaz (el paso es texto, porque lo que hay en un `<input>` es texto) y lo reconcilia contra las
// familias de tipos de las columnas. Reconciliar es lo que evita ofrecer combinaciones que el servidor
// rechazaría: si la columna nueva es de texto, «por trimestre» deja de ser una opción y el borrador cae a
// «valor tal cual» en vez de quedar en un estado inválido que el publicador no puede explicar.
//
// La última pieza es la que habilita «Guardar» (L11): la clave canónica de la configuración. Se compara
// contra la que se previsualizó con éxito, así que cualquier cambio posterior la invalida.

import { describe, expect, it } from "vitest";
import type { DatastoreField } from "$lib/api/datastore";
import {
	canonicalConfigKey,
	chartConfigFromDraft,
	emptyChartDraft,
	reconcileChartDraft,
} from "./form";

const f = (id: string, type: string): DatastoreField => ({ id, type });

const FIELDS: DatastoreField[] = [
	f("_id", "int4"),
	f("turno", "text"),
	f("cargo", "text"),
	f("horas_mes", "numeric"),
	f("salario", "numeric"),
	f("fecha_ingreso", "timestamp"),
];

describe("emptyChartDraft — de dónde arranca el formulario", () => {
	it("arranca válido, con un cálculo que no necesita columna del eje Y", () => {
		const draft = emptyChartDraft(FIELDS);

		expect(draft).toEqual({
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			x_step: "",
			x_fold_case: false,
			y_agg: "count",
			y_field: "",
			include_null: true,
		});
	});

	it("sin columnas no inventa una: el formulario se queda sin nada que elegir", () => {
		const draft = emptyChartDraft([f("_id", "int4")]);

		expect(draft.x_field).toBe("");
		expect(draft.x_bucket).toBe("value");
	});

	it("la columna interna del catálogo nunca es la primera opción", () => {
		expect(emptyChartDraft(FIELDS).x_field).not.toBe("_id");
	});
});

describe("reconcileChartDraft — el borrador siempre queda en un estado posible", () => {
	const base = emptyChartDraft(FIELDS);

	it("una agrupación que la columna nueva no admite cae a «valor tal cual»", () => {
		const draft = reconcileChartDraft(
			{ ...base, x_field: "fecha_ingreso", x_bucket: "quarter" },
			FIELDS,
		);
		expect(draft.x_bucket).toBe("quarter");

		const aTexto = reconcileChartDraft({ ...base, x_field: "turno", x_bucket: "quarter" }, FIELDS);
		expect(aTexto.x_bucket).toBe("value");

		const aNumero = reconcileChartDraft({ ...base, x_field: "salario", x_bucket: "year" }, FIELDS);
		expect(aNumero.x_bucket).toBe("value");
	});

	it("el paso se conserva sólo con el rango numérico", () => {
		const conPaso = reconcileChartDraft(
			{ ...base, x_field: "salario", x_bucket: "number_step", x_step: "5000" },
			FIELDS,
		);
		expect(conPaso.x_step).toBe("5000");

		const sinPaso = reconcileChartDraft(
			{ ...base, x_field: "salario", x_bucket: "value", x_step: "5000" },
			FIELDS,
		);
		expect(sinPaso.x_step).toBe("");
	});

	it("unificar mayúsculas sólo sobrevive con «valor» en una columna de texto", () => {
		expect(reconcileChartDraft({ ...base, x_fold_case: true }, FIELDS).x_fold_case).toBe(true);
		expect(
			reconcileChartDraft(
				{ ...base, x_field: "salario", x_bucket: "value", x_fold_case: true },
				FIELDS,
			).x_fold_case,
		).toBe(false);
		expect(
			reconcileChartDraft(
				{ ...base, x_field: "salario", x_bucket: "number_step", x_fold_case: true },
				FIELDS,
			).x_fold_case,
		).toBe(false);
	});

	it("contar filas no elige columna del eje Y", () => {
		const draft = reconcileChartDraft({ ...base, y_agg: "count", y_field: "salario" }, FIELDS);
		expect(draft.y_field).toBe("");
	});

	it("un cálculo que necesita columna elige la primera que sirve si no hay una válida", () => {
		const desdeCero = reconcileChartDraft({ ...base, y_agg: "sum" }, FIELDS);
		expect(desdeCero.y_field).toBe("horas_mes");

		const desdeTexto = reconcileChartDraft({ ...base, y_agg: "avg", y_field: "cargo" }, FIELDS);
		expect(desdeTexto.y_field).toBe("horas_mes");
	});

	it("contar distintos acepta la columna de texto que ya estaba elegida", () => {
		const draft = reconcileChartDraft(
			{ ...base, y_agg: "count_distinct", y_field: "turno" },
			FIELDS,
		);
		expect(draft.y_field).toBe("turno");
	});
});

describe("chartConfigFromDraft — el borrador se valida como lo haría el servidor", () => {
	const base = reconcileChartDraft(
		{ ...emptyChartDraft(FIELDS), x_field: "turno", y_agg: "avg", y_field: "salario" },
		FIELDS,
	);

	it("el paso escrito como texto viaja como número", () => {
		const draft = reconcileChartDraft(
			{ ...base, x_field: "salario", x_bucket: "number_step", x_step: "5000" },
			FIELDS,
		);
		const result = chartConfigFromDraft(draft, FIELDS);

		expect(result.valid).toBe(true);
		expect(result.config?.x_step).toBe(5000);
	});

	it("un paso que no es un número se explica en su campo", () => {
		const draft = { ...base, x_bucket: "number_step" as const, x_step: "muchos" };
		const result = chartConfigFromDraft(draft, FIELDS);

		expect(result.valid).toBe(false);
		expect(result.errors.x_step).toBe("El paso del eje X debe ser un número.");
	});

	it("un paso en blanco se reclama como faltante", () => {
		const draft = { ...base, x_bucket: "number_step" as const, x_step: "  " };
		expect(chartConfigFromDraft(draft, FIELDS).errors.x_step).toBe("Indique el paso del eje X.");
	});

	it("sin columna del eje X lo dice en su campo", () => {
		const result = chartConfigFromDraft({ ...base, x_field: "" }, FIELDS);
		expect(result.errors.x_field).toBe("Elija la columna del eje X.");
	});

	it("un borrador válido devuelve la configuración normalizada", () => {
		const result = chartConfigFromDraft(base, FIELDS);

		expect(result.valid).toBe(true);
		expect(result.config).toEqual({
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			x_fold_case: false,
			y_agg: "avg",
			y_field: "salario",
			include_null: true,
		});
	});
});

describe("canonicalConfigKey — la configuración que se previsualizó", () => {
	it("dos configuraciones iguales dan la misma clave aunque cambie el orden de las claves", () => {
		const uno = {
			version: 1,
			chart_type: "bar" as const,
			x_field: "turno",
			x_bucket: "value" as const,
			x_fold_case: false,
			y_agg: "count" as const,
			include_null: true,
		};
		const otro = {
			include_null: true,
			y_agg: "count" as const,
			x_fold_case: false,
			x_bucket: "value" as const,
			x_field: "turno",
			chart_type: "bar" as const,
			version: 1,
		};

		expect(canonicalConfigKey(uno)).toBe(canonicalConfigKey(otro));
	});

	it("cualquier cambio en la configuración cambia la clave", () => {
		const base = {
			version: 1,
			chart_type: "bar" as const,
			x_field: "turno",
			x_bucket: "value" as const,
			x_fold_case: false,
			y_agg: "count" as const,
			include_null: true,
		};

		expect(canonicalConfigKey({ ...base, include_null: false })).not.toBe(canonicalConfigKey(base));
		expect(canonicalConfigKey({ ...base, x_bucket: "number_step", x_step: 100 })).not.toBe(
			canonicalConfigKey(base),
		);
	});

	it("una configuración ausente no tiene clave", () => {
		expect(canonicalConfigKey(null)).toBeNull();
	});
});
