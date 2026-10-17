// Test del generador del CSV ficticio de la demo — T6 de odd/tasks/csv-charts.md.
//
// Se corre con el runner de Node, no con Vitest: el generador es un script de Node
// puro y `vitest.config.ts` sólo mira `src/**`.
//
//   node --test scripts/generate-demo-csv.test.mjs
//
// Qué protege: que el dataset que sostiene S7 (todos los buckets y agregaciones del
// contrato) siga teniendo la forma que el contrato necesita — determinismo byte a byte,
// columnas, `salario = horas_mes * bs_hora`, los tres turnos más vacíos, las tasas de
// vacíos del grupo `null`, y fechas que el DataStore pueda partir por año/trimestre/mes.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { COLUMNS, formatCsv, generateCsv, OUTPUT_PATH, ROW_COUNT } from "./generate-demo-csv.mjs";

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
		if (ch === "\r") {
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

// Mismo redondeo a centavos que el generador: el test recalcula el producto y lo compara
// con la columna, así que la igualdad es exacta sin depender de la representación binaria.
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

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

test("la cabecera es la del contrato y hay exactamente ROW_COUNT filas", () => {
	assert.deepEqual(header, [...COLUMNS]);
	assert.equal(ROW_COUNT, 2500);
	assert.equal(records.length - 1, ROW_COUNT);
	for (const record of records.slice(1)) {
		assert.equal(record.length, COLUMNS.length, `fila con ${record.length} campos`);
	}
	assert.deepEqual(
		rows.map((row) => row.n),
		Array.from({ length: ROW_COUNT }, (_, i) => String(i + 1)),
	);
});

test("salario es horas_mes * bs_hora redondeado a centavos, en toda fila", () => {
	for (const row of rows) {
		const hours = Number(row.horas_mes);
		const hourlyRate = Number(row.bs_hora);
		const salary = Number(row.salario);
		assert.ok(Number.isFinite(hours) && hours > 0, `horas_mes inválido en n=${row.n}`);
		assert.ok(Number.isFinite(hourlyRate) && hourlyRate > 0, `bs_hora inválido en n=${row.n}`);
		assert.match(row.bs_hora, /^\d+\.\d{2}$/, `bs_hora sin 2 decimales en n=${row.n}`);
		assert.match(row.salario, /^\d+\.\d{2}$/, `salario sin 2 decimales en n=${row.n}`);
		assert.equal(salary, round2(hours * hourlyRate), `salario no cierra en n=${row.n}`);
	}
});

test("turno tiene exactamente tres valores más el vacío", () => {
	const values = new Set(rows.map((row) => row.turno).filter((v) => v !== ""));
	assert.deepEqual([...values].sort(), ["mañana", "noche", "tarde"]);
});

test("las tasas de vacíos son las del grupo null: ~3% turno, ~2% fecha_ingreso", () => {
	const rate = (column) => rows.filter((row) => row[column] === "").length / rows.length;
	const shift = rate("turno");
	const hireDate = rate("fecha_ingreso");
	assert.ok(shift >= 0.02 && shift <= 0.04, `turno vacío fuera de banda: ${shift}`);
	assert.ok(
		hireDate >= 0.01 && hireDate <= 0.03,
		`fecha_ingreso vacío fuera de banda: ${hireDate}`,
	);

	// Ninguna otra columna trae vacíos: los datos faltantes son deliberados y acotados.
	for (const column of COLUMNS) {
		if (column === "turno" || column === "fecha_ingreso") continue;
		const empty = rows.filter((row) => row[column] === "").length;
		assert.equal(empty, 0, `${column} tiene ${empty} vacíos`);
	}
});

test("cada fecha no vacía es un YYYY-MM-DD real dentro de 1995–2025", () => {
	for (const row of rows) {
		if (row.fecha_ingreso === "") continue;
		assert.match(row.fecha_ingreso, /^\d{4}-\d{2}-\d{2}$/, `formato en n=${row.n}`);
		const date = new Date(`${row.fecha_ingreso}T00:00:00Z`);
		assert.ok(!Number.isNaN(date.getTime()), `fecha inválida en n=${row.n}`);
		// Ida y vuelta: descarta 2024-02-31 y compañía.
		assert.equal(date.toISOString().slice(0, 10), row.fecha_ingreso, `n=${row.n}`);
		assert.ok(date >= new Date("1995-01-01T00:00:00Z"), `fecha anterior a 1995 en n=${row.n}`);
		assert.ok(date <= new Date("2025-12-31T00:00:00Z"), `fecha posterior a 2025 en n=${row.n}`);
	}
});

test("las fechas alimentan los buckets year/quarter/month", () => {
	const dates = rows.map((row) => row.fecha_ingreso).filter((v) => v !== "");
	assert.ok(new Set(dates.map((d) => d.slice(0, 4))).size >= 25, "pocos años distintos");
	assert.equal(new Set(dates.map((d) => d.slice(5, 7))).size, 12, "no están los 12 meses");
	const quarters = new Set(
		dates.map((d) => `${d.slice(0, 4)}-Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`),
	);
	assert.ok(quarters.size >= 100, `pocos trimestres distintos: ${quarters.size}`);
});

test("la cardinalidad sirve para graficar: 9 departamentos, 6–8 facultades, 8–12 cargos", () => {
	const distinct = (column) => new Set(rows.map((row) => row[column])).size;
	assert.equal(distinct("departamento"), 9);
	assert.ok(distinct("facultad") >= 6 && distinct("facultad") <= 8, "facultades fuera de 6–8");
	assert.ok(distinct("cargo") >= 8 && distinct("cargo") <= 12, "cargos fuera de 8–12");
});

test("ninguna persona se repite y cada valor de turno se usa (datos útiles, no ruido)", () => {
	const people = new Set(rows.map((row) => `${row.nombre} ${row.apellido}`));
	assert.equal(people.size, rows.length, "hay combinaciones nombre+apellido repetidas");
	for (const value of ["mañana", "tarde", "noche"]) {
		assert.ok(
			rows.filter((row) => row.turno === value).length >= 100,
			`turno ${value} con muy pocas filas`,
		);
	}
});

// ── Triangulación: el formato RFC 4180 y la semilla ──

test("el CSV cita sólo cuando hace falta, con la regla RFC 4180", () => {
	const text = formatCsv([{ nombre: "Ana", apellido: 'Quispe "la jefa"' }], ["nombre", "apellido"]);
	assert.equal(text, 'nombre,apellido\nAna,"Quispe ""la jefa"""\n');

	const withComma = formatCsv([{ nombre: "Ana, Luz", apellido: "Mamani" }], ["nombre", "apellido"]);
	assert.equal(withComma, 'nombre,apellido\n"Ana, Luz",Mamani\n');

	const withNewline = formatCsv(
		[{ nombre: "Ana", apellido: "Mamani\nSegundo" }],
		["nombre", "apellido"],
	);
	assert.equal(withNewline, 'nombre,apellido\nAna,"Mamani\nSegundo"\n');
});

test("otra semilla produce otro dataset (el PRNG está realmente sembrado)", () => {
	const other = generateCsv({ seed: 7 });
	assert.notEqual(other, csv);
	assert.equal(parseCsv(other).length - 1, ROW_COUNT);
});

test("el CSV versionado en scripts/data/ coincide con el generador", () => {
	const onDisk = readFileSync(OUTPUT_PATH, "utf8");
	assert.equal(
		onDisk,
		csv,
		"el CSV versionado no coincide con el generador: corra `node scripts/generate-demo-csv.mjs`",
	);
});
