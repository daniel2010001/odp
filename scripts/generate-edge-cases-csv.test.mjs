// Test del generador del CSV de casos borde del cargador del DataStore — ítem «[v1]
// Evaluar un cargador del DataStore que normalice valores» de BACKLOG.md.
//
// Se corre con el runner de Node, no con Vitest: el generador es un script de Node puro y
// `vitest.config.ts` sólo mira `src/**`.
//
//   node --test scripts/generate-edge-cases-csv.test.mjs
//
// Qué protege: que el archivo que se sube al CKAN dev siga midiendo **una sola cosa por
// columna** — una entrada de expectativas por columna y viceversa, muestras que de verdad
// están en su columna y en la fila declarada, el texto tardío después de la fila 30, los
// dos controles limpios, los 12 casos del BACKLOG cubiertos, y los archivos versionados
// idénticos al generador.
//
// Y, para el segundo dataset (`loader-sampling-window.csv`), lo propio del muestreo: 1200
// filas con las primeras 1000 limpias y el valor problemático recién en la 1001, 1100 y
// 1200, que es lo que mide la ventana de 1000 filas de messytables.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
	COLUMNS,
	EXPECTATIONS_PATH,
	excelSerialToIso,
	generateCsv,
	generateExpectations,
	generateSamplingCsv,
	generateSamplingExpectations,
	LATE_ROWS,
	OUTPUT_PATH,
	ROW_COUNT,
	SAMPLE_WINDOW_ROWS,
	SAMPLING_COLUMNS,
	SAMPLING_EXPECTATIONS_PATH,
	SAMPLING_OUTPUT_PATH,
	SAMPLING_ROW_COUNT,
} from "./generate-edge-cases-csv.mjs";

// ── Parser RFC 4180 mínimo, para no depender de `papaparse` en un test de scripts ──

function parseCsv(text) {
	const records = [];
	let field = "";
	let record = [];
	let inQuotes = false;
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i += 1;
				continue;
			}
			field += ch;
			i += 1;
			continue;
		}
		if (ch === '"') {
			inQuotes = true;
			i += 1;
			continue;
		}
		if (ch === ",") {
			record.push(field);
			field = "";
			i += 1;
			continue;
		}
		if (ch === "\n") {
			record.push(field);
			records.push(record);
			record = [];
			field = "";
			i += 1;
			continue;
		}
		field += ch;
		i += 1;
	}
	if (field !== "" || record.length > 0) {
		record.push(field);
		records.push(record);
	}
	return records;
}

const csv = generateCsv();
const expectationsText = generateExpectations();
const expectations = JSON.parse(expectationsText);
const records = parseCsv(csv);
const header = records[0];
const rows = records
	.slice(1)
	.map((record) => Object.fromEntries(record.map((value, index) => [header[index], value])));

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const IDEAL_TYPES = new Set(["numeric", "timestamp", "boolean", "text"]);
const BACKLOG_CASES = Array.from({ length: 12 }, (_, index) => index + 1);
const isInteger = (value) => /^-?\d+$/.test(value);

test("es determinista: dos generaciones de CSV y de expectativas son idénticas", () => {
	assert.equal(generateCsv(), csv);
	assert.equal(generateExpectations(), expectationsText);
	assert.equal(sha256(generateCsv()), sha256(csv));
});

test("la cabecera es la de COLUMNS y hay entre 40 y 60 filas de datos", () => {
	assert.deepEqual(header, [...COLUMNS]);
	assert.ok(ROW_COUNT >= 40 && ROW_COUNT <= 60, `ROW_COUNT fuera de 40–60: ${ROW_COUNT}`);
	assert.equal(records.length - 1, ROW_COUNT);
	for (const record of records.slice(1)) {
		assert.equal(record.length, COLUMNS.length, `fila con ${record.length} campos`);
	}
});

test("cada columna del CSV tiene exactamente una entrada en el JSON y viceversa", () => {
	assert.equal(new Set(COLUMNS).size, COLUMNS.length, "hay columnas repetidas en COLUMNS");
	assert.deepEqual(
		expectations.columns.map((entry) => entry.column),
		[...COLUMNS],
		"las columnas del JSON no son las del CSV, o están en otro orden",
	);
});

