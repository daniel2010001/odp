// Piezas compartidas por los generadores de los CSV ficticios de la demo — T7 de
// odd/tasks/csv-charts.md (matrícula, ejecución presupuestaria, producción de investigación).
//
// Repite el patrón de `generate-demo-csv.mjs` (T6): PRNG `mulberry32` con semilla fija, CSV
// RFC 4180 con `\n` y salida byte a byte idéntica. Está aparte para no copiar tres veces el
// PRNG y el serializador; `generate-demo-csv.mjs` se deja como está.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

export function makeRandom(seed) {
	const next = mulberry32(seed);
	return {
		/** Entero uniforme en [min, max], ambos incluidos. */
		int: (min, max) => min + Math.floor(next() * (max - min + 1)),
		/** Real uniforme en [min, max). */
		float: (min, max) => min + next() * (max - min),
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

export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

const pad2 = (n) => String(n).padStart(2, "0");

export function daysInMonth(year, month) {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `YYYY-MM-DD` (ISO 8601, regla de L36 para las columnas de fecha). */
export function isoDate(year, month, day) {
	return `${year}-${pad2(month)}-${pad2(day)}`;
}

// ── CSV ──

const NEEDS_QUOTING = /[",\r\n]/;

function quoteField(value) {
	const text = value ?? "";
	return NEEDS_QUOTING.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Serializa filas a CSV (RFC 4180 en el citado; fin de línea `\n`). */
export function formatCsv(rows, columns) {
	const lines = [columns.join(",")];
	for (const row of rows) lines.push(columns.map((column) => quoteField(row[column])).join(","));
	return `${lines.join("\n")}\n`;
}

/** Escribe el CSV y informa filas, bytes y sha256 (el CLI de cada generador). */
export function writeDataset(outputPath, csv, rowCount) {
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, csv, "utf8");
	const bytes = Buffer.byteLength(csv, "utf8");
	const sha256 = createHash("sha256").update(csv).digest("hex");
	console.log(`✓ ${outputPath}`);
	console.log(`  ${rowCount} filas · ${bytes} bytes · sha256 ${sha256}`);
}

/** Parser RFC 4180 mínimo, para no depender de `papaparse` en los tests de scripts. */
export function parseCsv(text) {
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
		if (ch === '"') inQuotes = true;
		else if (ch === ",") {
			record.push(field);
			field = "";
		} else if (ch === "\n") {
			record.push(field);
			records.push(record);
			record = [];
			field = "";
		} else if (ch !== "\r") field += ch;
		i += 1;
	}
	if (field !== "" || record.length > 0) {
		record.push(field);
		records.push(record);
	}
	return records;
}

// ── Reglas de L36 para las columnas tipadas ──

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ¿El valor sirve para una columna declarada de ese tipo? Una celda vacía siempre sirve
 * (pasa a `NULL`); un número es punto decimal sin separador de miles; una fecha es ISO y
 * existe en el calendario. Nunca `NA`, `-` ni `s/d`.
 */
export function isValidForType(type, value) {
	if (value === "" || type === "text") return true;
	if (type === "numeric") return PLAIN_NUMBER.test(value) && Number.isFinite(Number(value));
	if (type === "timestamp") {
		if (!ISO_DATE.test(value)) return false;
		return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
	}
	return false;
}
