// Test del generador «Producción de investigación» — T7 de odd/tasks/csv-charts.md.
//
//   node --test scripts/generate-investigacion-csv.test.mjs
//
// Protege lo que hace graficable el dataset: determinismo byte a byte, mapa de tipos igual
// a la cabecera, valores que el DataStore pueda tipar (L36), el pastel por tipo de producto,
// la diferencia entre contar filas y contar proyectos distintos, y los vacíos deliberados.

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
} from "./generate-investigacion-csv.mjs";

const csv = generateCsv();
const records = parseCsv(csv);
const header = records[0];
const rows = records
	.slice(1)
	.map((record) => Object.fromEntries(record.map((v, i) => [header[i], v])));

const countBy = (key) => {
	const counts = new Map();
	for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
	return counts;
};

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
		assert.match(row.anio, /^\d{4}$/);
		assert.ok(Number(row.anio) >= FIRST_YEAR && Number(row.anio) <= LAST_YEAR);
		assert.match(row.autores, /^[1-9]\d*$/);
	}
});

test("pastel por tipo de producto: 8 tipos, el mayor domina y la cola es corta", () => {
	const byType = countBy("tipo_producto");
	assert.equal(byType.size, 8);
	assert.equal(byType.has(""), false, "tipo_producto no lleva vacíos");
	const counts = [...byType.values()].sort((a, b) => b - a);
	assert.ok(counts[0] > rows.length * 0.2, "no hay un tipo dominante");
	assert.ok(counts[counts.length - 1] < rows.length * 0.03, "la cola no es corta");
});

test("count_distinct sobre proyecto_id difiere de contar filas", () => {
	const projects = new Set(rows.map((row) => row.proyecto_id).filter((v) => v !== ""));
	assert.ok(projects.size >= 100, `proyectos: ${projects.size}`);
	assert.ok(rows.length > projects.size * 1.5, "casi un producto por proyecto");
	for (const id of projects) assert.match(id, /^PRY-\d{4}-\d{4}$/);
});

test("un proyecto fija su departamento y los productos no preceden a su inicio", () => {
	const departmentOf = new Map();
	for (const row of rows) {
		if (row.proyecto_id === "") continue;
		const seen = departmentOf.get(row.proyecto_id);
		if (seen) assert.equal(seen, row.departamento, row.proyecto_id);
		departmentOf.set(row.proyecto_id, row.departamento);
		assert.ok(Number(row.anio) >= Number(row.proyecto_id.slice(4, 8)), row.proyecto_id);
	}
});

test("líneas por año: los 11 años están y la producción reciente supera a la inicial", () => {
	const byYear = countBy("anio");
	assert.equal(byYear.size, LAST_YEAR - FIRST_YEAR + 1);
	assert.ok(byYear.get("2024") > byYear.get("2015"));
});

test("proyecto_id y fuente_financiamiento traen vacíos acotados; el resto no", () => {
	const rate = (column) => rows.filter((row) => row[column] === "").length / rows.length;
	for (const column of ["proyecto_id", "fuente_financiamiento"]) {
		assert.ok(rate(column) > 0.01 && rate(column) < 0.08, `${column}: ${rate(column)}`);
	}
	for (const column of ["departamento", "tipo_producto", "anio", "autores"]) {
		assert.equal(rate(column), 0, `${column} tiene vacíos`);
	}
});

test("el CSV versionado en scripts/data/ coincide con el generador", () => {
	assert.equal(
		readFileSync(OUTPUT_PATH, "utf8"),
		csv,
		"el CSV versionado no coincide: corra `node scripts/generate-investigacion-csv.mjs`",
	);
});
