// El borrador del formulario del publicador y su paso a la configuración del contrato.
//
// El formulario no edita una `ChartConfig` a medio armar: edita un **borrador** con las claves de la
// interfaz —el paso es texto, porque es lo que hay en un `<input>`— y lo reconcilia contra las familias de
// tipos de las columnas. Reconciliar es lo que evita ofrecer una combinación que el servidor rechazaría:
// si la columna nueva es de texto, «por trimestre» deja de existir y el borrador cae a «valor tal cual» en
// vez de quedarse en un estado inválido que el publicador no puede explicar.
//
// La última pieza es la que habilita «Guardar» (contrato, «Precisiones de L11»): la **clave canónica** de
// la configuración. Se compara contra la que se previsualizó con éxito, así que cualquier cambio posterior
// la invalida y el publicador no guarda algo que no vio. Con la vista previa automática (L28) la comparación
// se hace sobre las claves de **datos** (`canonicalDataKey`), porque la presentación se aplica sin consulta.
//
// Este módulo es puro: no conoce el cliente, ni el formulario, ni el gráfico.

import type { DatastoreField } from "$lib/api/datastore";
import {
	CHART_CONFIG_KEYS,
	CHART_CONTRACT_VERSION,
	type ChartConfig,
	type ChartConfigValidation,
	type ChartType,
	foldCaseAvailable,
	validateChartConfig,
	type XBucket,
	xBucketsFor,
	xColumnsFor,
	Y_AGGREGATES,
	type YAggregate,
	yColumnsFor,
} from "./contract";

/** Los topes del título y la descripción de la vista. Son de UX del portal, como los del dataset: CKAN no los pone. */
export const MAX_VIEW_TITLE_LENGTH = 120;
export const MAX_VIEW_DESCRIPTION_LENGTH = 500;

/** Los errores del título y la descripción de la vista; un campo sin error no aparece. */
export interface ViewTextErrors {
	title?: string;
	description?: string;
}

/**
 * El título es obligatorio y los dos tienen tope. Se valida en el portal y no se deja al servidor: su
 * rechazo llega en inglés y sin campo («title: Missing value»), y el publicador no sabe qué corregir (L37).
 * Se mide sobre el texto recortado, que es el que se guarda.
 */
export function validateViewText(title: string, description: string): ViewTextErrors {
	const errors: ViewTextErrors = {};
	const cleanTitle = title.trim();
	if (cleanTitle === "") errors.title = "Escriba un título para la vista.";
	else if (cleanTitle.length > MAX_VIEW_TITLE_LENGTH)
		errors.title = `El título no puede superar los ${MAX_VIEW_TITLE_LENGTH} caracteres.`;
	if (description.trim().length > MAX_VIEW_DESCRIPTION_LENGTH)
		errors.description = `La descripción no puede superar los ${MAX_VIEW_DESCRIPTION_LENGTH} caracteres.`;
	return errors;
}

/**
 * Los cálculos que la tabla admite: contar filas siempre, y cada uno de los demás sólo si hay al menos una
 * columna que lo acepte. Sin columnas numéricas, sumar o promediar no tienen sobre qué hacerse (L37, punto 6).
 */
export function yAggregatesFor(fields: readonly DatastoreField[]): YAggregate[] {
	return Y_AGGREGATES.filter((agg) => agg === "count" || yColumnsFor(fields, agg).length > 0);
}

/** Lo que el formulario edita: todo lo que una `ChartConfig` tiene, con el paso como texto. */
export interface ChartDraft {
	version: number;
	chart_type: ChartType;
	x_field: string;
	x_bucket: XBucket | "";
	x_step: string;
	x_fold_case: boolean;
	y_agg: YAggregate;
	y_field: string;
	include_null: boolean;
}

/** El borrador con el que abre el formulario: válido, con un cálculo que no pide columna del eje Y. */
export function emptyChartDraft(fields: readonly DatastoreField[]): ChartDraft {
	return {
		version: CHART_CONTRACT_VERSION,
		chart_type: "bar",
		x_field: xColumnsFor(fields)[0] ?? "",
		x_bucket: "value",
		x_step: "",
		x_fold_case: false,
		y_agg: "count",
		y_field: "",
		include_null: true,
	};
}

/**
 * Ajusta el borrador a lo que las familias permiten, **conservando lo que sigue siendo posible**: el paso
 * sobrevive a un cambio de columna numérica a otra, y unificar mayúsculas sobrevive si la columna nueva
 * también es de texto. Lo que ya no se puede usar se descarta en vez de quedar como error latente.
 */
