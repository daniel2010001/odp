import type { CkanResource } from "$lib/types/ckan";
import { resourceKind } from "./kind";

/** Chip que aporta un enlace: el mismo rótulo que la card y la página del recurso. */
export const LINK_CHIP = "Enlace";

type ChipSource = Pick<CkanResource, "format" | "url_type">;

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
 * Chips distintos de un dataset: recorte, mayúsculas y dedupe en orden de aparición.
 *
 * **Un enlace no aporta su formato, aporta «Enlace»** (decisión del autor, 2026-09-22, la misma que
 * aplican la card y la página del recurso vía `resourceKind`): el `format` de una URL externa es lo
 * que alguien declaró, no algo que el portal haya visto, y mostrarlo en la búsqueda para negarlo al
 * entrar a la ficha era un dato falso (2026-10-18). Sólo un archivo subido conserva su formato. Un
 * enlace sin formato también es «Enlace»: lo decide el tipo, y todos los enlaces son un solo chip.
 *
 * Es la **única** implementación del pipeline. `formatChips` la usa para recortar, y la card la usa
 * para saber qué formatos quedaron fuera del recorte: una sola verdad sobre cuándo dos formatos son
 * el mismo (`" csv "` es `"CSV"`), sin duplicar la normalización en los consumidores.
 *
 * **Descarta los valores en blanco** en vez de listar un formato vacío (`" "` es *truthy*). El orden
 * es el de primera aparición: no se inventa un orden nuevo, se conserva el de los recursos.
 */
export function normalizeFormats(resources: ChipSource[] | undefined): string[] {
	return [
		...new Set(
			(resources ?? [])
				.map((resource) =>
					resourceKind(resource) === "link" ? LINK_CHIP : resource.format?.trim().toUpperCase(),
				)
				.filter((chip): chip is string => Boolean(chip)),
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
export function formatChips(resources: ChipSource[] | undefined): FormatChips {
	const unique = normalizeFormats(resources);
	const chips = unique.slice(0, MAX_FORMAT_CHIPS);

	return { chips, more: unique.length - chips.length };
}
