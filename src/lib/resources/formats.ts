import type { CkanResource } from "$lib/types/ckan";

/** Resumen de formatos para los chips de una card de dataset. */
export interface FormatChips {
	/** Formatos distintos que se muestran, en orden de primera aparición y ya normalizados. */
	chips: string[];
	/** Cuántos formatos **distintos** quedaron fuera por el tope. */
	more: number;
}

/** Tope de chips visibles. */
export const MAX_FORMAT_CHIPS = 4;

/**
 * Resume los formatos de los recursos de un dataset para los chips de la card.
 *
 * Tres decisiones, las tres medidas contra el comportamiento anterior:
 *
 * - **Deduplica**, no distingue mayúsculas y minúsculas, y **recorta** antes de comparar: dos recursos
 *   CSV son un chip «CSV», y `" csv "` es el mismo formato que `"CSV"`.
 * - **Descarta los valores en blanco** en vez de pintar un chip vacío (`" "` es *truthy*).
 * - **`more` cuenta formatos distintos, no recursos.** Es lo que dice el chip «+N más»: cuántos
 *   formatos quedaron fuera del tope. Contar recursos infla el número con repetidos y anuncia un
 *   formato oculto que no existe.
 *
 * El orden es el de primera aparición: no se inventa un orden nuevo, se conserva el de los recursos.
 */
export function formatChips(resources: Pick<CkanResource, "format">[] | undefined): FormatChips {
	const unique = [
		...new Set(
			(resources ?? [])
				.map((resource) => resource.format?.trim().toUpperCase())
				.filter((format): format is string => Boolean(format)),
		),
	];
	const chips = unique.slice(0, MAX_FORMAT_CHIPS);

	return { chips, more: unique.length - chips.length };
}
