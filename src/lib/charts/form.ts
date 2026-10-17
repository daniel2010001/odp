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
// la invalida y el publicador no guarda algo que no vio.
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
	type YAggregate,
	yColumnsFor,
} from "./contract";

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

	const yColumns = yColumnsFor(fields, draft.y_agg);
	const y_field =
		draft.y_agg === "count"
			? ""
			: yColumns.includes(draft.y_field)
				? draft.y_field
				: (yColumns[0] ?? "");

	return {
		...draft,
		x_bucket,
		x_step: x_bucket === "number_step" ? draft.x_step : "",
		x_fold_case: draft.x_fold_case && foldCaseAvailable(field, x_bucket),
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
