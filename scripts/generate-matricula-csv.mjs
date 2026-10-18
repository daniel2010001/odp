#!/usr/bin/env node
// Generador determinista del CSV ficticio «Matrícula por facultad y gestión» — T7 de
// odd/tasks/csv-charts.md (tema elegido por el autor en L42).
//
// Escribe `scripts/data/matricula-facultad-gestion-ficticia.csv`. Una fila es el número de
// inscritos de una carrera en una gestión, por sexo y modalidad. Los valores son inventados
// (carreras plausibles de la UMSS, ningún dato oficial) y están pensados para ejercitar el
// contrato de `odd/tasks/csv-charts.md`:
//
//   · barras por `facultad` (`value`, `sum` de `inscritos`): Ciencias y Tecnología y Ciencias
//     Económicas encabezan; Arquitectura queda al final
//   · líneas por `gestion` (`value` o `number_step` 1, `sum` de `inscritos`): crece cada año,
//     con una caída marcada en 2020 y la modalidad virtual apareciendo ese año
//   · pastel por `sexo` (`value`, `count` o `sum`): casi mitad y mitad, más una rebanada sin dato
//   · `modalidad` (`value`) y `carrera` (`value`, `count_distinct`, 30+ valores) para el resto
//   · `sexo` y `modalidad` traen vacíos a propósito → el grupo `null`
//
// `gestion` es un **entero** (2015–2025) y no una fecha: una gestión académica es una
// etiqueta de año, no un instante, y fingirle un `YYYY-01-01` sería inventar un día que el
// dato no tiene. Como número, se agrupa por `value` o por `number_step` 1. Las fechas por
// año/trimestre/mes las ejercita el dataset de ejecución presupuestaria.
//
// Reglas de L36: punto decimal, sin separador de miles, celda vacía para «sin dato», nunca
// `NA`, `-` ni `s/d`. `TYPES` es el mapa para el paso de tipos de xloader (T7b).
//
// Determinismo: `mulberry32` con semilla fija; dos corridas dan bytes idénticos.
//
// Uso:
//   node scripts/generate-matricula-csv.mjs

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatCsv, makeRandom, writeDataset } from "./generate-csv-common.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const OUTPUT_PATH = resolve(HERE, "data", "matricula-facultad-gestion-ficticia.csv");
export const DEFAULT_SEED = 20261018;

/** Columnas, en el orden del CSV. */
export const COLUMNS = ["facultad", "carrera", "gestion", "sexo", "modalidad", "inscritos"];

/** Tipo de cada columna para xloader (`type_override`), por nombre exacto de encabezado. */
export const TYPES = {
	facultad: "text",
	carrera: "text",
	gestion: "numeric",
	sexo: "text",
	modalidad: "text",
	inscritos: "numeric",
};

export const FIRST_YEAR = 2015;
export const LAST_YEAR = 2025;

/**
 * Carreras por facultad: `[carrera, inscritos base por gestión, primera gestión]`, y la
 * proporción de mujeres de la facultad. Las carreras nuevas no tienen filas antes de abrir.
 */
