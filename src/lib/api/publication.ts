// API: las cinco acciones de publicación.
//
// ─── Por qué este módulo existe aparte ───────────────────────────────
// Las cinco acciones viven en el otro repositorio (`odp-docker`, `ckanext-umss`) y **la referencia de
// interfaz es su `PUBLICATION-ACTIONS.md` en `master`**, no un mensaje entre sesiones: ahí están las
// firmas, los argumentos y lo que cada acción devuelve. Si una firma cambia allí, cambia acá.
//
// ─── Lo que este módulo NO hace ─────────────────────────────────────
// **No decide permisos, no valida el motivo y no reescribe errores.** La capacidad la resuelve quien
// monta el control (la página ya la consulta), el motivo obligatorio al rechazar lo exige el formulario
// —y el servidor lo respalda—, y un fallo **sube tal cual**: el portal necesita su `status`, su
// `__type` y su `payload` para distinguir entre rechazos que la prosa no distingue. Un error
// reescrito acá sería información perdida en el único lugar donde todavía era exacta.
//
// ─── El retorno es uniforme ─────────────────────────────────────────
// Las cuatro acciones de escritura devuelven **sólo su fila**, sin el dataset. No es un detalle de
// estilo: la confirmación de una publicación sale de **releer el valor almacenado**, porque medir el
// valor guardado es más fuerte que creerle al escritor. Por eso el tipo de retorno es la fila y nada
// más — y por eso este módulo no ofrece ningún atajo que devuelva el dataset.

import type { CkanClient } from "./client";

/**
 * Los cinco estados de una solicitud, con el vocabulario de la tabla que los guarda.
 *
 * `annulled` **no** es `cancelled`: la anulada perdió su objeto (el dataset se borró o se publicó por
 * otra vía) y la cancelada la retiró quien la pidió. Ninguna de las dos se atribuye un decisor.
 */
export type PublicationRequestStatus =
	| "pending"
	| "approved"
	| "rejected"
	| "cancelled"
	| "annulled";

/**
 * Una fila de `publication_requests`, tal como la devuelven las acciones.
 *
 * **La forma medida es ésta, y se midió antes de cablear:** `_row_dict` devuelve las **columnas de la
tabla** más los dos nombres de presentación, así que una fila trae `id`, `dataset_id`,
 * `requested_visibility`, `status`, `requested_by`, `approved_by`, `comments`, `motive`, `created_at`,
 * `decided_at`, `consumed_at`, `requested_by_name` y `approved_by_name`.
 *
 * `requested_by` y `approved_by` son **ids de usuario**; los nombres visibles viajan aparte
 * (`requested_by_name` / `approved_by_name`), resueltos en una consulta batcheada por llamada. Las dos
 * formas de vacío son distintas y el consumidor no debe colapsarlas: un id **sin asignar** llega como
 * `null`, y un id **asignado que no resuelve** llega como el token `"unknown"` — nunca el id crudo.
 *
 * `motive` es un token estable de por qué se anuló (`dataset_deleted`, `published_by_another_path`), no
 * prosa: el portal lo puede leer para decir *por qué* en vez de mostrar un texto ajeno.
 *
 * `requested_visibility` es la **dirección pedida** y hoy existe en la tabla aunque la degradación esté
 * en `[v1]`: el portal puede mostrarla sin inventar nada el día que la bajada se construya.
 *
 * **Los fallos tienen DOS clases, y se distinguen por la forma — no por el texto** (medido por la par en el
 * contrato y en el código, 2026-10-07):
 *
 *  · **`403`, falla de autorización**: `{"__type": "Authorization Error", "message": "Access denied:
 *    <Rótulo>: …"}`. El **rótulo** congelado es lo declarado como interfaz —las oraciones de atrás quedan
 *    libres—, y son **nueve**. El portal matchea el prefijo y **no** lo renderiza: el copy visible es suyo.
 *  · **`409`, falla de validación**: `{"__type": "Validation Error", …}` con el payload **claveado por
 *    campo** y **sin** el envoltorio `Access denied:`. Acá lo que hay que mirar es **la clave**, no el texto:
 *    `comments` (rechazar sin motivo), `request_id` (**la solicitud ya no está pendiente**: alguien la decidió
 *    mientras se miraba) y `approve` (ausente o no booleano).
 *
 * **Por qué esto importa en la cola y no en un caso raro:** el `409` de `request_id` es la **carrera real**
 * —dos administradores con la misma lista, uno decide primero— y el portal tiene que presentarlo como
 * **«esta solicitud ya fue decidida»** y no como «no se pudo registrar la decisión». La diferencia es si el
 * usuario recarga la lista o reintenta algo que no va a funcionar nunca.
 *
 * **Sin `dataset_title` ni `organization_title` (todavía).** La fila de la cola se lee por el título del
 * dataset y por su organización, y esos dos campos **no** están en la tabla: se pidieron al otro
 * repositorio **antes de cablear la page**, que es el único momento en que la forma puede cambiar. Hasta
 * que lleguen, la page no se cablea contra suposiciones: una lista con la línea principal vacía se ve
 * terminada y no lo está.
 *
 * **Los dos campos ya fueron concedidos** (2026-10-07) y viajan en la **misma** consulta por llamada —la
 * que ya resuelve la organización dueña—, así que no agregan una llamada. Cuando aterricen traen, con la
 * **misma** semántica que los nombres (dos fallbacks distintos en una fila sería una trampa):
 * **campo vacío → `None`**, **seteado pero irresoluble → el token `"unknown"`**, y **nunca el id crudo**
 * — un campo `..._title` no puede contener un `dataset_id`, igual que un `..._name` no puede contener un
 * id de usuario. Se cablea contra eso cuando la par avise que aterrizó.
 */
