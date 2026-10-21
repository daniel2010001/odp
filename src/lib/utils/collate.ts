/**
 * Colación compartida para ordenar opciones por su etiqueta visible: español (la «ñ» entre «n» y
 * «o»), sin distinguir acentos ni caja, y con números por valor («Dataset 9» antes de «Dataset 10»).
 */
export const byLabel = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** Copia ordenada por etiqueta; los empates se resuelven por id para que el orden sea estable. */
export function sortByLabel<T>(
	items: readonly T[],
	getLabel: (item: T) => string,
	getId: (item: T) => string,
): T[] {
	return [...items].sort(
		(a, b) => byLabel.compare(getLabel(a), getLabel(b)) || byLabel.compare(getId(a), getId(b)),
	);
}
