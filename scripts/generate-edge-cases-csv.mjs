#!/usr/bin/env node
// Generador determinista del CSV de casos borde del cargador del DataStore — ítem «[v1]
// Evaluar un cargador del DataStore que normalice valores» de BACKLOG.md (pedido del autor,
// 2026-10-17, en odd/tasks/csv-charts.md L14 y L24(1)).
//
// Por qué existe: decidir qué cargador usa el portal (DataPusher, xloader, DataPusher+) no
// se puede resolver leyendo READMEs; la decisión es de `odp-docker`. Este archivo es el
// instrumento de la medición: un CSV **determinista**, con **una columna por caso borde**,
// que se sube al CKAN dev con cada cargador y se anota columna por columna qué tipo informa
// `datastore_search` en `fields` y qué valor queda guardado. El JSON de expectativas dice,
// para cada columna, qué guardaría un cargador ideal — y dónde «ideal» es una elección.
//
// Reglas del archivo, que son las que hacen la medición legible:
//   · Una columna = un caso. Dos rarezas en la misma columna no dicen cuál rompió.
//   · Dos controles (`baseline_integer`, `baseline_iso_date`): si fallan, el problema es del
//     cargador, no de los datos.
//   · El texto de `late_text_after_row_30` aparece después de la fila 30 a propósito: un
//     cargador que adivina el tipo con las primeras filas ya declaró `numeric`.
//   · Los casos que no caben en **un** CSV UTF-8 (codificación, BOM, `;`, encabezados
//     duplicados/vacíos/largos, Excel con varias hojas) no se generan: se listan en
//     `separate_file_cases` del JSON.
//
// Nombres de columna en inglés, snake_case, y son el id del caso. Los valores son datos y
// pueden estar en español («sí», «15 de marzo de 2024»).
//
// Determinismo: los valores salen de arreglos fijos o de `cycle`, sin `Math.random()` ni
// `Date.now()`, así que dos corridas producen **bytes idénticos** (el test lo verifica). El
// RFC 4180 y el fin de línea `\n` los pone `formatCsv` del generador de la demo, para no
// tener dos implementaciones de citado en el repo.
//
// Uso:
//   node scripts/generate-edge-cases-csv.mjs

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatCsv } from "./generate-demo-csv.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const OUTPUT_PATH = resolve(HERE, "data", "loader-edge-cases.csv");
export const EXPECTATIONS_PATH = resolve(HERE, "data", "loader-edge-cases.expected.json");
export const CSV_FILE_LABEL = "scripts/data/loader-edge-cases.csv";

/** 48 filas: suficiente para que el texto tardío caiga después de la 30 y para que la
 * medición no sea un archivo enorme que un cargador trate distinto por tamaño. */
export const ROW_COUNT = 48;

// ── Helpers de series ──

/** Un valor por fila, construido a partir del índice 0-based. */
function sequence(build) {
	return Array.from({ length: ROW_COUNT }, (_, index) => build(index));
}

/** Repite un patrón hasta llenar ROW_COUNT filas. */
function cycle(pattern) {
	return sequence((index) => pattern[index % pattern.length]);
}

/** Las primeras `count` muestras distintas, en el orden en que aparecen en la columna. */
function distinctSamples(values, count) {
	const samples = [];
	for (const value of values) {
		if (!samples.includes(value)) samples.push(value);
		if (samples.length === count) break;
	}
	return samples;
}

// ── Helpers de fecha y de texto ──

const DAY_MS = 86_400_000;
const identity = (raw) => raw;

function pad2(value) {
	return String(value).padStart(2, "0");
}

