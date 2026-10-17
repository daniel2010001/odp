// Las reglas del contrato v1 entre el portal y `ckanext-umss` (`odd/tasks/csv-charts.md`, § «El contrato
// entre el portal y `ckanext-umss` (versión 1, 2026-10-17)»).
//
// Cada fila de la tabla del contrato es, al menos, un test: el formulario del publicador tiene que explicar
// el mismo error que el servidor rechazaría, antes de guardar y con la clave culpable.
//
// Tipos de columna: las **familias que reconoce el backend** (O1 sobre CKAN 2.12): numéricos (`numeric`,
// `int2`, `int4`, `int8`, `float4`, `float8`), fechas (`timestamp`, `timestamptz`, `date`) y texto.

import { describe, expect, it } from "vitest";
import type { DatastoreField } from "$lib/api/datastore";
import {
	CHART_CONFIG_KEYS,
	CHART_CONTRACT_VERSION,
	CHART_VIEW_TYPE,
	type ChartConfig,
	fieldFamily,
	foldCaseAvailable,
	groupLabel,
	groupLabels,
	MAX_CHART_GROUPS,
	type NormalizedChartConfig,
	NULL_GROUP_LABEL,
	pickChartConfig,
	validateChartConfig,
	xBucketsFor,
	xColumnsFor,
	yColumnsFor,
} from "./contract";

const f = (id: string, type: string): DatastoreField => ({ id, type });

// `alias_raro` existe para fijar que la familia del portal no es más ancha que la del servidor: `int` no es
// uno de los tipos que el DataStore usa, y queda fuera de la familia numérica del contrato.
const FIELDS: DatastoreField[] = [
	f("_id", "int4"),
	f("departamento", "text"),
	f("codigo", "text"),
	f("monto", "numeric"),
	f("entero", "int4"),
	f("flotante", "float8"),
	f("fecha", "timestamp"),
	f("fecha_dia", "date"),
	f("fecha_hora", "timestamptz"),
	f("alias_raro", "int"),
];

/** La configuración mínima válida de la tabla del contrato. */
const VALID: ChartConfig = {
	version: 1,
	chart_type: "bar",
	x_field: "departamento",
	x_bucket: "value",
	y_agg: "count",
};

function validate(overrides: Record<string, unknown> = {}) {
	return validateChartConfig({ ...VALID, ...overrides }, FIELDS);
}

function errors(overrides: Record<string, unknown> = {}) {
	return validate(overrides).errors;
}

describe("el contrato — constantes", () => {
	it("el view_type y la versión son los que declara el contrato", () => {
		expect(CHART_VIEW_TYPE).toBe("umss_chart");
		expect(CHART_CONTRACT_VERSION).toBe(1);
	});
});

describe("validateChartConfig — una configuración válida", () => {
	it("no deja errores y devuelve la configuración normalizada", () => {
		const result = validate();

		expect(result.valid).toBe(true);
		expect(result.errors).toEqual({});
		expect(result.config).toEqual({
			version: 1,
			chart_type: "bar",
			x_field: "departamento",
			x_bucket: "value",
			x_fold_case: false,
			y_agg: "count",
			include_null: true,
		});
	});

	it("aplica los valores por defecto: x_fold_case=false e include_null=true", () => {
		const config = validate().config as NormalizedChartConfig;

		expect(config.x_fold_case).toBe(false);
		expect(config.include_null).toBe(true);
	});

	it("respeta los valores explícitos de x_fold_case e include_null", () => {
		const result = validate({ x_fold_case: true, include_null: false });

		expect(result.valid).toBe(true);
		expect(result.config?.x_fold_case).toBe(true);
		expect(result.config?.include_null).toBe(false);
	});

	it("una configuración inválida no devuelve configuración normalizada", () => {
		const result = validate({ chart_type: "donut" });

		expect(result.valid).toBe(false);
		expect(result.config).toBeNull();
	});
});