test("cada entrada de expectativas está completa y es coherente", () => {
	for (const entry of expectations.columns) {
		assert.ok(
			entry.backlog_case === null || BACKLOG_CASES.includes(entry.backlog_case),
			`backlog_case inválido en ${entry.column}: ${entry.backlog_case}`,
		);
		assert.ok(IDEAL_TYPES.has(entry.ideal_type), `ideal_type inválido en ${entry.column}`);
		assert.ok(entry.description.length > 20, `descripción muy corta en ${entry.column}`);
		assert.ok(entry.notes.length > 20, `notes muy corto en ${entry.column}`);
		assert.ok(entry.raw_samples.length >= 2, `pocas muestras en ${entry.column}`);
		assert.equal(
			entry.ideal_values.length,
			entry.raw_samples.length,
			`ideal_values no cubre las muestras de ${entry.column}`,
		);
		assert.equal(
			entry.sample_rows.length,
			entry.raw_samples.length,
			`sample_rows no cubre las muestras de ${entry.column}`,
		);
	}

	// Los dos controles son las únicas entradas sin caso del BACKLOG, y son las dos.
	const baselines = expectations.columns
		.filter((entry) => entry.backlog_case === null)
		.map((entry) => entry.column);
	assert.deepEqual(baselines, ["baseline_integer", "baseline_iso_date"]);
});

test("cada muestra cruda está realmente en su columna, en la fila declarada", () => {
	for (const entry of expectations.columns) {
		const values = rows.map((row) => row[entry.column]);
		entry.raw_samples.forEach((raw, index) => {
			const rowNumber = entry.sample_rows[index];
			assert.ok(
				Number.isInteger(rowNumber) && rowNumber >= 1 && rowNumber <= ROW_COUNT,
				`fila fuera de rango en ${entry.column}: ${rowNumber}`,
			);
			assert.equal(
				rows[rowNumber - 1][entry.column],
				raw,
				`la muestra ${index} de ${entry.column} no está en la fila ${rowNumber}`,
			);
			assert.ok(values.includes(raw), `la muestra «${raw}» no existe en ${entry.column}`);
		});
	}
});

test("el texto tardío de late_text_after_row_30 aparece después de la fila 30", () => {
	const values = rows.map((row) => row.late_text_after_row_30);
	for (const [index, value] of values.slice(0, 30).entries()) {
		assert.ok(isInteger(value), `la fila ${index + 1} no es numérica: «${value}»`);
	}

	const lateText = values
		.map((value, index) => ({ value, row: index + 1 }))
		.filter(({ value }) => !isInteger(value));
	assert.ok(lateText.length >= 1, "no hay ningún texto después de la fila 30");
	for (const { value, row } of lateText) {
		assert.ok(row > 30, `el texto «${value}» está en la fila ${row}, no después de la 30`);
	}
});

test("los dos controles son limpios: enteros y fechas ISO reales, sin repetidos", () => {
	const integers = rows.map((row) => row.baseline_integer);
	for (const value of integers) assert.ok(isInteger(value), `entero inválido: «${value}»`);
	assert.equal(new Set(integers).size, ROW_COUNT, "baseline_integer tiene valores repetidos");

	for (const value of rows.map((row) => row.baseline_iso_date)) {
		assert.match(value, /^\d{4}-\d{2}-\d{2}$/, `fecha ISO inválida: «${value}»`);
		// Ida y vuelta: descarta 2024-02-31 y compañía.
		assert.equal(
			new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10),
			value,
			`fecha inexistente: «${value}»`,
		);
	}
});

