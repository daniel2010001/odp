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

/**
 * Edad relativa de una fecha ISO en español neutro y formal: «hoy», «hace 1 día», «hace 5 meses»,
 * «hace 2 años». `now` entra **inyectado** para que el resultado sea determinista en las pruebas y en
 * la hoja de revisión: la función no lee la hora del sistema.
 *
 * Dos honestidades:
 *  · Un valor que no se puede parsear devuelve `""` — ninguna frase inventada: la fila se queda con
 *    su fecha absoluta y nada más.
 *  · Una fecha futura no se lee como «hace -3 días»: dice «en 3 días», que es lo que es.
 *
 * La antigüedad se cuenta por **días de calendario**, no por milisegundos: cruzar la medianoche
 * cuenta como un día entero y el resultado no depende de la hora del día. Los tramos son de
 * presentación (30 días = 1 mes, 365 días = 1 año), no una política de vencimiento: la solicitud no
 * expira.
 */
export function formatRelativeAge(iso: string, now: Date): string {
	const fecha = new Date(iso);
	if (Number.isNaN(fecha.getTime()) || Number.isNaN(now.getTime())) return "";

	const dias = Math.round(
		(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
			Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())) /
			86_400_000,
	);

	if (dias === 0) return "hoy";

	const futuro = dias < 0;
	const abs = Math.abs(dias);

	let cantidad: string;
	if (abs === 1) cantidad = "1 día";
	else if (abs < 30) cantidad = `${abs} días`;
	else if (abs < 365) {
		const meses = Math.floor(abs / 30);
		cantidad = meses === 1 ? "1 mes" : `${meses} meses`;
	} else {
		const anios = Math.floor(abs / 365);
		cantidad = anios === 1 ? "1 año" : `${anios} años`;
	}

	return futuro ? `en ${cantidad}` : `hace ${cantidad}`;
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
