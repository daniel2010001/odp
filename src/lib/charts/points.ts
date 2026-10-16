// De filas del DataStore a puntos de un gráfico.

import { parseNumber } from "./columns";

export type ChartType = "bar" | "line" | "pie";
export type Aggregate = "none" | "sum";

export interface ChartPoint {
	label: string;
	value: number;
}

export interface ChartOptions {
	x: string;
	y: string;
	type: ChartType;
	/** Sólo aplica a barras y pastel; una línea grafica siempre las filas tal cual. */
	aggregate: Aggregate;
}

/** Rótulo de un valor de X vacío: el mismo guion que muestra la tabla. */
export const MISSING_X_LABEL = "—";

function xLabel(value: unknown): string {
	if (value === null || value === undefined || value === "") return MISSING_X_LABEL;
	return String(value);
}

/**
 * Construye los puntos del gráfico y cuenta las filas que quedaron fuera (Y vacío o no numérico, y en
 * el pastel además los valores no positivos, que no tienen porción).
 */
export function buildPoints(
	records: readonly Record<string, unknown>[],
	{ x, y, type, aggregate }: ChartOptions,
): { points: ChartPoint[]; skipped: number } {
	let skipped = 0;
	let points: ChartPoint[] = [];
	for (const row of records) {
		const value = parseNumber(row[y]);
		if (value === null || (type === "pie" && value <= 0)) {
			skipped++;
			continue;
		}
		points.push({ label: xLabel(row[x]), value });
	}
	if (aggregate === "sum" && type !== "line") {
		const sums = new Map<string, number>();
		for (const p of points) sums.set(p.label, (sums.get(p.label) ?? 0) + p.value);
		points = [...sums].map(([label, value]) => ({ label, value }));
	}
	return { points, skipped };
}

/** ¿Algún valor de X aparece en más de una fila? Decide si tiene sentido ofrecer «sumar». */
export function hasRepeatedX(records: readonly Record<string, unknown>[], x: string): boolean {
	const seen = new Set<string>();
	for (const row of records) {
		const label = xLabel(row[x]);
		if (seen.has(label)) return true;
		seen.add(label);
	}
	return false;
}
