// Datos fijos de las maquetas de colecciones (P5 de `odd/tasks/prototype-presentation.md`, S4 y L3).
//
// Las tres maquetas —«Colecciones» (la del menú principal y «Mis colecciones» del panel), «Ficha de
// colección» y «Colecciones de un dataset»— leen de acá, para que el recorrido en los dos sentidos sea coherente: `ds1 → cl1 → ds2 → cl2 → ds3`. La
// matrícula está en tres colecciones públicas de curadores distintos —una persona, el Vicerrectorado y su propia
// facultad— para que la ficha real (H2-4, en modo prototipo) muestre varias (S42). Por ejemplo, el informe de
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
	/**
	 * De quién depende, con la forma de `/organizations` (`ListedOrganization.groups`): los grupos en los que está
	 * la organización, y el primero es la madre. Jerarquía figurativa (Q6): sólo navegación, sin permisos.
	 */
	groups?: { name: string }[];
	/** Sólo existe en la maqueta (no en el catálogo de la demo): se nombra sin enlace, para que un clic en vivo no lleve a «no encontrada». */
	mockOnly?: true;
}

/**
 * Las organizaciones de `src/lib/mock/data.ts`, con la sigla que tenían en la propuesta de organizaciones (hoy
 * promovida a `/organizations`, T27), y el Vicerrectorado, que sólo existe acá para que la ruta de la ficha tenga
 * un nivel intermedio (S36): Rectorado › Vicerrectorado › Dirección de Investigación; las facultades, bajo el
 * Rectorado.
 */
export const ORGS: Record<string, Org> = {
	fcyt: {
		name: "fcyt",
		title: "Facultad de Ciencias y Tecnología",
		acronym: "FCyT",
		groups: [{ name: "rectorado" }],
	},
	fcs: {
		name: "fcs",
		title: "Facultad de Ciencias de la Salud",
		acronym: "FCS",
		groups: [{ name: "rectorado" }],
	},
	fca: {
		name: "fca",
		title: "Facultad de Ciencias Agrícolas",
		acronym: "FCAPyF",
		groups: [{ name: "rectorado" }],
	},
	rectorado: { name: "rectorado", title: "Rectorado UMSS", acronym: "UMSS" },
	vicerrectorado: {
		name: "vicerrectorado",
		title: "Vicerrectorado",
		acronym: "VR",
		groups: [{ name: "rectorado" }],
		mockOnly: true,
	},
	"direccion-investigacion": {
		name: "direccion-investigacion",
		title: "Dirección de Investigación",
		acronym: "DICyT",
		groups: [{ name: "vicerrectorado" }],
	},
};

