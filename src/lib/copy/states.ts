// Cómo se dice el estado de un dataset o de un recurso (`state` de CKAN). Una sola tabla para la ficha,
// la información técnica y la página del recurso.

const STATE_LABELS: Record<string, string> = {
	active: "Activo",
	draft: "Borrador",
	deleted: "Eliminado",
};

/** Etiqueta neutra para un estado que el portal aún no conoce: la fila no se descarta en silencio. */
const UNKNOWN_STATE = "Sin clasificar";

/** Etiqueta del estado, o `null` si el catálogo no trajo ninguno. */
export function stateLabel(state?: string | null): string | null {
	if (!state) return null;
	return STATE_LABELS[state] ?? UNKNOWN_STATE;
}
