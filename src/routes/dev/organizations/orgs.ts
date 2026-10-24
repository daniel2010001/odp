// Datos fijos y reglas puras del playground de organizaciones (S9 de `odd/tasks/prototype-presentation.md`).
//
// El playground no consulta el catálogo: compara la cuadrícula de hoy contra la propuesta con un
// conjunto **realista** de la UMSS —facultades con sus unidades dependientes, direcciones, institutos y
// el Rectorado—. Las cinco organizaciones de hoy (`CURRENT_ORG_NAMES`) conservan su slug, título y
// cantidad de datasets de `src/lib/mock/data.ts`, para que el caso «Catálogo actual» sea el de hoy.
//
// El tipo, la sigla y la dependencia (`parent`) **no existen hoy** en las organizaciones: serían campos
// propios de la organización y una extensión de jerarquía (ver la nota de factibilidad del panel).

import type { CkanOrganization } from "$lib/types/ckan";
import { sortByLabel } from "$lib/utils/collate";

export type OrgType =
	| "rectorado"
	| "facultad"
	| "direccion"
	| "instituto"
	| "carrera"
	| "departamento";

export interface OrgTypeInfo {
	id: OrgType;
	/** Rótulo del filtro y de la etiqueta de la tarjeta. */
	label: string;
	/** Encabezado del grupo. */
	plural: string;
}

/**
 * Orden institucional, no alfabético: es una escala de dominio fija (README §11 bis) — el Rectorado
 * arriba, las unidades dependientes al final.
 */
export const ORG_TYPES: OrgTypeInfo[] = [
	{ id: "rectorado", label: "Rectorado", plural: "Rectorado" },
	{ id: "facultad", label: "Facultad", plural: "Facultades" },
	{ id: "direccion", label: "Dirección", plural: "Direcciones" },
	{ id: "instituto", label: "Instituto", plural: "Institutos y centros" },
	{ id: "carrera", label: "Carrera", plural: "Carreras" },
	{ id: "departamento", label: "Departamento", plural: "Departamentos" },
];

export interface MockOrg {
	name: string;
	title: string;
	acronym: string;
	type: OrgType;
	description: string;
	count: number;
	/** Fecha (ISO, `AAAA-MM-DD`) del último dataset actualizado; falta si no publicó ninguno. */
	updated?: string;
	/** Slug de la organización de la que depende. */
	parent?: string;
}

const UMSS: MockOrg[] = [
	{
		name: "rectorado",
		title: "Rectorado UMSS",
		acronym: "UMSS",
		type: "rectorado",
		description: "Administración central de la Universidad Mayor de San Simón.",
		count: 15,
		updated: "2026-10-14",
	},
	{
		name: "fcyt",
		title: "Facultad de Ciencias y Tecnología",
		acronym: "FCyT",
		type: "facultad",
		description: "FCyT - UMSS. Investigación en ingeniería, ciencias exactas y tecnología.",
		count: 45,
		updated: "2026-10-21",
	},
	{
		name: "fcs",
		title: "Facultad de Ciencias de la Salud",
		acronym: "FCS",
		type: "facultad",
		description: "Medicina, enfermería, odontología y ciencias farmacéuticas.",
		count: 28,
		updated: "2026-10-09",
	},
	{
		name: "fca",
		title: "Facultad de Ciencias Agrícolas",
		acronym: "FCAPyF",
		type: "facultad",
		description: "Investigación agropecuaria y recursos naturales.",
		count: 32,
		updated: "2026-09-30",
	},
	{
		name: "fce",
		title: "Facultad de Ciencias Económicas",
		acronym: "FCE",
		type: "facultad",
		description: "Economía, administración de empresas, contaduría pública e ingeniería comercial.",
		count: 19,
		updated: "2026-10-02",
	},
	{
		name: "fhce",
		title: "Facultad de Humanidades y Ciencias de la Educación",
		acronym: "FHCE",
		type: "facultad",
		description: "Ciencias de la educación, psicología, lingüística y trabajo social.",
		count: 11,
		updated: "2026-08-27",
	},
	{
		name: "fach",
		title: "Facultad de Arquitectura y Ciencias del Hábitat",
		acronym: "FACH",
		type: "facultad",
		description: "Arquitectura, planificación territorial y diseño.",
		count: 7,
		updated: "2026-07-15",
	},
	{
		name: "direccion-investigacion",
		title: "Dirección de Investigación",
		acronym: "DICyT",
		type: "direccion",
		description: "Coordinación y gestión de proyectos de investigación universitarios.",
		count: 22,
		updated: "2026-10-18",
	},
	{
		name: "duea",
		title: "Dirección Universitaria de Evaluación y Acreditación",
		acronym: "DUEA",
		type: "direccion",
		description: "Evaluación institucional y acreditación de las carreras.",
		count: 9,
		updated: "2026-09-12",
	},
	{
		name: "dpa",
		title: "Dirección de Planificación Académica",
		acronym: "DPA",
		type: "direccion",
		description: "Estadísticas de matrícula, titulación y oferta académica.",
		count: 24,
		updated: "2026-10-20",
	},
	{
		name: "disu",
		title: "Dirección de Interacción Social Universitaria",
		acronym: "DISU",
		type: "direccion",
		description: "Proyectos de extensión y vínculo de la universidad con la sociedad.",
		count: 6,
		updated: "2026-08-04",
	},
	{
		name: "cesu",
		title: "Centro de Estudios Superiores Universitarios",
		acronym: "CESU",
		type: "instituto",
		description: "Investigación y posgrado en ciencias sociales y desarrollo.",
		count: 13,
		updated: "2026-09-25",
	},
	{
		name: "casa",
		title: "Centro de Aguas y Saneamiento Ambiental",
		acronym: "CASA",
		type: "instituto",
		description: "Calidad del agua, saneamiento y monitoreo ambiental.",
		count: 8,
		updated: "2026-10-07",
		parent: "fcyt",
	},
	{
		name: "iibismed",
		title: "Instituto de Investigaciones Biomédicas",
		acronym: "IIBISMED",
		type: "instituto",
		description: "Investigación biomédica y salud pública en la región.",
		count: 10,
		updated: "2026-09-18",
		parent: "fcs",
	},
	{
		name: "iese",
		title: "Instituto de Estudios Sociales y Económicos",
		acronym: "IESE",
		type: "instituto",
		description: "Estudios de empleo, pobreza y economía regional.",
		count: 12,
		updated: "2026-09-29",
		parent: "fce",
	},
	{
		name: "ing-sistemas",
		title: "Carrera de Ingeniería de Sistemas",
		acronym: "ISI",
		type: "carrera",
		description: "Datos académicos y proyectos de grado de la carrera.",
		count: 5,
		updated: "2026-10-16",
		parent: "fcyt",
	},
	{
		name: "medicina",
		title: "Carrera de Medicina",
		acronym: "MED",
		type: "carrera",
		description: "Datos académicos e internado rotatorio de la carrera.",
		count: 4,
		updated: "2026-08-21",
		parent: "fcs",
	},
	{
		name: "ing-forestal",
		title: "Carrera de Ingeniería Forestal",
		acronym: "IFO",
		type: "carrera",
		description: "Inventarios forestales y manejo de bosques.",
		count: 3,
		updated: "2026-06-30",
		parent: "fca",
	},
	{
		name: "dep-fisica",
		title: "Departamento de Física",
		acronym: "DF",
		type: "departamento",
		description: "Mediciones de laboratorio y observaciones atmosféricas.",
		count: 6,
		updated: "2026-10-01",
		parent: "fcyt",
	},
];

