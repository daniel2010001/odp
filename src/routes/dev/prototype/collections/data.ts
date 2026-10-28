// Datos fijos de las maquetas de colecciones (P5 de `odd/tasks/prototype-presentation.md`, S4 y L3).
//
// Las tres maquetas —«Colecciones» (la del menú principal y «Mis colecciones» del panel), «Ficha de
// colección» y «Colecciones de un dataset»— leen de acá, para que el recorrido en los dos sentidos sea coherente: `ds1 → cl1 → ds2 → cl2 → ds3`. Por ejemplo, el informe de
// gestión de la FCyT está en «Rendición pública de cuentas 2025» (la cura el Rectorado) y en «Investigación y
// laboratorios de la FCyT» (la cura la Dirección de Investigación): **un solo dataset**, publicado una vez por
// su organización dueña y referenciado desde las dos. Es la respuesta al ejemplo de la carta del tribunal (S4):
// se sube una vez y se referencia desde varios lugares; no hay circulación de documentos.
//
// Factibilidad en CKAN (S6): una colección es un `group` y su pertenencia, `group_member` (nativos; medido:
// `ckan.auth.user_create_groups = true`, cualquier usuario con sesión puede crear una). La aprobación por
// organización de RF-23 **no es nativa**: sería una extensión propia, como las solicitudes de publicación.
// La descripción en markdown (`markdown`) es el `description` nativo del `group`; el resumen corto, un `extra`.
//
// Visibilidad (Q10 de `design-system/datos-umss/preguntas-abiertas.md`, decidida el 2026-10-26): la privada
// depende de quién cura la colección —la de una persona la ve sólo esa persona; la de una organización, sus
// miembros—; la interna, cualquier usuario con sesión; la pública, cualquiera. Ni la privada ni la interna son
// nativas (un `group` de CKAN es siempre público), y que una organización sea dueña de una colección tampoco.

