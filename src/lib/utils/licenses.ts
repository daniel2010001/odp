// Etiquetas en español de las licencias, una sola fuente para el facet de búsqueda, la ficha del
// dataset y el formulario.
//
// La tabla está indexada por los ids de la propia lista de CKAN (`license_list`): son los únicos ids
// que el formulario ofrece y los que quedan guardados en `license_id`. CKAN trae sus títulos en inglés
// ("Creative Commons Attribution"); el portal sólo pone el nombre en español encima.
//
// Medido contra el CKAN de desarrollo (2026-10-20): `license_list` devuelve 15 ids y `package_show`
// repite el título en inglés en `license_title`. Un id que CKAN agregue y que esta tabla aún no tenga
// se muestra con el título de CKAN (legible), nunca con el id desfigurado. La misma tabla guarda el
// resumen en español y la página oficial de los términos (las direcciones de CKAN son http a
// opendefinition.org o versiones viejas; las del portal son https y, donde existe, en español).

interface LicenseInfo {
	label: string;
	/** Una frase, en «usted» neutro, de lo que la licencia permite. */
	summary?: string;
	/** Página oficial de los términos, https y en español cuando existe. */
	terms?: string;
	/** No se ofrece al crear o editar; sigue etiquetándose donde un dataset ya la tiene. */
	hiddenInForm?: true;
}

const LICENSES: Record<string, LicenseInfo> = {
	notspecified: { label: "Sin especificar" },
	"cc-by": {
		label: "CC BY — Atribución",
		summary:
			"Permite usar, compartir y adaptar los datos, incluso con fines comerciales, citando la fuente.",
		terms: "https://creativecommons.org/licenses/by/4.0/deed.es",
	},
	"cc-by-sa": {
		label: "CC BY-SA — Atribución-CompartirIgual",
		summary:
			"Permite usar, compartir y adaptar los datos, incluso con fines comerciales, citando la fuente y manteniendo la misma licencia en las obras derivadas.",
		terms: "https://creativecommons.org/licenses/by-sa/4.0/deed.es",
	},
	"cc-zero": {
		label: "CC0 — Dominio Público",
		summary:
			"Renuncia a todos los derechos: permite usar los datos para cualquier fin, sin condiciones.",
		terms: "https://creativecommons.org/publicdomain/zero/1.0/deed.es",
	},
	"cc-nc": {
		label: "CC BY-NC — Atribución-NoComercial",
		summary:
			"Permite usar, compartir y adaptar los datos citando la fuente, pero no con fines comerciales.",
		terms: "https://creativecommons.org/licenses/by-nc/4.0/deed.es",
	},
	"odc-pddl": {
		label: "ODC-PDDL — Dominio Público (bases de datos)",
		summary:
			"Dedica la base de datos al dominio público: permite usarla para cualquier fin, sin condiciones.",
		terms: "https://opendatacommons.org/licenses/pddl/1-0/",
	},
	"odc-odbl": {
		label: "ODbL — Licencia Abierta de Bases de Datos",
		summary:
			"Permite usar, compartir y adaptar la base de datos citando la fuente y manteniendo la misma licencia en las versiones derivadas.",
		terms: "https://opendatacommons.org/licenses/odbl/1-0/",
	},
	"odc-by": {
		label: "ODC-BY — Atribución (bases de datos)",
		summary:
			"Permite usar, compartir y adaptar la base de datos, incluso con fines comerciales, citando la fuente.",
		terms: "https://opendatacommons.org/licenses/by/1-0/",
	},
	gfdl: {
		label: "GFDL — Licencia de Documentación Libre de GNU",
		summary:
			"Permite copiar, distribuir y modificar el documento, incluso con fines comerciales, manteniendo la misma licencia en las copias.",
		terms: "https://www.gnu.org/licenses/fdl-1.3.html",
	},
	"uk-ogl": {
		label: "OGL — Gobierno Abierto (Reino Unido)",
		summary:
			"Permite usar y adaptar la información, incluso con fines comerciales, citando la fuente.",
		terms: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		hiddenInForm: true,
	},
	"other-open": {
		label: "Otra licencia abierta",
		summary:
			"Los términos son los que declare quien publica; consúltelos antes de reutilizar los datos.",
	},
	"other-pd": {
		label: "Otra licencia de dominio público",
		summary: "Los datos están en el dominio público; consulte los detalles con quien los publica.",
	},
	"other-at": {
		label: "Otra licencia con atribución",
		summary:
			"Permite reutilizar los datos citando la fuente; consulte los detalles con quien los publica.",
	},
	"other-nc": {
		label: "Otra licencia no comercial",
		summary:
			"Permite reutilizar los datos sólo sin fines comerciales; consulte los detalles con quien los publica.",
	},
	"other-closed": {
		label: "Otra licencia (no abierta)",
		summary:
			"No es una licencia abierta: consulte con quien publica los datos qué usos están permitidos.",
	},
};

/**
 * Etiqueta legible de una licencia: la del portal si el id está en la tabla; si no, el título que
 * CKAN trae; si tampoco hay título, el id tal cual. Sin id ni título, «Sin especificar».
 */
export function labelFor(id?: string | null, ckanTitle?: string | null): string {
	if (id && LICENSES[id]) return LICENSES[id].label;
	return ckanTitle?.trim() || id || LICENSES.notspecified.label;
}

/** Resumen en español de lo que permite la licencia; `null` si el id no está en la tabla. */
export function licenseSummary(id?: string | null): string | null {
	return (id && LICENSES[id]?.summary) || null;
}

/**
 * Página oficial de los términos: la mapeada del portal si el id la tiene; si no, la que CKAN
 * trae (CKAN apunta a opendefinition.org por http, o a una versión vieja). Quien la muestre debe
 * pasarla por `safeExternalUrl`.
 */
export function licenseTermsUrl(id?: string | null, ckanUrl?: string | null): string | undefined {
	return (id && LICENSES[id]?.terms) || ckanUrl || undefined;
}

/** Si el selector de crear/editar ofrece esta licencia. */
export function isOfferedInForm(id: string): boolean {
	return !LICENSES[id]?.hiddenInForm;
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
	return LICENSES[id]?.label ?? null;
}
