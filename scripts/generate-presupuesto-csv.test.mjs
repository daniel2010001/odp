// Test del generador «Ejecución presupuestaria mensual» — T7 de odd/tasks/csv-charts.md.
//
//   node --test scripts/generate-presupuesto-csv.test.mjs
//
// Protege lo que hace graficable el dataset: determinismo byte a byte, mapa de tipos igual
// a la cabecera, valores que el DataStore pueda tipar (L36), fechas que se parten por
// mes/trimestre/año, montos con rango útil y los vacíos deliberados del grupo `null`.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { isValidForType, parseCsv } from "./generate-csv-common.mjs";
import {
	COLUMNS,
	FIRST_YEAR,
	generateCsv,
	LAST_YEAR,
	OUTPUT_PATH,
	TYPES,
} from "./generate-presupuesto-csv.mjs";

const csv = generateCsv();
const records = parseCsv(csv);
const header = records[0];
const rows = records
	.slice(1)
	.map((record) => Object.fromEntries(record.map((v, i) => [header[i], v])));

test("es determinista: dos generaciones son idénticas byte a byte", () => {
	assert.equal(generateCsv(), csv);
	const digest = (text) => createHash("sha256").update(text).digest("hex");
	assert.equal(digest(generateCsv()), digest(csv));
});

test("otra semilla produce otro dataset (el PRNG está realmente sembrado)", () => {
	assert.notEqual(generateCsv({ seed: 7 }), csv);
});

test("la cabecera es COLUMNS, las filas son rectangulares y hay unos cientos o miles", () => {
	assert.deepEqual(header, [...COLUMNS]);
	for (const record of records.slice(1)) assert.equal(record.length, COLUMNS.length);
	assert.ok(rows.length >= 300 && rows.length <= 5000, `filas: ${rows.length}`);
});

test("las claves del mapa de tipos son exactamente los encabezados del CSV", () => {
	assert.deepEqual(Object.keys(TYPES).sort(), [...header].sort());
	for (const type of Object.values(TYPES))
		assert.ok(["numeric", "timestamp", "text"].includes(type));
});

test("todo valor de una columna numérica o de fecha se interpreta (o está vacío) — L36", () => {
	for (const [column, type] of Object.entries(TYPES)) {
		for (const row of rows) {
			assert.ok(isValidForType(type, row[column]), `${column}=${JSON.stringify(row[column])}`);
		}
	}
	for (const row of rows) {
		for (const value of Object.values(row)) assert.ok(!["NA", "-", "s/d"].includes(value));
		assert.match(row.monto_programado, /^\d+\.\d{2}$/, "programado sin 2 decimales");
		if (row.monto_ejecutado !== "") assert.match(row.monto_ejecutado, /^\d+\.\d{2}$/);
	}
});

test("las fechas cubren los 24 meses de 2024–2025, para month/quarter/year", () => {
	const dates = rows.map((row) => row.fecha_registro).filter((v) => v !== "");
	const months = new Set(dates.map((d) => d.slice(0, 7)));
	assert.equal(months.size, (LAST_YEAR - FIRST_YEAR + 1) * 12);
	for (const date of dates) {
		assert.ok(Number(date.slice(0, 4)) >= FIRST_YEAR && Number(date.slice(0, 4)) <= LAST_YEAR);
	}
});

test("los montos tienen rango útil: ejecutado ≤ 1,04 × programado y cola larga", () => {
	const programmed = rows.map((row) => Number(row.monto_programado));
	assert.ok(Math.min(...programmed) < 5000 && Math.max(...programmed) > 200000);
	for (const row of rows) {
		if (row.monto_ejecutado === "") continue;
		assert.ok(Number(row.monto_ejecutado) <= Number(row.monto_programado) * 1.04 + 0.01);
	}
});

test("la ejecución del último trimestre supera a la del primero (señal estacional)", () => {
	const executedIn = (months) =>
		rows
			.filter((row) => row.fecha_registro !== "" && months.includes(row.fecha_registro.slice(5, 7)))
			.reduce((sum, row) => sum + Number(row.monto_ejecutado || 0), 0);
	assert.ok(executedIn(["10", "11", "12"]) > executedIn(["01", "02", "03"]));
});

test("cardinalidad para barras y pastel: 12 unidades y 8 partidas (más el vacío)", () => {
	assert.equal(new Set(rows.map((row) => row.unidad)).size, 12);
	assert.equal(new Set(rows.map((row) => row.partida).filter((v) => v !== "")).size, 8);
});

test("fecha_registro, partida y monto_ejecutado traen vacíos acotados; el resto no", () => {
	const rate = (column) => rows.filter((row) => row[column] === "").length / rows.length;
	for (const column of ["fecha_registro", "partida", "monto_ejecutado"]) {
		assert.ok(rate(column) > 0.005 && rate(column) < 0.05, `${column}: ${rate(column)}`);
	}
	for (const column of ["unidad", "monto_programado"]) {
		assert.equal(rate(column), 0, `${column} tiene vacíos`);
	}
});

test("el CSV versionado en scripts/data/ coincide con el generador", () => {
	assert.equal(
		readFileSync(OUTPUT_PATH, "utf8"),
		csv,
		"el CSV versionado no coincide: corra `node scripts/generate-presupuesto-csv.mjs`",
	);
});
