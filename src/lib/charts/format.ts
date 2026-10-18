// Cómo se escribe un número en un gráfico: es-BO, con a lo sumo dos decimales.
//
// El servidor devuelve los valores sin redondear (un promedio llega como `8496.754044…`, L23), así que el
// redondeo es del portal. Vive acá, y no en cada superficie, para que el tooltip, la tabla accesible, el total
// de la dona y el eje vertical digan el mismo número.

import { NULL_GROUP_LABEL } from "./contract";

const FORMAT = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 });

/**
 * El número como lo lee el visitante: `8496.754044` → «8.496,75». Un valor ausente o no finito (el servidor
 * devuelve `null` en lugar de `NaN`, L23) se rotula como el resto de lo que no tiene dato, nunca como «NaN».
 */
export function formatChartNumber(value: number | string | null | undefined): string {
	if (value === null || value === undefined || value === "") return NULL_GROUP_LABEL;
	const number = typeof value === "number" ? value : Number(value);
	return Number.isFinite(number) ? FORMAT.format(number) : NULL_GROUP_LABEL;
}