export interface PublicationRequest {
	id: string;
	dataset_id: string;
	/** La dirección pedida. Existe en la tabla aunque la bajada esté en `[v1]`. */
	requested_visibility?: string | null;
	status: PublicationRequestStatus;
	/** Id de usuario de quien pidió. Sólo alimenta la comparación de cuatro ojos. */
	requested_by?: string | null;
	/** Nombre visible de quien pidió; es lo que la fila muestra. */
	requested_by_name?: string | null;
	/** Id de usuario de quien decidió; sólo tiene sentido en `approved` y `rejected`. */
	approved_by?: string | null;
	/** Nombre visible de quien decidió, o el token `"unknown"` si el id no resuelve. */
	approved_by_name?: string | null;
	comments?: string | null;
	/** Por qué se anuló, como token del contrato. */
	motive?: string | null;
	created_at?: string | null;
	decided_at?: string | null;
	consumed_at?: string | null;
}

export function createPublicationApi(client: CkanClient) {
	return {
		/**
		 * Pide publicar un dataset **privado**. Idempotente del lado del catálogo: si ya hay una
		 * solicitud `pending`, responde ésa en vez de crear otra.
		 */
		async request(datasetId: string, comments?: string): Promise<PublicationRequest> {
			const data: Record<string, unknown> = { dataset_id: datasetId };
			if (comments) data.comments = comments;
			return client.post<PublicationRequest>("publication_request_create", data);
		},

		/** Retira una solicitud propia (`cancelled`). */
		async cancel(requestId: string): Promise<PublicationRequest> {
			return client.post<PublicationRequest>("publication_request_cancel", {
				request_id: requestId,
			});
		},

		/**
		 * Decide una solicitud. Rechazar **exige** motivo: el formulario no lo manda sin él y el
		 * catálogo lo respalda con un `ValidationError`, que sube intacto para que quien llama pueda
		 * decir «falta el motivo» en vez de «no se pudo».
		 */
		async decide(
			requestId: string,
			approve: boolean,
			comments?: string,
		): Promise<PublicationRequest> {
			const data: Record<string, unknown> = { request_id: requestId, approve };
			if (comments) data.comments = comments;
			return client.post<PublicationRequest>("publication_request_decide", data);
		},

		/** El camino directo, reservado a la superadministración de la plataforma. */
		async publish(datasetId: string, comments?: string): Promise<PublicationRequest> {
			const data: Record<string, unknown> = { dataset_id: datasetId };
			if (comments) data.comments = comments;
			return client.post<PublicationRequest>("publication_publish", data);
		},

		/**
		 * Las solicitudes que quien llama puede ver.
		 *
		 * Va por **GET** porque la acción es `side_effect_free`: es una lectura y el verbo lo dice. El
		 * catálogo acota la respuesta a las organizaciones donde la persona administra o edita, más sus
		 * propias solicitudes, así que el filtro por `status` no es un control de acceso.
		 */
		async list(status?: PublicationRequestStatus): Promise<PublicationRequest[]> {
			const params: Record<string, unknown> = {};
			if (status) params.status = status;
			return client.get<PublicationRequest[]>("publication_request_list", params);
		},
	};
}