describe("validateChartConfig — version", () => {
	it("es obligatoria", () => {
		expect(errors({ version: undefined })).toHaveProperty("version");
	});

	it("tiene que ser 1", () => {
		expect(errors({ version: 2 })).toHaveProperty("version");
		expect(errors({ version: "1" })).toHaveProperty("version");
	});
});

describe("validateChartConfig — chart_type", () => {
	it("es obligatoria", () => {
		expect(errors({ chart_type: undefined })).toHaveProperty("chart_type");
		expect(errors({ chart_type: "" })).toHaveProperty("chart_type");
	});

	it("sólo admite bar, line o pie", () => {
		for (const type of ["bar", "line", "pie"]) {
			expect(errors({ chart_type: type })).not.toHaveProperty("chart_type");
		}
		expect(errors({ chart_type: "donut" })).toHaveProperty("chart_type");
	});
});

describe("validateChartConfig — x_field", () => {
	it("es obligatoria", () => {
		expect(errors({ x_field: undefined })).toHaveProperty("x_field");
	});

	it("se rechaza un id que no existe en los fields del DataStore", () => {
		expect(errors({ x_field: "no_existe" })).toHaveProperty("x_field");
	});
});

describe("validateChartConfig — x_bucket", () => {
	it("es obligatoria", () => {
		expect(errors({ x_bucket: undefined })).toHaveProperty("x_bucket");
	});

	it("sólo admite value, number_step, year, quarter o month", () => {
		const configForBucket = (bucket: string) => {
			if (bucket === "number_step") return { x_bucket: bucket, x_field: "monto", x_step: 5 };
			if (bucket === "value") return { x_bucket: bucket };
			return { x_bucket: bucket, x_field: "fecha" };
		};
		for (const bucket of ["value", "number_step", "year", "quarter", "month"]) {
			expect(errors(configForBucket(bucket))).not.toHaveProperty("x_bucket");
		}
		expect(errors({ x_bucket: "day" })).toHaveProperty("x_bucket");
	});

	it("number_step exige una columna numeric", () => {
		expect(errors({ x_bucket: "number_step", x_field: "departamento", x_step: 5 })).toHaveProperty(
			"x_bucket",
		);
		expect(errors({ x_bucket: "number_step", x_field: "fecha", x_step: 5 })).toHaveProperty(
			"x_bucket",
		);
		expect(errors({ x_bucket: "number_step", x_field: "monto", x_step: 5 })).not.toHaveProperty(
			"x_bucket",
		);
	});

	it("number_step acepta la familia numérica completa del backend", () => {
		for (const field of ["monto", "entero", "flotante"]) {
			expect(errors({ x_bucket: "number_step", x_field: field, x_step: 5 })).not.toHaveProperty(
				"x_bucket",
			);
		}
	});

	it("un tipo fuera de la familia numérica no sirve para number_step", () => {
		expect(errors({ x_bucket: "number_step", x_field: "alias_raro", x_step: 5 })).toHaveProperty(
			"x_bucket",
		);
	});

	it("year, quarter y month exigen una columna timestamp", () => {
		for (const bucket of ["year", "quarter", "month"]) {
			expect(errors({ x_bucket: bucket, x_field: "departamento" })).toHaveProperty("x_bucket");
			expect(errors({ x_bucket: bucket, x_field: "monto" })).toHaveProperty("x_bucket");
			expect(errors({ x_bucket: bucket, x_field: "fecha" })).not.toHaveProperty("x_bucket");
		}
	});

	it("year, quarter y month aceptan la familia de fechas completa del backend", () => {
		for (const bucket of ["year", "quarter", "month"]) {
			for (const field of ["fecha", "fecha_dia", "fecha_hora"]) {
				expect(errors({ x_bucket: bucket, x_field: field })).not.toHaveProperty("x_bucket");
			}
		}
	});
});

