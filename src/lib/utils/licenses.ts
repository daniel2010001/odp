// Etiquetas en español de las licencias, una sola fuente para el facet de búsqueda, la ficha del
// dataset y el formulario.
//
// La tabla está indexada por los ids de la propia lista de CKAN (`license_list`): son los únicos ids
// que el formulario ofrece y los que quedan guardados en `license_id`. CKAN trae sus títulos en inglés
// ("Creative Commons Attribution"); el portal sólo pone el nombre en español encima.
//
// Medido contra el CKAN de desarrollo (2026-10-20): `license_list` devuelve 15 ids y `package_show`
// repite el título en inglés en `license_title`. Un id que CKAN agregue y que esta tabla aún no tenga
// se muestra con el título de CKAN (legible), nunca con el id desfigurado.

const LICENSE_LABELS: Record<string, string> = {
	notspecified: "Sin especificar",
	"odc-pddl": "PDDL — Dominio Público",
	"odc-odbl": "ODbL — Open Database License",
	"odc-by": "ODC-BY — Atribución",
	"cc-zero": "CC0 — Dominio Público",
	"cc-by": "CC BY — Atribución",
	"cc-by-sa": "CC BY-SA — Atribución-CompartirIgual",
	gfdl: "GFDL — Licencia de Documentación Libre de GNU",
	"other-open": "Otra (abierta)",
	"other-pd": "Otra (dominio público)",
	"other-at": "Otra (atribución)",
	"uk-ogl": "OGL — Licencia de Gobierno Abierto del Reino Unido",
	"cc-nc": "CC NC — NoComercial",
	"other-nc": "Otra (no comercial)",
	"other-closed": "Otra (cerrada)",
};

/**
 * Etiqueta legible de una licencia: la del portal si el id está en la tabla; si no, el título que
 * CKAN trae; si tampoco hay título, el id tal cual. Sin id ni título, «Sin especificar».
 */
export function labelFor(id?: string | null, ckanTitle?: string | null): string {
	if (id && LICENSE_LABELS[id]) return LICENSE_LABELS[id];
	return ckanTitle?.trim() || id || LICENSE_LABELS.notspecified;
}

/** Convierte items de un facet `license_id` a labels legibles. */
export function mapLicenseItems<T extends { name: string; count: number }>(
	items: T[],
): (T & { display_name: string })[] {
	return items.map((item) => ({
		...item,
		display_name: labelFor(item.name),
	}));
}

/**
 * @deprecated Sólo lo usa el playground `/dev/dataset-edit` (fuera del alcance de la unificación);
 * usar `labelFor`. Se borra con ese playground.
 */
export function curatedLicenseLabel(id: string): string | null {
	return LICENSE_LABELS[id] ?? null;
}
