// El contrato entre el portal y `ckanext-umss` (versión 1), del lado del portal.
//
// Fuente versionada: `odd/tasks/csv-charts.md`, § «El contrato entre el portal y `ckanext-umss` (versión 1,
// 2026-10-17)». Este módulo es la forma en TypeScript de ese contrato y **las mismas reglas** que el plugin
// aplica del lado del servidor, para que el formulario del publicador pueda explicar el error en la clave
// culpable antes de guardar, en vez de que CKAN lo rechace después.
//
// Es puro: no conoce el cliente de CKAN ni el DataStore, sólo recibe los `fields` que el DataStore ya
// devolvió. Los tipos de columna que mira son **las familias que el backend reconoce** (medido por la sesión
// de `odp-docker`, O1 sobre CKAN 2.12): «numérico» es `numeric`, `int2`, `int4`, `int8`, `float4` o `float8`;
// «fecha» es `timestamp`, `timestamptz` o `date`; y todo lo demás cuenta como texto, salvo que `x_fold_case`
// exige exactamente `text`. Las familias no se ensanchan para adivinar: la regla tiene que ser la misma que
// aplica el servidor, ni más ancha ni más angosta (L17 cerró la duda de L16 sobre `int`).
//
// Lo que este módulo **no** hace: consultar, agrupar ni rotular valores del eje Y. La agregación la hace la
// base (S6) y el portal sólo arma la configuración y rotula las `key` que vuelven.

import type { DatastoreField } from "$lib/api/datastore";

/** El `view_type` que registra el plugin `umss_chart` en `ckanext-umss`. */
export const CHART_VIEW_TYPE = "umss_chart";

/** La versión del contrato que este módulo valida. Un cambio de contrato sube este número. */
export const CHART_CONTRACT_VERSION = 1;

/**
 * El tope de grupos de una respuesta: el contrato corta en **500 grupos** y lo declara con
 * `truncated: true`. Es una constante del portal (L12, punto 4) porque el formulario tiene que poder
 * explicar el recorte sin pedirlo.
 */
export const MAX_CHART_GROUPS = 500;

