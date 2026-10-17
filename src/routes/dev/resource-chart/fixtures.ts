// La tabla de la demo, con la forma **real** medida en vivo (L16) y la regla de nulos de L17.
//
// No se importa el CSV de 266 KB (ni sus 2.500 filas) al bundle del cliente: acá se genera una muestra
// determinista de ~200 filas con las mismas columnas y los mismos tipos que el DataPusher reportó para
// `planilla-docente-ficticia`:
//
//   `n`, `horas_mes`, `bs_hora`, `salario` → `numeric`; `fecha_ingreso` → `timestamp`; el resto → `text`;
//   `_id` → `int` (la columna que numera CKAN, que nunca se grafica).
//
// Dos detalles que no son cosméticos:
//  · `turno` trae cadenas vacías (en la tabla real, 76 de 2.500 y **ningún** NULL). Desde L17 una cadena
//    vacía o de sólo espacios es «sin dato»: forma parte del grupo nulo y no cuenta como valor. Si acá
//    hubiera NULL en vez de `""`, el doble no probaría la regla que el servidor aplica con
//    `NULLIF(btrim(col), '')`.
//  · `fecha_ingreso` trae NULL de verdad (57 en la tabla real), que es el otro camino al grupo nulo.
//
// La forma de los datos sale del ejemplo del autor (L7): nombres y apellidos que no se repiten, `cargo`
// con poca frecuencia, tres turnos, `horas_mes` agrupadas por turno, y `salario = horas_mes * bs_hora` —
// así «turno vs. salario promedio» tiene una señal clara.

import type { DatastoreField } from "$lib/api/datastore";

/** Los `fields` de la tabla, con los tipos que informa el DataStore (L16). */
export const DEMO_FIELDS: DatastoreField[] = [
	{ id: "_id", type: "int" },
	{ id: "n", type: "numeric" },
	{ id: "nombre", type: "text" },
	{ id: "apellido", type: "text" },
	{ id: "departamento", type: "text" },
	{ id: "facultad", type: "text" },
	{ id: "cargo", type: "text" },
	{ id: "turno", type: "text" },
	{ id: "horas_mes", type: "numeric" },
	{ id: "bs_hora", type: "numeric" },
	{ id: "salario", type: "numeric" },
	{ id: "fecha_ingreso", type: "timestamp" },
];

export interface DemoTable {
	fields: DatastoreField[];
	records: Record<string, unknown>[];
	total: number;
}

const FIRST_NAMES = [
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
];

const LAST_NAMES = [
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
];

const DEPARTMENTS = [
	"Cochabamba",
	"La Paz",
	"Santa Cruz",
	"Oruro",
	"Potosí",
	"Chuquisaca",
	"Tarija",
	"Beni",
	"Pando",
];

const FACULTIES = [
	"Ciencias y Tecnología",
	"Ciencias Económicas",
	"Ciencias Jurídicas y Políticas",
	"Ciencias de la Salud",
	"Ciencias Agrícolas",
	"Humanidades y Ciencias de la Educación",
	"Ciencias Sociales",
	"Arquitectura y Ciencias del Hábitat",
];

const POSITIONS = [
	"Docente auxiliar",
	"Docente adjunto",
	"Docente asociado",
	"Docente titular",
	"Investigador",
	"Coordinador académico",
	"Jefe de departamento",
	"Director de carrera",
];

/** `[turno, peso, rango de horas al mes]`. El turno manda en las horas, y por eso en el salario. */
const SHIFTS: [string, number, [number, number]][] = [
	["mañana", 52, [88, 120]],
	["tarde", 33, [64, 92]],
	["noche", 15, [36, 60]],
];

const YEAR_MIN = 1995;
const YEAR_MAX = 2025;
/** Proporción de `turno` vacío en la tabla real (76/2500) y de `fecha_ingreso` nula (57/2500). */
const EMPTY_SHIFT_RATE = 0.03;
const NULL_DATE_RATE = 0.023;

/** PRNG determinista (`mulberry32`): dos llamadas con la misma semilla dan las mismas filas. */
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * La muestra de la demo. `count` es configurable para que un test pueda generar más grupos que el tope del
 * contrato sin tocar el resto del archivo.
 */
export function demoTable(count = 200, seed = 20261017): DemoTable {
	const next = mulberry32(seed);
	const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
	const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] ?? list[0];

	const weightedShift = (): string => {
		const total = SHIFTS.reduce((sum, [, weight]) => sum + weight, 0);
		let r = next() * total;
		for (const [shift, weight] of SHIFTS) {
			r -= weight;
			if (r < 0) return shift;
		}
		return SHIFTS[SHIFTS.length - 1][0];
	};

	const records: Record<string, unknown>[] = [];
	for (let i = 1; i <= count; i++) {
		const firstName = pick(FIRST_NAMES);
		const lastName = pick(LAST_NAMES);
		const position = pick(POSITIONS);
		const pickedShift = weightedShift();
		const [, , [hoursMin, hoursMax]] = SHIFTS.find(([shift]) => shift === pickedShift) ?? SHIFTS[0];
		const shift = pickedShift;
		// Cadenas vacías, no NULL: es lo que trae el CSV real en `turno` (L17).
		const finalShift = next() < EMPTY_SHIFT_RATE ? "" : shift;
		const hours = int(hoursMin, hoursMax);
		const ratePerHour = int(
			50 + (POSITIONS.indexOf(position) + 1) * 6,
			70 + (POSITIONS.indexOf(position) + 1) * 7,
		);

		const year = Math.min(
			YEAR_MAX,
			YEAR_MIN + Math.floor(next() ** 0.7 * (YEAR_MAX - YEAR_MIN + 1)),
		);
		const month = int(1, 12);
		const day = int(1, daysInMonth(year, month));
		// NULL de verdad en `fecha_ingreso`: el otro camino al grupo nulo (L16/L17).
		const hireDate =
			next() < NULL_DATE_RATE
				? null
				: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`;

		records.push({
			_id: i,
			n: i,
			nombre: firstName,
			apellido: lastName,
			departamento: pick(DEPARTMENTS),
			facultad: pick(FACULTIES),
			cargo: position,
			turno: finalShift,
			horas_mes: hours,
			bs_hora: ratePerHour,
			salario: round2(hours * ratePerHour),
			fecha_ingreso: hireDate,
		});
	}

	return { fields: DEMO_FIELDS, records, total: count };
}