function isoFromParts(year, month, day) {
	return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Día 0 = 2024-01-01; un día por fila, sin saltos ni repetidos. */
function isoDateFromDayOffset(offset) {
	return new Date(Date.UTC(2024, 0, 1) + offset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Número de serie de Excel → fecha ISO. Excel cuenta días desde el 30/12/1899; esa época ya
 * lleva incorporado su bug del 29/02/1900 para toda fecha posterior al 01/03/1900, que es el
 * único rango que usa la columna (seriales modernos).
 */
export function excelSerialToIso(serial) {
	const days = Number(serial);
	if (!Number.isFinite(days)) throw new Error(`número de serie inválido: ${serial}`);
	return new Date(Date.UTC(1899, 11, 30) + days * DAY_MS).toISOString().slice(0, 10);
}

/** «15/03/2024» → «2024-03-15». La lectura dd/mm es una elección, no un hecho. */
function ddMmToIso(raw) {
	const [day, month, year] = raw.split("/");
	return isoFromParts(year, month, day);
}

const SPANISH_MONTHS = {
	enero: 1,
	febrero: 2,
	marzo: 3,
	abril: 4,
	mayo: 5,
	junio: 6,
	julio: 7,
	agosto: 8,
	septiembre: 9,
	octubre: 10,
	noviembre: 11,
	diciembre: 12,
};

/** «15 de marzo de 2024» → «2024-03-15». */
function spanishDateToIso(raw) {
	const match = raw.match(/^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/);
	if (!match) throw new Error(`fecha en español no reconocida: ${raw}`);
	const month = SPANISH_MONTHS[match[2]];
	if (!month) throw new Error(`mes en español no reconocido: ${raw}`);
	return isoFromParts(match[3], month, match[1]);
}

/** Con zona horaria el instante se conserva; UTC lo hace comparable. */
function toUtcIso(raw) {
	return new Date(raw).toISOString().replace(".000Z", "Z");
}

/** Sin zona horaria no hay instante: se conserva la hora de pared, en formato ISO. */
function wallClockIso(raw) {
	return raw.replace(" ", "T");
}

// ── Las columnas: una por caso, en el orden del CSV ──

const COLUMN_SPECS = [
	// Controles: no son casos borde, son la prueba de que la carga funcionó.
	{
		name: "baseline_integer",
		backlogCase: null,
		description: "Control: enteros limpios, sin separadores, sin marcas y todos distintos.",
		idealType: "numeric",
		values: sequence((index) => String(1000 + index * 3)),
		toIdeal: Number,
		notes:
			"Baseline, no un caso borde. Si esta columna no sale `numeric`, el cargador falló en algo básico y el resto de la medición no se puede interpretar.",
	},
	{
		name: "baseline_iso_date",
		backlogCase: null,
		description: "Control: fechas ISO `YYYY-MM-DD`, un día por fila, sin ambigüedad ni huecos.",
		idealType: "timestamp",
		values: sequence((index) => isoDateFromDayOffset(index)),
		notes:
			"Baseline. DataPusher 0.0.21 infiere `timestamp` para ISO (L9) y L16 lo confirmó en vivo sobre la tabla de la demo.",
	},

	// ── Caso 1: números con formato local ──
	{
		name: "decimal_comma",
		backlogCase: 1,
		description:
			"Números con coma decimal y sin separador de miles: `1,5` donde el formato internacional escribe `1.5`.",
		idealType: "numeric",
		values: cycle(["1,5", "2,25", "-0,5", "12,75", "0,1", "100,00"]),
		toIdeal: (raw) => Number(raw.replace(",", ".")),
		notes:
			"Ideal: 1.5. DataPusher 0.0.21 no decide la coma por el archivo sino por el locale del servidor (CKAN #5769): si el locale es en_US la columna entera queda `text`. En el CSV estos valores van entre comillas porque la coma es el separador.",
	},
	{
		name: "thousands_dot_decimal_comma",
		backlogCase: 1,
		description: "Formato español completo: punto de miles y coma decimal, `1.234,56`.",
		idealType: "numeric",
		values: cycle(["1.234,56", "12.345,00", "999.999,99", "1.000.000,00", "0,50"]),
		toIdeal: (raw) => Number(raw.replaceAll(".", "").replace(",", ".")),
		notes:
			"Ideal: 1234.56. La lectura inversa (punto decimal) también existe en otros archivos, así que reconocerlo exige una regla, no una heurística por valor: acá el agrupamiento de tres dígitos y la coma final no dejan duda. Un cargador que no lo reconoce guarda el texto y el número deja de ser comparable.",
	},
	{
		name: "us_thousands",
		backlogCase: 1,
		description:
			"Formato inglés: coma de miles y punto decimal, `1,234.56`, el opuesto del caso anterior.",
		idealType: "numeric",
		values: cycle(["1,234.56", "12,345.00", "999,999.99", "1,000,000.00", "0.50"]),
		toIdeal: (raw) => Number(raw.replaceAll(",", "")),
		notes:
			"Ideal: 1234.56. Si el cargador aplica una sola regla de separadores para todo el archivo, esta columna y `thousands_dot_decimal_comma` no pueden estar bien las dos: ése es exactamente el resultado que se quiere medir.",
	},

	// ── Caso 2: moneda, porcentaje y unidades ──
	{
		name: "currency_usd",
		backlogCase: 2,
		description: "Importes con símbolo de moneda adelante: `$1,234.56`.",
		idealType: "numeric",
		values: cycle(["$1,234.56", "$15.00", "$0.00", "$99.90", "$1,000,000.00"]),
		toIdeal: (raw) => Number(raw.replace(/[$,]/g, "")),
		notes:
			"Ideal: 1234.56, sin el símbolo. Es una elección: guardar el número pierde de qué moneda era, y guardarlo como texto pierde la aritmética. Lo que no sirve es dejarlo `text` sin avisar y que el gráfico no pueda sumar.",
	},
	{
		name: "percent_value",
		backlogCase: 2,
		description: "Porcentajes con signo `%` y coma decimal: `15%`, `7,5%`.",
		idealType: "numeric",
		values: cycle(["15%", "7,5%", "0%", "100%", "33,33%"]),
		toIdeal: (raw) => Number(raw.replace("%", "").replace(",", ".")),
		notes:
			"Ideal: 15 en puntos porcentuales. Guardar 0,15 es igual de defendible (la fracción) y es la razón por la que el `%` no se puede borrar sin decidir: quien mire la columna después no sabe cuál de las dos escalas es.",
	},
	{
		name: "measured_with_unit",
		backlogCase: 2,
		description: "Cantidades con unidad pegada al número: `12 kg`, `3,5 m`, `250 ml`.",
		idealType: "numeric",
		values: cycle(["12 kg", "3,5 m", "250 ml", "40 km/h", "1,20 L"]),
		toIdeal: (raw) => Number(raw.match(/^-?[\d.,]+/)[0].replace(",", ".")),
		notes:
			"Ideal: 12, sin la unidad. Las unidades no son homogéneas (`kg`, `m`, `km/h`, `L`) y borrarlas mezcla magnitudes incomparables en una misma columna: el ideal del valor es el número, y la unidad debería vivir en el nombre de la columna, no en la celda.",
	},

	// ── Caso 3: booleanos ──
	{
		name: "boolean_10",
		backlogCase: 3,
		description: "Booleano escrito como 1 y 0.",
		idealType: "boolean",
		values: cycle(["1", "0"]),
		toIdeal: (raw) => raw === "1",
		notes:
			"Ideal: `true`. Pero una columna con sólo 0 y 1 es indistinguible de un contador o de un código sin metadatos: convertir a booleano es una decisión de quien conoce el dato, no algo que el archivo diga. Es el caso donde la medición del cargador y la del diccionario de datos se separan.",
	},
	{
		name: "boolean_true_false",
		backlogCase: 3,
		description: "Booleano escrito como `true` y `false`, en minúsculas.",
		idealType: "boolean",
		values: cycle(["true", "false"]),
		toIdeal: (raw) => raw === "true",
		notes:
			"Ideal: `true`. DataPusher+ reconoce booleanos si la columna tiene exactamente dos valores que empiezan por `t/f` (BACKLOG), así que es el caso donde el cargador nuevo debería ganar; el actual (0.0.21) los deja `text`.",
	},
	{
		name: "boolean_si_no",
		backlogCase: 3,
		description: "Booleano en español: `sí` (con tilde) y `no`.",
		idealType: "boolean",
		values: cycle(["sí", "no"]),
		toIdeal: (raw) => raw === "sí",
		notes:
			"Ideal: `true`. DataPusher+ **no** lo detecta: sus patrones son `0/1`, `t/f` y `y/n`, y «sí/no» no entra en ninguno (BACKLOG). Es el caso más importante de la medición para un portal en español, y el que probablemente exija `type_override` o un cargador propio.",
	},
	{
		name: "boolean_s_n",
		backlogCase: 3,
		description: "Booleano abreviado en español: `S` y `N`.",
		idealType: "boolean",
		values: cycle(["S", "N"]),
		toIdeal: (raw) => raw === "S",
		notes:
			"Ideal: `true`. Tampoco entra en los patrones de DataPusher+ (`y/n` es inglés, `s/n` no), y en mayúscula la ambigüedad con una categoría `S`/`N` es total: sin diccionario de datos no hay forma de saber que es un booleano.",
	},
	{
		name: "boolean_marker_x",
		backlogCase: 3,
		description: "Booleano de planilla: `X` marca sí y la celda vacía marca no.",
		idealType: "boolean",
		values: cycle(["X", ""]),
		toIdeal: (raw) => (raw === "X" ? true : null),
		notes:
			"Ideal: `true` / `null`. La celda vacía es el problema: en notación de planilla significa «no», pero en un DataStore es «dato faltante», y las dos lecturas son legítimas. Convertirla a `false` inventa un dato; dejarla `null` lo pierde. Cualquiera de las dos hay que declararla.",
	},

	// ── Caso 4: fechas ──
	{
		name: "date_dd_mm_yyyy_unambiguous",
		backlogCase: 4,
		description:
			"Fecha dd/mm/aaaa con días mayores que 12 en todas las filas, así no puede ser mm/dd.",
		idealType: "timestamp",
		values: cycle([
			"15/03/2024",
			"28/02/2023",
			"31/12/2022",
			"14/07/2021",
			"25/12/2020",
			"30/06/2019",
		]),
		toIdeal: ddMmToIso,
		notes:
			"Ideal: 2024-03-15. Ésta no es ambigua: leída como mm/dd daría mes 15, que no existe. Si el cargador deja esta columna en `text`, no está interpretando fechas locales en absoluto.",
	},
	{
		name: "date_ambiguous_dd_mm",
		backlogCase: 4,
		description:
			"Fecha dd/mm/aaaa ambigua: todos los días son ≤ 12, así que también es una fecha mm/dd válida.",
		idealType: "timestamp",
		values: cycle(["03/04/2024", "05/06/2023", "07/08/2022", "01/02/2021", "10/11/2020"]),
		toIdeal: ddMmToIso,
		notes:
			"Ideal elegido: 2024-04-03 (dd/mm, la convención local). La otra lectura, 2024-03-04, es igual de válida para el archivo: acá «ideal» es una **decisión** del portal, no un hecho del dato. Lo que se mide es qué elige el cargador; si elige mm/dd, un 3 de abril se guarda como 4 de marzo y nada lo delata.",
	},
	{
		name: "date_spanish_month",
		backlogCase: 4,
		description:
			"Fecha con mes en texto español: `15 de marzo de 2024`, y una sin cero a la izquierda.",
		idealType: "timestamp",
		values: cycle([
			"15 de marzo de 2024",
			"1 de enero de 2023",
			"28 de febrero de 2022",
			"31 de diciembre de 2021",
		]),
		toIdeal: spanishDateToIso,
		notes:
			"Ideal: 2024-03-15. DataPusher+ reconoce 19 formatos, pero sólo en columnas cuyo **nombre** coincide con un patrón de fecha (BACKLOG): acá el nombre de la columna no está en español, así que se mide el reconocimiento por valor, no por nombre. Es el tipo de fecha que un usuario escribe a mano.",
	},
	{
		name: "date_excel_serial",
		backlogCase: 4,
		description:
			"Número de serie de Excel: un entero que representa una fecha (45292 = 2024-01-01).",
		idealType: "timestamp",
		values: cycle(["45292", "44927", "44197", "40909", "44562"]),
		toIdeal: excelSerialToIso,
		notes:
			"Ideal elegido: la fecha (2024-01-01). Pero en un CSV el serial es un número suelto e indistinguible de un identificador o de un contador: guardarlo como `numeric` 45292 también es defendible. Que el cargador lo convierta sin que nadie se lo pida es adivinar; que lo deje número es no rescatar un dato que el autor creía fecha. Ésa es la ambigüedad que se mide.",
	},
	{
		name: "date_partial_year_month",
		backlogCase: 4,
		description: "Fecha parcial año-mes, sin día: `2024-03`.",
		idealType: "text",
		values: cycle(["2024-03", "2023-11", "2022-07"]),
		toIdeal: identity,
		notes:
			"Ideal: conservar `2024-03` como texto. Convertirla a `2024-03-01` inventa el día, y un `timestamp` con un día inventado contamina cualquier agrupación por mes en el borde. Guardarla como texto conserva la precisión real (un mes) y deja la decisión de «a qué día pertenece» a la consulta.",
	},
	{
		name: "date_partial_year",
		backlogCase: 4,
		description: "Fecha parcial: sólo el año, `2024`.",
		idealType: "text",
		values: cycle(["2024", "1999", "2010"]),
		toIdeal: identity,
		notes:
			"Ideal: conservar `2024` como texto, porque el dato dice «un año», no «un número». L9 midió lo contrario en DataPusher 0.0.21: un año sale `numeric`. Si el portal necesita agrupar por año, `date_part` sobre un timestamp o conservar el texto da lo mismo; un `numeric` con 2024 en una columna de importes, no.",
	},
	{
		name: "date_invalid",
		backlogCase: 4,
		description: "Fechas que no existen: 31 de febrero, 30 de febrero, mes 13, 31 de abril.",
		idealType: "text",
		values: cycle(["31/02/2024", "2023-02-30", "2024-13-01", "30/02/2023", "2024-04-31"]),
		toIdeal: identity,
		notes:
			"Ideal: conservar el texto original para que la fila se pueda corregir. Ninguna conversión es correcta: un cargador que «arregla» 31/02/2024 a 02/03/2024 o 29/02/2024 está inventando un dato, y uno que la convierte a `null` borra la evidencia de que había una fecha mal escrita. Lo que se mide es si la carga se corta, si la fila se rechaza o si el valor se guarda tal cual.",
	},
	{
		name: "timestamp_with_tz",
		backlogCase: 4,
		description: "Timestamp con zona horaria explícita: `Z` y desplazamientos `-04:00`, `+02:00`.",
		idealType: "timestamp",
		values: cycle([
			"2024-03-15T10:30:00Z",
			"2024-03-15T10:30:00-04:00",
			"2023-11-02T23:59:59+02:00",
		]),
		toIdeal: toUtcIso,
		notes:
			"Ideal: el mismo instante en UTC (10:30Z, 14:30Z, 21:59:59Z). Con zona el instante no se pierde: guardarlo como `timestamptz` conserva la información y lo hace comparable. Si el cargador descarta el desplazamiento y guarda la hora de pared, tres instantes distintos se vuelven el mismo número.",
	},
	{
		name: "timestamp_without_tz",
		backlogCase: 4,
		description:
			"Timestamp sin zona horaria, con `T` y con espacio, tal como se escribe en una planilla.",
		idealType: "timestamp",
		values: cycle(["2024-03-15 10:30:00", "2023-11-02T23:59:59", "2022-07-01 00:00:00"]),
		toIdeal: wallClockIso,
		notes:
			"Ideal: conservar la hora de pared (2024-03-15T10:30:00) y **declarar la suposición**. Sin zona no hay respuesta correcta: DataPusher+ asume UTC (BACKLOG), que para Bolivia (UTC-4) mueve la hora cuatro horas. Un `timestamp` sin zona conserva el dato; un `timestamptz` con UTC inventado, no.",
	},

	// ── Caso 5: marcas de «sin dato» mezcladas con números ──
	{
		name: "null_marker_na",
		backlogCase: 5,
		description: "Columna numérica con `NA` intercalado como marca de dato faltante.",
		idealType: "numeric",
		values: cycle(["10", "NA", "12", "14", "NA", "16"]),
		toIdeal: (raw) => (raw === "NA" ? null : Number(raw)),
		notes:
			"Ideal: 10 / null. Es el caso que hoy rompe la carga: DataPusher 0.0.21 adivina el tipo con las primeras filas y, si una columna numérica trae un `N/A` («NA» incluido) más abajo, la carga se corta a mitad (BACKLOG). La medición tiene que anotar **hasta qué fila llegó**, no sólo el tipo.",
	},
	{
		name: "null_marker_n_a",
		backlogCase: 5,
		description:
			"La misma marca con barra: `N/A`, que es la que aparece en los reportes exportados.",
		idealType: "numeric",
		values: cycle(["20", "N/A", "22", "24", "N/A", "26"]),
		toIdeal: (raw) => (raw === "N/A" ? null : Number(raw)),
		notes:
			"Ideal: 20 / null. Está en su propia columna, separada de `NA`, porque un cargador puede reconocer una forma y no la otra; con las dos juntas no se sabría cuál lo rompió.",
	},
	{
		name: "null_marker_dash",
		backlogCase: 5,
		description: "Guion suelto `-` como marca de sin dato en una columna numérica.",
		idealType: "numeric",
		values: cycle(["30", "32", "-", "34", "36", "-"]),
		toIdeal: (raw) => (raw === "-" ? null : Number(raw)),
		notes:
			"Ideal: 30 / null. Es la marca más peligrosa porque el guion también es un valor legítimo en columnas de texto (un rango, un código). Convertirlo a null en una columna numérica es una buena apuesta; hacerlo en una de texto, no.",
	},
	{
		name: "null_marker_sd",
		backlogCase: 5,
		description: "Marca de sin dato en español: `s/d` («sin dato»).",
		idealType: "numeric",
		values: cycle(["40", "42", "s/d", "44", "46", "s/d"]),
		toIdeal: (raw) => (raw === "s/d" ? null : Number(raw)),
		notes:
			"Ideal: 40 / null. Ningún cargador genérico la conoce: es una marca local. Si el portal quiere que `s/d` cuente como vacío, lo tiene que declarar por columna; es evidencia para el diccionario de datos, no para el cargador.",
	},

	// ── Caso 6: normalización de texto ──
	{
		name: "text_leading_trailing_spaces",
		backlogCase: 6,
		description: "Nombres con espacios al principio o al final de la celda.",
		idealType: "text",
		values: cycle(["  Ana Quispe  ", "Luis Mamani ", "  Rosa Flores", "Carmen Rojas  "]),
		toIdeal: (raw) => raw.trim(),
		notes:
			"Ideal: `Ana Quispe`, recortado. También es defendible no tocarlos (los espacios podrían ser significativos), pero mientras no se decida, «Ana Quispe» y «Ana Quispe␣» son dos categorías distintas en un gráfico. Se mide si el cargador los conserva, los recorta o los colapsa.",
	},
	{
		name: "text_case_variants",
		backlogCase: 6,
		description:
			"El mismo valor en tres capitalizaciones: `Cochabamba`, `cochabamba`, `COCHABAMBA`.",
		idealType: "text",
		values: cycle(["Cochabamba", "cochabamba", "COCHABAMBA"]),
		toIdeal: identity,
		notes:
			"Ideal: tal cual, porque la capitalización es información (un nombre propio no se escribe en mayúsculas). El problema es de la consulta: agrupar sin unificar mayúsculas parte un departamento en tres. Un cargador que normaliza el texto a minúsculas destruye el nombre para siempre; uno que lo deja pasa el problema a la consulta, que es donde se puede arreglar. La medición anota cuál de las dos cosas hace.",
	},
	{
		name: "text_accents",
		backlogCase: 6,
		description:
			"El mismo nombre con tilde y sin tilde: `José` / `Jose`, `Gutiérrez` / `Gutierrez`.",
		idealType: "text",
		values: cycle(["José", "Jose", "María", "Maria", "Gutiérrez", "Gutierrez"]),
		toIdeal: identity,
		notes:
			"Ideal: tal cual. Quitar tildes «para que coincida» destruye el nombre; el mismo problema de agrupación que las mayúsculas se resuelve en la consulta (o con una columna normalizada aparte), no borrando el dato en la carga.",
	},
	{
		name: "text_nbsp",
		backlogCase: 6,
		description:
			"Espacio no separable (U+00A0) dentro del valor y al final, en lugar de un espacio común.",
		idealType: "text",
		values: cycle(["San\u00a0José", "La\u00a0Paz", "Santa Cruz\u00a0"]),
		toIdeal: (raw) => raw.replaceAll("\u00a0", " ").trim(),
		notes:
			"Ideal: `San José`, con espacio común y recortado. U+00A0 se ve **idéntico** a un espacio y Postgres no lo colapsa, así que «La Paz» y «La␣Paz» (NBSP) son dos valores distintos en la base y nadie lo ve en pantalla. Es el caso que explica por qué un gráfico «pierde» una categoría sin que haya un error.",
	},
	{
		name: "text_nfc_vs_nfd",
		backlogCase: 6,
		description: "El mismo nombre en NFC (`José`, é = U+00E9) y en NFD (`Jose` + U+0301).",
		idealType: "text",
		values: cycle(["José", "Jose\u0301", "Gutiérrez", "Gutie\u0301rrez"]),
		toIdeal: (raw) => raw.normalize("NFC"),
		notes:
			"Ideal: NFC, para que el mismo nombre sea un solo valor. Postgres compara texto por bytes y no normaliza: las formas NFC y NFD se ven iguales y son cadenas distintas, así que la columna tiene el doble de categorías de las que muestra. Un cargador que normaliza a NFC arregla el dato; uno que no, deja el problema a la consulta.",
	},

	// ── Caso 7: códigos con ceros a la izquierda ──
	{
		name: "code_leading_zeros",
		backlogCase: 7,
		description:
			"Códigos con ceros a la izquierda: `0012`, `0007`, que son identificadores, no cantidades.",
		idealType: "text",
		values: cycle(["0012", "0007", "0042", "0100", "0001"]),
		toIdeal: identity,
		notes:
			"Ideal: `0012` como texto. L9 lo midió: DataPusher 0.0.21 infiere `numeric` y **pierde los ceros a la izquierda**, así que `0012` y `12` pasan a ser el mismo código. La corrección conocida es `type_override` en el diccionario de datos (y recargar); el cargador no tiene cómo saberlo por sí solo.",
	},

	// ── Caso 8: identificadores numéricos largos ──
	{
		name: "long_numeric_id",
		backlogCase: 8,
		description: "Identificadores numéricos largos: teléfonos y documentos de 11 a 16 dígitos.",
		idealType: "text",
		values: cycle(["71234567", "59171234567", "1234567890123", "87654321", "9007199254740993"]),
		toIdeal: identity,
		notes:
			"Ideal: texto. No se suman ni se promedian, y como número pierden información: por encima de 2^31 no entran en `int4` (1234567890123) y por encima de 2^53 un `double` ya no los representa exactos (`9007199254740993` vuelve como `…992`, el último dígito cambia en silencio). Un cargador que los declara `numeric` no falla: guarda otro número.",
	},

	// ── Caso 9: columnas mixtas y el texto tardío ──
	{
		name: "mixed_types",
		backlogCase: 9,
		description:
			"Columna sin tipo único: número, texto, fecha, booleano, número local, vacío y `N/A` en la misma columna.",
		idealType: "text",
		values: cycle(["12", "Ana", "2024-03-15", "true", "1,5", "", "N/A"]),
		toIdeal: identity,
		notes:
			"Ideal: `text`, que es el único tipo que guarda todas las filas sin pérdida. Un cargador que adivina `numeric` con las primeras filas y después encuentra «Ana» corta la carga o trunca; uno que adivina y convierte deja celdas vacías en silencio. Cualquier elección que no sea texto pierde filas, y lo que se mide es cuántas.",
	},
	{
		name: "late_text_after_row_30",
		backlogCase: 9,
		description:
			"Columna casi numérica: las primeras 30 filas son enteros y el texto aparece recién después de la fila 30 (34, 41 y 48).",
		idealType: "text",
		values: sequence((index) => {
			const lateText = { 34: "sin dato", 41: "pendiente", 48: "revisar" };
			return lateText[index + 1] ?? String(101 + index);
		}),
		rawSamples: ["101", "sin dato", "pendiente"],
		notes:
			"Ideal: `text`, por las tres filas de texto. La posición es el punto: DataPusher 0.0.21 adivina el tipo con las **primeras** filas, declara `numeric` y no ve el texto hasta que ya cargó treinta y pico de filas, así que falla o trunca a mitad (BACKLOG). Si el cargador hace un muestreo de las primeras filas, ésta es la columna que lo delata; si recorre todo el archivo, la declara `text` y la medición lo muestra en `fields`.",
	},
];

export const COLUMNS = COLUMN_SPECS.map((spec) => spec.name);

// ── Casos que no caben en este archivo ──

const SEPARATE_FILE_CASES = [
	{
		backlog_case: 10,
		case: "latin1_encoding",
		description:
			"El mismo contenido guardado en Latin-1/Windows-1252 (á = 0xE1) y subido como UTF-8: los acentos llegan rotos o la carga falla.",
		why_separate:
			"Un archivo tiene una sola codificación. Si se mezclara acá, todas las columnas de texto dejarían de ser comparables entre sí.",
	},
	{
		backlog_case: 10,
		case: "utf8_bom",
		description:
			"BOM UTF-8 (EF BB BF) al inicio del archivo: la primera celda de la cabecera puede quedar como «\\ufeffbaseline_integer» y esa columna no se reconoce.",
		why_separate:
			"El BOM afecta sólo a la primera celda del archivo, y ese efecto no se puede aislar dentro de una columna de un CSV generado sin BOM.",
	},
	{
		backlog_case: 10,
		case: "semicolon_separator",
		description:
			"Separador `;` con coma decimal, que es lo que produce Excel en configuración regional española: un cargador que asume `,` ve una sola columna con toda la fila adentro.",
		why_separate:
			"El separador define la estructura del archivo entero, no el valor de una columna: con `;` todas las columnas de este archivo se leen mal a la vez.",
	},
	{
		backlog_case: 11,
		case: "duplicate_headers",
		description:
			"Dos columnas con el mismo nombre: el cargador puede renombrar la segunda, rechazar el archivo o pisar la primera.",
		why_separate:
			"Rompe el resto de la medición: el mapeo columna→caso deja de ser uno a uno y no se puede saber qué columna reportó `fields`.",
	},
	{
		backlog_case: 11,
		case: "empty_header",
		description:
			"Una columna sin nombre en la cabecera: el DataStore necesita un nombre y lo inventa o rechaza la carga.",
		why_separate:
			"Sin nombre no hay forma de referirse a esa columna en este JSON ni en `datastore_search`.",
	},
	{
		backlog_case: 11,
		case: "header_over_63_chars",
		description:
			"Un encabezado de más de 63 caracteres: PostgreSQL trunca los identificadores a 63 bytes, así que el nombre que vuelve en `fields` no es el que se subió.",
		why_separate:
			"El nombre de la columna cambia por el camino, y con él el mapeo columna→caso del archivo entero.",
	},
	{
		backlog_case: 11,
		case: "title_rows_before_header",
		description:
			"Dos o tres filas de título o comentario antes de la fila de encabezados: el cargador toma la primera fila como cabecera y todo corre una fila de lugar.",
		why_separate:
			"Desplaza la cabecera; dentro de un CSV con cabecera en la primera fila no se puede representar.",
	},
	{
		backlog_case: 12,
		case: "excel_multiple_sheets",
		description:
			"Un .xlsx con varias hojas: cuál se carga depende del cargador, y los tipos pueden diferir entre hojas.",
		why_separate:
			"Este archivo es CSV; la elección de hoja no se puede expresar en un solo archivo plano.",
	},
	{
		backlog_case: 12,
		case: "excel_merged_cells",
		description:
			"Un .xlsx con celdas combinadas: el valor queda en la primera celda del rango y las demás vacías, así que una columna que se ve llena llega con vacíos.",
		why_separate:
			"El CSV no tiene el concepto de celda combinada: el efecto (vacíos) se puede medir, la causa no.",
	},
	{
		backlog_case: 12,
		case: "excel_formulas",
		description:
			"Un .xlsx con fórmulas: se guarda el resultado calculado o la fórmula como texto según lo que lea el cargador, y un archivo sin recalcular trae el valor viejo.",
		why_separate: "Un CSV no tiene fórmulas: el caso existe sólo en el archivo de Excel original.",
	},
];

// ── CSV ──

/** Filas como objetos `{ columna: valor }`, que es lo que come `formatCsv`. */
export function generateRows() {
	return sequence((index) =>
		Object.fromEntries(COLUMN_SPECS.map((spec) => [spec.name, spec.values[index]])),
	);
}

export function generateCsv() {
	return formatCsv(generateRows(), COLUMNS);
}

// ── Expectativas ──

/** Qué se hace con el archivo, para que la sesión que mide no tenga que adivinarlo. */
const HOW_TO_RECORD = `Para cada cargador (DataPusher 0.0.21, el actual, y DataPusher+ vigente) se sube ESTE mismo archivo, sin editarlo, como recurso de un dataset del CKAN dev y se espera a que termine la tarea de carga. Después, por cargador, se anota lo siguiente.

1. ¿Terminó la carga? El \`total\` de \`datastore_search\` (¿son las 48 filas?), si el recurso quedó \`datastore_active\`, y el mensaje de error del cargador con la fila donde se detuvo si se detuvo.

2. Tipo por columna: la respuesta de \`datastore_search\` trae \`fields\`, y cada entrada tiene \`id\` y \`type\`. Anotar el \`type\` que el cargador declaró para cada columna de este archivo, más \`_id\`. Ojo: \`fields\` informa el \`typname\` de Postgres (\`int4\`, \`float8\`, \`text\`, \`timestamptz\`), no el nombre del tipo del DataStore (L17 de odd/tasks/csv-charts.md), así que conviene anotar los dos nombres si no coinciden.

3. Valores guardados: para cada columna, leer las filas de \`sample_rows\` (\`_id\` es el número de fila de datos, 1 = primera fila después de la cabecera) con \`datastore_search\` (\`filters: {"_id": n}\` o \`offset\`) y anotar el valor tal como vuelve. Se compara con \`ideal_values\`; lo que sirve es el valor crudo guardado, no un «bien/mal».

4. Un bloque por cargador, con nombre y versión, y las tres cosas por columna. Si la carga se cortó, anotar en qué fila y qué columnas quedaron: el corte es el resultado más importante de la medición, porque un cargador que se niega a cargar es más seguro que uno que guarda un número equivocado.`;

const PAYLOAD_TITLE = "Casos borde del cargador del DataStore — expectativas de la medición";

const PURPOSE = `Este JSON acompaña a ${CSV_FILE_LABEL}: una columna por caso borde del BACKLOG «[v1] Evaluar un cargador del DataStore que normalice valores», y para cada columna el tipo y los valores que guardaría un cargador ideal. El archivo lo consume la sesión de odp-docker, que sube el CSV con cada cargador y anota lo que realmente pasa. «Ideal» es una elección declarada en \`notes\` cuando el dato es ambiguo (dd/mm contra mm/dd, códigos con ceros a la izquierda, números de serie de Excel); la medición no consiste en acertar el ideal sino en registrar qué se guardó.`;

// ── Serialización del JSON ──

/**
 * El JSON se escribe con el mismo formato que aplica Biome (tabs, ancho 100: arreglos
 * cortos en una línea, objetos y arreglos largos uno por línea). Si no coincidiera,
 * `biome check` pediría reformatear un archivo generado y el repo quedaría con dos
 * versiones del mismo archivo: la del generador y la del formateador.
 */
const MAX_WIDTH = 100;
const TAB_WIDTH = 2;

/** Los caracteres invisibles se escriben escapados para que se puedan ver en el diff. */
const INVISIBLE_ESCAPES = new Map([
	["\u00a0", "\\u00a0"],
	["\u0301", "\\u0301"],
]);

function encodeString(value) {
	return JSON.stringify(value).replace(/\u00a0|\u0301/g, (char) => INVISIBLE_ESCAPES.get(char));
}

function isScalar(value) {
	return value === null || typeof value !== "object";
}

function inlineJson(value) {
	if (typeof value === "string") return encodeString(value);
	if (value === null) return "null";
	if (Array.isArray(value)) return `[${value.map(inlineJson).join(", ")}]`;
	if (typeof value === "object") {
		const entries = Object.entries(value).map(
			([key, item]) => `${encodeString(key)}: ${inlineJson(item)}`,
		);
		return `{ ${entries.join(", ")} }`;
	}
	return String(value);
}

/** `prefixLength` es lo que ya se escribió en la línea antes del valor (la clave). */
function renderJson(value, depth, prefixLength = 0) {
	if (isScalar(value)) return inlineJson(value);

	const indent = "\t".repeat(depth);
	const inlineForm = inlineJson(value);
	if (depth * TAB_WIDTH + prefixLength + inlineForm.length <= MAX_WIDTH) return inlineForm;

	const innerIndent = `${indent}\t`;
	if (Array.isArray(value)) {
		const items = value.map((item) => innerIndent + renderJson(item, depth + 1));
		return `[\n${items.join(",\n")}\n${indent}]`;
	}

	const entries = Object.entries(value).map(([key, item]) => {
		const keyText = encodeString(key);
		return `${innerIndent}${keyText}: ${renderJson(item, depth + 1, keyText.length + 2)}`;
	});
	return `{\n${entries.join(",\n")}\n${indent}}`;
}

export function serializeJson(payload) {
	return `${renderJson(payload, 0)}\n`;
}

export function buildExpectations(csvText) {
	const columns = COLUMN_SPECS.map((spec) => {
		const toIdeal = spec.toIdeal ?? identity;
		const rawSamples = spec.rawSamples ?? distinctSamples(spec.values, 3);
		return {
			column: spec.name,
			backlog_case: spec.backlogCase,
			description: spec.description,
			raw_samples: rawSamples,
			sample_rows: rawSamples.map((raw) => spec.values.indexOf(raw) + 1),
			ideal_type: spec.idealType,
			ideal_values: rawSamples.map((raw) => toIdeal(raw)),
			notes: spec.notes,
		};
	});

	const payload = {
		title: PAYLOAD_TITLE,
		csv_file: CSV_FILE_LABEL,
		csv_sha256: createHash("sha256").update(csvText).digest("hex"),
		row_count: ROW_COUNT,
		generated_by: "scripts/generate-edge-cases-csv.mjs",
		purpose: PURPOSE,
		how_to_record: HOW_TO_RECORD,
		columns,
		separate_file_cases: SEPARATE_FILE_CASES,
	};

	return serializeJson(payload);
}

export function generateExpectations() {
	return buildExpectations(generateCsv());
}

// ── CLI ──

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
	const csv = generateCsv();
	const expectations = buildExpectations(csv);
	mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
	writeFileSync(OUTPUT_PATH, csv, "utf8");
	writeFileSync(EXPECTATIONS_PATH, expectations, "utf8");

	const report = (path, text) => {
		const bytes = Buffer.byteLength(text, "utf8");
		const sha256 = createHash("sha256").update(text).digest("hex");
		console.log(`  ${path.replace(`${HERE}/`, "")}  ${bytes} bytes  sha256 ${sha256}`);
	};
	console.log(`✓ ${COLUMN_SPECS.length} columnas, ${ROW_COUNT} filas`);
	report(OUTPUT_PATH, csv);
	report(EXPECTATIONS_PATH, expectations);
}