export const CHART_TYPES = ["bar", "line", "pie"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const X_BUCKETS = ["value", "number_step", "year", "quarter", "month"] as const;
export type XBucket = (typeof X_BUCKETS)[number];

export const Y_AGGREGATES = ["count", "count_distinct", "sum", "avg", "min", "max"] as const;
export type YAggregate = (typeof Y_AGGREGATES)[number];

/**
 * Las familias de tipos que el contrato reconoce, **tal como las mide el backend** (O1 sobre CKAN 2.12):
 * «numérico» y «fecha». Todo lo demás cuenta como texto, salvo que `x_fold_case` exige exactamente `text`.
 */
const NUMERIC_TYPES = new Set(["numeric", "int2", "int4", "int8", "float4", "float8"]);
const TIMESTAMP_TYPES = new Set(["timestamp", "timestamptz", "date"]);

/** La familia de una columna, con los tres nombres que el formulario necesita distinguir. */
export type FieldFamily = "numeric" | "timestamp" | "text";

/**
 * La familia de un tipo del DataStore. Todo lo que el contrato no reconoce cae a texto, igual que en el
 * servidor: es la familia que sólo admite «valor tal cual» (y, si el tipo es `text` de verdad, unificar
 * mayúsculas).
 */
export function fieldFamily(type: string): FieldFamily {
	if (NUMERIC_TYPES.has(type)) return "numeric";
	if (TIMESTAMP_TYPES.has(type)) return "timestamp";
	return "text";
}

/** Las agrupaciones del eje X que admite cada familia de columna (contrato v1, tabla de claves). */
export function xBucketsFor(type: string): XBucket[] {
	switch (fieldFamily(type)) {
		case "numeric":
			return ["value", "number_step"];
		case "timestamp":
			return ["value", "year", "quarter", "month"];
		default:
			return ["value"];
	}
}

/** Las columnas que se ofrecen como eje X: todas menos la interna del catálogo. */
export function xColumnsFor(fields: readonly DatastoreField[]): string[] {
	return fields.filter((field) => field.id !== INTERNAL_FIELD_ID).map((field) => field.id);
}

/**
 * Las columnas que se ofrecen como eje Y para un cálculo dado: ninguna con `count` (cuenta filas),
 * cualquiera con `count_distinct`, y sólo numéricas con `sum`/`avg`/`min`/`max`.
 */
export function yColumnsFor(fields: readonly DatastoreField[], agg: YAggregate): string[] {
	if (agg === "count") return [];
	return fields
		.filter((field) => field.id !== INTERNAL_FIELD_ID)
		.filter((field) => agg === "count_distinct" || fieldFamily(field.type) === "numeric")
		.map((field) => field.id);
}

/**
 * Si el interruptor de unificar mayúsculas tiene sentido: sólo con `value` sobre una columna `text`
 * (el contrato es más angosto que la familia: `varchar` no es un tipo del DataStore, pero si algún día
 * apareciera, no habilita el interruptor).
 */
export function foldCaseAvailable(
	field: DatastoreField | undefined,
	bucket: XBucket | "",
): boolean {
	return bucket === "value" && field?.type === "text";
}

/**
 * La configuración de una vista `umss_chart`, con claves planas y escalares: CKAN guarda en `config` sólo
 * lo que el `schema` del plugin declara, y así es como la vista se lee de vuelta sin perder nada (L9, L10).
 */
export interface ChartConfig {
	version: number;
	chart_type: ChartType;
	x_field: string;
	x_bucket: XBucket;
	/** Sólo con `x_bucket: "number_step"`; número mayor que cero. */
	x_step?: number;
	/** Sólo con `value` sobre una columna `text`. Por defecto `false`. */
	x_fold_case?: boolean;
	y_agg: YAggregate;
	/** Prohibida con `count`; obligatoria con el resto de los cálculos. */
	y_field?: string;
	/** Si es `true`, las filas con X nulo forman un grupo propio. Por defecto `true`. */
	include_null?: boolean;
}

/** La configuración tal como vuelve del servidor: los valores por defecto ya están aplicados. */
export interface NormalizedChartConfig extends Omit<ChartConfig, "x_fold_case" | "include_null"> {
	x_fold_case: boolean;
	include_null: boolean;
}

/** La `key` cruda de un grupo: el portal es quien la rotula (`groupLabel`). */
export type ChartGroupKey = string | number | null;

export interface ChartGroup {
	key: ChartGroupKey;
	value: number;
}

/** La respuesta de `umss_chart_data`, en sus dos formas de llamada. */
export interface ChartData {
	version: number;
	config: NormalizedChartConfig;
	groups: ChartGroup[];
	truncated: boolean;
	total_rows: number;
}

/** Una clave de la configuración: es también la clave culpable de un `ValidationError` del catálogo. */
export type ChartConfigKey = keyof ChartConfig;

/** Un mensaje por clave culpable. Vacío significa que la configuración es válida. */
export type ChartConfigErrors = Partial<Record<ChartConfigKey, string>>;

export interface ChartConfigValidation {
	valid: boolean;
	errors: ChartConfigErrors;
	/** La configuración con los valores por defecto aplicados, o `null` si no es válida. */
	config: NormalizedChartConfig | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Ausente es `undefined`, `null` o una cadena en blanco: una clave vacía no es un valor elegido. */
function absent(value: unknown): boolean {
	return (
		value === undefined || value === null || (typeof value === "string" && value.trim() === "")
	);
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
	return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isPositiveNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * La columna que CKAN numera por su cuenta en cada tabla del DataStore. No es un dato del recurso, así que no se
 * grafica en ningún eje (contrato v1, L12).
 */
export const INTERNAL_FIELD_ID = "_id";
const INTERNAL_FIELD_MESSAGE = "La columna «_id» es interna del catálogo y no se puede graficar.";

/**
 * Valida una configuración contra las reglas del contrato v1, **con los `fields` del DataStore a la vista**.
 *
 * Las reglas condicionales (tipo de columna) sólo se evalúan cuando la clave de la que dependen ya es
 * válida: si `x_field` no existe, no tiene sentido reclamar además que `number_step` necesita una columna
 * numérica. Cada clave culpable lleva **un** mensaje, en español formal, y nunca se apilan.
 *
 * Acepta `unknown` a propósito: es lo que llega de un formulario en construcción o de la `config` guardada
 * en una vista, y una entrada que no es un objeto no debe reventar sino reportar las claves obligatorias.
 */
export function validateChartConfig(
	raw: unknown,
	fields: readonly DatastoreField[],
): ChartConfigValidation {
	const record = isRecord(raw) ? raw : {};
	const errors: ChartConfigErrors = {};
	const fieldsById = new Map(fields.map((field) => [field.id, field]));

	// version — obligatoria, y la única que este módulo sabe leer.
	const version = record.version;
	if (absent(version)) {
		errors.version = "Indique la versión del contrato de la vista.";
	} else if (version !== CHART_CONTRACT_VERSION) {
		errors.version = "La versión de la vista debe ser 1.";
	}

	// chart_type — obligatoria.
	const chartType = record.chart_type;
	if (absent(chartType)) {
		errors.chart_type = "Elija el tipo de gráfico: barra, línea o pastel.";
	} else if (!isOneOf(CHART_TYPES, chartType)) {
		errors.chart_type = "Elija un tipo de gráfico válido: barra, línea o pastel.";
	}

	// x_field — obligatoria y tiene que existir en los fields del DataStore.
	const xField = record.x_field;
	const xFieldDef = typeof xField === "string" ? fieldsById.get(xField) : undefined;
	if (absent(xField)) {
		errors.x_field = "Elija la columna del eje X.";
	} else if (xField === INTERNAL_FIELD_ID) {
		errors.x_field = INTERNAL_FIELD_MESSAGE;
	} else if (!xFieldDef) {
		errors.x_field = `La columna «${String(xField)}» no existe en la tabla del recurso.`;
	}

	// x_bucket — obligatoria; number_step exige numeric, year/quarter/month exigen timestamp.
	const bucket = record.x_bucket;
	const bucketIsValid = isOneOf(X_BUCKETS, bucket);
	if (absent(bucket)) {
		errors.x_bucket = "Elija cómo agrupar el eje X.";
	} else if (!bucketIsValid) {
		errors.x_bucket =
			"Elija una agrupación válida para el eje X: valor, paso numérico, año, trimestre o mes.";
	} else if (xFieldDef && bucket === "number_step" && !NUMERIC_TYPES.has(xFieldDef.type)) {
		errors.x_bucket =
			"Agrupar por paso requiere una columna numérica; elija una columna numérica o cambie la agrupación.";
	} else if (
		xFieldDef &&
		(bucket === "year" || bucket === "quarter" || bucket === "month") &&
		!TIMESTAMP_TYPES.has(xFieldDef.type)
	) {
		errors.x_bucket =
			"Agrupar por año, trimestre o mes requiere una columna de fecha; elija una columna de fecha o cambie la agrupación.";
	}

	// x_step — obligatoria sólo con number_step, y prohibida con el resto.
	const step = record.x_step;
	if (bucketIsValid) {
		if (bucket === "number_step") {
			if (absent(step)) {
				errors.x_step = "Indique el paso del eje X.";
			} else if (typeof step !== "number" || !Number.isFinite(step)) {
				errors.x_step = "El paso del eje X debe ser un número.";
			} else if (step <= 0) {
				errors.x_step = "El paso del eje X debe ser mayor que cero.";
			}
		} else if (!absent(step)) {
			errors.x_step = "El paso del eje X sólo aplica cuando se agrupa por paso.";
		}
	}

	// x_fold_case — por defecto false; sólo con value sobre una columna text.
	const foldCase = record.x_fold_case;
	if (!absent(foldCase) && typeof foldCase !== "boolean") {
		errors.x_fold_case = "Unificar mayúsculas debe ser verdadero o falso.";
	} else if (foldCase === true && bucketIsValid) {
		if (bucket !== "value") {
			errors.x_fold_case = "Unificar mayúsculas sólo aplica cuando se agrupa por valor.";
		} else if (xFieldDef && xFieldDef.type !== "text") {
			errors.x_fold_case = "Unificar mayúsculas sólo aplica a una columna de texto.";
		}
	}

	// y_agg — obligatoria.
	const yAgg = record.y_agg;
	const aggIsValid = isOneOf(Y_AGGREGATES, yAgg);
	if (absent(yAgg)) {
		errors.y_agg = "Elija cómo calcular el eje Y.";
	} else if (!aggIsValid) {
		errors.y_agg =
			"Elija un cálculo válido para el eje Y: contar, contar distintos, sumar, promediar, mínimo o máximo.";
	}

	// y_field — prohibida con count, cualquier tipo con count_distinct, numeric con el resto.
	const yField = record.y_field;
	const yFieldDef = typeof yField === "string" ? fieldsById.get(yField) : undefined;
	if (aggIsValid) {
		if (yAgg === "count") {
			if (!absent(yField)) {
				errors.y_field = "Al contar filas no se elige una columna del eje Y.";
			}
		} else if (absent(yField)) {
			errors.y_field = "Elija la columna del eje Y.";
		} else if (yField === INTERNAL_FIELD_ID) {
			errors.y_field = INTERNAL_FIELD_MESSAGE;
		} else if (!yFieldDef) {
			errors.y_field = `La columna «${String(yField)}» no existe en la tabla del recurso.`;
		} else if (yAgg !== "count_distinct" && !NUMERIC_TYPES.has(yFieldDef.type)) {
			errors.y_field =
				"Sumar, promediar, obtener el mínimo o el máximo requiere una columna numérica.";
		}
	}

	// include_null — por defecto true.
	const includeNull = record.include_null;
	if (!absent(includeNull) && typeof includeNull !== "boolean") {
		errors.include_null = "Incluir las filas sin dato debe ser verdadero o falso.";
	}

	const valid = Object.keys(errors).length === 0;
	return {
		valid,
		errors,
		config: valid
			? {
					version: CHART_CONTRACT_VERSION,
					chart_type: chartType as ChartType,
					x_field: xField as string,
					x_bucket: bucket as XBucket,
					...(bucket === "number_step" ? { x_step: step as number } : {}),
					x_fold_case: foldCase === true,
					y_agg: yAgg as YAggregate,
					...(yAgg === "count" ? {} : { y_field: yField as string }),
					include_null: includeNull !== false,
				}
			: null,
	};
}

// ─── La forma plana de la vista ─────────────────────────────────────────

/** Las claves de la configuración, en el orden del contrato. */
export const CHART_CONFIG_KEYS = [
	"version",
	"chart_type",
	"x_field",
	"x_bucket",
	"x_step",
	"x_fold_case",
	"y_agg",
	"y_field",
	"include_null",
] as const satisfies readonly ChartConfigKey[];

/**
 * Saca la configuración de un diccionario **plano**, como lo devuelve el catálogo.
 *
 * `resource_view_list` y `resource_view_show` devuelven las claves de la config **al tope** del diccionario
 * de la vista, al lado de `id`, `title` o `view_type` —no dentro de un objeto `config`— (medido por la
 * sesión del backend, O1 sobre CKAN 2.12). Esta función toma las del contrato y descarta el resto, para que
 * el portal pueda tipar la vista sin arrastrar metadatos de CKAN ni inventar un campo que la API no tiene.
 *
 * Las claves presentes vienen tipadas del servidor (`version` y `x_step` como número, los booleanos como
 * tales, y los valores por defecto aplicados), pero el resultado es `Partial` a propósito: quien lea una
 * vista debería poder convivir con una incompleta en vez de suponer que está entera.
 */
export function pickChartConfig(source: Record<string, unknown>): Partial<ChartConfig> {
	const config: Partial<ChartConfig> = {};
	const draft = config as Record<string, unknown>;
	for (const key of CHART_CONFIG_KEYS) {
		if (source[key] !== undefined) {
			draft[key] = source[key];
		}
	}
	return config;
}

// ─── Rótulos ────────────────────────────────────────────────────────────

/** El rótulo del grupo nulo: las filas sin valor en X forman un grupo propio (`include_null`). */
export const NULL_GROUP_LABEL = "Sin dato";

const MONTHS = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
] as const;

const QUARTER_ORDINALS = ["1.er", "2.º", "3.er", "4.º"] as const;

/** `2024-Q1` → `1.er trimestre 2024`; `2024-01` → `enero 2024`. */
const QUARTER = /^(\d{4})-Q([1-4])$/;
const MONTH = /^(\d{4})-(\d{2})$/;

export interface ChartLabelOptions {
	bucket: XBucket;
	/** El paso del eje X, necesario para rotular un rango de `number_step`. */
	step?: number;
	/**
	 * Cómo se escribe un rango numérico. Las dos formas dicen lo mismo —el límite inferior es parte del
	 * rango y el superior no— y la elección es del autor al revisar el formulario (L12); por defecto se
	 * mantiene el intervalo semiabierto, que es el que ya estaba medido.
	 */
	rangeStyle?: RangeLabelStyle;
}

/** `[0, 5)` o «0–5»: dos formas del mismo rango semiabierto. */
export const RANGE_LABEL_STYLES = ["interval", "dash"] as const;
export type RangeLabelStyle = (typeof RANGE_LABEL_STYLES)[number];

/**
 * El rótulo de una `key` cruda del servidor, según cómo se agrupó el eje X.
 *
 * El contrato deja la `key` cruda a propósito (el servidor no sabe de idiomas ni de formato): `value`
 * devuelve el valor tal cual (en minúsculas si `x_fold_case`), `number_step` devuelve el límite inferior
 * del rango semiabierto `[k, k + x_step)`, `year` → `"2024"`, `quarter` → `"2024-Q1"` y `month` →
 * `"2024-01"`. Acá se convierten en el texto que ve el visitante.
 *
 * Una `key` que no tiene la forma esperada se muestra **cruda**, nunca se inventa un rótulo: es más honesto
 * un `"2024-13"` visible que un «diciembre 2024» falso.
 */
export function groupLabel(
	key: ChartGroupKey | undefined,
	{ bucket, step, rangeStyle = "interval" }: ChartLabelOptions,
): string {
	if (key === null || key === undefined) return NULL_GROUP_LABEL;

	const text = String(key);
	switch (bucket) {
		case "value":
			return text;
		case "number_step": {
			const lower = typeof key === "number" ? key : Number(text);
			if (!Number.isFinite(lower) || !isPositiveNumber(step)) return text;
			const upper = lower + step;
			return rangeStyle === "dash" ? `${lower}–${upper}` : `[${lower}, ${upper})`;
		}
		case "year":
			return text;
		case "quarter": {
			const match = QUARTER.exec(text);
			if (!match) return text;
			return `${QUARTER_ORDINALS[Number(match[2]) - 1]} trimestre ${match[1]}`;
		}
		case "month": {
			const match = MONTH.exec(text);
			const month = match ? Number(match[2]) : 0;
			if (!match || month < 1 || month > 12) return text;
			return `${MONTHS[month - 1]} ${match[1]}`;
		}
		default:
			return text;
	}
}
