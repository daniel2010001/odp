// Copia del panel «Mis datasets»: el estado vacío y sus cuatro formas.
//
// ─── Por qué la copia vive acá y no en la página ─────────────────────
// Estos textos se revisan y se aprueban; si viven dentro del `{#if}` de la página, la única forma de
// leerlos es reproducir a mano cada estado — y hay uno que no se puede reproducir a mano (una sesión
// autenticada a la que le falta el permiso de creación). Al extraerlos a un módulo sin Svelte, la
// hoja de revisión `/dev/copy` los muestra llamando a esta misma función, así que no puede mostrar
// una cadena distinta de la que se publica.
//
// ─── Cuatro estados, tres oraciones ──────────────────────────────────
// La cadena de selección tiene cuatro ramas pero sólo tres oraciones distintas: «puede publicar» y el
// relleno neutro dicen exactamente lo mismo, porque en ambos casos no hay nada que agregar. El
// relleno neutro cubre las preguntas abiertas (organizaciones cargando, carga fallida o pregunta de
// permiso sin responder): mientras no se sepa, la copia no afirma nada sobre el requisito.

/** Encabezado del estado vacío de la grilla de datasets. */
export const EMPTY_STATE_HEADING = "Publique su primer dataset";

/** Etiqueta del llamado a la acción del estado vacío, que sólo aparece con permiso para publicar. */
export const EMPTY_STATE_PRIMARY_ACTION_LABEL = "Publicar dataset";

/** Oración base, siempre presente en las tres variantes. */
export const EMPTY_STATE_BASE_MESSAGE =
	"Aún no ha creado ningún dataset. El asistente lo guía paso a paso.";

/** Requisito que sólo es cierto con la lista de organizaciones terminada, sin error y vacía. */
export const EMPTY_STATE_NO_ORGANIZATION_REQUIREMENT =
	"Publicar un dataset requiere pertenecer a una organización.";

/** Requisito que sólo es cierto con la pregunta de permiso respondida y negada. */
export const EMPTY_STATE_NO_CREATE_PERMISSION_REQUIREMENT =
	"Publicar un dataset requiere rol de editor o administrador en una organización.";

/**
 * Banderas que seleccionan la variante. Cada una ya es una **afirmación** resuelta por la página; la
 * función no vuelve a decidir si se sabe algo, sólo elige el texto.
 */
export interface EmptyStateFlags {
	/** Hay permiso de creación y se puede ofrecer el asistente. */
	canPublish: boolean;
	/** La carga terminó, sin error, y el usuario no pertenece a ninguna organización. */
	confirmedNoOrganizations: boolean;
	/** El usuario pertenece a organizaciones, la pregunta de permiso se respondió y fue negativa. */
	confirmedNoCreatePermission: boolean;
}

/**
 * Elige la oración del estado vacío. Reproduce la cadena original en su mismo orden y precedencia
 * (publicar → organizaciones → permiso → relleno neutro); con varias banderas verdaderas gana la
 * primera.
 */
export function emptyStateMessage(state: EmptyStateFlags): string {
	if (state.canPublish) {
		return EMPTY_STATE_BASE_MESSAGE;
	}
	if (state.confirmedNoOrganizations) {
		return `${EMPTY_STATE_BASE_MESSAGE} ${EMPTY_STATE_NO_ORGANIZATION_REQUIREMENT}`;
	}
	if (state.confirmedNoCreatePermission) {
		return `${EMPTY_STATE_BASE_MESSAGE} ${EMPTY_STATE_NO_CREATE_PERMISSION_REQUIREMENT}`;
	}
	return EMPTY_STATE_BASE_MESSAGE;
}
