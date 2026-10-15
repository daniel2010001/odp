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
