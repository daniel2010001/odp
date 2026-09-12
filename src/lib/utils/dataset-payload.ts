// Construcción del payload de CKAN para el wizard de datasets.
//
// Decisión de v0 (2026-09-11): NO se escriben `extras`. El vocabulario de
// ckanext-dcat difiere entre sus perfiles legacy y scheming, así que congelar
// claves ahora obligaría a migrar todos los datasets creados entre medio. Lo que
// el PRD pide ya se cubre con campos nativos: `metadata_created` y
// `metadata_modified` son el fallback de issued/modified, y la organización
// dueña es el fallback de publisher.

import { formatSize } from "./ckan";

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
 * guarde valores en blanco. No agrega `extras`.
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

	return payload;
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
