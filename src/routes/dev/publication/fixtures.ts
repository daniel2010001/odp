// Fixtures de la hoja de revisión de publicación (`/dev/publication`). Sólo datos: ninguna lógica de
// producto vive acá. Los tipos salen de los componentes reales, así que si el vocabulario de una
// solicitud cambia, estas fixtures dejan de compilar.

import type { PublicationRequest } from "$lib/api/publication";
import type {
	PublicationDecisionResult,
	PublicationQueueItem,
} from "$lib/components/dataset/PublicationQueue.svelte";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";

export const ORGANIZACION: CkanOrganization = {
	id: "org-1",
	name: "facultad-tecnologia",
	title: "Facultad de Tecnología",
	description: "Datos de ingeniería y tecnología",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
};

export const OTRA_ORGANIZACION: CkanOrganization = {
	...ORGANIZACION,
	id: "org-2",
	name: "facultad-medicina",
	title: "Facultad de Medicina",
};

export function makeDataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: true,
		state: "active",
		organization: ORGANIZACION,
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

export const DATASET = makeDataset();

export const DATASET_PUBLICADO = makeDataset({
	private: false,
	metadata_modified: "2026-10-08T12:00:00.000000",
});

/** Motivo de rechazo que la hoja usa para el estado «rechazada con su motivo». */
export const MOTIVO_RECHAZO = "Los datos personales de los estudiantes aún deben anonimizarse.";

/**
 * Ids de usuario del catálogo: `requested_by` guarda y devuelve el **id**, no el nombre. La hoja de
 * revisión debe ver la misma forma que producción, así que las fixtures separan el id del nombre.
 */
export const ADMINISTRADOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const SOLICITANTE_ID = "7f3c1a2e-9b4d-4e6f-8a10-2c5d6e7f8a90";
export const OTRO_SOLICITANTE_ID = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

/** Nombre visible de quien decide en la cola: no es el autor de las solicitudes de la fixture. */
export const ADMINISTRADOR = "admin.tecnologia";

/** Nombre visible de quien creó la solicitud `req-1`. */
export const SOLICITANTE = "editor.tecnologia";

export function makeRequest(overrides: Partial<PublicationRequest> = {}): PublicationRequest {
	return {
		id: "req-1",
		dataset_id: DATASET.id,
		status: "pending",
		requested_by: SOLICITANTE_ID,
		comments: null,
		created_at: "2026-10-01T00:00:00.000000",
		...overrides,
	};
}

/**
 * Reloj fijo de la hoja de revisión: la antigüedad de la cola no depende de cuándo se mire. Se usa
 * el mismo día del ejemplo del autor («Solicitada el 3 de abril — hace 6 meses»).
 */
export const AHORA_REVISION = new Date("2026-10-07T12:00:00");

export const COLA: PublicationQueueItem[] = [
	{
		id: "req-1",
		dataset_id: DATASET.id,
		dataset_title: "Matrícula 2026",
		organization_title: ORGANIZACION.title,
		requested_by: SOLICITANTE_ID,
		requested_by_name: SOLICITANTE,
		created_at: "2026-10-01T00:00:00.000000",
		status: "pending",
		comments: null,
	},
	{
		id: "req-2",
		dataset_id: "pkg-2",
		dataset_title: "Presupuesto de investigación 2026",
		organization_title: OTRA_ORGANIZACION.title,
		requested_by: OTRO_SOLICITANTE_ID,
		requested_by_name: "editor.economicas",
		created_at: "2026-10-03T00:00:00.000000",
		status: "pending",
		comments: null,
	},
	{
		id: "req-3",
		dataset_id: "pkg-3",
		dataset_title: "Encuesta de satisfacción 2024",
		organization_title: OTRA_ORGANIZACION.title,
		requested_by: OTRO_SOLICITANTE_ID,
		requested_by_name: "editor.arquitectura",
		// Antigua a propósito: con `AHORA_REVISION` la fila dice «hace 6 meses» y lleva el énfasis.
		created_at: "2026-04-03T00:00:00.000000",
		status: "pending",
		comments: null,
	},
];

/**
 * La decisión confirmada devuelve **sólo** su fila: el contrato es uniforme y ninguna acción trae el
 * dataset. La hoja confirma la aprobación con su propia relectura (`leerDataset`).
 */
export function decidedRow(
	item: PublicationQueueItem,
	approve: boolean,
): PublicationDecisionResult {
	return approve
		? { ...item, status: "approved", comments: null }
		: { ...item, status: "rejected", comments: null };
}

/**
 * Cola con solicitudes ya resueltas: la fila decidida muestra quién la decidió, y las canceladas o
 * anuladas no se atribuyen un decisor. Una de las aprobadas llega sin nombre a propósito: la fila
 * muestra la etiqueta neutral en vez de un id crudo.
 */
export const COLA_RESUELTA: PublicationQueueItem[] = [
	{
		id: "req-4",
		dataset_id: DATASET.id,
		dataset_title: "Matrícula 2026",
		organization_title: ORGANIZACION.title,
		requested_by: SOLICITANTE_ID,
		requested_by_name: SOLICITANTE,
		approved_by_name: ADMINISTRADOR,
		created_at: "2026-09-28T00:00:00.000000",
		status: "approved",
		comments: null,
	},
	{
		id: "req-5",
		dataset_id: "pkg-5",
		dataset_title: "Presupuesto de investigación 2026",
		organization_title: OTRA_ORGANIZACION.title,
		requested_by: OTRO_SOLICITANTE_ID,
		requested_by_name: "editor.economicas",
		approved_by_name: ADMINISTRADOR,
		created_at: "2026-09-30T00:00:00.000000",
		status: "rejected",
		comments: MOTIVO_RECHAZO,
	},
	{
		id: "req-6",
		dataset_id: "pkg-6",
		dataset_title: "Encuesta de satisfacción 2024",
		organization_title: OTRA_ORGANIZACION.title,
		requested_by: OTRO_SOLICITANTE_ID,
		requested_by_name: "editor.arquitectura",
		// Sin nombre de quien decidió: la fila usa la etiqueta neutral, nunca un id.
		created_at: "2026-09-15T00:00:00.000000",
		status: "approved",
		comments: null,
	},
	{
		id: "req-7",
		dataset_id: "pkg-7",
		dataset_title: "Calendario académico 2026",
		organization_title: ORGANIZACION.title,
		requested_by: SOLICITANTE_ID,
		requested_by_name: SOLICITANTE,
		created_at: "2026-09-20T00:00:00.000000",
		status: "cancelled",
		comments: null,
	},
	{
		id: "req-8",
		dataset_id: "pkg-8",
		dataset_title: "Inventario de laboratorios 2025",
		organization_title: OTRA_ORGANIZACION.title,
		requested_by: OTRO_SOLICITANTE_ID,
		requested_by_name: "editor.economicas",
		created_at: "2026-09-22T00:00:00.000000",
		status: "annulled",
		comments: null,
	},
];
