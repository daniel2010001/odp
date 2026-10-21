// Helpers puros de la page de solicitudes: cómo se ordena, se reparte, se filtra y se vacía la cola, y cómo se
// resume el dataset de una solicitud. Sin Svelte ni red, para probarlo sin montar nada.

import type { PublicationRequestStatus } from "$lib/api/publication";
import { estadoDelHistorial, nombreDelHistorial } from "$lib/copy/publication";
import { normalizeFormats } from "$lib/resources/formats";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import { formatDate } from "$lib/utils";
import { sortByLabel } from "$lib/utils/collate";
import { labelFor } from "$lib/utils/licenses";

// ─── Tipos de la cola de solicitudes ──────────────────────────────────
// Lo que el portal necesita mostrar de una solicitud: de qué dataset es, quién la pidió y cuándo.
// Los campos de presentación (`dataset_title`, `organization_title`, `requested_by_name`) son valores
// ya resueltos por la capa de API; si faltan, la fila simplemente no los muestra. `requested_by` es
// el **id** de usuario y sólo se usa para la comparación de cuatro ojos: nunca se renderiza. El
// estado reusa el vocabulario de `PublicationRequest`, que es el dueño de la tabla.
export interface QueueItem {
	id: string;
	/** Id del dataset de la solicitud; es lo que la cola relee para confirmar una aprobación. */
	dataset_id: string;
	dataset_title: string;
	organization_title?: string;
	/** Id de usuario de quien creó la solicitud; sólo alimenta la comparación de cuatro ojos. */
	requested_by?: string;
	/**
	 * La respuesta del catálogo: `true` sólo si `publication_request_decide` autorizaría a quien mira
	 * sobre esta fila. Es lo que permite la excepción de auto-aprobación y lo que lee el plegado; ausente
	 * en un catálogo anterior al campo.
	 */
	decidable_by_caller?: boolean | null;
	/** Nombre visible de quien creó la solicitud; es lo que la fila muestra. */
	requested_by_name?: string;
	/** Nombre visible de quien decidió la solicitud; sólo lo traen las filas ya resueltas. */
	approved_by_name?: string;
	created_at?: string;
	/** Cuándo se resolvió; ordena las resueltas. Ausente en las pendientes y en filas anteriores a la 0002. */
	decided_at?: string;
	status: PublicationRequestStatus;
	comments?: string | null;
}

export type Tab = "pendientes" | "resueltas" | "todas";
export const TABS: { id: Tab; label: string }[] = [
	{ id: "pendientes", label: "Pendientes" },
	{ id: "resueltas", label: "Resueltas" },
	{ id: "todas", label: "Todas" },
];

/** Etiqueta neutral cuando el catálogo no entrega el nombre visible: la misma de la cola. */
const CATALOG_NAME_FALLBACK = "un usuario del catálogo";

export const isPending = (item: QueueItem): boolean => item.status === "pending";

/** La fecha de una fila como número; una ausente o ilegible es `NaN` y se ordena al final. */
function timeOf(value: string | undefined): number {
	return new Date(value ?? "").getTime();
}

