#!/usr/bin/env node
// Generador determinista del CSV ficticio de la demo — T6 de odd/tasks/csv-charts.md.
//
// Por qué existe: L4 midió que el catálogo sembrado no tiene **ningún** recurso en el
// DataStore (0 de 35), así que la demo de gráficos no tenía nada que graficar. Este
// script escribe `scripts/data/planilla-docente-ficticia.csv` con datos **ficticios**
// (nombres inventados, ninguna persona real) pensados para ejercitar el contrato de
// `odd/tasks/csv-charts.md` § «El contrato entre el portal y ckanext-umss»:
//
//   · `turno` (texto, 3 valores + vacíos) y `departamento`/`facultad`/`cargo` → `x_bucket: value`
//   · `horas_mes`/`bs_hora`/`salario` (numéricos) → `x_bucket: number_step` y `sum`/`avg`/`min`/`max`
//   · `fecha_ingreso` (YYYY-MM-DD) → `x_bucket: year` / `quarter` / `month`
//   · `turno` y `fecha_ingreso` traen vacíos a propósito → el grupo `null`
//
// Los tipos son los que el DataPusher infiere (L9: `numeric`, `timestamp`, `text`), así
// que el CSV se sube tal cual, sin `type_override`.
//
// La forma de los datos sale del ejemplo del autor (L7): nombres y apellidos que nunca
// se repiten, `cargo` con poca frecuencia, tres `turno`, `horas_mes` agrupadas por turno,
// `bs_hora` correlacionado con el cargo y `salario = horas_mes * bs_hora`. Esa relación
// hace que «turno vs. salario» (lo que el autor quiere mostrar) tenga una señal clara.
//
// Determinismo: PRNG `mulberry32` con semilla fija. No se usa `Math.random()` ni
// `Date.now()`, así que dos corridas producen **bytes idénticos** (el test lo verifica).
// El formato es RFC 4180: comas, comillas y saltos de línea se citan con `"` y las
// comillas internas se duplican. El fin de línea es `\n`.
//
// Uso:
//   node scripts/generate-demo-csv.mjs

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const OUTPUT_PATH = resolve(HERE, "data", "planilla-docente-ficticia.csv");
export const ROW_COUNT = 2500;
export const DEFAULT_SEED = 20261017;

/** Columnas, en el orden del CSV. */
export const COLUMNS = [
	"n",
	"nombre",
	"apellido",
	"departamento",
	"facultad",
	"cargo",
	"turno",
	"horas_mes",
	"bs_hora",
	"salario",
	"fecha_ingreso",
];

// ── PRNG determinista ──

