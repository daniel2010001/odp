// El adaptador del `ValidationError` del servidor a la forma del formulario.
//
// El contrato (v1) dice que una configuración inválida vuelve como `ValidationError` **con la clave
// culpable**, y el catálogo la manda con un arreglo de mensajes por clave (`{"y_field": ["…"]}`). El
// formulario muestra un texto por campo, así que esta es la única traducción entre las dos formas (L12,
// punto 3): una clave de la configuración, un mensaje.
//
// Dos cosas que no hace, a propósito:
//  · **no adivina la clave**: lo que no es una clave de la configuración (`title`, `match`, `__extras`)
//    no se cuelga de un campo del gráfico; se devuelve aparte para que la superficie decida si lo
//    muestra como aviso general;
//  · **no inventa un error de validación**: un 403, un timeout o un `Error` cualquiera no se adaptan, y
//    quien llama sigue su camino de fallo (autorización, catálogo no disponible) en vez de pintar campos
//    en rojo por algo que no es de un campo.

import { CkanApiError } from "$lib/types/api";
import { CHART_CONFIG_KEYS, type ChartConfigErrors } from "./contract";

/** Cuando el servidor rechaza una clave sin decir por qué, el campo no queda mudo. */
export const UNNAMED_FIELD_MESSAGE = "El catálogo rechazó este campo.";

export interface AdaptedServerValidation {
	/** Los mensajes que corresponden a una clave de la configuración. */
	errors: ChartConfigErrors;
	/** Los de claves que no son de la configuración, ya aplanados como «clave: mensaje». */
	rest: string[];
}

const configKeys = new Set<string>(CHART_CONFIG_KEYS);

/** Los mensajes de texto de un valor que el catálogo pudo haber mandado como arreglo, objeto o texto. */
function messagesOf(value: unknown): string[] {
	if (typeof value === "string") return value.trim() === "" ? [] : [value.trim()];
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter((entry) => entry !== "");
}

/**
 * El `payload` del error del catálogo → un mensaje por clave culpable, o `null` si no hay nada que se
 * pueda mostrar bajo un campo (porque el error no es de validación, o porque no nombra ninguna clave).
 */
export function adaptServerValidation(err: unknown): AdaptedServerValidation | null {
	if (!(err instanceof CkanApiError)) return null;
	const payload = err.payload;
	if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
	if (err.ckanType !== "Validation Error") return null;

	const errors: ChartConfigErrors = {};
	const rest: string[] = [];

	for (const [key, value] of Object.entries(payload)) {
		// `message` y `__type` son el sobre de la respuesta, no claves culpables.
		if (key === "message" || key === "__type") continue;

		if (key === "__extras") {
			// Es donde el catálogo junta las claves que el `schema` del plugin no declara: lo que importa
			// es cuál era la clave, no el campo del formulario (que no existe).
			if (value !== null && typeof value === "object" && !Array.isArray(value)) {
				for (const [extraKey, extraValue] of Object.entries(value)) {
					for (const message of messagesOf(extraValue)) {
						rest.push(`${extraKey}: ${message}`);
					}
				}
			} else {
				for (const message of messagesOf(value)) rest.push(message);
			}
			continue;
		}

		const messages = messagesOf(value);
		if (configKeys.has(key)) {
			errors[key as keyof ChartConfigErrors] = messages[0] ?? UNNAMED_FIELD_MESSAGE;
		} else if (messages.length > 0) {
			rest.push(`${key}: ${messages[0]}`);
		}
	}

	if (Object.keys(errors).length === 0 && rest.length === 0) return null;
	return { errors, rest };
}