describe("validateChartConfig — x_step", () => {
	it("es obligatoria con number_step", () => {
		expect(errors({ x_bucket: "number_step", x_field: "monto" })).toHaveProperty("x_step");
	});

	it("tiene que ser un número mayor que cero", () => {
		const base = { x_bucket: "number_step", x_field: "monto" };
		for (const step of [0, -1, Number.NaN]) {
			expect(errors({ ...base, x_step: step })).toHaveProperty("x_step");
		}
		expect(errors({ ...base, x_step: "5" })).toHaveProperty("x_step");
		expect(errors({ ...base, x_step: 0.5 })).not.toHaveProperty("x_step");
	});

	it("está prohibida con el resto de las agrupaciones", () => {
		for (const bucket of ["value", "year", "quarter", "month"]) {
			const field = bucket === "value" ? "departamento" : "fecha";
			expect(errors({ x_bucket: bucket, x_field: field, x_step: 5 })).toHaveProperty("x_step");
		}
	});
});

describe("validateChartConfig — x_fold_case", () => {
	it("sólo se permite con value", () => {
		expect(errors({ x_bucket: "year", x_field: "fecha", x_fold_case: true })).toHaveProperty(
			"x_fold_case",
		);
		expect(errors({ x_fold_case: true })).not.toHaveProperty("x_fold_case");
	});

	it("sólo se permite sobre una columna text", () => {
		expect(errors({ x_field: "monto", x_fold_case: true })).toHaveProperty("x_fold_case");
		expect(errors({ x_field: "fecha", x_fold_case: true })).toHaveProperty("x_fold_case");
		// `date` no es `text`: unificar mayúsculas sobre una fecha no significa nada.
		expect(errors({ x_field: "fecha_dia", x_fold_case: true })).toHaveProperty("x_fold_case");
		expect(errors({ x_field: "codigo", x_fold_case: true })).not.toHaveProperty("x_fold_case");
	});

	it("tiene que ser booleano si viene", () => {
		expect(errors({ x_fold_case: "sí" })).toHaveProperty("x_fold_case");
	});
});

describe("validateChartConfig — y_agg", () => {
	it("es obligatoria", () => {
		expect(errors({ y_agg: undefined })).toHaveProperty("y_agg");
	});

	it("sólo admite los seis cálculos del contrato", () => {
		for (const agg of ["count", "count_distinct", "sum", "avg", "min", "max"]) {
			const field = agg === "count" ? undefined : agg === "count_distinct" ? "codigo" : "monto";
			expect(errors({ y_agg: agg, y_field: field })).not.toHaveProperty("y_agg");
		}
		expect(errors({ y_agg: "median" })).toHaveProperty("y_agg");
	});
});

describe("validateChartConfig — y_field", () => {
	it("está prohibida con count (cuenta filas)", () => {
		expect(errors({ y_agg: "count", y_field: "monto" })).toHaveProperty("y_field");
	});

	it("es obligatoria con el resto de los cálculos", () => {
		for (const agg of ["count_distinct", "sum", "avg", "min", "max"]) {
			expect(errors({ y_agg: agg })).toHaveProperty("y_field");
		}
	});

	it("se rechaza un id que no existe en los fields del DataStore", () => {
		expect(errors({ y_agg: "sum", y_field: "no_existe" })).toHaveProperty("y_field");
	});

	it("con count_distinct se acepta cualquier tipo", () => {
		expect(errors({ y_agg: "count_distinct", y_field: "codigo" })).not.toHaveProperty("y_field");
		expect(errors({ y_agg: "count_distinct", y_field: "monto" })).not.toHaveProperty("y_field");
	});

	it("con sum, avg, min y max exige una columna numeric", () => {
		for (const agg of ["sum", "avg", "min", "max"]) {
			expect(errors({ y_agg: agg, y_field: "departamento" })).toHaveProperty("y_field");
			expect(errors({ y_agg: agg, y_field: "fecha" })).toHaveProperty("y_field");
			expect(errors({ y_agg: agg, y_field: "alias_raro" })).toHaveProperty("y_field");
			for (const field of ["monto", "entero", "flotante"]) {
				expect(errors({ y_agg: agg, y_field: field })).not.toHaveProperty("y_field");
			}
		}
	});
});

