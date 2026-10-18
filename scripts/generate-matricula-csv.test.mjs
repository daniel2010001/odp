// Test del generador «Matrícula por facultad y gestión» — T7 de odd/tasks/csv-charts.md.
//
//   node --test scripts/generate-matricula-csv.test.mjs
//
// Protege lo que hace graficable el dataset: determinismo byte a byte, mapa de tipos igual
// a la cabecera, valores que el DataStore pueda tipar (L36), la serie por gestión con su
// caída de 2020, el reparto por sexo y los vacíos deliberados del grupo `null`.

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
} from "./generate-matricula-csv.mjs";

const csv = generateCsv();
const records = parseCsv(csv);
const header = records[0];
const rows = records
	.slice(1)
	.map((record) => Object.fromEntries(record.map((v, i) => [header[i], v])));

const sumBy = (key) => {
	const totals = new Map();
	for (const row of rows) {
		totals.set(row[key], (totals.get(row[key]) ?? 0) + Number(row.inscritos));
	}
	return totals;
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
	// Ningún marcador de «sin dato» disfrazado de valor.
	for (const row of rows) {
		for (const value of Object.values(row)) assert.ok(!["NA", "-", "s/d"].includes(value));
	}
	for (const row of rows) {
		assert.match(row.gestion, /^\d{4}$/);
		assert.match(row.inscritos, /^[1-9]\d*$/, "inscritos es un entero positivo y nunca vacío");
	}
});

test("hay una serie por gestión 2015–2025, creciente salvo la caída de 2020", () => {
	const byYear = sumBy("gestion");
	const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) =>
		String(FIRST_YEAR + i),
	);
	assert.deepEqual([...byYear.keys()].sort(), years);
	assert.ok(byYear.get("2020") < byYear.get("2019"), "2020 no cae respecto de 2019");
	assert.ok(byYear.get("2025") > byYear.get("2015") * 1.2, "no hay tendencia de crecimiento");
});

test("barras por facultad: 8 facultades y la mayor duplica a la menor", () => {
	const byFaculty = sumBy("facultad");
	assert.equal(byFaculty.size, 8);
	const totals = [...byFaculty.values()];
	assert.ok(Math.max(...totals) > 2 * Math.min(...totals));
});

test("pastel por sexo: dos rebanadas parejas más el vacío; modalidad virtual desde 2020", () => {
	const bySex = sumBy("sexo");
	assert.deepEqual([...bySex.keys()].filter((v) => v !== "").sort(), ["Femenino", "Masculino"]);
	const [f, m] = [bySex.get("Femenino"), bySex.get("Masculino")];
	assert.ok(Math.min(f, m) / Math.max(f, m) > 0.6, "las rebanadas no son comparables");

	const virtual = rows.filter((row) => row.modalidad === "Virtual");
	assert.ok(virtual.length > 0);
	assert.ok(
		virtual.every((row) => Number(row.gestion) >= 2020),
		"virtual antes de 2020",
	);
});

test("sexo y modalidad traen vacíos acotados; ninguna otra columna los trae", () => {
	const rate = (column) => rows.filter((row) => row[column] === "").length / rows.length;
	for (const column of ["sexo", "modalidad"]) {
		assert.ok(rate(column) > 0.005 && rate(column) < 0.05, `${column}: ${rate(column)}`);
	}
	for (const column of COLUMNS.filter((c) => c !== "sexo" && c !== "modalidad")) {
		assert.equal(rate(column), 0, `${column} tiene vacíos`);
	}
});

test("carrera sirve para count_distinct: más de 25 valores", () => {
	assert.ok(new Set(rows.map((row) => row.carrera)).size > 25);
});

test("el CSV versionado en scripts/data/ coincide con el generador", () => {
	assert.equal(
		readFileSync(OUTPUT_PATH, "utf8"),
		csv,
		"el CSV versionado no coincide: corra `node scripts/generate-matricula-csv.mjs`",
	);
});
