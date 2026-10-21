// Copia de la solicitud de publicación: la oración que resume **en qué está** una solicitud.
//
// ─── Por qué vive acá y no en la página ──────────────────────────────
// La oración vive aparte de la página para que cualquier superficie que muestre la tarjeta llame a
// **esta misma función** y no repita la cadena a mano: una copia puede mostrar un texto que la
// aplicación nunca renderiza. Los tests de la página siguen mirando el texto por el DOM.
//
// ─── El vocabulario es el de la tabla, no el de la página ────────────
// Por eso la frase se arma con un `switch` **exhaustivo**: si la tabla gana un estado, esto no
// compila hasta que se lo nombre. Es la misma forma que usa el módulo de fallos, y evita que un estado
// nuevo se muestre como «desconocido» sin que nadie se entere.

import type { PublicationRequest } from "$lib/api/publication";

export function estadoDeLaSolicitud(solicitud: PublicationRequest): string {
	switch (solicitud.status) {
		case "pending":
			return solicitud.requested_by_name
				? `Pendiente de revisión, pedida por ${solicitud.requested_by_name}.`
				: "Pendiente de revisión.";
		case "approved":
			return solicitud.approved_by_name
				? `Publicada, aprobada por ${solicitud.approved_by_name}.`
				: "Publicada.";
		case "rejected": {
			const quien = solicitud.approved_by_name
				? `Rechazada por ${solicitud.approved_by_name}.`
				: "Rechazada.";
			// El **motivo** es lo único que le dice al editor qué corregir: sin esto, el motivo que el
			// aprobador escribió no aparecería en ninguna parte de la página.
			const motivo = solicitud.comments?.trim();
			return motivo ? `${quien} Motivo: ${motivo}` : quien;
		}
		case "cancelled":
			return "Retirada por quien la pidió.";
		case "annulled":
			return "Anulada: la solicitud dejó de estar vigente.";
		default: {
			const exhaustivo: never = solicitud.status;
			void exhaustivo;
			return "Estado desconocido.";
		}
	}
}

/** La insignia del estado de una solicitud: su rótulo y los colores de la forma de insignia. */
export interface InsigniaDeSolicitud {
	label: string;
	tone: string;
}

/**
 * La insignia del estado de la solicitud para el hero: **una** por estado y **exhaustiva** igual que
 * `estadoDeLaSolicitud` — si la tabla gana un estado, esto no compila hasta nombrarlo. `null` para los
 * estados que no son un estado visible en el hero (`approved` ya se lee como el dataset publicado, y
 * `cancelled` vuelve a ofrecer la acción de pedir) y para la **ausencia** de solicitud (`undefined`).
 *
 * La usan las dos superficies que dibujan el estado: la unidad del hero (`RequestPublicationControl`) y la
 * fila de insignias, cuando quien mira no puede pedir y por eso no hay unidad.
 */
export function insigniaDeLaSolicitud(
	estado: PublicationRequest["status"] | undefined,
): InsigniaDeSolicitud | null {
	switch (estado) {
		case "pending":
			return {
				label: "Solicitud pendiente",
				tone: "border-primary/20 bg-primary/10 text-primary",
			};
		case "rejected":
			return {
				label: "Solicitud rechazada",
				tone: "border-destructive/20 bg-destructive/10 text-destructive",
			};
		case "annulled":
			return {
				label: "Solicitud anulada",
				tone: "border-border bg-muted text-muted-foreground",
			};
		case "approved":
		case "cancelled":
		case undefined:
			return null;
		default: {
			const exhaustivo: never = estado;
			void exhaustivo;
			return null;
		}
	}
}

/**
 * Cómo se nombra a una persona del historial. `null` o vacío = sin asignar: no hay nada que decir y el
 * llamador omite la frase. `"unknown"` = asignada pero irresoluble (contrato de `publication.ts`): una
 * etiqueta neutra, nunca el id crudo.
 */
export const USUARIO_NO_DISPONIBLE = "usuario no disponible";

export function nombreDelHistorial(nombre: string | null | undefined): string | null {
	const limpio = nombre?.trim();
	if (!limpio) return null;
	return limpio === "unknown" ? USUARIO_NO_DISPONIBLE : limpio;
}

const MOTIVOS_DE_ANULACION: Record<string, string> = {
	dataset_deleted: "El dataset se eliminó.",
	published_by_another_path: "El dataset se publicó por otra vía.",
};

/**
 * Por qué se anuló una solicitud, a partir del token `motive` del contrato. Un token que el portal no
 * conoce no se muestra crudo: se cae a la oración general, la misma de `estadoDeLaSolicitud`.
 */
export function motivoDeAnulacion(motivo: string | null | undefined): string {
	return (motivo && MOTIVOS_DE_ANULACION[motivo]) || "La solicitud dejó de estar vigente.";
}

/** Cómo se rotula una entrada del historial: el estado, su color y la palabra de la línea de resolución. */
export interface EstadoDelHistorial {
	label: string;
	tone: string;
	/** El rótulo de la línea «resuelta»; `null` si el estado no se resolvió (pendiente o desconocido). */
	resolvio: string | null;
}

const ESTADOS_DEL_HISTORIAL: Record<PublicationRequest["status"], EstadoDelHistorial> = {
	pending: { label: "Pendiente", tone: "text-primary", resolvio: null },
	approved: {
		label: "Aprobada",
		tone: "text-positive",
		resolvio: "Aprobada",
	},
	rejected: { label: "Rechazada", tone: "text-destructive", resolvio: "Rechazada" },
	cancelled: { label: "Retirada", tone: "text-muted-foreground", resolvio: "Retirada" },
	annulled: { label: "Anulada", tone: "text-muted-foreground", resolvio: "Anulada" },
};

const ESTADO_DESCONOCIDO: EstadoDelHistorial = {
	label: "Estado desconocido",
	tone: "text-muted-foreground",
	resolvio: null,
};

/**
 * El rótulo de una entrada del historial. Un estado que el portal no conoce (el catálogo puede ganar uno
 * antes que el portal) se lee neutral —«Estado desconocido», sin mostrar el token crudo— y nunca lanza.
 */
export function estadoDelHistorial(estado: PublicationRequest["status"]): EstadoDelHistorial {
	return Object.hasOwn(ESTADOS_DEL_HISTORIAL, estado)
		? ESTADOS_DEL_HISTORIAL[estado]
		: ESTADO_DESCONOCIDO;
}
