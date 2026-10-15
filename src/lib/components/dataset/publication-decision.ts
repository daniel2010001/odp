// El **contrato** de decidir una solicitud de publicación: qué necesita el control para montarse y qué
// devuelve la acción.
//
// ─── Por qué vive acá y no en la cola ────────────────────────────────
// Vivía en `PublicationQueue.svelte`, que es **un consumidor** del control, no su dueño: eso dejaba al
// componente importando su propio contrato del componente que lo monta, con el ciclo de tipos que eso
// implica. Un módulo sin Svelte corta la dependencia en la dirección correcta, y de paso la ficha puede
// hablar el mismo contrato sin pasar por la cola.
//
// Lo señaló la revisión nativa del PR #67 (`R2-type-ownership-inverted`, linaje
// `review-1481add2b05f1386`), y es de esas observaciones de estructura que se arreglan una vez.

import type { PublicationRequest } from "$lib/api/publication";

/**
 * Lo mínimo que el control necesita de una solicitud: **su id** —para el `for`/`id` del comentario—,
 * **quién la creó** y **si el catálogo le concedería la decisión a quien mira**. El resto de la fila no
 * se usa, y por eso lo pueden montar tanto la cola (`PublicationQueueItem`, su tipo de vista) como la
 * ficha (`PublicationRequest`, la fila cruda del catálogo) sin que ninguno fabrique los campos del otro.
 */
export type DecidableRequest = {
	id: string;
	requested_by?: string | null;
	/**
	 * La respuesta del catálogo sobre **esta** fila: `true` sólo si la decisión le correspondería a quien
	 * mira y la fila sigue pendiente. Ausente en un catálogo anterior al campo, y entonces vale la regla
	 * de siempre —la propia no se decide—.
	 */
	decidable_by_caller?: boolean | null;
};

/**
 * La respuesta de `publication_request_decide`: **sólo** su fila `publication_requests`, el contrato
 * uniforme de las cinco acciones. No trae el dataset; la confirmación de una aprobación viene de releer
 * el **valor almacenado** (`readDataset`), y un rechazo confirma con el estado de su propia fila.
 *
 * Es la **fila del catálogo**, no la vista de la cola: `PublicationQueueItem` agrega los campos ya
 * resueltos para mostrar (título del dataset y de la organización, nombres visibles) que la respuesta no
 * trae.
 */
export type PublicationDecisionResult = PublicationRequest;

/**
 * Registra la decisión sobre una solicitud y devuelve **sólo** su fila `publication_requests`. La
 * aprobación se confirma releyendo el valor almacenado; el rechazo, con el estado de la fila.
 */
export type DecidePublicationRequest = (
	requestId: string,
	approve: boolean,
	comments?: string,
) => Promise<PublicationDecisionResult>;