test("los 12 casos del BACKLOG están cubiertos: 1–9 en columnas, 10–12 aparte", () => {
	const inColumns = new Set(
		expectations.columns.map((entry) => entry.backlog_case).filter((value) => value !== null),
	);
	assert.deepEqual(
		[...inColumns].sort((a, b) => a - b),
		BACKLOG_CASES.slice(0, 9),
		"los casos 1–9 no son exactamente los que están en columnas",
	);

	const separate = expectations.separate_file_cases;
	assert.ok(Array.isArray(separate) && separate.length >= 3, "faltan separate_file_cases");
	for (const kase of [10, 11, 12]) {
		assert.ok(
			separate.some((entry) => entry.backlog_case === kase),
			`falta un caso separado para el BACKLOG ${kase}`,
		);
	}
	for (const entry of separate) {
		assert.ok(BACKLOG_CASES.includes(entry.backlog_case), `caso separado inválido: ${entry.case}`);
		assert.ok(entry.case.length > 0, "caso separado sin id");
		assert.ok(entry.description.length > 20, `descripción muy corta en ${entry.case}`);
		assert.ok(entry.why_separate.length > 20, `why_separate muy corto en ${entry.case}`);
	}
});

test("el JSON explica cómo medir: cargador, datastore_search y fields", () => {
	assert.equal(typeof expectations.how_to_record, "string");
	assert.ok(expectations.how_to_record.includes("datastore_search"));
	assert.ok(expectations.how_to_record.includes("fields"));
	assert.ok(expectations.how_to_record.includes("DataPusher"));
	assert.equal(expectations.row_count, ROW_COUNT);
});

test("los archivos versionados en scripts/data/ coinciden con el generador", () => {
	assert.equal(
		readFileSync(OUTPUT_PATH, "utf8"),
		csv,
		"el CSV versionado no coincide: corra `node scripts/generate-edge-cases-csv.mjs`",
	);
	assert.equal(
		readFileSync(EXPECTATIONS_PATH, "utf8"),
		expectationsText,
		"el JSON versionado no coincide: corra `node scripts/generate-edge-cases-csv.mjs`",
	);
});

test("el sha256 del CSV en el JSON es el del CSV", () => {
	assert.equal(expectations.csv_sha256, sha256(csv));
	assert.equal(expectations.csv_file, "scripts/data/loader-edge-cases.csv");
});

// Los dos hashes del primer dataset, fijados a mano: el segundo dataset se agrega sin
// tocarle un byte al primero, y esto lo vuelve comprobable en vez de confiado.
const DATASET_1_CSV_SHA256 = "c74fe2fa9690e708c158ce587e027c45df21860481ac3473e909b3f11001ae22";
const DATASET_1_JSON_SHA256 = "4dd5dce692d6566d04e740ad33bb72d654f27c2cc79516d310777cd2f1f9d2a6";

test("el primer dataset no cambió: sus sha256 son los del commit anterior", () => {
	assert.equal(sha256(csv), DATASET_1_CSV_SHA256, "cambió el CSV del primer dataset");
	assert.equal(
		sha256(expectationsText),
		DATASET_1_JSON_SHA256,
		"cambió el JSON del primer dataset",
	);
	assert.equal(sha256(readFileSync(OUTPUT_PATH, "utf8")), DATASET_1_CSV_SHA256);
	assert.equal(sha256(readFileSync(EXPECTATIONS_PATH, "utf8")), DATASET_1_JSON_SHA256);
});

// ── Triangulación: los ideales que se calculan, y lo que el CSV conserva byte a byte ──

test("los números de serie de Excel se traducen a la fecha correcta (control del ideal)", () => {
	assert.equal(excelSerialToIso("45292"), "2024-01-01");
	assert.equal(excelSerialToIso("44927"), "2023-01-01");
	assert.equal(excelSerialToIso("44197"), "2021-01-01");
	// Fuera del rango moderno el serial 1 cae un día antes en Excel por su bug del 29/02/1900:
	// por eso sólo se usan seriales posteriores al 01/03/1900 en la columna.
	assert.equal(excelSerialToIso("61"), "1900-03-01");
});

