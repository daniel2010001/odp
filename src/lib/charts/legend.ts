// La leyenda de la dona. LayerChart la pinta como **una sola fila** sin partir (`white-space: nowrap`), centrada
// con `translateX(-50%)`: con 8 tipos mide más de 1.000 px y se sale del gráfico por los dos lados, y en móvil
// ensancha la página (S20: 743 px de `scrollWidth` a 375 px). Dos decisiones viven acá: cuándo cabe en una fila
// y cuándo conviene sacarla del gráfico, a un bloque propio debajo que se parte en renglones.

/** Rótulo a 12 px (`text-xs`, Poppins): ancho medio de un carácter. */
const CHAR_WIDTH_PX = 7;
/** El punto de color (16 px) y su separación del rótulo (4 px). */
const SWATCH_PX = 20;
/** La separación entre dos ítems de la fila. */
const ITEM_GAP_PX = 16;

export type LegendLayout = "inline" | "stacked";

/** El ancho que ocuparía la leyenda en una sola fila. */
export function inlineLegendWidth(labels: readonly string[]): number {
	const items = labels.reduce((sum, label) => sum + SWATCH_PX + label.length * CHAR_WIDTH_PX, 0);
	return items + ITEM_GAP_PX * Math.max(0, labels.length - 1);
}

/**
 * «inline» deja la leyenda de la biblioteca (el aspecto de escritorio, sin cambios); «stacked» la saca del
 * gráfico y la pone debajo, en renglones. Un ancho sin medir (0) no decide: se queda en una fila.
 */
export function legendLayout(labels: readonly string[], containerWidth: number): LegendLayout {
	if (containerWidth <= 0) return "inline";
	return inlineLegendWidth(labels) <= containerWidth ? "inline" : "stacked";
}
