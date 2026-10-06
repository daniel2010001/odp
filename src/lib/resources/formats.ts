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
 * Formatos distintos de un dataset, normalizados: recorte, mayúsculas y dedupe en orden de aparición.
 *
 * Es la **única** implementación del pipeline. `formatChips` la usa para recortar, y la card la usa
 * para saber qué formatos quedaron fuera del recorte: una sola verdad sobre cuándo dos formatos son
 * el mismo (`" csv "` es `"CSV"`), sin duplicar la normalización en los consumidores.
 *
 * **Descarta los valores en blanco** en vez de listar un formato vacío (`" "` es *truthy*). El orden
 * es el de primera aparición: no se inventa un orden nuevo, se conserva el de los recursos.
 */
export function normalizeFormats(resources: Pick<CkanResource, "format">[] | undefined): string[] {
	return [
		...new Set(
			(resources ?? [])
				.map((resource) => resource.format?.trim().toUpperCase())
				.filter((format): format is string => Boolean(format)),
		),
	];
}

/**
 * Resume los formatos de los recursos de un dataset para los chips de la card.
 *
 * Tres decisiones, las tres medidas contra el comportamiento anterior:
 *
 * - **Deduplica**, no distingue mayúsculas y minúsculas, y **recorta** antes de comparar: dos recursos
 *   CSV son un chip «CSV», y `" csv "` es el mismo formato que `"CSV"`. Eso vive en
 *   `normalizeFormats`, la única implementación.
 * - **Descarta los valores en blanco** en vez de pintar un chip vacío (`" "` es *truthy*).
 * - **`more` cuenta formatos distintos, no recursos.** Es lo que dice el chip «+N más»: cuántos
 *   formatos quedaron fuera del tope. Contar recursos infla el número con repetidos y anuncia un
 *   formato oculto que no existe.
 *
 * El orden es el de primera aparición: no se inventa un orden nuevo, se conserva el de los recursos.
 */
export function formatChips(resources: Pick<CkanResource, "format">[] | undefined): FormatChips {
	const unique = normalizeFormats(resources);
	const chips = unique.slice(0, MAX_FORMAT_CHIPS);

	return { chips, more: unique.length - chips.length };
}