describe("validateChartConfig — include_null", () => {
	it("tiene que ser booleano si viene", () => {
		expect(errors({ include_null: "sí" })).toHaveProperty("include_null");
		expect(errors({ include_null: false })).not.toHaveProperty("include_null");
	});
});

describe("validateChartConfig — la forma de los errores", () => {
	it("una clave culpable, un mensaje: no se apilan mensajes sobre la misma clave", () => {
		// `number_step` sobre texto con paso inválido: dos claves culpables, un mensaje en cada una.
		const result = errors({ x_bucket: "number_step", x_field: "departamento", x_step: 0 });

		expect(result.x_bucket).toBeTruthy();
		expect(result.x_step).toBeTruthy();
		expect(Object.keys(result).sort()).toEqual(["x_bucket", "x_step"]);
	});

	it("los mensajes están en español formal y explican qué corregir", () => {
		const messages = [
			errors({ x_field: undefined }).x_field,
			errors({ y_agg: "sum", y_field: "departamento" }).y_field,
			errors({ y_agg: "count", y_field: "monto" }).y_field,
			errors({ version: 2 }).version,
		];

		for (const message of messages) {
			expect(typeof message).toBe("string");
			expect(message).toMatch(/^[A-ZÁÉÍÓÚÑ]/);
			expect(message).toMatch(/\.$/);
		}
	});
});

describe("validateChartConfig — entradas que no son un objeto", () => {
	it("no revienta y reporta las claves obligatorias", () => {
		for (const input of [null, undefined, "config", 42, [1, 2]]) {
			const result = validateChartConfig(input, FIELDS);
			expect(result.valid).toBe(false);
			expect(result.errors).toHaveProperty("version");
			expect(result.errors).toHaveProperty("chart_type");
			expect(result.errors).toHaveProperty("x_field");
			expect(result.errors).toHaveProperty("y_agg");
		}
	});
});

describe("pickChartConfig — la config guardada, que el catálogo devuelve plana", () => {
	it("toma las claves del contrato que están al tope del diccionario de la vista", () => {
		const view = {
			id: "v1",
			resource_id: "res-1",
			title: "Empleo por turno",
			view_type: "umss_chart",
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			x_fold_case: false,
			y_agg: "sum",
			y_field: "salario",
			include_null: true,
			plugin: "umss_chart",
			order: 0,
		};

		expect(pickChartConfig(view)).toEqual({
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			x_fold_case: false,
			y_agg: "sum",
			y_field: "salario",
			include_null: true,
		});
	});

	it("no inventa las claves que el catálogo no devolvió ni lee una `config` anidada", () => {
		// La `config` anidada no existe en la respuesta de CKAN: si apareciera, sería de un cliente que se
		// equivocó de forma, y tomarla escondería el error en vez de dejarlo a la vista.
		const config = pickChartConfig({ id: "v1", config: { chart_type: "bar" } });

		expect(config).toEqual({});
		expect(config).not.toHaveProperty("x_step");
		expect(config).not.toHaveProperty("y_field");
	});

	it("las claves del contrato son las nueve de la tabla, en orden", () => {
		expect([...CHART_CONFIG_KEYS]).toEqual([
			"version",
			"chart_type",
			"x_field",
			"x_bucket",
			"x_step",
			"x_fold_case",
			"y_agg",
			"y_field",
			"include_null",
		]);
	});
});