/** La organización recién creada del caso «sin datasets». */
const WITHOUT_DATASETS: MockOrg = {
	name: "cep",
	title: "Centro de Estudios de Población",
	acronym: "CEP",
	type: "instituto",
	description: "Demografía y estudios de población del departamento de Cochabamba.",
	count: 0,
};

/** Las cinco organizaciones que hoy existen en el catálogo. */
export const CURRENT_ORG_NAMES = ["fcyt", "fcs", "fca", "rectorado", "direccion-investigacion"];

export type OrgCase = "actual" | "completa" | "sin-datos";
export const ORG_CASES: readonly OrgCase[] = ["actual", "completa", "sin-datos"];

export function orgsForCase(orgCase: OrgCase): MockOrg[] {
	if (orgCase === "actual") {
		// En el orden en que hoy las entrega el catálogo.
		return CURRENT_ORG_NAMES.map((name) => UMSS.find((org) => org.name === name) as MockOrg);
	}
	if (orgCase === "sin-datos") return [...UMSS, WITHOUT_DATASETS];
	return UMSS;
}

/** La forma que espera la tarjeta real (`OrganizationCard`). */
export function toCkan(org: MockOrg): CkanOrganization {
	return {
		id: `org-${org.name}`,
		name: org.name,
		title: org.title,
		description: org.description,
		created: "2024-01-15T10:00:00Z",
		state: "active",
		image_url: "",
		package_count: org.count,
	};
}

function fold(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/** Busca por nombre, sigla o descripción, sin distinguir acentos ni caja. */
export function matchesQuery(org: MockOrg, query: string): boolean {
	const needle = fold(query.trim());
	if (needle === "") return true;
	return [org.title, org.acronym, org.description].some((field) => fold(field).includes(needle));
}

/** Cantidad por tipo, sólo de los tipos presentes, en el orden institucional. */
export function typeCounts(
	orgs: MockOrg[],
	present: MockOrg[],
): { type: OrgTypeInfo; count: number }[] {
	return ORG_TYPES.filter((type) => present.some((org) => org.type === type.id)).map((type) => ({
		type,
		count: orgs.filter((org) => org.type === type.id).length,
	}));
}

export function sortByTitle(orgs: MockOrg[]): MockOrg[] {
	return sortByLabel(
		orgs,
		(org) => org.title,
		(org) => org.name,
	);
}

/** Grupos por tipo, en el orden institucional; cada grupo, alfabético. Los grupos vacíos no aparecen. */
export function groupByType(orgs: MockOrg[]): { type: OrgTypeInfo; orgs: MockOrg[] }[] {
	return ORG_TYPES.map((type) => ({
		type,
		orgs: sortByTitle(orgs.filter((org) => org.type === type.id)),
	})).filter((group) => group.orgs.length > 0);
}

export function dependentsOf(org: MockOrg, all: MockOrg[]): MockOrg[] {
	return sortByTitle(all.filter((candidate) => candidate.parent === org.name));
}

export function typeLabel(type: OrgType): string {
	return ORG_TYPES.find((info) => info.id === type)?.label ?? "Unidad";
}

const DATE_FORMAT = new Intl.DateTimeFormat("es", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

/** «21 oct 2026». Se fija el mediodía para que la zona horaria no corra el día. */
export function formatDate(iso: string): string {
	return DATE_FORMAT.format(new Date(`${iso}T12:00:00`)).replace(/\./g, "");
}
