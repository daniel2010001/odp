// Utilidades para trabajar con la API de CKAN

import type { CkanExtra, CkanPackage } from "$lib/types/ckan";

/** Convertir objeto plano a extras CKAN */
export function toExtras(obj: Record<string, string | undefined>): CkanExtra[] {
	return Object.entries(obj)
		.filter(([, v]) => v !== undefined && v !== "")
		.map(([key, value]) => ({ key, value: value as string }));
}

/** Construir string filter query (fq) desde filtros seleccionados */
export function buildFilterQuery(filters: Record<string, string[]>): string | undefined {
	const clauses: string[] = [];

	for (const [field, values] of Object.entries(filters)) {
		if (values.length === 0) continue;
		if (values.length === 1) {
			clauses.push(`${field}:${escapeFqValue(values[0])}`);
		} else {
			const joined = values.map(escapeFqValue).join(" OR ");
			clauses.push(`(${joined})`);
		}
	}

	return clauses.length > 0 ? clauses.join(" AND ") : undefined;
}

function escapeFqValue(value: string): string {
	// Escapar caracteres especiales de Solr
	if (/[\s:"()!{}[\]^~*?]/.test(value)) {
		return `"${value.replace(/"/g, '\\"')}"`;
	}
	return value;
}

/**
 * Id de la organización dueña de un paquete: `owner_org` (UUID) y, si el campo opcional falta, el id
 * de la organización embebida. Devuelve `""` cuando no hay ninguno, que no coincide con ningún id.
 *
 * Los dos valores se comprueban en **runtime** aunque el tipo los declare: el paquete llega de la red
 * y el tipo se borra. Un valor que no sea cadena no se propaga — la ruta de edición tenía ese chequeo
 * antes de que este helper unificara los tres llamadores, y unificarlos no puede perderlo.
 */
export function ownerOrgIdOf(pkg: CkanPackage): string {
	const crudo = (pkg as { owner_org?: unknown }).owner_org;
	if (typeof crudo === "string" && crudo !== "") return crudo;

	const orgId = (pkg as { organization?: { id?: unknown } }).organization?.id;
	if (typeof orgId === "string" && orgId !== "") return orgId;

	return "";
}

/** Parsear fecha ISO a formato legible */
export function formatDate(iso: string): string {
	try {
		return new Date(iso).toLocaleDateString("es-BO", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	} catch {
		return iso;
	}
}

/** Parsear tamaño de archivo a formato legible */
export function formatSize(bytes?: number): string {
	if (bytes === undefined || bytes === null) return "—";
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}
	return `${value.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}