function sortKey(item: QueueItem): number {
	const t = timeOf(item.decided_at ?? item.created_at);
	return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** De la más antigua a la más nueva; sin fecha legible, al final. Estable: las iguales conservan su orden. */
function byAge(a: QueueItem, b: QueueItem): number {
	const ta = timeOf(a.created_at);
	const tb = timeOf(b.created_at);
	if (Number.isNaN(ta) || Number.isNaN(tb))
		return Number.isNaN(ta) ? (Number.isNaN(tb) ? 0 : 1) : -1;
	return ta - tb;
}

/**
 * Las pendientes de la más antigua a la más nueva (FIFO: quien esperó más, arriba); las resueltas con la más
 * nueva primero (una fecha ilegible, la última). Las pendientes son trabajo y se atienden en orden de llegada;
 * las resueltas son archivo y se lee lo último.
 */
export function splitQueue(items: QueueItem[]): {
	pendientes: QueueItem[];
	resueltas: QueueItem[];
} {
	return {
		pendientes: items.filter(isPending).sort(byAge),
		resueltas: items
			.filter((item) => !isPending(item))
			.map((item) => ({ item, t: sortKey(item) }))
			.sort((a, b) => (a.t === b.t ? 0 : b.t > a.t ? 1 : -1))
			.map(({ item }) => item),
	};
}

/** La regla de cuatro ojos de la cola: la propia sólo se decide si el catálogo concedió la excepción. */
export function canDecide(item: QueueItem, viewer: string | null): boolean {
	const own = viewer !== null && item.requested_by === viewer;
	return !own || item.decidable_by_caller === true;
}

/** La primera pendiente —la más antigua— que quien mira puede decidir: la única que arranca abierta. */
export function firstDecidable(items: QueueItem[], viewer: string | null): QueueItem | null {
	return splitQueue(items).pendientes.find((item) => canDecide(item, viewer)) ?? null;
}

export function itemsForTab(items: QueueItem[], tab: Tab): QueueItem[] {
	const { pendientes, resueltas } = splitQueue(items);
	if (tab === "pendientes") return pendientes;
	if (tab === "resueltas") return resueltas;
	return [...pendientes, ...resueltas];
}

export function tabCounts(items: QueueItem[]): Record<Tab, number> {
	const { pendientes, resueltas } = splitQueue(items);
	return { pendientes: pendientes.length, resueltas: resueltas.length, todas: items.length };
}

/** Cada organización una vez, en el orden en que aparece; las filas sin organización no cuentan. */
export function organizationsOf(items: QueueItem[]): string[] {
	return [
		...new Set(items.map((i) => i.organization_title).filter((t): t is string => Boolean(t))),
	];
}

export function filterByOrganization(items: QueueItem[], organization: string | null): QueueItem[] {
	return organization === null
		? items
		: items.filter((item) => item.organization_title === organization);
}

/**
 * Refleja una decisión confirmada: la fila **queda en la lista** como resuelta, con quién y cuándo, en vez
 * de desaparecer. Es lo que las variantes proponen —la cola de hoy la saca—, porque ahora las resueltas
 * se ven y la decisión recién tomada es la que más se quiere volver a mirar.
 */
export function applyDecision(
	items: QueueItem[],
	decided: { id: string; status: PublicationRequestStatus; comments?: string | null },
	context: { by: string; at: string },
): QueueItem[] {
	return items.map((item) =>
		item.id === decided.id
			? {
					...item,
					status: decided.status,
					approved_by_name: context.by,
					decided_at: context.at,
					comments: decided.comments ?? item.comments,
					decidable_by_caller: false,
				}
			: item,
	);
}

/**
 * ¿El fallo es la carrera real —«esta solicitud ya fue decidida»—? Es el `409` de validación **claveado
 * por `request_id`** (`publication.ts`): el 409 de `comments` o de `approve` es otra cosa.
 */
export function isStaleDecision(err: unknown): boolean {
	return (
		err instanceof CkanApiError &&
		err.status === 409 &&
		typeof err.payload === "object" &&
		err.payload !== null &&
		"request_id" in err.payload
	);
}

export const STALE_MESSAGE = "Esta solicitud ya fue decidida por otra persona.";

/**
 * La línea de resolución con el vocabulario de `RequestHistory` («Aprobada por Ana el 17 de octubre de
 * 2026»). `null` si la solicitud sigue pendiente. La retirada y la anulada no se atribuyen un decisor.
 */
export function resolutionLine(item: QueueItem): string | null {
	const rotulo = estadoDelHistorial(item.status).resolvio;
	if (!rotulo) return null;
	const decisor = item.status === "approved" || item.status === "rejected";
	const nombre = decisor
		? (nombreDelHistorial(item.approved_by_name) ?? CATALOG_NAME_FALLBACK)
		: null;
	return [
		rotulo,
		nombre ? `por ${nombre}` : null,
		item.decided_at ? `el ${formatDate(item.decided_at)}` : null,
	]
		.filter(Boolean)
		.join(" ");
}

export interface EmptyState {
	title: string;
	hint: string;
}

/**
 * El mensaje de una lista vacía. La cola de hoy dice «No hay solicitudes pendientes de revisión.» aun
 * cuando no existe **ninguna** solicitud, y ahora que muestra las resueltas esa frase miente por omisión.
 */
export function emptyState(tab: Tab, counts: Record<Tab, number>): EmptyState {
	if (counts.todas === 0) {
		return {
			title: "No hay solicitudes de publicación.",
			hint: "Cuando una persona editora pida publicar un dataset de sus organizaciones, la solicitud aparecerá aquí.",
		};
	}
	if (tab === "pendientes") {
		return {
			title: "No hay solicitudes pendientes.",
			hint: "Las solicitudes ya decididas están en «Resueltas».",
		};
	}
	return {
		title: "Aún no hay solicitudes resueltas.",
		hint: "Las que usted decida quedarán aquí.",
	};
}

/**
 * El rótulo del botón que abre el detalle de una fila, o `null` si no hay nada que abrir. Decidir se
 * ofrece sólo donde quien mira puede; la propia se abre como «Ver» para leer por qué no se decide, y una
 * resuelta sólo se abre si tiene un comentario que leer.
 */
export function actionLabel(item: QueueItem, viewer: string | null): string | null {
	if (isPending(item)) return canDecide(item, viewer) ? "Decidir" : "Ver";
	return item.comments?.trim() ? "Ver" : null;
}

/**
 * Lo que sigue al rótulo en `resolutionLine` («por Ana el 17 de octubre de 2026»), para las filas que ya
 * dicen el estado con un rótulo propio. `null` si la solicitud sigue pendiente o la línea no trae nada más.
 */
export function resolutionDetail(item: QueueItem): string | null {
	const line = resolutionLine(item);
	const rotulo = estadoDelHistorial(item.status).resolvio;
	if (!line || !rotulo) return null;
	return line.slice(rotulo.length).trim() || null;
}

/**
 * Las dos partes de la línea de estado de una fila: la palabra del estado («Aprobada») y lo que le sigue
 * («por Ana el 17 de octubre de 2026», vacío si no hay nada más). Son dos partes y no una frase porque la
 * palabra lleva el color del estado; quien las dibuja debe poner **él** el espacio entre ambas: el 2026-10-20
 * se leyó «Aprobadapor Ana» porque el espacio estaba dentro de un `{#if}`, donde Svelte lo recorta.
 */
export function statusLineParts(item: QueueItem): { label: string; tone: string; detail: string } {
	const estado = estadoDelHistorial(item.status);
	return { label: estado.label, tone: estado.tone, detail: resolutionDetail(item) ?? "" };
}

/** Cuántas resueltas se ven antes de «Ver N más»: el mismo límite del historial del dataset. */
export const LIMITE_RESUELTAS = 5;

/**
 * Acota la parte resuelta de una lista —las resueltas crecen sin parar—, no las pendientes, que se ven todas.
 * `hidden` es lo que «Ver N más» ofrece; el orden de las filas no cambia.
 */
export function acotarResueltas(
	rows: QueueItem[],
	limite: number,
): { shown: QueueItem[]; hidden: number } {
	let resolved = 0;
	const shown = rows.filter((i) => isPending(i) || ++resolved <= limite);
	return { shown, hidden: rows.length - shown.length };
}

/** La pestaña que representa «sin filtro de organización»: ninguna organización se llama así. */
export const TODAS_LAS_ORGANIZACIONES = "__todas__";

export interface OrganizationTab {
	/** `TODAS_LAS_ORGANIZACIONES` o el nombre de la organización. */
	id: string;
	label: string;
	count: number;
}

/** «Todas» primero, con el total, y después cada organización en orden alfabético (es), con sus solicitudes. */
export function organizationTabs(items: QueueItem[]): OrganizationTab[] {
	return [
		{ id: TODAS_LAS_ORGANIZACIONES, label: "Todas", count: items.length },
		...sortByLabel(
			organizationsOf(items),
			(organization) => organization,
			(organization) => organization,
		).map((organization) => ({
			id: organization,
			label: organization,
			count: filterByOrganization(items, organization).length,
		})),
	];
}

/** Las opciones del control de estado, cada una con su conteo. */
export function statusOptions(
	counts: Record<Tab, number>,
): { id: Tab; label: string; count: number }[] {
	return TABS.map((t) => ({ ...t, count: counts[t.id] }));
}

/** Las pestañas de organización sólo se dibujan si filtran algo: «Todas» más al menos dos organizaciones. */
export function hasOrganizationTabs(tabs: OrganizationTab[]): boolean {
	return tabs.length > 2;
}

/** El texto de una opción del control de estado: «Pendientes (4)». */
export function statusOptionLabel(option: { label: string; count: number }): string {
	return `${option.label} (${option.count})`;
}

/**
 * El conteo de la barra de resultados, en las dos partes de la búsqueda (el número grande y su frase):
 * «4» «solicitudes pendientes», «1» «solicitud resuelta», «10» «solicitudes».
 */
export function requestCountLabel(tab: Tab, count: number): { number: string; text: string } {
	const plural = count !== 1;
	const noun = plural ? "solicitudes" : "solicitud";
	const adjective =
		tab === "todas"
			? ""
			: ` ${tab === "pendientes" ? "pendiente" : "resuelta"}${plural ? "s" : ""}`;
	return { number: count.toLocaleString("es-BO"), text: `${noun}${adjective}` };
}

export interface DatasetSummary {
	/** La organización dueña hoy; `null` si el catálogo no la trae. */
	organization: string | null;
	license: string;
	/** «3 recursos (CSV, JSON)»: cuántos y de qué formatos; sin formatos no abre paréntesis. */
	resources: string;
	/** Si el dataset es público o privado **hoy**, que es lo que la aprobación va a cambiar. */
	visibility: "Público" | "Privado";
}

/** Lo que quien decide necesita ver del dataset antes de aprobar: dueña, licencia, recursos y visibilidad. */
export function datasetSummary(dataset: CkanPackage): DatasetSummary {
	const count = dataset.resources?.length ?? 0;
	const formats = normalizeFormats(dataset.resources);
	const resources =
		count === 0
			? "Sin recursos"
			: `${count} ${count === 1 ? "recurso" : "recursos"}${formats.length > 0 ? ` (${formats.join(", ")})` : ""}`;
	return {
		organization: dataset.organization?.title || null,
		license: labelFor(dataset.license_id, dataset.license_title),
		resources,
		visibility: dataset.private ? "Privado" : "Público",
	};
}
