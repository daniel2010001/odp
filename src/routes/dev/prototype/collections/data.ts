// Datos fijos de las maquetas de colecciones (P5 de `odd/tasks/prototype-presentation.md`, S4 y L3).
//
// Las tres maquetas —«Colecciones», «Ficha de colección» y «Colecciones de un dataset»— leen de acá, para que
// el recorrido en los dos sentidos sea coherente: `ds1 → cl1 → ds2 → cl2 → ds3`. Por ejemplo, el informe de
// gestión de la FCyT está en «Rendición pública de cuentas 2025» (la cura el Rectorado) y en «Investigación y
// laboratorios de la FCyT» (la cura la Dirección de Investigación): **un solo dataset**, publicado una vez por
// su organización dueña y referenciado desde las dos. Es la respuesta al ejemplo de la carta del tribunal (S4):
// se sube una vez y se referencia desde varios lugares; no hay circulación de documentos.
//
// Factibilidad en CKAN (S6): una colección es un `group` y su pertenencia, `group_member` (nativos; medido:
// `ckan.auth.user_create_groups = true`, cualquier usuario con sesión puede crear una). La aprobación por
// organización de RF-23 **no es nativa**: sería una extensión propia, como las solicitudes de publicación.

export type Visibility = "Pública" | "Interna";

export interface Org {
	name: string;
	title: string;
	acronym: string;
}

/** Las organizaciones de `src/lib/mock/data.ts`, con su sigla de `src/routes/dev/organizations/orgs.ts`. */
export const ORGS: Record<string, Org> = {
	fcyt: { name: "fcyt", title: "Facultad de Ciencias y Tecnología", acronym: "FCyT" },
	fcs: { name: "fcs", title: "Facultad de Ciencias de la Salud", acronym: "FCS" },
	fca: { name: "fca", title: "Facultad de Ciencias Agrícolas", acronym: "FCAPyF" },
	rectorado: { name: "rectorado", title: "Rectorado UMSS", acronym: "UMSS" },
	"direccion-investigacion": {
		name: "direccion-investigacion",
		title: "Dirección de Investigación",
		acronym: "DICyT",
	},
};

export interface MockDataset {
	slug: string;
	title: string;
	org: string;
	formats: string[];
	updated: string;
}

export const DATASETS: MockDataset[] = [
	{
		slug: "informe-gestion-2025-fcyt",
		title: "Informe de gestión 2025 — Facultad de Ciencias y Tecnología",
		org: "fcyt",
		formats: ["PDF", "XLSX"],
		updated: "14 oct. 2026",
	},
	{
		slug: "informe-gestion-2025-fcs",
		title: "Informe de gestión 2025 — Facultad de Ciencias de la Salud",
		org: "fcs",
		formats: ["PDF"],
		updated: "9 oct. 2026",
	},
	{
		slug: "matricula-por-carrera",
		title: "Matrícula estudiantil por carrera 2021–2025",
		org: "rectorado",
		formats: ["CSV", "XLSX"],
		updated: "2 oct. 2026",
	},
	{
		slug: "titulados-por-facultad",
		title: "Titulados por facultad 2020–2025",
		org: "rectorado",
		formats: ["CSV"],
		updated: "28 sep. 2026",
	},
	{
		slug: "proyectos-investigacion-2025",
		title: "Proyectos de investigación financiados 2025",
		org: "direccion-investigacion",
		formats: ["CSV", "PDF"],
		updated: "20 oct. 2026",
	},
	{
		slug: "publicaciones-indexadas",
		title: "Publicaciones científicas indexadas 2025",
		org: "direccion-investigacion",
		formats: ["CSV", "JSON"],
		updated: "17 oct. 2026",
	},
	{
		slug: "equipamiento-laboratorios-fcyt",
		title: "Equipamiento de laboratorios de la FCyT",
		org: "fcyt",
		formats: ["XLSX"],
		updated: "11 sep. 2026",
	},
	{
		slug: "rendimiento-cultivos-andinos",
		title: "Parcelas experimentales: rendimiento de cultivos andinos",
		org: "fca",
		formats: ["CSV"],
		updated: "6 oct. 2026",
	},
];

