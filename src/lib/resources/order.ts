import type { CkanResource } from "$lib/types/ckan";

/** Lo que necesita quien navega entre los recursos de un dataset. */
export interface ResourceNeighbours<T> {
	/** Los recursos, **ordenados por la `position` de CKAN**. */
	ordered: T[];
	/** Posición del recurso actual en `ordered` (0-based), o `-1` si no está. */
	index: number;
	/** El anterior en el orden del dataset, o nada si el actual es el primero. */
	previous?: T;
	/** El siguiente, o nada si el actual es el último. */
	next?: T;
}

/**
 * Vecinos de un recurso dentro de su dataset.
 *
 * Es una función **pura** a propósito: el orden y los extremos son decisiones, y se prueban sin montar la
 * página (misma forma que `resourceKind` y `formatChips`).
 *
 * Tres decisiones, las tres medidas contra lo que el catálogo manda:
 *
 * - **El orden es el del dataset, no el de la respuesta.** CKAN devuelve `position` en cada recurso y hoy
 *   coincide con el orden del arreglo, pero el portal no puede depender de que coincida: se ordena por
 *   `position`.
 * - **No envuelve en los extremos.** Pasar del último al primero con «siguiente» daría un salto que el
 *   usuario no pidió; en el extremo correspondiente no hay acción.
 * - **Un recurso sin `position` va al final** y no rompe el orden ni la cuenta (el orden entre varios sin
 *   `position` es el de entrada, porque `sort` es estable).
 * - **Sin recurso actual** (mientras la página carga, o si el id no está en la lista) no hay vecinos: el
 *   índice queda en `-1` y quien consume decide qué mostrar.
 */
export function resourceNeighbours<T extends { id: string; position?: number }>(
	resources: T[] | undefined,
	currentId: string | undefined,
): ResourceNeighbours<T> {
	const ordered = [...(resources ?? [])].sort(
		(a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER),
	);
	const index = ordered.findIndex((resource) => resource.id === currentId);

	return {
		ordered,
		index,
		previous: index > 0 ? ordered[index - 1] : undefined,
		next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined,
	};
}

/**
 * Etiqueta del selector: «Recurso 4 de 5».
 *
 * Con el recurso actual fuera de la lista devuelve sólo el total, en vez de inventar un número.
 */
export function resourcePositionLabel(index: number, total: number): string {
	return index >= 0 ? `Recurso ${index + 1} de ${total}` : `${total} recursos`;
}

/** Tipo del recurso tal como lo consume la página, para no repetir el `Pick` en cada firma. */
export type OrderableResource = Pick<CkanResource, "id" | "position" | "name" | "format">;
