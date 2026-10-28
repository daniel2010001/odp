// Datos fijos del playground del panel derecho (`/dev/dataset-panel`, S17 de
// `odd/tasks/prototype-presentation.md`). Un dataset y, por caso, lo que la ficha real sabría de quien mira:
// la solicitud vigente, si puede decidirla, si puede editar y el historial (que el anónimo nunca recibe).

import type { PublicationRequest } from "$lib/api/publication";
import { SHOWCASE_DATASET } from "$lib/mock/data";
import type { CkanPackage } from "$lib/types/ckan";
import { SUMMARY_EXTRA_KEY } from "$lib/utils/dataset-summary";

export type PanelCase = "todas" | "visitante" | "editor" | "publicado";
export const PANEL_CASES: readonly PanelCase[] = ["todas", "visitante", "editor", "publicado"];

export interface PanelScenario {
	label: string;
	/** Qué ve el autor en este caso, en una línea. */
	note: string;
	dataset: CkanPackage;
	request: PublicationRequest | null;
	canDecide: boolean;
	canEdit: boolean;
	history: PublicationRequest[];
}

// La descripción del showcase viene en HTML; la ficha la renderiza como markdown (sin HTML crudo).
const NOTES = `El Observatorio de Movilidad Urbana de Cochabamba es un proyecto interdisciplinario de la Facultad de Ciencias y Tecnología que recopila, procesa y publica datos abiertos sobre movilidad urbana en el área metropolitana de Kanata.

Los datos cubren el período 2019–2025 y se actualizan trimestralmente. Incluyen series temporales de flujos vehiculares por punto de conteo, tiempos de viaje promedio entre zonas de análisis, cobertura del transporte público y estadísticas de accidentalidad vial.

**Limitaciones conocidas:** los datos de 2020 presentan interrupciones por las restricciones de movilidad durante la pandemia.`;

const BASE: CkanPackage = {
	...SHOWCASE_DATASET,
	notes: NOTES,
	extras: [
		...(SHOWCASE_DATASET.extras ?? []),
		{ key: "Frecuencia de actualización", value: "Trimestral" },
		{
			key: SUMMARY_EXTRA_KEY,
			value:
				"Flujos vehiculares, encuestas de origen-destino, transporte público y accidentalidad vial del área metropolitana.",
		},
	],
};

const DATASET_ID = BASE.id;

function row(
	fields: Partial<PublicationRequest> & Pick<PublicationRequest, "id" | "status">,
): PublicationRequest {
	return { dataset_id: DATASET_ID, requested_by_name: "Ana Rojas", ...fields };
}

// La historia, de la más vieja a la más nueva: una primera solicitud rechazada con motivo, otra aprobada (el
// dataset se publicó), el dataset volvió a privado para corregir datos y se pidió de nuevo.
const REJECTED = row({
	id: "req-1",
	status: "rejected",
	created_at: "2026-09-02T10:00:00.000000",
	decided_at: "2026-09-04T15:30:00.000000",
	resolved_by_name: "Carlos Méndez",
	request_comment: "Primera publicación del observatorio.",
	decision_comment: "Falta el diccionario de datos de la encuesta de origen-destino.",
});
const APPROVED = row({
	id: "req-2",
	status: "approved",
	created_at: "2026-09-10T09:00:00.000000",
	decided_at: "2026-09-11T11:00:00.000000",
	resolved_by_name: "Carlos Méndez",
	request_comment: "Se agregó el diccionario de datos.",
	decision_comment: "Completo. Se publica.",
});
const CANCELLED = row({
	id: "req-3",
	status: "cancelled",
	created_at: "2026-10-05T08:00:00.000000",
	decided_at: "2026-10-05T08:20:00.000000",
	resolved_by_name: "Ana Rojas",
});
const PENDING = row({
	id: "req-4",
	status: "pending",
	requested_by: "user-ana",
	created_at: "2026-10-20T16:45:00.000000",
	request_comment: "Corregidos los conteos de 2024; se pide volver a publicar.",
	decidable_by_caller: true,
});

const PRIVATE: CkanPackage = { ...BASE, private: true };
const PUBLIC: CkanPackage = { ...BASE, private: false };

export const SCENARIOS: Record<PanelCase, PanelScenario> = {
	todas: {
		label: "Todas las tarjetas",
		note: "Todas las tarjetas a la vez, sin importar la sesión: la solicitud pendiente (con la decisión, como la ve quien administra) y un historial de cuatro solicitudes.",
		dataset: PRIVATE,
		request: PENDING,
		canDecide: true,
		canEdit: true,
		history: [PENDING, CANCELLED, APPROVED, REJECTED],
	},
	visitante: {
		label: "Visitante",
		note: "Un dataset publicado, sin sesión: no hay solicitud y el historial no se muestra a los visitantes.",
		dataset: PUBLIC,
		request: null,
		canDecide: false,
		canEdit: false,
		history: [],
	},
	editor: {
		label: "Editor con solicitud pendiente",
		note: "Quien pidió la publicación: ve el estado de su solicitud y el historial, pero no decide la propia.",
		dataset: PRIVATE,
		request: { ...PENDING, decidable_by_caller: false },
		canDecide: false,
		canEdit: true,
		history: [PENDING, REJECTED],
	},
	publicado: {
		label: "Publicado, con sesión",
		note: "Un dataset ya publicado, con sesión: se ve el historial (pedida, rechazada con motivo, pedida otra vez, aprobada) y no hay solicitud en curso.",
		dataset: PUBLIC,
		request: APPROVED,
		canDecide: false,
		canEdit: true,
		history: [APPROVED, REJECTED],
	},
};
