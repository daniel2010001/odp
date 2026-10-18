// Los valores escritos sobre las barras: en prueba en `/dev/chart-values` (regla 8), apagados por defecto.
//
// Dos decisiones viven acá para que el componente y el playground digan lo mismo: cómo se abrevia un número
// largo y cuándo un rótulo no cabe sobre su barra.

import { formatChartNumber } from "./format";

export type ValueLabelsMode = "off" | "on" | "fit";
export type ValueLabelsPlacement = "outside" | "inside";
export type ValueLabelsFormat = "full" | "compact";

export interface BarValueLabels {
	mode: ValueLabelsMode;
	placement: ValueLabelsPlacement;
	format: ValueLabelsFormat;
}

const ONE_DECIMAL = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 });

/**
 * La abreviatura es propia y no `notation: "compact"`: en es-BO, `Intl` escribe «1,2 K» y «45,2 k» (medido el
 * 2026-10-18), dos unidades distintas para la misma magnitud.
 */
function formatCompact(value: number | string | null | undefined): string {
	const number = typeof value === "number" ? value : Number(value);
	if (value === null || value === undefined || value === "" || !Number.isFinite(number)) {
		return formatChartNumber(value);
	}
	const abs = Math.abs(number);
	if (abs >= 1_000_000) return `${ONE_DECIMAL.format(number / 1_000_000)} M`;
	if (abs >= 1_000) return `${ONE_DECIMAL.format(number / 1_000)} mil`;
	return formatChartNumber(number);
}

export function barValueFormatter(
	format: ValueLabelsFormat,
): (value: number | string | null | undefined) => string {
	return format === "compact" ? formatCompact : formatChartNumber;
}

/** El ancho medio de un carácter del rótulo (11 px, cifras tabulares) y el aire a cada lado. */
const CHAR_WIDTH_PX = 6.6;
const SIDE_GAP_PX = 2;

/** ¿Cabe el rótulo más largo sobre la barra? Es una estimación por caracteres, no una medición del texto. */
export function valueLabelsFit(bandwidth: number, labels: string[]): boolean {
	if (bandwidth <= 0 || labels.length === 0) return false;
	const widest = Math.max(...labels.map((label) => label.length));
	return widest * CHAR_WIDTH_PX + SIDE_GAP_PX * 2 <= bandwidth;
}
