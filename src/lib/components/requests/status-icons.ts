// El icono de cada estado de una solicitud: el mismo juego de `RequestHistory`. Vive acá, y no dentro de cada
// chip o ficha, porque lo leen el chip, el cuadro de estado y la línea de tiempo de las variantes nuevas.

import { Ban, CircleCheck, CircleHelp, CircleX, Clock, Undo2 } from "@lucide/svelte";
import type { Component } from "svelte";
import type { PublicationRequestStatus } from "$lib/api/publication";

const ICONOS: Record<PublicationRequestStatus, Component> = {
	pending: Clock,
	approved: CircleCheck,
	rejected: CircleX,
	cancelled: Undo2,
	annulled: Ban,
};

/** El icono del estado; uno desconocido cae a una interrogación neutral, como en el historial. */
export function statusIcon(status: PublicationRequestStatus): Component {
	return Object.hasOwn(ICONOS, status) ? ICONOS[status] : CircleHelp;
}