export function reconcileChartDraft(
	draft: ChartDraft,
	fields: readonly DatastoreField[],
): ChartDraft {
	const field = fields.find((candidate) => candidate.id === draft.x_field);
	const buckets = field ? xBucketsFor(field.type) : ["value" as XBucket];
	const x_bucket = (buckets as string[]).includes(draft.x_bucket)
		? draft.x_bucket
		: (buckets[0] ?? "value");

	// Un cálculo que la tabla no admite —por ejemplo, un promedio guardado cuando ya no hay columnas
	// numéricas— vuelve a contar filas, que siempre se puede.
	const y_agg = yAggregatesFor(fields).includes(draft.y_agg) ? draft.y_agg : "count";
	const yColumns = yColumnsFor(fields, y_agg);
	const y_field =
		y_agg === "count" ? "" : yColumns.includes(draft.y_field) ? draft.y_field : (yColumns[0] ?? "");

	return {
		...draft,
		x_bucket,
		x_step: x_bucket === "number_step" ? draft.x_step : "",
		x_fold_case: draft.x_fold_case && foldCaseAvailable(field, x_bucket),
		y_agg,
		y_field,
	};
}

/**
 * El borrador → la validación del contrato. El paso se convierte a número sólo si lo es: un texto que no
 * se puede leer como número viaja tal cual para que el validador lo explique en su campo («debe ser un
 * número») en vez de confundirlo con un paso faltante.
 */
export function chartConfigFromDraft(
	draft: ChartDraft,
	fields: readonly DatastoreField[],
): ChartConfigValidation {
	const stepText = draft.x_step.trim();
	const step = stepText === "" ? undefined : parseStep(stepText);

	return validateChartConfig(
		{
			version: draft.version,
			chart_type: draft.chart_type,
			x_field: draft.x_field,
			x_bucket: draft.x_bucket === "" ? undefined : draft.x_bucket,
			x_step: step,
			x_fold_case: draft.x_fold_case,
			y_agg: draft.y_agg,
			y_field: draft.y_field.trim() === "" ? undefined : draft.y_field,
			include_null: draft.include_null,
		},
		fields,
	);
}

function parseStep(text: string): number | string {
	const parsed = Number(text);
	return Number.isFinite(parsed) ? parsed : text;
}

/**
 * La identidad de una configuración, para comparar la que se previsualizó con la que está en pantalla.
 *
 * Se arma con las claves del contrato en su orden, así que el orden en que llegaron las propiedades no
 * cambia el resultado (el servidor no promete un orden) y una clave ausente no se confunde con un valor.
 */
export function canonicalConfigKey(config: Partial<ChartConfig> | null | undefined): string | null {
	if (!config) return null;
	return JSON.stringify(CHART_CONFIG_KEYS.map((key) => config[key] ?? null));
}

/**
 * Las claves de la configuración que **cambian los datos** que hay que pedir: todo el contrato menos la
 * presentación. El tipo de gráfico, el título y la descripción se aplican al instante, sin consulta (L28,
 * decisión 1), así que cambiar de barras a líneas no invalida los grupos que ya están dibujados.
 */
export const CHART_DATA_KEYS = CHART_CONFIG_KEYS.filter((key) => key !== "chart_type");

/**
 * La identidad de los **datos** de una configuración: lo que se compara para decidir si lo dibujado
 * corresponde a lo que se ve en pantalla —y por lo tanto si «Guardar» puede habilitarse—, y también lo que
 * se compara para descartar una respuesta que llegó tarde.
 *
 * Es más angosta que `canonicalConfigKey` a propósito: los grupos y sus dos rótulos (L21) salen de estas
 * claves, no del tipo de gráfico.
 */
export function canonicalDataKey(config: Partial<ChartConfig> | null | undefined): string | null {
	if (!config) return null;
	return JSON.stringify(CHART_DATA_KEYS.map((key) => config[key] ?? null));
}

/**
 * La configuración guardada de una vista → el borrador con el que abre el formulario de edición.
 *
 * El paso vuelve del servidor como número y el borrador lo guarda como texto. Lo que la vista no trae no se
 * inventa: quien arma el formulario completa el resto con `emptyChartDraft` y lo reconcilia contra las
 * columnas vigentes.
 */
export function draftFromConfig(config: Partial<ChartConfig>): Partial<ChartDraft> {
	const { x_step, ...rest } = config;
	return x_step === undefined ? rest : { ...rest, x_step: String(x_step) };
}