function mulberry32(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeRandom(seed) {
	const next = mulberry32(seed);
	return {
		/** Entero uniforme en [min, max], ambos incluidos. */
		int: (min, max) => min + Math.floor(next() * (max - min + 1)),
		/** Un elemento al azar de una lista no vacía. */
		pick: (list) => list[Math.floor(next() * list.length)],
		/** Un elemento de `[[valor, peso], …]` con la probabilidad del peso. */
		weighted: (entries) => {
			const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
			let r = next() * total;
			for (const [value, weight] of entries) {
				r -= weight;
				if (r < 0) return value;
			}
			return entries[entries.length - 1][0];
		},
		chance: (p) => next() < p,
	};
}

// ── Catálogos ficticios ──

const NOMBRES = [
	"José",
	"María",
	"Juan",
	"Ana",
	"Luis",
	"Rosa",
	"Carlos",
	"Carmen",
	"Jorge",
	"Silvia",
	"Roberto",
	"Patricia",
	"Fernando",
	"Gabriela",
	"Ricardo",
	"Mónica",
	"Eduardo",
	"Beatriz",
	"Álvaro",
	"Claudia",
	"Ramiro",
	"Verónica",
	"Gonzalo",
	"Sandra",
	"Marcelo",
	"Lorena",
	"Rodrigo",
	"Daniela",
	"Javier",
	"Natalia",
	"Walter",
	"Cecilia",
	"Freddy",
	"Andrea",
	"Mauricio",
	"Paola",
	"Sergio",
	"Teresa",
	"Grover",
	"Elizabeth",
	"Orlando",
	"Jimena",
	"Víctor",
	"Marisol",
	"Ronald",
	"Fabiola",
	"Limbert",
	"Gladys",
	"Marco",
	"Roxana",
];

const APELLIDOS = [
	"Quispe",
	"Mamani",
	"Flores",
	"Choque",
	"Condori",
	"Rojas",
	"Vargas",
	"Ticona",
	"Cruz",
	"Gutiérrez",
	"Villarroel",
	"Apaza",
	"Colque",
	"Huanca",
	"Zeballos",
	"Montaño",
	"Salazar",
	"Aguilar",
	"Ríos",
	"Poma",
	"Céspedes",
	"Escobar",
	"Aliaga",
	"Fernández",
	"Guzmán",
	"Arce",
	"Medina",
	"Navarro",
	"Torrico",
	"Cabrera",
	"Ortiz",
	"Sejas",
	"Peralta",
	"Camacho",
	"Coca",
	"Caballero",
	"Sanjinés",
	"Terrazas",
	"Loayza",
	"Chávez",
	"Mercado",
	"Siles",
	"Peñaranda",
	"Villca",
	"Yujra",
	"Lazo",
	"Coronado",
	"Cáceres",
	"Ibarra",
	"Vásquez",
	"Rocha",
	"Antelo",
	"Suárez",
	"Beltrán",
	"Soliz",
	"Cortez",
	"Fuentes",
	"Miranda",
	"Valdez",
	"Loza",
	"Chambi",
	"Calla",
	"Tarqui",
	"Alarcón",
	"Bustos",
	"Calani",
	"Céspedes",
	"Dávila",
	"Espinoza",
	"García",
	"Herrera",
	"Justiniano",
	"Limpias",
	"Molina",
	"Nogales",
	"Osinaga",
	"Pacheco",
	"Rivero",
	"Soria",
	"Tapia",
	"Urquieta",
	"Vaca",
	"Yáñez",
];

/** Los nueve departamentos, con Cochabamba sobrerrepresentada (sede de la UMSS). */
const DEPARTAMENTOS = [
	["Cochabamba", 30],
	["La Paz", 22],
	["Santa Cruz", 18],
	["Oruro", 7],
	["Potosí", 6],
	["Chuquisaca", 5],
	["Tarija", 5],
	["Beni", 4],
	["Pando", 3],
];

const FACULTADES = [
	["Ciencias y Tecnología", 22],
	["Ciencias Económicas", 16],
	["Ciencias Jurídicas y Políticas", 14],
	["Ciencias de la Salud", 14],
	["Ciencias Agrícolas", 11],
	["Humanidades y Ciencias de la Educación", 11],
	["Ciencias Sociales", 7],
	["Arquitectura y Ciencias del Hábitat", 5],
];

/** Cargos con cola larga a propósito: los raros son pocos y pagan más por hora. */
const CARGOS = [
	["Docente auxiliar", 34],
	["Docente adjunto", 22],
	["Docente asociado", 16],
	["Docente titular", 12],
	["Investigador", 7],
	["Coordinador académico", 4],
	["Jefe de departamento", 2.5],
	["Director de carrera", 1.2],
	["Vicedecano", 0.8],
	["Decano", 0.5],
];

/** Rango de bs/hora por cargo: el salario es el producto, así que el cargo manda. */
const BS_HORA_POR_CARGO = {
	"Docente auxiliar": [52, 68],
	"Docente adjunto": [68, 84],
	"Docente asociado": [82, 100],
	Investigador: [88, 112],
	"Docente titular": [98, 120],
	"Coordinador académico": [78, 96],
	"Jefe de departamento": [100, 126],
	"Director de carrera": [110, 136],
	Vicedecano: [120, 146],
	Decano: [130, 160],
};

const TURNOS = [
	["mañana", 52],
	["tarde", 33],
	["noche", 15],
];

/** Horas al mes por turno: los valores se agrupan por turno (ejemplo del autor, L7). */
const HORAS_POR_TURNO = {
	mañana: [88, 120],
	tarde: [64, 92],
	noche: [36, 60],
};
/** Sin turno declarado las horas quedan dispersas, para que el grupo `null` no engañe. */
const HORAS_SIN_TURNO = [40, 110];

const PROB_TURNO_VACIO = 0.03;
const PROB_FECHA_VACIA = 0.02;
const ANIO_MIN = 1995;
const ANIO_MAX = 2025;

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

function daysInMonth(year, month) {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function fechaIngreso(rnd) {
	// Pesos crecientes: más ingresos recientes, pero ningún año queda vacío (los buckets
	// por año del contrato necesitan serie, no un montón).
	const years = [];
	for (let year = ANIO_MIN; year <= ANIO_MAX; year++) {
		years.push([year, 1 + (year - ANIO_MIN) * 0.3]);
	}
	const year = rnd.weighted(years);
	const month = rnd.int(1, 12);
	const day = rnd.int(1, daysInMonth(year, month));
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Genera las filas del dataset. Cada valor ya viene formateado como texto, que es lo que
 * el CSV lleva y lo que el DataStore devuelve: el salario se calcula acá, una sola vez.
 */
export function generateRows({ seed = DEFAULT_SEED, count = ROW_COUNT } = {}) {
	const pool = NOMBRES.length * APELLIDOS.length;
	if (count > pool) {
		throw new Error(`count ${count} supera las ${pool} combinaciones de nombre+apellido.`);
	}

	const rnd = makeRandom(seed);
	const people = new Set();
	const rows = [];

	for (let i = 1; i <= count; i++) {
		let nombre;
		let apellido;
		do {
			nombre = rnd.pick(NOMBRES);
			apellido = rnd.pick(APELLIDOS);
		} while (people.has(`${nombre} ${apellido}`));
		people.add(`${nombre} ${apellido}`);

		const cargo = rnd.weighted(CARGOS);
		const turno = rnd.chance(PROB_TURNO_VACIO) ? "" : rnd.weighted(TURNOS);
		const [horasMin, horasMax] = turno ? HORAS_POR_TURNO[turno] : HORAS_SIN_TURNO;
		const horasMes = rnd.int(horasMin, horasMax);
		const [bsMin, bsMax] = BS_HORA_POR_CARGO[cargo];
		const bsHora = rnd.int(Math.round(bsMin * 100), Math.round(bsMax * 100)) / 100;

		rows.push({
			n: String(i),
			nombre,
			apellido,
			departamento: rnd.weighted(DEPARTAMENTOS),
			facultad: rnd.weighted(FACULTADES),
			cargo,
			turno,
			horas_mes: String(horasMes),
			bs_hora: bsHora.toFixed(2),
			salario: round2(horasMes * bsHora).toFixed(2),
			fecha_ingreso: rnd.chance(PROB_FECHA_VACIA) ? "" : fechaIngreso(rnd),
		});
	}

	return rows;
}

// ── CSV ──

const NEEDS_QUOTING = /[",\r\n]/;

function quoteField(value) {
	const text = value ?? "";
	return NEEDS_QUOTING.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Serializa filas a CSV (RFC 4180 en el citado; fin de línea `\n`). */
export function formatCsv(rows, columns = COLUMNS) {
	const lines = [columns.join(",")];
	for (const row of rows) lines.push(columns.map((column) => quoteField(row[column])).join(","));
	return `${lines.join("\n")}\n`;
}

export function generateCsv({ seed = DEFAULT_SEED, count = ROW_COUNT } = {}) {
	return formatCsv(generateRows({ seed, count }));
}

// ── CLI ──

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
	const csv = generateCsv();
	mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
	writeFileSync(OUTPUT_PATH, csv, "utf8");
	const bytes = Buffer.byteLength(csv, "utf8");
	const sha256 = createHash("sha256").update(csv).digest("hex");
	console.log(`✓ ${OUTPUT_PATH}`);
	console.log(`  ${ROW_COUNT} filas · ${bytes} bytes · sha256 ${sha256}`);
}
