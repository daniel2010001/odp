// El adaptador del `ValidationError` del servidor a la forma del formulario.
//
// El contrato (v1) dice que una configuración inválida vuelve como `ValidationError` **con la clave
// culpable**. Lo que garantiza es la **clave**, no el texto: los mensajes llegan en inglés y una parte es de
// CKAN core («Missing value», «Value must be one of: …»), así que no son copy de la interfaz (L18). El campo
// muestra el texto **del portal** para esa clave; el del servidor sólo sobrevive como detalle técnico, que
// es la política de copy del proyecto: la frase humana primero, el dato técnico como secundario.
//
// Dos cosas que no hace, a propósito:
//  · **no adivina la clave**: lo que no es una clave de la configuración (`title`, `query`, `__extras`)
//    no se cuelga de un campo del gráfico; da un aviso aparte;
//  · **no inventa un error de validación**: un 403, un timeout o un `Error` cualquiera no se adaptan, y
//    quien llama sigue su camino de fallo (autorización, catálogo no disponible) en vez de pintar campos
//    en rojo por algo que no es de un campo.

import { CkanApiError } from "$lib/types/api";
import { CHART_CONFIG_KEYS, type ChartConfigErrors, type ChartConfigKey } from "./contract";

/** El texto de cada campo cuando el servidor lo rechaza: el mismo campo, en las palabras del portal. */
export const FIELD_MESSAGES: Record<ChartConfigKey, string> = {
	version: "Esta versión del portal no reconoce el formato de la vista.",
	chart_type: "Elija un tipo de gráfico válido.",
	x_field: "La columna del eje X no se puede usar con esta tabla. Elija otra.",
	x_bucket: "La agrupación del eje X no corresponde al tipo de la columna.",
	x_step: "Revise el tamaño del rango: debe ser un número mayor que cero.",
	x_fold_case: "Unificar mayúsculas sólo se aplica a columnas de texto agrupadas por valor.",
	y_agg: "Elija un cálculo válido para el eje Y.",
	y_field: "La columna del eje Y no corresponde al cálculo elegido.",
	include_null: "Indique si se incluye el grupo «Sin dato».",
};

/** Los avisos de las claves que no son un campo del gráfico. */
export const NOTICE_MESSAGES = {
	query:
		"La consulta tardó demasiado. Elija una agrupación que junte más filas por grupo e intente nuevamente.",
	title: "Revise el título de la vista.",
	description: "Revise la descripción de la vista.",
} as const;

/** El aviso de cualquier otra clave (`resource_id`, `view_id`, `config`, `__extras`). */
export const GENERAL_NOTICE =
	"El catálogo rechazó la configuración. Si el problema continúa, comuníquese con quien administra el portal.";

export interface AdaptedServerValidation {
	/** El texto del portal para cada clave de la configuración que el servidor rechazó. */
	errors: ChartConfigErrors;
	/** Los avisos del portal para las claves que no son un campo, sin repetir. */
	notices: string[];
	/** Lo que dijo el servidor, «clave: mensaje», para el detalle técnico. Nunca es copy de la interfaz. */
	technical: string[];
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
	const notices = new Set<string>();
	const technical: string[] = [];

	for (const [key, value] of Object.entries(payload)) {
		// `message` y `__type` son el sobre de la respuesta, no claves culpables.
		if (key === "message" || key === "__type") continue;

		if (key === "__extras") {
			// Es donde el catálogo junta las claves que el `schema` del plugin no declara: lo que importa
			// es cuál era la clave, no el campo del formulario (que no existe).
			notices.add(GENERAL_NOTICE);
			if (value !== null && typeof value === "object" && !Array.isArray(value)) {
				for (const [extraKey, extraValue] of Object.entries(value)) {
					const [first] = messagesOf(extraValue);
					if (first) technical.push(`${extraKey}: ${first}`);
				}
			} else {
				const [first] = messagesOf(value);
				if (first) technical.push(first);
			}
			continue;
		}

		const [first] = messagesOf(value);
		if (first) technical.push(`${key}: ${first}`);
		if (configKeys.has(key)) {
			errors[key as ChartConfigKey] = FIELD_MESSAGES[key as ChartConfigKey];
		} else {
			notices.add(
				key in NOTICE_MESSAGES
					? NOTICE_MESSAGES[key as keyof typeof NOTICE_MESSAGES]
					: GENERAL_NOTICE,
			);
		}
	}

	if (Object.keys(errors).length === 0 && notices.size === 0) return null;
	return { errors, notices: [...notices], technical };
}
