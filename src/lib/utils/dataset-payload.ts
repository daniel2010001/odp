// Construcción del payload de CKAN para el wizard de datasets.
//
// Decisión de v0 (2026-09-11): no se escriben extras de **DCAT** (su vocabulario difiere
// entre perfiles y congelar claves obligaría a migrar). La única excepción es el **resumen** del
// portal (RF-40), que no mapea a ningún vocabulario externo: ver `dataset-summary.ts`.

import type { CkanExtra, CkanPackage } from "$lib/types/ckan";
import { formatSize } from "./ckan";
import { SUMMARY_EXTRA_KEY } from "./dataset-summary";

/** Tamaño máximo por recurso (PRD RF-12). Único origen del valor. */
export const MAX_RESOURCE_BYTES = 50 * 1024 * 1024;

/** Largo máximo del slug que acepta el schema de `datasetCreateSchema`. */
const MAX_SLUG_LENGTH = 100;

export interface DatasetFormInput {
	title: string;
	name: string;
	owner_org: string;
	private: boolean;
	notes?: string;
	summary?: string;
	license_id?: string;
	tag_string?: string;
	url?: string;
	maintainer?: string;
	maintainer_email?: string;
}

/** Campos opcionales del formulario que se omiten si quedan vacíos. */
const OPTIONAL_FIELDS = [
	"notes",
	"license_id",
	"tag_string",
	"url",
	"maintainer",
	"maintainer_email",
] as const;

function clean(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

/**
 * Traduce el formulario al payload de `package_create`.
 *
 * Omite los opcionales vacíos en lugar de mandar cadenas vacías, para que CKAN no
 * guarde valores en blanco. Sólo escribe `extras` para el resumen del portal (RF-40).
 */
export function buildPackagePayload(input: DatasetFormInput): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		title: input.title.trim(),
		name: input.name.trim(),
		owner_org: input.owner_org.trim(),
		private: input.private,
	};

	for (const field of OPTIONAL_FIELDS) {
		const value = clean(input[field]);
		if (value !== undefined) payload[field] = value;
	}

	// El resumen va como extra: CKAN no tiene un campo nativo para él.
	const resumen = clean(input.summary);
	if (resumen !== undefined) {
		payload.extras = [{ key: SUMMARY_EXTRA_KEY, value: resumen }];
	}

	return payload;
}

/**
 * Campos del formulario que una **edición** puede escribir.
 *
 * `owner_org` y `private` quedan fuera por diseño: la organización no se mueve desde acá (cambia
 * quién puede ver y administrar el dataset) y la visibilidad va por el flujo de publicación. La
 * exclusión es de tipo para que ningún refactor futuro los cuele en el `update`.
 */
export type DatasetEditInput = Omit<DatasetFormInput, "owner_org" | "private">;

/**
 * Dataset cargado con el que se abrió el formulario: de acá sale la precondición de concurrencia y,
 * también, la **lista de extras cargada**.
 *
 * `extras` es **obligatorio** a propósito. El builder decide entre actualizar el extra del resumen
 * contra su índice o agregarlo con `extend`, y esa decisión sólo es honesta si conoce la lista
 * cargada: con la lista ausente, un resumen existente se leería como "no existe" y la escritura
 * **agregaría un duplicado** en vez de actualizarlo. Hacerlo requerido convierte esa corrupción
 * silenciosa en un error de compilación (`R3-1` de `review-4542f91dce1819a4`).
 */
export interface LoadedDataset {
	id: string;
	metadata_modified: string;
	extras: readonly CkanExtra[];
}

/** Los tres campos que el builder lee del paquete cargado: se tipa sobre la **fuente cruda**, no
 * sobre el `LoadedDataset` ya verificado, porque los datos llegan de la red y el tipo se borra —
 * eso es lo que hace que el chequeo de runtime signifique algo. */
export type LoadedDatasetSource = Pick<CkanPackage, "id" | "metadata_modified" | "extras">;

/** Argumentos de `package_revise`: el `match` afirma el estado y el `update` escribe lo parcial. */
export interface RevisePayload {
	match: { id: string; metadata_modified: string };
	update: Record<string, unknown>;
}

/** Motivo por el que un paquete cargado no alcanza para armar una edición. */
export type LoadedDatasetFailure =
	| "extras_unavailable"
	| "identity_unavailable"
	| "revision_unavailable";

/**
 * Convierte un paquete de CKAN en el `LoadedDataset` que pide `buildRevisePayload`.
 *
 * Devuelve un resultado discriminado en vez de lanzar: la ruta decide el mensaje, y este módulo
 * sólo devuelve un código de motivo.
 *
 * Los tres chequeos son de **runtime** a propósito: el tipo `CkanPackage` afirma `extras`, `id` y
 * `metadata_modified`, pero el paquete llega de la red y el tipo se borra. Se lee `extras` a través
 * de `unknown` para que el compilador no vuelva vacuo el guard.
 */
