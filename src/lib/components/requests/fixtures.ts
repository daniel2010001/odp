// Fixtures de las pruebas de la cola de solicitudes. Sólo datos: ninguna lógica de producto vive acá. Los tipos
// salen de la cola, así que si el vocabulario de una solicitud cambia, esto deja de compilar.

import type { PublicationQueueItem } from "$lib/components/dataset/PublicationQueue.svelte";
import type { CkanPackage } from "$lib/types/ckan";

/** Reloj fijo: la antigüedad de cada fila no depende de cuándo se mire la hoja. */
export const AHORA = new Date("2026-10-20T12:00:00");
export const AHORA_ISO = "2026-10-20T12:00:00";

export const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const ADMIN_NOMBRE = "admin.tecnologia";
export const EDITOR_ID = "7f3c1a2e-9b4d-4e6f-8a10-2c5d6e7f8a90";
const OTRO_ID = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

const TECNOLOGIA = "Facultad de Tecnología";
const MEDICINA = "Facultad de Medicina";
const ECONOMICAS = "Facultad de Ciencias Económicas, Administrativas y Financieras";

function row(
	id: string,
	title: string,
	organization: string | undefined,
	created: string,
	overrides: Partial<PublicationQueueItem> = {},
): PublicationQueueItem {
	return {
		id,
		dataset_id: `pkg-${id}`,
		dataset_title: title,
		organization_title: organization,
		requested_by: OTRO_ID,
		requested_by_name: "editor.economicas",
		created_at: created,
		status: "pending",
		comments: null,
		...overrides,
	};
}

const PENDIENTES: PublicationQueueItem[] = [
	row("p1", "Matrícula 2026", TECNOLOGIA, "2026-10-17T00:00:00", {
		requested_by: EDITOR_ID,
		requested_by_name: "editor.tecnologia",
	}),
	row("p2", "Presupuesto de investigación 2026", ECONOMICAS, "2026-10-12T00:00:00"),
	row("p3", "Encuesta de satisfacción 2024", MEDICINA, "2026-04-03T00:00:00", {
		requested_by_name: "editor.medicina",
	}),
	row("p4", "Inventario de laboratorios 2025", TECNOLOGIA, "2026-10-19T00:00:00", {
		requested_by: EDITOR_ID,
		requested_by_name: "editor.tecnologia",
	}),
];

const TITULOS_RESUELTOS = [
	"Calendario académico 2026",
	"Graduados por carrera 2020–2025",
	"Convenios interinstitucionales vigentes",
	"Producción científica indexada 2025",
	"Becas otorgadas por gestión",
	"Consumo energético de los campus",
	"Uso de laboratorios por semestre",
	"Deserción estudiantil 2023",
	"Infraestructura bibliotecaria",
	"Proyectos de extensión 2025",
	"Ejecución presupuestaria 2025",
	"Plantel docente por categoría",
	"Registro de seminarios 2024",
	"Publicaciones de la revista institucional",
];
const ESTADOS_RESUELTOS = [
	"approved",
	"approved",
	"rejected",
	"approved",
	"cancelled",
	"annulled",
] as const;

/** `n` solicitudes resueltas, de la más nueva a la más vieja, repartidas entre tres organizaciones. */
function resueltas(n: number): PublicationQueueItem[] {
	return Array.from({ length: n }, (_, i) => {
		const status = ESTADOS_RESUELTOS[i % ESTADOS_RESUELTOS.length];
		const dia = String(18 - i).padStart(2, "0");
		const mes = 18 - i > 0 ? "10" : "09";
		const fecha = 18 - i > 0 ? dia : String(30 + (18 - i)).padStart(2, "0");
		const decidida = `2026-${mes}-${fecha}T10:00:00`;
		return row(
			`r${i + 1}`,
			TITULOS_RESUELTOS[i % TITULOS_RESUELTOS.length],
			[TECNOLOGIA, MEDICINA, ECONOMICAS][i % 3],
			`2026-09-${String(1 + (i % 20)).padStart(2, "0")}T00:00:00`,
			{
				status,
				decided_at: decidida,
				approved_by_name: status === "approved" || status === "rejected" ? ADMIN_NOMBRE : undefined,
				comments:
					status === "rejected"
						? "Los datos personales de los estudiantes aún deben anonimizarse."
						: null,
			},
		);
	});
}

/** Los escenarios que las pruebas montan. */
export type Caso =
	| "varias"
	| "vacia"
	| "solo-pendientes"
	| "muchas-resueltas"
	| "una-organizacion"
	| "propia"
	| "obsoleta";

export function itemsDelCaso(caso: Caso): PublicationQueueItem[] {
	switch (caso) {
		case "vacia":
			return [];
		case "solo-pendientes":
			return PENDIENTES.slice(0, 3);
		case "muchas-resueltas":
			return [...PENDIENTES.slice(0, 2), ...resueltas(14)];
		case "una-organizacion":
			return [
				...PENDIENTES.filter((i) => i.organization_title === TECNOLOGIA),
				...resueltas(6).map((i) => ({ ...i, organization_title: TECNOLOGIA })),
			];
		case "propia":
			return [
				row("own1", "Directorio de investigadores", TECNOLOGIA, "2026-03-01T00:00:00", {
					requested_by: ADMIN_ID,
					requested_by_name: ADMIN_NOMBRE,
					decidable_by_caller: false,
				}),
				row("own2", "Actas del consejo de carrera", TECNOLOGIA, "2026-03-05T00:00:00", {
					requested_by: ADMIN_ID,
					requested_by_name: ADMIN_NOMBRE,
					decidable_by_caller: true,
				}),
				...PENDIENTES.slice(1, 3),
				...resueltas(4),
			];
		default:
			return [...PENDIENTES, ...resueltas(6)];
	}
}

/** Qué fila devuelve el 409 en el caso «obsoleta»: la pendiente más antigua, que es la que arranca abierta. */
export const ID_OBSOLETA = "p3";

/** El dataset ya público: es lo que la relectura devuelve para confirmar una aprobación. */
export function datasetPublicado(id: string): CkanPackage {
	return {
		id,
		name: id,
		title: id,
		private: false,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: AHORA_ISO,
	};
}

/** El dataset de una solicitud tal como el catálogo lo cuenta hoy: privado, con licencia y tres recursos. */
export function datasetDeLaSolicitud(id: string): CkanPackage {
	return {
		...datasetPublicado(id),
		title: `Dataset ${id}`,
		private: true,
		organization: { id: "org", name: "org", title: TECNOLOGIA } as CkanPackage["organization"],
		license_id: "cc-by",
		license_title: "Creative Commons Attribution",
		resources: [
			{ id: "1", format: "csv", url_type: "upload" },
			{ id: "2", format: "CSV", url_type: "upload" },
			{ id: "3", format: "json", url_type: "upload" },
		] as CkanPackage["resources"],
	};
}
