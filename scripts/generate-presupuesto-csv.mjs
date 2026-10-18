#!/usr/bin/env node
// Generador determinista del CSV ficticio «Ejecución presupuestaria mensual» — T7 de
// odd/tasks/csv-charts.md (tema elegido por el autor en L42).
//
// Escribe `scripts/data/ejecucion-presupuestaria-ficticia.csv`. Una fila es un registro de
// ejecución de una partida de una unidad en un mes de 2024–2025, con lo programado y lo
// ejecutado en bolivianos. Todo es inventado (unidades reales de la UMSS, cifras que no lo
// son) y apunta al contrato de `odd/tasks/csv-charts.md`:
//
//   · `fecha_registro` (YYYY-MM-DD) → `x_bucket: month` / `quarter` / `year`, `sum` de
//     `monto_ejecutado`: 24 meses, con repunte en marzo y agosto (inicio de semestre) y el
//     pico de diciembre por los activos reales
//   · `unidad` (12) y `partida` (8) → barras con `value`, `sum`/`avg`; `partida` también pastel
//   · `monto_programado` y `monto_ejecutado` → `number_step` (rangos de monto), `min`, `max`,
//     `avg`; la cola larga de los activos reales da una distribución con forma
//   · `fecha_registro`, `monto_ejecutado` y `partida` traen vacíos a propósito → el grupo `null`
//
// Reglas de L36: punto decimal (`1234.50`), sin separador de miles, fechas ISO, celda vacía
// para «sin dato», nunca `NA`, `-` ni `s/d`. `TYPES` es el mapa para el paso de tipos de
// xloader (T7b).
//
// Determinismo: `mulberry32` con semilla fija; dos corridas dan bytes idénticos.
//
// Uso:
//   node scripts/generate-presupuesto-csv.mjs

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	daysInMonth,
	formatCsv,
	isoDate,
	makeRandom,
	round2,
	writeDataset,
} from "./generate-csv-common.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const OUTPUT_PATH = resolve(HERE, "data", "ejecucion-presupuestaria-ficticia.csv");
export const DEFAULT_SEED = 20261019;

/** Columnas, en el orden del CSV. */
export const COLUMNS = [
	"unidad",
	"partida",
	"fecha_registro",
	"monto_programado",
	"monto_ejecutado",
];

/** Tipo de cada columna para xloader (`type_override`), por nombre exacto de encabezado. */
export const TYPES = {
	unidad: "text",
	partida: "text",
	fecha_registro: "timestamp",
	monto_programado: "numeric",
	monto_ejecutado: "numeric",
};

export const FIRST_YEAR = 2024;
export const LAST_YEAR = 2025;

/** `[unidad, escala de los montos]`: las facultades grandes y Rectorado pesan más. */
const UNITS = [
	["Facultad de Ciencias y Tecnología", 1.6],
	["Facultad de Ciencias Económicas", 1.2],
	["Facultad de Ciencias de la Salud", 1.4],
	["Facultad de Ciencias Agrícolas", 0.9],
	["Facultad de Humanidades y Ciencias de la Educación", 0.8],
	["Facultad de Arquitectura y Ciencias del Hábitat", 0.6],
	["Facultad de Ciencias Jurídicas y Políticas", 0.7],
	["Dirección Administrativa y Financiera", 1.0],
	["Dirección de Investigación", 0.7],
	["Dirección de Bienestar Estudiantil", 0.5],
	["Dirección de Infraestructura", 1.1],
	["Rectorado", 1.3],
];

/**
 * Partidas: `[partida, mínimo, máximo programado (Bs), ejecución típica, probabilidad de
 * registro en un mes]`. Los activos reales son pocos, grandes y de ejecución baja.
 */
const ITEMS = [
	["Servicios personales", 60000, 180000, 0.99, 1],
	["Servicios no personales", 8000, 40000, 0.86, 0.7],
	["Materiales y suministros", 3000, 25000, 0.8, 0.7],
	["Activos reales", 20000, 250000, 0.55, 0.3],
	["Becas y transferencias", 5000, 40000, 0.9, 0.5],
	["Investigación y desarrollo", 5000, 60000, 0.6, 0.45],
	["Mantenimiento de infraestructura", 4000, 45000, 0.72, 0.5],
	["Pasajes y viáticos", 1000, 9000, 0.75, 0.55],
];

/** Meses de inicio de semestre: sube lo que se compra; diciembre cierra con los activos. */
const MONTH_BOOST = { 3: 1.25, 8: 1.25 };

/** La ejecución arranca baja en enero y se acelera hasta el cierre del año. */
function monthPace(month) {
	return 0.72 + (month - 1) * 0.027;
}

const PROB_EMPTY_DATE = 0.015;
const PROB_EMPTY_EXECUTED = 0.02;
const PROB_EMPTY_ITEM = 0.015;

/** Genera las filas; cada valor ya viene formateado como texto. */
export function generateRows({ seed = DEFAULT_SEED } = {}) {
	const rnd = makeRandom(seed);
	const rows = [];

	for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
		// El presupuesto de la segunda gestión crece un poco.
		const yearScale = 1 + (year - FIRST_YEAR) * 0.06;
		for (let month = 1; month <= 12; month++) {
			for (const [unit, unitScale] of UNITS) {
				for (const [item, min, max, typicalRatio, probability] of ITEMS) {
					if (!rnd.chance(probability)) continue;

					let boost = MONTH_BOOST[month] ?? 1;
					if (item === "Activos reales" && month === 12) boost = 1.8;
					if (item === "Activos reales" && month >= 10) boost = Math.max(boost, 1.4);

					const programmed = round2(rnd.float(min, max) * unitScale * yearScale * boost);
					const ratio = Math.min(1.04, typicalRatio * monthPace(month) * rnd.float(0.85, 1.15));
					const executed = round2(programmed * ratio);

					rows.push({
						unidad: unit,
						partida: rnd.chance(PROB_EMPTY_ITEM) ? "" : item,
						fecha_registro: rnd.chance(PROB_EMPTY_DATE)
							? ""
							: isoDate(year, month, rnd.int(1, daysInMonth(year, month))),
						monto_programado: programmed.toFixed(2),
						monto_ejecutado: rnd.chance(PROB_EMPTY_EXECUTED) ? "" : executed.toFixed(2),
					});
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