export type Curator = { kind: "org"; org: string } | { kind: "user"; name: string };

export type Approval = "Aprobada" | "Pendiente";

export interface MockCollection {
	slug: string;
	name: string;
	description: string;
	curator: Curator;
	visibility: Visibility;
	datasets: string[];
	/** Una decisión por organización dueña de algún dataset (RF-23). Falta si la colección es interna y no pidió publicarse. */
	approvals?: Record<string, Approval>;
}

export const COLLECTIONS: MockCollection[] = [
	{
		slug: "rendicion-cuentas-2025",
		name: "Rendición pública de cuentas 2025",
		description:
			"Informes de gestión e indicadores académicos que la universidad presenta en la rendición pública de cuentas de la gestión 2025.",
		curator: { kind: "org", org: "rectorado" },
		visibility: "Interna",
		datasets: [
			"informe-gestion-2025-fcyt",
			"informe-gestion-2025-fcs",
			"matricula-por-carrera",
			"titulados-por-facultad",
		],
		approvals: { rectorado: "Aprobada", fcyt: "Aprobada", fcs: "Pendiente" },
	},
	{
		slug: "investigacion-laboratorios-fcyt",
		name: "Investigación y laboratorios de la FCyT",
		description:
			"Proyectos, publicaciones y equipamiento de la Facultad de Ciencias y Tecnología, reunidos para la evaluación de la investigación.",
		curator: { kind: "org", org: "direccion-investigacion" },
		visibility: "Pública",
		datasets: [
			"informe-gestion-2025-fcyt",
			"proyectos-investigacion-2025",
			"publicaciones-indexadas",
			"equipamiento-laboratorios-fcyt",
		],
		approvals: { "direccion-investigacion": "Aprobada", fcyt: "Aprobada" },
	},
	{
		slug: "indicadores-academicos",
		name: "Indicadores académicos para tesis",
		description:
			"Series de matrícula, titulación, producción científica y producción agrícola que uso como base para una tesis de maestría.",
		curator: { kind: "user", name: "María Fernanda Rojas Vargas" },
		visibility: "Pública",
		datasets: [
			"matricula-por-carrera",
			"titulados-por-facultad",
			"publicaciones-indexadas",
			"rendimiento-cultivos-andinos",
		],
		approvals: { rectorado: "Aprobada", "direccion-investigacion": "Aprobada", fca: "Aprobada" },
	},
	{
		slug: "seguridad-alimentaria-salud",
		name: "Seguridad alimentaria y salud",
		description:
			"Datos de salud y de producción agrícola para un proyecto conjunto entre la Facultad de Ciencias de la Salud y la de Ciencias Agrícolas.",
		curator: { kind: "user", name: "Ana Gabriela Céspedes" },
		visibility: "Interna",
		datasets: ["informe-gestion-2025-fcs", "rendimiento-cultivos-andinos"],
	},
];

export function datasetBySlug(slug: string): MockDataset {
	const found = DATASETS.find((d) => d.slug === slug);
	if (!found) throw new Error(`Dataset de maqueta inexistente: ${slug}`);
	return found;
}

export function collectionBySlug(slug: string | null): MockCollection {
	return COLLECTIONS.find((c) => c.slug === slug) ?? COLLECTIONS[0];
}

/** Las organizaciones dueñas de los datasets de una colección, sin repetir, en el orden de los datasets. */
export function ownerOrgs(collection: MockCollection): Org[] {
	const names = [...new Set(collection.datasets.map((slug) => datasetBySlug(slug).org))];
	return names.map((name) => ORGS[name]);
}

/** Las colecciones que incluyen un dataset, menos la que se excluye (la que se está mirando). */
export function collectionsOf(datasetSlug: string, except?: string): MockCollection[] {
	return COLLECTIONS.filter((c) => c.slug !== except && c.datasets.includes(datasetSlug));
}

export function curatorLabel(curator: Curator): string {
	return curator.kind === "org" ? ORGS[curator.org].title : curator.name;
}

export const collectionHref = (slug: string) => `/dev/prototype/collection?c=${slug}`;
export const datasetHref = (slug: string) => `/dev/prototype/dataset-collections?d=${slug}`;
