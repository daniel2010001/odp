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

/** Devuelve un label legible para un id de licencia, o el id capitalizado. */
export function licenseLabel(id: string): string {
	return LICENSE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
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
