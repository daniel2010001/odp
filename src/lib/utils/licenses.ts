// Labels legibles para los ids de licencia de CKAN.
// El facet `license_id` devuelve ids crudos (ej: "cc-by"), pero el usuario
// necesita un nombre legible (ej: "CC BY — Atribución"). Los datasets ya
// traen `license_title`, pero el facet solo expone el id.

const LICENSE_LABELS: Record<string, string> = {
	"cc-by": "CC BY — Atribución",
	"cc-by-sa": "CC BY-SA — Atribución-CompartirIgual",
	"cc-by-nc": "CC BY-NC — Atribución-NoComercial",
	"cc-by-nc-sa": "CC BY-NC-SA — Atribución-NoComercial-CompartirIgual",
	"cc-by-nd": "CC BY-ND — Atribución-SinDerivadas",
	"cc-by-nc-nd": "CC BY-NC-ND — Atribución-NoComercial-SinDerivadas",
	"cc-zero": "CC0 — Dominio Público",
	cc0: "CC0 — Dominio Público",
	"cc0-1.0": "CC0 — Dominio Público",
	odbl: "ODbL — Open Database License",
	"odc-odbl": "ODbL — Open Database License",
	"odc-by": "ODC-BY — Atribución",
	pddl: "PDDL — Dominio Público",
	"other-open": "Otra (abierta)",
	"other-at": "Otra (atribución)",
	"other-closed": "Otra (cerrada)",
	other: "Otra",
	notspecified: "Sin especificar",
};

// Etiquetas **curadas** del portal para los ids que `license_list` de CKAN ofrece de verdad.
//
// Medido contra el CKAN en ejecución (2026-09-13): `license_list` devuelve 15 ids y la lista
// genérica de arriba contenía 4 que no existen allí (`cc-by-nc`, `cc-by-nc-sa`, `cc0-1.0`,
// `pddl`), mientras que faltaba `odc-pddl`. `licenseLabel` y `mapLicenseItems` mantienen su
// comportamiento (con fallback), así que esta es la única lista **curada** que usa el wizard:
// sólo devuelve un label cuando el id tiene una entrada curada, y `null` en cualquier otro caso.
const CURATED_LICENSE_LABELS: Record<string, string> = {
	"cc-by": "CC BY — Atribución",
	"cc-by-sa": "CC BY-SA — Atribución-CompartirIgual",
	"cc-by-nd": "CC BY-ND — Atribución-SinDerivadas",
	"cc-by-nc-nd": "CC BY-NC-ND — Atribución-NoComercial-SinDerivadas",
	"cc-zero": "CC0 — Dominio Público",
	cc0: "CC0 — Dominio Público",
	odbl: "ODbL — Open Database License",
	"odc-odbl": "ODbL — Open Database License",
	"odc-by": "ODC-BY — Atribución",
	"odc-pddl": "PDDL — Dominio Público",
	"other-open": "Otra (abierta)",
	"other-at": "Otra (atribución)",
	"other-closed": "Otra (cerrada)",
	other: "Otra",
	notspecified: "Sin especificar",
};

/** Devuelve un label legible para un id de licencia, o el id capitalizado. */
export function licenseLabel(id: string): string {
	return LICENSE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Label curado en español para un id de licencia, o `null` si ese id no tiene una entrada
 * curada (p. ej. un id que CKAN no ofrece o uno desconocido).
 */
export function curatedLicenseLabel(id: string): string | null {
	return CURATED_LICENSE_LABELS[id] ?? null;
}

/** Convierte items de un facet `license_id` a labels legibles. */
export function mapLicenseItems<T extends { name: string; count: number }>(
	items: T[],
): (T & { display_name: string })[] {
	return items.map((item) => ({
		...item,
		display_name: licenseLabel(item.name),
	}));
}