describe("groupLabel — el rótulo que el portal pone a cada key cruda", () => {
	it("el grupo nulo es «Sin dato», cualquiera sea la agrupación", () => {
		expect(NULL_GROUP_LABEL).toBe("Sin dato");
		for (const bucket of ["value", "number_step", "year", "quarter", "month"] as const) {
			expect(groupLabel(null, { bucket })).toBe("Sin dato");
		}
	});

	it("value devuelve el valor tal cual", () => {
		expect(groupLabel("Cochabamba", { bucket: "value" })).toBe("Cochabamba");
		expect(groupLabel("cochabamba", { bucket: "value" })).toBe("cochabamba");
		expect(groupLabel(12, { bucket: "value" })).toBe("12");
	});

	it("number_step rotula el rango semiabierto [k, k + paso)", () => {
		expect(groupLabel(0, { bucket: "number_step", step: 5 })).toBe("[0, 5)");
		expect(groupLabel(5, { bucket: "number_step", step: 5 })).toBe("[5, 10)");
		expect(groupLabel(-5, { bucket: "number_step", step: 5 })).toBe("[-5, 0)");
		expect(groupLabel(0, { bucket: "number_step", step: 0.5 })).toBe("[0, 0.5)");
	});

	it("number_step admite el rótulo «0–5» en vez de «[0, 5)»: cada superficie usa el suyo (L21)", () => {
		expect(groupLabel(0, { bucket: "number_step", step: 5, rangeStyle: "dash" })).toBe("0–5");
		expect(groupLabel(-5, { bucket: "number_step", step: 5, rangeStyle: "dash" })).toBe("-5–0");
		expect(groupLabel(1500, { bucket: "number_step", step: 500, rangeStyle: "dash" })).toBe(
			"1500–2000",
		);
		// Sin elegir, el rótulo es el intervalo semiabierto: no cambia lo ya medido.
		expect(groupLabel(0, { bucket: "number_step", step: 5, rangeStyle: "interval" })).toBe(
			"[0, 5)",
		);
	});

	it("number_step sin un paso válido cae al valor crudo: no inventa un rango", () => {
		expect(groupLabel(7, { bucket: "number_step" })).toBe("7");
		expect(groupLabel(7, { bucket: "number_step", step: 0 })).toBe("7");
	});

	it("year devuelve el año tal cual", () => {
		expect(groupLabel("2024", { bucket: "year" })).toBe("2024");
	});

	it("quarter rotula «N.º trimestre AAAA»", () => {
		expect(groupLabel("2024-Q1", { bucket: "quarter" })).toBe("1.er trimestre 2024");
		expect(groupLabel("2024-Q2", { bucket: "quarter" })).toBe("2.º trimestre 2024");
		expect(groupLabel("2024-Q3", { bucket: "quarter" })).toBe("3.er trimestre 2024");
		expect(groupLabel("2024-Q4", { bucket: "quarter" })).toBe("4.º trimestre 2024");
	});

	it("month rotula «mes AAAA»", () => {
		expect(groupLabel("2024-01", { bucket: "month" })).toBe("enero 2024");
		expect(groupLabel("2024-12", { bucket: "month" })).toBe("diciembre 2024");
	});

	it("una key que no tiene la forma esperada cae al valor crudo, sin inventar", () => {
		expect(groupLabel("raro", { bucket: "quarter" })).toBe("raro");
		expect(groupLabel("2024-13", { bucket: "month" })).toBe("2024-13");
		expect(groupLabel("2024-Q9", { bucket: "quarter" })).toBe("2024-Q9");
	});
});

describe("groupLabels — el eje y el dato exacto, cada uno en su forma (L21)", () => {
	it("un rango numérico va con guion en el eje y como intervalo semiabierto en el tooltip y la tabla", () => {
		expect(groupLabels(1500, { bucket: "number_step", step: 5000 })).toEqual({
			axis: "1500–6500",
			interval: "[1500, 6500)",
		});
		expect(groupLabels(0, { bucket: "number_step", step: 5000 })).toEqual({
			axis: "0–5000",
			interval: "[0, 5000)",
		});
	});

	it("las demás agrupaciones se escriben igual en los dos lugares: no hay rango que distinguir", () => {
		for (const bucket of ["value", "year", "quarter", "month"] as const) {
			const key = bucket === "value" ? "turno" : bucket === "year" ? "2024" : "2024-Q1";
			const labels = groupLabels(key, { bucket });
			expect(labels.axis).toBe(labels.interval);
		}
		expect(groupLabels(null, { bucket: "number_step", step: 5000 })).toEqual({
			axis: NULL_GROUP_LABEL,
			interval: NULL_GROUP_LABEL,
		});
	});
});