/** La cadena de una organización, de la más alta hasta ella. Corta si una madre no está o si el árbol da la vuelta. */
export function orgAncestry(name: string): Org[] {
	const chain: Org[] = [];
	let current: Org | undefined = ORGS[name];
	while (current && !chain.includes(current)) {
		chain.unshift(current);
		const parent: string | undefined = current.groups?.[0]?.name;
		current = parent ? ORGS[parent] : undefined;
	}
	return chain;
}

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
	{
		slug: "produccion-cientifica-2025",
		name: "Producción científica 2025",
		description:
			"Los proyectos financiados y las publicaciones indexadas de la gestión 2025, para el informe anual de investigación.",
		markdown: `### Propósito

Reúne la **producción científica** de la Universidad en la gestión 2025 para el informe anual de investigación.

### Qué reúne

- Los proyectos de investigación financiados en 2025.
- Las publicaciones científicas indexadas.

### Curaduría y actualización

La cura la **Dirección de Investigación**, que la actualiza al cierre de cada gestión.`,
		curator: { kind: "org", org: "direccion-investigacion" },
		created: "4 mar. 2026",
		updated: "20 oct. 2026",
		visibility: "Pública",
		datasets: ["proyectos-investigacion-2025", "publicaciones-indexadas"],
		approvals: { "direccion-investigacion": "Aprobada" },
	},
	{
		slug: "autoevaluacion-acreditacion-fcyt",
		name: "Autoevaluación para la acreditación de la FCyT",
		description:
			"Gestión, equipamiento y titulación de la Facultad de Ciencias y Tecnología, reunidos para la autoevaluación de sus carreras.",
		markdown: `### Propósito

Reúne la información que la **Facultad de Ciencias y Tecnología** presenta en la autoevaluación de sus carreras para la acreditación.

### Qué reúne

- El informe de gestión 2025 de la facultad.
- El equipamiento de sus laboratorios.
- Los titulados por facultad, con su serie histórica.

### Curaduría y actualización

La cura la **Facultad de Ciencias y Tecnología**. Se actualiza antes de cada proceso de acreditación.`,
		curator: { kind: "org", org: "fcyt" },
		created: "18 jun. 2026",
		updated: "14 oct. 2026",
		visibility: "Pública",
		datasets: [
			"informe-gestion-2025-fcyt",
			"equipamiento-laboratorios-fcyt",
			"titulados-por-facultad",
		],
		approvals: { fcyt: "Aprobada", rectorado: "Aprobada" },
	},
	{
		slug: "produccion-agricola-experimental",
		name: "Producción agrícola experimental",
		description:
			"Rendimiento de las parcelas experimentales y los proyectos de investigación agrícola de la Facultad de Ciencias Agrícolas.",
		markdown: `### Propósito

Reúne los datos de las **parcelas experimentales** de la Facultad de Ciencias Agrícolas y los proyectos que las financian.

### Qué reúne

- El rendimiento de cultivos andinos en las parcelas experimentales.
- Los proyectos de investigación financiados en 2025.

### Curaduría y actualización

La cura la **Facultad de Ciencias Agrícolas**, al cierre de cada campaña agrícola.`,
		curator: { kind: "org", org: "fca" },
		created: "9 abr. 2026",
		updated: "6 oct. 2026",
		visibility: "Pública",
		datasets: ["rendimiento-cultivos-andinos", "proyectos-investigacion-2025"],
		approvals: { fca: "Aprobada", "direccion-investigacion": "Aprobada" },
	},
	{
		slug: "estadisticas-academicas-pregrado",
		name: "Estadísticas académicas de pregrado",
		description:
			"Matrícula y titulación de las carreras de pregrado, reunidas para el seguimiento académico de la Universidad.",
		markdown: `### Propósito

Reúne las series que el **Vicerrectorado** consulta para el seguimiento académico de las carreras de pregrado.

### Qué reúne

- La matrícula estudiantil por carrera y gestión.
- Los titulados por facultad, con su serie histórica.

### Curaduría y actualización

La cura el **Vicerrectorado**. Se actualiza al cierre de cada gestión académica, cuando las organizaciones dueñas publican sus nuevas series.`,
		curator: { kind: "org", org: "vicerrectorado" },
		created: "15 mar. 2026",
		updated: "2 oct. 2026",
		visibility: "Pública",
		datasets: ["matricula-por-carrera", "titulados-por-facultad"],
		approvals: { fcs: "Aprobada", rectorado: "Aprobada" },
	},
	{
		slug: "ciencias-salud-en-cifras",
		name: "La Facultad de Ciencias de la Salud en cifras",
		description:
			"Matrícula, titulación y gestión de la Facultad de Ciencias de la Salud, reunidas en un solo lugar.",
		markdown: `### Propósito

Reúne los datos con los que la **Facultad de Ciencias de la Salud** presenta su situación académica a estudiantes, docentes y público en general.

### Qué reúne

- La matrícula estudiantil por carrera y gestión.
- Los titulados por facultad, con su serie histórica.
- El informe de gestión 2025 de la facultad.

### Curaduría y actualización

La cura la **Facultad de Ciencias de la Salud**. Se actualiza al cierre de cada gestión.`,
		curator: { kind: "org", org: "fcs" },
		created: "7 jul. 2026",
		updated: "9 oct. 2026",
		visibility: "Pública",
		datasets: ["matricula-por-carrera", "titulados-por-facultad", "informe-gestion-2025-fcs"],
		approvals: { fcs: "Aprobada", rectorado: "Aprobada" },
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
 * Quién mira la maqueta: un visitante sin sesión o un usuario con sesión, miembro de cero o más organizaciones
 * (Q8: una persona puede ser miembro de varias). `name` es la persona, para sus colecciones privadas; sin él,
 * no cura ninguna a título personal.
 */
export type Viewer =
	| { kind: "visitor" }
	| { kind: "member"; orgs: readonly string[]; name?: string };

/**
 * Quien mira «Mis colecciones» en el panel: una persona fija, con las tres organizaciones de la maqueta de
 * usuarios (`../users/+page.svelte`): Dirección de Investigación, FCyT y Rectorado.
 */
export const PANEL_VIEWER = {
	kind: "member",
	orgs: ["direccion-investigacion", "fcyt", "rectorado"],
	name: "María Fernanda Rojas Vargas",
} as const satisfies Viewer;

/** Las colecciones que cura quien mira: a título personal o por una de sus organizaciones. */
export function curatedBy(collection: MockCollection, viewer: Viewer): boolean {
	if (viewer.kind === "visitor") return false;
	return collection.curator.kind === "org"
		? viewer.orgs.includes(collection.curator.org)
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
 * «Curada por» sin ambigüedad (Q10, S22): la cura una organización o una persona a título personal. El hero de
 * la ficha lo dice en una frase; `name` va resaltado.
 */
export function curatorPhrase(curator: Curator): { before: string; name: string; after: string } {
	return curator.kind === "org"
		? { before: "Curada por la organización", name: ORGS[curator.org].title, after: "" }
		: { before: "Curada por", name: curator.name, after: ", a título personal" };
}

// ─── Pestañas de organización (S22) ──────────────────────────────

/** La pestaña de las colecciones que cura una persona, no una organización. */
export const PERSONALES = "__personales__";

export interface CuratorTab {
	/** `TODAS_LAS_ORGANIZACIONES`, `PERSONALES` o el nombre de la organización. */
	id: string;
	label: string;
	count: number;
}

/**
 * Las pestañas de organización de una lista de colecciones, con la forma de las de «Solicitudes»
 * (`$lib/components/requests/requests-model.ts`): «Todas» primero, después la de las personales —si hay alguna—
 * y una por organización, en orden alfabético (es). `orgs` fija qué organizaciones tienen pestaña aunque no
 * curen ninguna (las de quien mira, en «Mis colecciones»); sin él, las que curan alguna de la lista.
 */
export function curatorTabs(
	collections: MockCollection[],
	{ todas, personales, orgs }: { todas: string; personales: string; orgs?: readonly string[] },
): CuratorTab[] {
	const byOrg = (org: string) =>
		collections.filter((c) => c.curator.kind === "org" && c.curator.org === org).length;
	const names = orgs ?? [
		...new Set(collections.flatMap((c) => (c.curator.kind === "org" ? [c.curator.org] : []))),
	];
	const organizations = names
		.map((name) => ({ id: name, label: ORGS[name].title, count: byOrg(name) }))
		.sort((a, b) => a.label.localeCompare(b.label, "es"));
	const personal = collections.filter((c) => c.curator.kind === "user").length;
	return [
		{ id: todas, label: "Todas", count: collections.length },
		...(personal > 0 ? [{ id: PERSONALES, label: personales, count: personal }] : []),
		...organizations,
	];
}

/** Las colecciones de una pestaña de organización; cualquier otra pestaña («Todas») no filtra. */
export function inCuratorTab(collections: MockCollection[], tab: string): MockCollection[] {
	if (tab === PERSONALES) return collections.filter((c) => c.curator.kind === "user");
	if (!(tab in ORGS)) return collections;
	return collections.filter((c) => c.curator.kind === "org" && c.curator.org === tab);
}

/** El nombre accesible del conteo de una pestaña: «1 colección», «3 colecciones». */
export const collectionsCountLabel = (n: number) => `${n} ${n === 1 ? "colección" : "colecciones"}`;

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
export const organizationHref = (name: string) => `/organization/${name}`;

/** `?curador=` de la lista de colecciones: la pestaña con la que abre (`personales` o el nombre de una organización). */
export const CURADOR_PARAM = "curador";
export const personalesHref = `/dev/prototype/collections?${CURADOR_PARAM}=personales`;

/** La pestaña que pide `?curador=`; sin él, «Todas». */
export function curatorTabFromUrl(url: URL, todas: string): string {
	const value = url.searchParams.get(CURADOR_PARAM);
	if (value === "personales") return PERSONALES;
	return value ?? todas;
}

export const collectionsHref = "/dev/prototype/collections";

/**
 * La ruta de navegación de la ficha (S36), sin «Inicio»: la raíz es «Colecciones», la lista (S42). Curada por una
 * organización: después, su árbol, de la más alta hasta la curadora, cada una hacia su ficha. Curada por una persona
 * no hay árbol: «Personales», hacia la lista con esa pestaña. Al final, la colección.
 */
export function collectionTrail(
	collection: MockCollection,
): { label: string; href?: string; role?: string }[] {
	const curator =
		collection.curator.kind === "org"
			? orgAncestry(collection.curator.org).map((org) => ({
					label: org.title,
					href: org.mockOnly ? undefined : organizationHref(org.name),
					role: "Organización",
				}))
			: [{ label: "Personales", href: personalesHref, role: "Curador" }];
	return [
		{ label: "Colecciones", href: collectionsHref, role: "Lista" },
		...curator,
		{ label: collection.name, role: "Colección" },
	];
}
export const datasetHref = (slug: string) => `/dev/prototype/dataset-collections?d=${slug}`;