export function toLoadedDataset(
	pkg: LoadedDatasetSource,
): { ok: true; dataset: LoadedDataset } | { ok: false; reason: LoadedDatasetFailure } {
	// Nunca se sustituye la lista ausente por `[]`: con la lista ausente el builder leería un
	// resumen existente como inexistente y lo **agregaría con `extend`** en vez de actualizarlo,
	// dejando un duplicado. Mismo motivo que hizo obligatorio `LoadedDataset.extras` (advisory
	// `R3-001` de `review-5b851d86ae1bc07c`).
	const extras = (pkg as { extras?: unknown }).extras;
	if (!Array.isArray(extras)) {
		return { ok: false, reason: "extras_unavailable" };
	}

	const { id } = pkg;
	if (typeof id !== "string" || id === "") {
		return { ok: false, reason: "identity_unavailable" };
	}

	// El `match` que arma el builder es la precondición de concurrencia del `package_revise`. Sin
	// `metadata_modified` la precondición se degradaría a "siempre coincide" y el aviso de conflicto
	// no aparecería: la misma familia de falla silenciosa que el chequeo de `extras`.
	const { metadata_modified } = pkg;
	if (typeof metadata_modified !== "string" || metadata_modified === "") {
		return { ok: false, reason: "revision_unavailable" };
	}

	return {
		ok: true,
		dataset: { id, metadata_modified, extras: extras as readonly CkanExtra[] },
	};
}

/**
 * Traduce el formulario de edición a los argumentos de **`package_revise`**.
 *
 * - El `match` lleva el `metadata_modified` **que se cargó con el formulario**: es la precondición
 *   de concurrencia. Si el dataset cambió mientras el formulario estaba abierto, CKAN rechaza la
 *   escritura en vez de pisar el cambio ajeno. Nunca se relee: releerlo anularía la afirmación.
 * - El `update` lleva **sólo los campos que el formulario gobierna**, como claves planas. No van
 *   `owner_org`, `private`, `state`, `id`, `resources` ni los campos derivados de CKAN.
 * - El resumen (RF-40) vive dentro de la **lista** `extras`, y una lista no se reemplaza: se escribe
 *   con la clave aplanada contra el índice del extra cargado (`update__extras__<i>__value`) o, si
 *   el extra todavía no existe, se agrega con `update__extras__extend`. Así, por construcción,
 *   los extras que el portal no gobierna sobreviven a la edición.
 * - Los opcionales vacíos se escriben igual, como cadena vacía: omitir una clave en
 *   `package_revise` significa "dejá el valor actual", así que una clave ausente convertiría el
 *   borrado en una mentira. `package_update` no se usa nunca porque borra todo campo ausente del
 *   request.
 */
export function buildRevisePayload({
	dataset,
	input,
}: {
	dataset: LoadedDatasetSource;
	input: DatasetEditInput;
}): RevisePayload {
	// Lanza en vez de devolver un resultado: llegar acá es un error de programación —un caller esquivó el
	// camino verificado— y la falla evitada (resumen duplicado, `match` sin `metadata_modified`) es corrupción silenciosa.
	const verificado = toLoadedDataset(dataset);
	if (!verificado.ok) {
		throw new Error(`buildRevisePayload: el dataset cargado no sirve (${verificado.reason})`);
	}
	const cargado = verificado.dataset;

	const update: Record<string, unknown> = {
		title: input.title.trim(),
		name: input.name.trim(),
	};

	// A diferencia de la creación, acá el campo vacío viaja como cadena vacía: es la única forma
	// de que CKAN borre el valor actual en vez de conservarlo.
	for (const field of OPTIONAL_FIELDS) {
		update[field] = input[field]?.trim() ?? "";
	}

	const resumen = input.summary?.trim() ?? "";
	const index = cargado.extras.findIndex((extra) => extra.key === SUMMARY_EXTRA_KEY);
	if (index >= 0) {
		// Con extra cargado, el valor (o la cadena vacía del borrado) va contra su índice.
		update[`update__extras__${index}__value`] = resumen;
	} else if (resumen !== "") {
		// Sin extra cargado y con valor, se agrega. Si está vacío no hay nada que limpiar ni que
		// agregar: no se crea un extra en blanco.
		update.update__extras__extend = [{ key: SUMMARY_EXTRA_KEY, value: resumen }];
	}

	return {
		match: { id: cargado.id, metadata_modified: cargado.metadata_modified },
		update,
	};
}

/**
 * Deriva un slug del título: sin acentos, en minúsculas, con guiones como único
 * separador, recortado a los 100 caracteres que acepta CKAN.
 *
 * Puede devolver una cadena vacía si el título no tiene nada utilizable; el
 * schema es quien reporta el error.
 */
export function suggestSlug(title: string): string {
	return (
		title
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/-{2,}/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, MAX_SLUG_LENGTH)
			// Tras el slice puede quedar un separador colgando si el corte cayó justo
			// sobre él; se limpia para no devolver un slug que el schema rechazaría.
			.replace(/[-_]+$/g, "")
	);
}

/** Infiere el `format` del recurso a partir de la extensión del archivo. */
export function inferResourceFormat(filename: string): string {
	const dot = filename.lastIndexOf(".");
	if (dot === -1 || dot === filename.length - 1) return "";
	return filename.slice(dot + 1).toUpperCase();
}

/**
 * Valida el tamaño del archivo ANTES de enviar bytes, para que el rechazo de un
 * proxy o de CKAN no aparezca como un error de validación confuso.
 */
export function validateResourceFile(file: {
	name: string;
	size: number;
}): { ok: true } | { ok: false; message: string } {
	if (file.size <= MAX_RESOURCE_BYTES) return { ok: true };

	const limitMb = MAX_RESOURCE_BYTES / 1024 / 1024;
	return {
		ok: false,
		message: `El archivo "${file.name}" pesa ${formatSize(file.size)} y supera el límite de ${limitMb} MB por recurso.`,
	};
}
