// Fixtures deterministas de la hoja `/dev/search`: ~6 cards con contenido de catálogo al estilo
// UMSS. Nada se busca en CKAN —el buscador real ya cubre eso—, así que los números del instrumento
// y las capturas son reproducibles. Los casos cubren los bordes del recorte de tags y formatos:
// exactamente 3 tags (sin `+N`), 8 tags y 6 formatos (recorte ancho), título muy largo y cero tags.

import type { CkanPackage, CkanResource, CkanTag } from "$lib/types/ckan";

export interface SheetCase {
	id: string;
	label: string;
	/** Qué borde del recorte cubre, en una línea. */
	description: string;
	datasets(): CkanPackage[];
}

const ORGS = [
	"Departamento de Admisiones",
	"Facultad de Ciencias y Tecnología",
	"Instituto de Investigaciones Sociales",
	"Vicerrectorado Académico",
	"Departamento de Estadística",
	"Facultad de Humanidades",
];

const TITLES = [
	"Matrícula estudiantil 2026",
	"Presupuesto ejecutado por facultad",
	"Egresados por carrera y gestión",
	"Encuesta de satisfacción docente",
	"Inventario de infraestructura",
	"Indicadores de investigación",
];

const SUMMARIES = [
	"Registro consolidado de estudiantes inscritos por carrera, gestión y turno, con la modalidad de ingreso.",
	"Ejecución presupuestaria por unidad, partida y trimestre, tal como se reporta a la Contraloría.",
	"Egresados titulados por carrera, gestión y modalidad de graduación.",
	"Resultados agregados de la encuesta semestral a docentes y asignaturas.",
	"Inventario de aulas, laboratorios y equipamiento por edificio y facultad.",
	"Indicadores de producción científica por investigador, proyecto y año.",
];

const TAG_NAMES = [
	"estudiantes",
	"presupuesto",
	"egresados",
	"docentes",
	"infraestructura",
	"investigación",
	"admisiones",
	"acreditación",
	"género",
	"becas",
];

const FORMAT_POOL = ["CSV", "JSON", "PDF", "XLSX", "XML", "RDF"];

function makeTag(name: string): CkanTag {
	return { id: `tag-${name}`, name, display_name: name, state: "active" };
}

function makeResource(format: string, index: number, datasetName: string): CkanResource {
	return {
		id: `${datasetName}-res-${index}`,
		package_id: datasetName,
		name: `recurso-${format.toLowerCase()}-${index}`,
		url: `https://datos.umss.edu.bo/dataset/${datasetName}/resource/${index}`,
		format,
		created: "2026-01-15T10:00:00.000000",
		last_modified: "2026-03-02T09:30:00.000000",
		state: "active",
		position: index,
	};
}

interface CaseShape {
	tags: number;
	/** Número de formatos por card, o una lista para variarlos card a card. */
	formats: number | number[];
	longTitle?: boolean;
}

function buildDatasets(shape: CaseShape): CkanPackage[] {
	return TITLES.map((title, index) => {
		const name = `muestra-${index + 1}`;
		const formatCount = Array.isArray(shape.formats) ? (shape.formats[index] ?? 1) : shape.formats;
		const formats = FORMAT_POOL.slice(0, formatCount);

		return {
			id: name,
			name,
			title: shape.longTitle
				? `${title} — desagregación por facultad, carrera, gestión, turno y modalidad de ingreso para el período académico 2020-2026`
				: title,
			notes: SUMMARIES[index],
			private: index === 4,
			state: "active",
			organization: {
				id: `org-${index}`,
				name: `org-${index}`,
				title: ORGS[index],
				description: "Muestra determinista para la hoja de decisión.",
				created: "2020-01-01T00:00:00.000000",
				state: "active",
				package_count: 12 - index,
			},
			owner_org: `org-${index}`,
			resources: formats.map((format, formatIndex) => makeResource(format, formatIndex, name)),
			tags: TAG_NAMES.slice(0, shape.tags).map(makeTag),
			groups: [],
			extras: [],
			metadata_created: "2026-01-15T10:00:00.000000",
			metadata_modified: "2026-03-02T09:30:00.000000",
			license_id: "cc-by",
			license_title: "Creative Commons Attribution",
		} satisfies CkanPackage;
	});
}

export const CASES: SheetCase[] = [
	{
		id: "tags8-format6",
		label: "8 etiquetas · 6 formatos",
		description: "El recorte más ancho: 3 tags visibles +5, 4 formatos +2 más.",
		datasets: () => buildDatasets({ tags: 8, formats: 6 }),
	},
	{
		id: "tags3-format1",
		label: "3 etiquetas · 1 formato",
		description: "El borde exacto: no debe aparecer ningún `+N`.",
		datasets: () => buildDatasets({ tags: 3, formats: 1 }),
	},
	{
		id: "long-title",
		label: "Título muy largo",
		description: "El título se recorta a dos líneas; el alto de la card cambia.",
		datasets: () => buildDatasets({ tags: 3, formats: 3, longTitle: true }),
	},
	{
		id: "no-tags",
		label: "Sin etiquetas",
		description: "Cero tags y formatos variables: la card no dibuja el bloque de tags.",
		datasets: () => buildDatasets({ tags: 0, formats: [1, 2, 3, 6, 4, 5] }),
	},
];

export const DEFAULT_CASE = "tags8-format6";

export function getCase(id: string): SheetCase {
	return CASES.find((sheetCase) => sheetCase.id === id) ?? CASES[0];
}
