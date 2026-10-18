// El paso de rango por defecto (L49). Al agrupar por «Rangos numéricos» con el paso vacío, el formulario
// no abre con un error: propone un paso redondo calculado con el mínimo y el máximo de la columna. Un `1`
// fijo sobre una columna de miles daría miles de grupos, y el servidor corta en `MAX_CHART_GROUPS`.
//
// Este módulo es puro: la lectura del mínimo y el máximo la hace quien lo llama.

/** Cuántos rangos se busca producir entre el mínimo y el máximo. */
export const TARGET_RANGES = 10;

/** Lo que se usa cuando no hay un rango del que calcular (lectura fallida, un solo valor). */
export const FALLBACK_STEP = 1;

/**
 * Un paso «redondo» —1, 2 o 5 por una potencia de diez— que parte `[min, max]` en unos `TARGET_RANGES`
 * rangos. Se redondea hacia arriba, así que nunca hay más rangos que el objetivo. Cae a `FALLBACK_STEP`
 * si los extremos no son finitos o `max` no supera a `min`.
 */
export function defaultRangeStep(min: number, max: number): number {
	if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return FALLBACK_STEP;
	const raw = (max - min) / TARGET_RANGES;
	if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_STEP;

	const exponent = Math.floor(Math.log10(raw));
	const normalized = raw / 10 ** exponent;
	// La tolerancia absorbe el error de punto flotante en los límites exactos (por ejemplo 0,3 / 10).
	const nice = [1, 2, 5, 10].find((candidate) => normalized <= candidate * (1 + 1e-9)) ?? 10;

	// Con exponente negativo se divide: `1 / 10` da 0,1 exacto y `1 * 10 ** -1` también, pero `5 * 10 ** -2`
	// arrastra ruido que `5 / 100` no tiene.
	return exponent < 0 ? nice / 10 ** -exponent : nice * 10 ** exponent;
}