test("el CSV respeta RFC 4180 y conserva comas, NBSP y NFD como bytes distintos", () => {
	assert.equal(rows[0].decimal_comma, "1,5");
	assert.ok(csv.includes('"1,5"'), "la coma decimal no va entre comillas");
	assert.equal(rows[0].us_thousands, "1,234.56");
	assert.ok(csv.includes('"1,234.56"'), "los miles en formato US no van entre comillas");

	// U+00A0 se ve como un espacio y no lo es.
	assert.equal(rows[0].text_nbsp, "San\u00a0José");
	assert.notEqual(rows[0].text_nbsp, "San José");

	// El mismo nombre en NFC y en NFD son dos cadenas distintas que se ven igual.
	assert.equal(rows[0].text_nfc_vs_nfd, "José");
	assert.equal(rows[1].text_nfc_vs_nfd, "Jose\u0301");
	assert.notEqual(rows[0].text_nfc_vs_nfd, rows[1].text_nfc_vs_nfd);
	assert.equal(rows[1].text_nfc_vs_nfd.normalize("NFC"), rows[0].text_nfc_vs_nfd);
});

// ── Segundo dataset: la ventana de muestreo de 1000 filas (messytables) ──
//
// Medición 1 del BACKLOG midió el DataPusher 0.0.21 con 48 filas, y con 48 filas el archivo
// entero cabe en la muestra: messytables adivina con una ventana de 1000 filas
// (`messytables/commas.py`: `window or 1000`), así que el texto tardío de la fila 34 estaba
// dentro del muestreo. Este segundo archivo pone el valor problemático **después** de la
// ventana, que es el caso que la medición anterior no podía ver.

const samplingCsv = generateSamplingCsv();
const samplingExpectationsText = generateSamplingExpectations();
const samplingExpectations = JSON.parse(samplingExpectationsText);
const samplingRecords = parseCsv(samplingCsv);
const samplingHeader = samplingRecords[0];
const samplingRows = samplingRecords
	.slice(1)
	.map((record) =>
		Object.fromEntries(record.map((value, index) => [samplingHeader[index], value])),
	);

/** Las columnas con valor tardío: todas menos el control de filas. */
const LATE_COLUMNS = [
	"late_text_after_row_1000",
	"late_decimal_comma_after_row_1000",
	"late_invalid_date_after_row_1000",
	"late_ambiguous_date_after_row_1000",
];

const isDotDecimal = (value) => /^-?\d+\.\d+$/.test(value);
const isIsoDate = (value) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	// Ida y vuelta: descarta 2024-02-31 y 2024-13-01, que el regex acepta.
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const isDdMmWithDayOverTwelve = (value) => {
	const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	return match !== null && Number(match[1]) > 12;
};

/** Qué significa «limpia» en cada columna tardía: el valor que ve la ventana de 1000 filas. */
const CLEAN_CHECKS = {
	late_text_after_row_1000: isInteger,
	late_decimal_comma_after_row_1000: isDotDecimal,
	late_invalid_date_after_row_1000: isIsoDate,
	late_ambiguous_date_after_row_1000: isDdMmWithDayOverTwelve,
};

/** El valor problemático que va exactamente en las filas 1001, 1100 y 1200. */
const LATE_VALUES = {
	late_text_after_row_1000: ["sin dato", "pendiente", "N/A"],
	late_decimal_comma_after_row_1000: ["1,5", "2,25", "3,75"],
	late_invalid_date_after_row_1000: ["31/02/2024", "2024-13-01", "no aplica"],
	late_ambiguous_date_after_row_1000: ["03/04/2024", "05/06/2023", "07/08/2022"],
};

test("el dataset de la ventana es determinista: dos generaciones son idénticas", () => {
	assert.equal(generateSamplingCsv(), samplingCsv);
	assert.equal(generateSamplingExpectations(), samplingExpectationsText);
	assert.equal(sha256(generateSamplingCsv()), sha256(samplingCsv));
});

test("la ventana son 1200 filas de datos con la cabecera de SAMPLING_COLUMNS", () => {
	assert.deepEqual(samplingHeader, [...SAMPLING_COLUMNS]);
	assert.equal(SAMPLING_ROW_COUNT, 1200);
	assert.equal(SAMPLE_WINDOW_ROWS, 1000);
	assert.deepEqual([...LATE_ROWS], [1001, 1100, 1200]);
	assert.equal(samplingRecords.length - 1, SAMPLING_ROW_COUNT);
	for (const record of samplingRecords.slice(1)) {
		assert.equal(record.length, SAMPLING_COLUMNS.length, `fila con ${record.length} campos`);
	}
});

