// Fixtures de la hoja de revisión de publicación (`/dev/publication`). Sólo datos: ninguna lógica de
// producto vive acá. Los tipos salen de los componentes reales, así que si el vocabulario de una
// solicitud cambia, estas fixtures dejan de compilar.

import type { PublicationQueueItem } from "$lib/components/dataset/PublicationQueue.svelte";
import type { PublicationRequest } from "$lib/components/dataset/RequestPublicationControl.svelte";
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

export const COLA: PublicationQueueItem[] = [
	{
		id: "req-1",
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
		dataset_title: "Presupuesto de investigación 2026",
		organization_title: OTRA_ORGANIZACION.title,
		requested_by: OTRO_SOLICITANTE_ID,
		requested_by_name: "editor.economicas",
		created_at: "2026-10-03T00:00:00.000000",
		status: "pending",
		comments: null,
	},
];

export function decidedRow(item: PublicationQueueItem, approve: boolean): PublicationQueueItem {
	return { ...item, status: approve ? "approved" : "rejected", comments: null };
}
