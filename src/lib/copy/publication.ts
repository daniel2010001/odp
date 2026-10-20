// Copia de la solicitud de publicación: la oración que resume **en qué está** una solicitud.
//
// ─── Por qué vive acá y no en la página ──────────────────────────────
// La oración la muestran **dos** superficies: la tarjeta de la ficha del dataset (la página real) y
// la hoja de revisión `/dev/publication`, que tiene que mostrar la misma tarjeta para que el autor
// juzgue dónde va el control de decidir. Una hoja que repite la cadena a mano puede mostrar un texto
// que la aplicación nunca renderiza: por eso la hoja llama a **esta misma función**, y estos tests de
// la página siguen mirando el texto por el DOM.
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