const FACULTIES = [
	{
		name: "Ciencias y Tecnología",
		female: 0.3,
		careers: [
			["Ingeniería Civil", 420, 2015],
			["Ingeniería de Sistemas", 380, 2015],
			["Ingeniería Industrial", 300, 2015],
			["Ingeniería Eléctrica", 220, 2015],
			["Ingeniería Química", 180, 2015],
			["Ciencia de Datos", 90, 2022],
		],
	},
	{
		name: "Ciencias Económicas",
		female: 0.52,
		careers: [
			["Administración de Empresas", 450, 2015],
			["Contaduría Pública", 400, 2015],
			["Ingeniería Comercial", 330, 2015],
			["Economía", 220, 2015],
		],
	},
	{
		name: "Ciencias Jurídicas y Políticas",
		female: 0.55,
		careers: [
			["Derecho", 600, 2015],
			["Ciencias Políticas", 140, 2015],
		],
	},
	{
		name: "Ciencias de la Salud",
		female: 0.68,
		careers: [
			["Medicina", 520, 2015],
			["Enfermería", 360, 2015],
			["Odontología", 300, 2015],
			["Bioquímica y Farmacia", 240, 2015],
			["Nutrición y Dietética", 130, 2017],
		],
	},
	{
		name: "Ciencias Agrícolas",
		female: 0.38,
		careers: [
			["Ingeniería Agronómica", 210, 2015],
			["Medicina Veterinaria", 190, 2015],
			["Ingeniería Forestal", 110, 2015],
		],
	},
	{
		name: "Humanidades y Ciencias de la Educación",
		female: 0.62,
		careers: [
			["Ciencias de la Educación", 260, 2015],
			["Comunicación Social", 210, 2015],
			["Lingüística e Idiomas", 190, 2015],
		],
	},
	{
		name: "Ciencias Sociales",
		female: 0.64,
		careers: [
			["Psicología", 280, 2015],
			["Trabajo Social", 230, 2015],
			["Sociología", 150, 2015],
			["Antropología", 90, 2018],
		],
	},
	{
		name: "Arquitectura y Ciencias del Hábitat",
		female: 0.5,
		careers: [
			["Arquitectura", 340, 2015],
			["Diseño Gráfico", 160, 2016],
		],
	},
];

/** Participación de cada modalidad por gestión; lo que no aparece no tiene filas. */
function modalityShares(year) {
	if (year < 2020) {
		return [
			["Presencial", 0.84],
			["Semipresencial", 0.16],
		];
	}
	if (year === 2020) {
		return [
			["Presencial", 0.1],
			["Semipresencial", 0.2],
			["Virtual", 0.7],
		];
	}
	// Después de 2020 la virtual baja de a poco hacia un piso y cede lugar a la semipresencial.
	const virtual = Math.max(0.12, 0.3 - (year - 2021) * 0.04);
	return [
		["Presencial", 0.6],
		["Semipresencial", 0.4 - virtual],
		["Virtual", virtual],
	];
}

/** Crecimiento sostenido, con la caída de 2020 y una recuperación lenta en 2021. */
function yearFactor(year) {
	const growth = 1.035 ** (year - FIRST_YEAR);
	if (year === 2020) return growth * 0.88;
	if (year === 2021) return growth * 0.95;
	return growth;
}

const PROB_EMPTY_SEX = 0.015;
const PROB_EMPTY_MODALITY = 0.02;

/** Genera las filas; cada valor ya viene formateado como texto. */
export function generateRows({ seed = DEFAULT_SEED } = {}) {
	const rnd = makeRandom(seed);
	const rows = [];

	for (const faculty of FACULTIES) {
		for (const [career, base, firstYear] of faculty.careers) {
			for (let year = Math.max(firstYear, FIRST_YEAR); year <= LAST_YEAR; year++) {
				const total = base * yearFactor(year);
				for (const [sex, sexShare] of [
					["Femenino", faculty.female],
					["Masculino", 1 - faculty.female],
				]) {
					const shares = modalityShares(year);
					const shareSum = shares.reduce((sum, [, share]) => sum + share, 0);
					for (const [modality, rawShare] of shares) {
						const noise = rnd.float(0.88, 1.12);
						const enrolled = Math.max(
							1,
							Math.round(total * sexShare * (rawShare / shareSum) * noise),
						);
						rows.push({
							facultad: faculty.name,
							carrera: career,
							gestion: String(year),
							sexo: rnd.chance(PROB_EMPTY_SEX) ? "" : sex,
							modalidad: rnd.chance(PROB_EMPTY_MODALITY) ? "" : modality,
							inscritos: String(enrolled),
						});
					}
				}
			}
		}
	}

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