test("el control row_number es 1..1200 en orden, sin huecos ni repetidos", () => {
	assert.deepEqual(
		samplingRows.map((row) => row.row_number),
		Array.from({ length: SAMPLING_ROW_COUNT }, (_, index) => String(index + 1)),
	);
});

test("cada columna de la ventana tiene una entrada en su JSON y viceversa", () => {
	assert.equal(
		new Set(SAMPLING_COLUMNS).size,
		SAMPLING_COLUMNS.length,
		"hay columnas repetidas en SAMPLING_COLUMNS",
	);
	assert.deepEqual(
		samplingExpectations.columns.map((entry) => entry.column),
		[...SAMPLING_COLUMNS],
		"las columnas del JSON no son las del CSV, o están en otro orden",
	);
	assert.equal(samplingExpectations.row_count, SAMPLING_ROW_COUNT);
	assert.equal(samplingExpectations.csv_file, "scripts/data/loader-sampling-window.csv");
});

test("el JSON de la ventana explica la ventana de 1000 filas y sus fuentes", () => {
	const purpose = samplingExpectations.purpose;
	assert.equal(typeof purpose, "string");
	assert.ok(purpose.includes("1000"), "el purpose no nombra la ventana de 1000 filas");
	assert.ok(
		purpose.includes("messytables/commas.py"),
		"el purpose no cita el window de messytables",
	);
	assert.ok(
		purpose.includes("datapusher/jobs.py:459"),
		"el purpose no cita el type_guess de jobs.py",
	);
	assert.ok(
		samplingExpectations.how_to_record.includes("datastore_search"),
		"how_to_record no dice cómo leer el resultado",
	);
});

test("cada entrada de la ventana está completa y cubre el interior y las filas tardías", () => {
	const insideWindow = [1, 500, SAMPLE_WINDOW_ROWS];
	for (const entry of samplingExpectations.columns) {
		assert.ok(IDEAL_TYPES.has(entry.ideal_type), `ideal_type inválido en ${entry.column}`);
		assert.ok(entry.description.length > 20, `descripción muy corta en ${entry.column}`);
		assert.equal(
			entry.ideal_values.length,
			entry.raw_samples.length,
			`ideal_values no cubre las muestras de ${entry.column}`,
		);
		assert.equal(
			entry.sample_rows.length,
			entry.raw_samples.length,
			`sample_rows no cubre las muestras de ${entry.column}`,
		);
		for (const row of [...insideWindow, ...LATE_ROWS]) {
			assert.ok(
				entry.sample_rows.includes(row),
				`las muestras de ${entry.column} no incluyen la fila ${row}`,
			);
		}
	}

	// Las notas tienen que decir qué pasa en cada comportamiento posible del cargador: no
	// alcanza con describir el caso, hay que poder anotar el resultado contra algo.
	for (const entry of samplingExpectations.columns) {
		if (!LATE_COLUMNS.includes(entry.column)) {
			assert.ok(
				entry.notes.toLowerCase().includes("control"),
				`notes de ${entry.column} no lo declara control`,
			);
			continue;
		}
		assert.ok(entry.notes.includes("1001"), `notes de ${entry.column} no nombra la fila 1001`);
		assert.ok(
			entry.notes.includes("null"),
			`notes de ${entry.column} no dice qué pasa si queda null`,
		);
		assert.ok(
			entry.notes.includes("se corta"),
			`notes de ${entry.column} no dice qué pasa si se corta`,
		);
		assert.ok(
			entry.notes.includes("texto"),
			`notes de ${entry.column} no dice qué pasa si cae a texto`,
		);
	}
});

test("cada muestra cruda de la ventana está en su columna, en la fila declarada", () => {
	for (const entry of samplingExpectations.columns) {
		entry.raw_samples.forEach((raw, index) => {
			const rowNumber = entry.sample_rows[index];
			assert.ok(
				Number.isInteger(rowNumber) && rowNumber >= 1 && rowNumber <= SAMPLING_ROW_COUNT,
				`fila fuera de rango en ${entry.column}: ${rowNumber}`,
			);
			assert.equal(
				samplingRows[rowNumber - 1][entry.column],
				raw,
				`la muestra ${index} de ${entry.column} no está en la fila ${rowNumber}`,
			);
		});
	}
});

