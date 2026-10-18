#!/usr/bin/env node
// Generador determinista del CSV ficticio «Producción de investigación» — T7 de
// odd/tasks/csv-charts.md (tema elegido por el autor en L42).
//
// Escribe `scripts/data/produccion-investigacion-ficticia.csv`. Una fila es un producto de
// investigación (artículo, libro, tesis…) de un departamento, con el proyecto que lo originó
// y su fuente de financiamiento. Todo es inventado y apunta al contrato de
// `odd/tasks/csv-charts.md`:
//
//   · pastel por `tipo_producto` (`value`, `count`): 8 tipos con una cola larga, de los
//     artículos indexados a las patentes
//   · barras por `departamento` (`value`, `count`) y por `fuente_financiamiento`
//   · líneas por `anio` (`value` o `number_step` 1, `count`): la producción crece desde 2015
//   · `proyecto_id` (`count_distinct`): cada proyecto da varios productos, así que contar
//     filas y contar proyectos distintos da números distintos
//   · `autores` (numérica pequeña) → `avg`, `min`, `max` y `number_step`
//   · `proyecto_id` y `fuente_financiamiento` traen vacíos a propósito → el grupo `null`
//     (un producto sin proyecto asociado es un caso real)
//
// `anio` es un **entero** (2015–2025), como la gestión de la matrícula: el dato es el año de
// publicación, no una fecha completa. Las fechas por año/trimestre/mes las ejercita el
// dataset de ejecución presupuestaria.
//
// Reglas de L36: punto decimal, sin separador de miles, celda vacía para «sin dato», nunca
// `NA`, `-` ni `s/d`. `TYPES` es el mapa para el paso de tipos de xloader (T7b).
//
// Determinismo: `mulberry32` con semilla fija; dos corridas dan bytes idénticos.
//
// Uso:
//   node scripts/generate-investigacion-csv.mjs

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatCsv, makeRandom, writeDataset } from "./generate-csv-common.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const OUTPUT_PATH = resolve(HERE, "data", "produccion-investigacion-ficticia.csv");
export const DEFAULT_SEED = 20261020;
export const PROJECT_COUNT = 240;

/** Columnas, en el orden del CSV. */
export const COLUMNS = [
	"departamento",
	"tipo_producto",
	"anio",
	"fuente_financiamiento",
	"proyecto_id",
	"autores",
];

/** Tipo de cada columna para xloader (`type_override`), por nombre exacto de encabezado. */
export const TYPES = {
	departamento: "text",
	tipo_producto: "text",
	anio: "numeric",
	fuente_financiamiento: "text",
	proyecto_id: "text",
	autores: "numeric",
};

export const FIRST_YEAR = 2015;
export const LAST_YEAR = 2025;

/** Departamentos académicos con su peso: los de ciencias e ingeniería publican más. */
const DEPARTMENTS = [
	["Biología", 14],
	["Química", 11],
	["Física", 7],
	["Informática y Sistemas", 13],
	["Ingeniería Civil", 10],
	["Ingeniería Eléctrica", 6],
	["Medicina", 12],
	["Enfermería", 4],
	["Agronomía", 9],
	["Economía", 6],
	["Derecho", 4],
	["Ciencias de la Educación", 5],
];

/** Tipos de producto: `[tipo, peso, [mínimo, máximo de autores]]`. */
const PRODUCT_TYPES = [
	["Artículo en revista indexada", 30, [3, 8]],
	["Artículo en revista regional", 22, [2, 5]],
	["Tesis de posgrado", 16, [1, 2]],
	["Ponencia en congreso", 15, [2, 6]],
	["Informe técnico", 8, [2, 6]],
	["Capítulo de libro", 5, [1, 4]],
	["Libro", 3, [1, 3]],
	["Patente", 1, [2, 5]],
];

/** `weighted` quiere `[valor, peso]`: el valor es la entrada entera, con sus autores. */
const PRODUCT_WEIGHTS = PRODUCT_TYPES.map((entry) => [entry, entry[1]]);

const FUNDING_SOURCES = [
	["Recursos propios UMSS", 38],
	["Fondo concursable nacional", 22],
	["Cooperación internacional", 20],
	["Convenio con empresa", 10],
	["Gobierno departamental", 6],
	["Sin financiamiento externo", 4],
];

const PROB_EMPTY_PROJECT = 0.05;
const PROB_EMPTY_FUNDING = 0.03;

const projectId = (year, n) => `PRY-${year}-${String(n).padStart(4, "0")}`;

/** Los proyectos nacen sesgados a años recientes (la actividad de investigación crece). */
function makeProjects(rnd) {
	const years = [];
	for (let year = FIRST_YEAR; year <= LAST_YEAR; year++)
		years.push([year, 1 + (year - FIRST_YEAR)]);
	const projects = [];
	for (let n = 1; n <= PROJECT_COUNT; n++) {
		const year = rnd.weighted(years);
		projects.push({
			id: projectId(year, n),
			year,
			department: rnd.weighted(DEPARTMENTS),
			funding: rnd.weighted(FUNDING_SOURCES),
		});
	}
	return projects;
}

/**
 * Genera las filas; cada valor ya viene formateado como texto. Un proyecto fija su
 * departamento y su fuente, y sus productos salen desde el año en que empezó.
 */
export function generateRows({ seed = DEFAULT_SEED } = {}) {
	const rnd = makeRandom(seed);
	const projects = makeProjects(rnd);
	const rows = [];

	for (const project of projects) {
		const products = rnd.int(1, 7);
		for (let i = 0; i < products; i++) {
			const [type, , authors] = rnd.weighted(PRODUCT_WEIGHTS);
			const year = Math.min(LAST_YEAR, project.year + rnd.int(0, 3));
			rows.push({
				departamento: project.department,
				tipo_producto: type,
				anio: String(year),
				fuente_financiamiento: rnd.chance(PROB_EMPTY_FUNDING) ? "" : project.funding,
				proyecto_id: project.id,
				autores: String(rnd.int(authors[0], authors[1])),
			});
		}
	}

	// Productos sin proyecto (tesis, ponencias sueltas): `proyecto_id` vacío.
	const orphans = Math.round(rows.length * PROB_EMPTY_PROJECT);
	for (let i = 0; i < orphans; i++) {
		const [type, , authors] = rnd.weighted(PRODUCT_WEIGHTS);
		rows.push({
			departamento: rnd.weighted(DEPARTMENTS),
			tipo_producto: type,
			anio: String(rnd.int(FIRST_YEAR, LAST_YEAR)),
			fuente_financiamiento: rnd.chance(PROB_EMPTY_FUNDING) ? "" : rnd.weighted(FUNDING_SOURCES),
			proyecto_id: "",
			autores: String(rnd.int(authors[0], authors[1])),
		});
	}

	// Orden estable por año y proyecto, como un registro que se va llenando.
	rows.sort(
		(a, b) => Number(a.anio) - Number(b.anio) || a.proyecto_id.localeCompare(b.proyecto_id),
	);
	return rows;
}

export function generateCsv(options) {
	return formatCsv(generateRows(options), COLUMNS);
}

// ── CLI ──

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
	writeDataset(OUTPUT_PATH, generateCsv(), generateRows().length);
}