export type Visibility = "Pública" | "Interna" | "Privada";

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
		// El título y la organización del dataset real de la instancia de demostración, para que el salto de la
		// ficha real a esta maqueta no se note (`presentation/guion.md`, historia 2).
		title: "Matrícula estudiantil por carrera y gestión",
		org: "fcs",
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
	/** Resumen corto, bajo el título. */
	description: string;
	/** Descripción larga en markdown, como la de un dataset (RF-39). */
	markdown: string;
	curator: Curator;
	created: string;
	updated: string;
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
		markdown: `### Propósito

Esta colección reúne la información que la Universidad presenta en la **rendición pública de cuentas** de la gestión 2025, para que cualquier persona pueda revisar los datos detrás de cada informe.

### Qué reúne

- Los informes de gestión de cada facultad participante.
- La matrícula estudiantil por carrera de los últimos cinco años.
- Los titulados por facultad, con su serie histórica.

Cada dataset se publica en su organización dueña; la colección sólo los referencia, de modo que una corrección hecha en el dataset original se refleja aquí sin pasos adicionales.

### Curaduría y actualización

La cura el **Rectorado**. Se revisa una vez al año, antes del acto de rendición de cuentas, y se incorporan los informes de las facultades que se sumen.`,
		curator: { kind: "org", org: "rectorado" },
		created: "3 ago. 2026",
		updated: "14 oct. 2026",
		visibility: "Privada",
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
		markdown: `### Propósito

Reúne la producción de investigación de la **Facultad de Ciencias y Tecnología** para su evaluación anual.

### Qué reúne

- Los proyectos de investigación financiados en 2025.
- Las publicaciones científicas indexadas.
- El equipamiento disponible en los laboratorios.
- El informe de gestión de la facultad, como contexto.

### Curaduría y actualización

La cura la **Dirección de Investigación**, que la actualiza cada semestre al cierre de la convocatoria de proyectos.`,
		curator: { kind: "org", org: "direccion-investigacion" },
		created: "12 may. 2026",
		updated: "20 oct. 2026",
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
		markdown: `### Propósito

Series de datos que sirven de base para una tesis de maestría sobre **indicadores académicos** de la Universidad.

### Qué reúne

- Matrícula y titulación, para medir la eficiencia terminal.
- Publicaciones indexadas, como indicador de producción científica.
- Rendimiento de cultivos andinos, para el capítulo de extensión.

### Curaduría y actualización

La cura una investigadora a título personal. Se actualiza cuando las organizaciones dueñas publican nuevas series.`,
		curator: { kind: "user", name: "María Fernanda Rojas Vargas" },
		created: "20 feb. 2026",
		updated: "17 oct. 2026",
		visibility: "Pública",
		datasets: [
			"matricula-por-carrera",
			"titulados-por-facultad",
			"publicaciones-indexadas",
			"rendimiento-cultivos-andinos",
		],
		approvals: {
			fcs: "Aprobada",
			rectorado: "Aprobada",
			"direccion-investigacion": "Aprobada",
			fca: "Aprobada",
		},
	},
	{
		slug: "seguridad-alimentaria-salud",
		name: "Seguridad alimentaria y salud",
		description:
			"Datos de salud y de producción agrícola para un proyecto conjunto entre la Facultad de Ciencias de la Salud y la de Ciencias Agrícolas.",
		markdown: `### Propósito

Datos para un **proyecto conjunto** entre la Facultad de Ciencias de la Salud y la Facultad de Ciencias Agrícolas sobre seguridad alimentaria.

### Qué reúne

- El informe de gestión 2025 de la Facultad de Ciencias de la Salud.
- El rendimiento de las parcelas experimentales de cultivos andinos.

### Curaduría y actualización

La cura la coordinadora del proyecto. Se actualiza al cierre de cada etapa del proyecto.`,
		curator: { kind: "user", name: "Ana Gabriela Céspedes" },
		created: "1 sep. 2026",
		updated: "9 oct. 2026",
		visibility: "Interna",
		datasets: ["informe-gestion-2025-fcs", "rendimiento-cultivos-andinos"],
	},
	{
		slug: "capitulo-eficiencia-terminal",
		name: "Lista de trabajo: capítulo de eficiencia terminal",
		description:
			"Datasets que reviso para el capítulo de eficiencia terminal de mi tesis, antes de decidir cuáles cito.",
		markdown: `### Propósito

Una **lista de trabajo** para el capítulo de eficiencia terminal de una tesis de maestría: reúne los datasets que se están revisando, sin necesidad de publicarlos.

### Qué reúne

- La matrícula estudiantil por carrera.
- Los titulados por facultad.
- El informe de gestión 2025 de la Facultad de Ciencias de la Salud, como contexto.

### Curaduría y actualización

La cura una investigadora a título personal y sólo la ve ella. Si el capítulo se publica, puede pasar a interna o solicitar su publicación.`,
		curator: { kind: "user", name: "María Fernanda Rojas Vargas" },
		created: "21 oct. 2026",
		updated: "24 oct. 2026",
		visibility: "Privada",
		datasets: ["matricula-por-carrera", "titulados-por-facultad", "informe-gestion-2025-fcs"],
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

/**
 * Quién mira la maqueta: un visitante sin sesión o un miembro de una organización. `name` es la persona, para
 * sus colecciones privadas; sin él, el miembro no cura ninguna a título personal.
 */
export type Viewer = { kind: "visitor" } | { kind: "member"; org: string; name?: string };

/** Quien mira «Mis colecciones» en el panel: una persona fija, miembro del Rectorado. */
export const PANEL_VIEWER = {
	kind: "member",
	org: "rectorado",
	name: "María Fernanda Rojas Vargas",
} as const satisfies Viewer;

/** Las colecciones que cura quien mira: a título personal o por una de sus organizaciones. */
export function curatedBy(collection: MockCollection, viewer: Viewer): boolean {
	if (viewer.kind === "visitor") return false;
	return collection.curator.kind === "org"
		? collection.curator.org === viewer.org
		: collection.curator.name === viewer.name;
}

/** Q10: si quien mira puede ver la colección. */
export function canSee(collection: MockCollection, viewer: Viewer): boolean {
	if (collection.visibility === "Pública") return true;
	if (viewer.kind === "visitor") return false;
	if (collection.visibility === "Interna") return true;
	// Privada: la de una organización, sus miembros; la de una persona, sólo esa persona.
	return curatedBy(collection, viewer);
}

/** Q10: quién ve la colección, dicho en una frase. */
export function audienceLabel(collection: MockCollection): string {
	if (collection.visibility === "Pública") return "La ve cualquier persona";
	if (collection.visibility === "Interna") return "La ven los usuarios con sesión";
	return collection.curator.kind === "org"
		? `Sólo la ven los miembros de ${ORGS[collection.curator.org].title}`
		: "Sólo la ve quien la cura";
}

export function curatorLabel(curator: Curator): string {
	return curator.kind === "org" ? ORGS[curator.org].title : curator.name;
}

/**
 * Ficha real (slug de CKAN) → dataset de maqueta, para la sección de colecciones de la ficha real en modo
 * prototipo (`$lib/prototype/mode.ts`). Los slugs reales no coinciden con los de la maqueta; un dataset real
 * sin entrada acá no muestra la sección.
 */
export const REAL_TO_MOCK_DATASET: Record<string, string> = {
	"matricula-estudiantil-por-carrera-y-gestion": "matricula-por-carrera",
};

/** Las colecciones de una ficha real que quien mira puede ver; `null` si el dataset real no tiene maqueta. */
export function collectionsOfRealDataset(
	realSlug: string,
	viewer: Viewer,
): MockCollection[] | null {
	const mock = REAL_TO_MOCK_DATASET[realSlug];
	if (!mock) return null;
	return collectionsOf(mock).filter((c) => canSee(c, viewer));
}

/** «Colecciones que cura» una organización (Q18), con su slug real (igual a la clave de `ORGS`). */
export function collectionsCuratedByOrg(org: string, viewer: Viewer): MockCollection[] {
	return COLLECTIONS.filter(
		(c) => c.curator.kind === "org" && c.curator.org === org && canSee(c, viewer),
	);
}

export const collectionHref = (slug: string) => `/dev/prototype/collection?c=${slug}`;
export const datasetHref = (slug: string) => `/dev/prototype/dataset-collections?d=${slug}`;