test("las filas 1–1000 de cada columna tardía son limpias", () => {
	for (const column of LATE_COLUMNS) {
		const values = samplingRows.map((row) => row[column]);
		for (const [index, value] of values.slice(0, SAMPLE_WINDOW_ROWS).entries()) {
			assert.ok(
				CLEAN_CHECKS[column](value),
				`${column}: la fila ${index + 1} no es limpia dentro de la ventana: «${value}»`,
			);
		}
	}
});

test("el valor tardío está exactamente en 1001, 1100 y 1200, y en ninguna otra fila", () => {
	for (const column of LATE_COLUMNS) {
		const late = LATE_VALUES[column];
		const clean = CLEAN_CHECKS[column];
		LATE_ROWS.forEach((row, index) => {
			assert.equal(
				samplingRows[row - 1][column],
				late[index],
				`${column}: la fila ${row} no tiene «${late[index]}»`,
			);
			assert.ok(!clean(late[index]), `${column}: «${late[index]}» no es un valor problemático`);
		});

		const dirtyRows = samplingRows
			.map((row, index) => ({ row: index + 1, value: row[column] }))
			.filter(({ value }) => !clean(value))
			.map(({ row }) => row);
		assert.deepEqual(
			dirtyRows,
			[...LATE_ROWS],
			`${column} tiene valores sucios fuera de las filas tardías`,
		);
	}
});

test("los ideales de la ventana son la lectura declarada, no un valor inventado", () => {
	const byColumn = Object.fromEntries(
		samplingExpectations.columns.map((entry) => [entry.column, entry]),
	);

	// Coma decimal tardía: el ideal es el número, igual que en el primer dataset.
	assert.equal(byColumn.late_decimal_comma_after_row_1000.ideal_type, "numeric");
	assert.equal(byColumn.late_decimal_comma_after_row_1000.ideal_values.at(-1), 3.75);

	// Fecha ambigua tardía: lectura dd/mm (03/04/2024 = 3 de abril, no 4 de marzo).
	const ambiguous = byColumn.late_ambiguous_date_after_row_1000;
	assert.equal(ambiguous.ideal_type, "timestamp");
	assert.deepEqual(ambiguous.ideal_values.slice(-3), ["2024-04-03", "2023-06-05", "2022-08-07"]);

	// Texto tardío y fecha inválida: texto, que es el único tipo que guarda la fila entera.
	assert.equal(byColumn.late_text_after_row_1000.ideal_type, "text");
	assert.equal(byColumn.late_invalid_date_after_row_1000.ideal_type, "text");
	assert.equal(byColumn.late_invalid_date_after_row_1000.ideal_values.at(-1), "no aplica");
});

test("el CSV de la ventana cita la coma decimal tardía y no toca los valores limpios", () => {
	assert.ok(samplingCsv.includes('"1,5"'), "la coma decimal tardía no va entre comillas");
	assert.equal(samplingRows[0].late_decimal_comma_after_row_1000, "12.50");
	assert.equal(samplingRows[999].late_text_after_row_1000, "5999");
	assert.equal(samplingRows[1001].late_text_after_row_1000, "6001");
});

test("los archivos versionados de la ventana coinciden con el generador", () => {
	assert.equal(
		readFileSync(SAMPLING_OUTPUT_PATH, "utf8"),
		samplingCsv,
		"el CSV de la ventana no coincide: corra `node scripts/generate-edge-cases-csv.mjs`",
	);
	assert.equal(
		readFileSync(SAMPLING_EXPECTATIONS_PATH, "utf8"),
		samplingExpectationsText,
		"el JSON de la ventana no coincide: corra `node scripts/generate-edge-cases-csv.mjs`",
	);
	assert.equal(samplingExpectations.csv_sha256, sha256(samplingCsv));
});
