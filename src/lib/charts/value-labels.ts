// Los valores escritos sobre las barras (elección del autor, 2026-10-18): encima, en formato compacto y sólo si
// caben. Dos decisiones viven acá: cómo se abrevia un número largo y cuándo un rótulo no cabe sobre su barra.

import { formatChartNumber } from "./format";

const SIGNIFICANT_DIGITS = 3;
const SIGNIFICANT = new Intl.NumberFormat("es-BO", {
	maximumSignificantDigits: SIGNIFICANT_DIGITS,
});

const UNITS = [
	{ size: 1_000_000_000, suffix: "mil M" },
	{ size: 1_000_000, suffix: "M" },
	{ size: 1_000, suffix: "mil" },
];

/**
 * La abreviatura es propia y no `notation: "compact"`: en es-BO, `Intl` escribe «1,2 K» y «45,2 k» (medido el
 * 2026-10-18), dos unidades distintas para la misma magnitud.
 *
 * Tres cifras significativas y no un decimal fijo: con un decimal, 1.049 se leía «1 mil», un 4,7 % menos (duda del
 * autor sobre el redondeo, 2026-10-18). Con tres, el error queda por debajo del 0,5 %, y el valor exacto sigue en el
 * tooltip y en la tabla. La unidad se elige sobre el valor **ya redondeado**, para que 999.950 sea «1 M» y no
 * «1.000 mil». Por debajo de mil no se abrevia.
 */
export function formatCompactNumber(value: number | string | null | undefined): string {
	const number = typeof value === "number" ? value : Number(value);
	if (value === null || value === undefined || value === "" || !Number.isFinite(number)) {
		return formatChartNumber(value);
	}
	const rounded = Number(Math.abs(number).toPrecision(SIGNIFICANT_DIGITS));
	const unit = UNITS.find((u) => rounded >= u.size);
	return unit
		? `${SIGNIFICANT.format(number / unit.size)} ${unit.suffix}`
		: formatChartNumber(number);
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