describe("validateChartConfig — `_id` es interna del catálogo y no se grafica", () => {
	it("rechaza `_id` como columna del eje X", () => {
		const result = validateChartConfig({ ...VALID, x_field: "_id" }, FIELDS);
		expect(result.valid).toBe(false);
		expect(result.errors.x_field).toBe(
			"La columna «_id» es interna del catálogo y no se puede graficar.",
		);
	});

	it("rechaza `_id` como columna del eje Y", () => {
		const result = validateChartConfig(
			{ ...VALID, y_agg: "count_distinct", y_field: "_id" },
			FIELDS,
		);
		expect(result.valid).toBe(false);
		expect(result.errors.y_field).toBe(
			"La columna «_id» es interna del catálogo y no se puede graficar.",
		);
	});
});

describe("las familias de tipos y lo que cada una habilita en el formulario", () => {
	it("clasifica con las mismas familias que el backend, ni más anchas ni más angostas (L17)", () => {
		expect(fieldFamily("numeric")).toBe("numeric");
		expect(fieldFamily("int2")).toBe("numeric");
		expect(fieldFamily("int8")).toBe("numeric");
		expect(fieldFamily("float4")).toBe("numeric");
		expect(fieldFamily("timestamp")).toBe("timestamp");
		expect(fieldFamily("timestamptz")).toBe("timestamp");
		expect(fieldFamily("date")).toBe("timestamp");
		expect(fieldFamily("text")).toBe("text");
		// L17 cerró la duda de L16: las familias quedan como el servidor las nombra, y `int` —que no es
		// uno de los tipos que el contrato reconoce— no entra por la ventana.
		expect(fieldFamily("int")).toBe("text");
	});

	it("cada familia ofrece sólo las agrupaciones que admite", () => {
		expect(xBucketsFor("text")).toEqual(["value"]);
		expect(xBucketsFor("numeric")).toEqual(["value", "number_step"]);
		expect(xBucketsFor("timestamp")).toEqual(["value", "year", "quarter", "month"]);
		expect(xBucketsFor("int")).toEqual(["value"]);
	});

	it("el eje X ofrece todas las columnas menos la interna del catálogo", () => {
		expect(xColumnsFor(FIELDS)).toEqual([
			"departamento",
			"codigo",
			"monto",
			"entero",
			"flotante",
			"fecha",
			"fecha_dia",
			"fecha_hora",
			"alias_raro",
		]);
	});

	it("contar filas no ofrece columna del eje Y", () => {
		expect(yColumnsFor(FIELDS, "count")).toEqual([]);
	});

	it("contar distintos ofrece cualquier columna, la interna incluida nunca", () => {
		const columns = yColumnsFor(FIELDS, "count_distinct");

		expect(columns).toContain("codigo");
		expect(columns).toContain("fecha");
		expect(columns).not.toContain("_id");
	});

	it("sumar, promediar, mínimo y máximo ofrecen sólo columnas numéricas", () => {
		for (const agg of ["sum", "avg", "min", "max"] as const) {
			expect(yColumnsFor(FIELDS, agg)).toEqual(["monto", "entero", "flotante"]);
		}
	});

	it("unificar mayúsculas sólo se ofrece con «valor» sobre una columna de texto", () => {
		expect(foldCaseAvailable(f("letra", "text"), "value")).toBe(true);
		expect(foldCaseAvailable(f("letra", "text"), "quarter")).toBe(false);
		expect(foldCaseAvailable(f("monto", "numeric"), "value")).toBe(false);
		expect(foldCaseAvailable(undefined, "value")).toBe(false);
	});

	it("el tope de grupos del contrato es una constante del portal", () => {
		expect(MAX_CHART_GROUPS).toBe(500);
	});
});
