// Los rótulos de los ejes: el cálculo y la columna dichos como una frase.
//
// El servidor devuelve `key`s crudas y el portal las rotula (`groupLabel`); con los ejes pasa lo mismo. Un
// eje que se llama «salario» con «avg» encima dice dos identificadores, no qué mide el gráfico. Estos
// rótulos son **texto del portal**, no del catálogo: los nombres de columna son datos del publicador y se
// muestran tal cual, porque son lo que él eligió y lo que el visitante va a reconocer.

import type { XBucket, YAggregate } from "./contract";

const AGGREGATE_NOUNS: Record<YAggregate, string> = {
	count: "Cantidad de filas",
	count_distinct: "Valores distintos",
	sum: "Suma",
	avg: "Promedio",
	min: "Mínimo",
	max: "Máximo",
};

/** Qué mide el eje Y. `count` cuenta filas y por eso no nombra una columna. */
export function yAxisLabel(agg: YAggregate, field?: string): string {
	const noun = AGGREGATE_NOUNS[agg];
	const column = field?.trim() ?? "";
	if (agg === "count" || column === "") return noun;
	return `${noun} de ${column}`;
}

/** Cómo se agrupa el eje X, nombrado con la columna que el publicador eligió. */
export function xAxisLabel(bucket: XBucket, field: string, step?: number): string {
	const column = field.trim();
	switch (bucket) {
		case "number_step":
			return step !== undefined ? `${column} por rango de ${step}` : `${column} por rango`;
		case "year":
			return `Año de ${column}`;
		case "quarter":
			return `Trimestre de ${column}`;
		case "month":
			return `Mes de ${column}`;
		default:
			return column;
	}
}
