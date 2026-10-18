// Test de los archivos ficticios del seed (CSV, XLSX, PDF, JSON, GeoJSON).
//
//   node --test scripts/generate-demo-files.test.mjs
//
// Protege que cada recurso sembrado sea un archivo real cuyos bytes coinciden con su formato
// declarado: determinismo, estructura mínima de cada formato y la nota de datos ficticios
// donde el formato lo permite.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";

import { parseCsv } from "./generate-csv-common.mjs";
import { FORMAT_INFO, generateFile, PROFILES } from "./generate-demo-files.mjs";
import { crc32, readZipEntries } from "./xlsx-writer.mjs";

const FORMATS = Object.keys(FORMAT_INFO);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const spec = (format, profile = Object.keys(PROFILES)[0]) => ({
	datasetName: "dataset-de-prueba",
	resourceName: "Recurso de prueba",
	title: "Dataset de prueba",
	description: "Descripción de prueba.",
	profile,
	format,
});

test("hay un perfil por cada conjunto del seed y todos tienen columnas", () => {
	assert.ok(Object.keys(PROFILES).length >= 20);
	for (const profile of Object.values(PROFILES)) {
		assert.ok(profile.columns.length >= 3);
		assert.ok(profile.rows >= 8);
	}
});

test("es determinista: dos generaciones dan los mismos bytes en cada formato", () => {
	for (const format of FORMATS) {
		const a = generateFile(spec(format));
		const b = generateFile(spec(format));
		assert.ok(a.equals(b), format);
		assert.equal(sha(a), sha(b));
	}
});

test("cambiar el formato o el nombre del recurso cambia los bytes", () => {
	assert.ok(!generateFile(spec("CSV")).equals(generateFile(spec("JSON"))));
	const other = { ...spec("CSV"), resourceName: "Otro recurso" };
	assert.ok(!generateFile(spec("CSV")).equals(generateFile(other)));
});

test("CSV: cabecera del perfil, filas del perfil y celdas consistentes", () => {
	for (const [key, profile] of Object.entries(PROFILES)) {
		const records = parseCsv(generateFile(spec("CSV", key)).toString("utf8"));
		assert.deepEqual(
			records[0],
			profile.columns.map(([name]) => name),
		);
		assert.equal(records.length - 1, profile.rows, key);
		for (const record of records) assert.equal(record.length, profile.columns.length);
	}
});

test("JSON: arreglo de registros con las columnas del perfil", () => {
	for (const [key, profile] of Object.entries(PROFILES)) {
		const data = JSON.parse(generateFile(spec("JSON", key)).toString("utf8"));
		assert.ok(Array.isArray(data));
		assert.equal(data.length, profile.rows, key);
		assert.deepEqual(
			Object.keys(data[0]),
			profile.columns.map(([name]) => name),
		);
	}
});

test("GeoJSON: FeatureCollection RFC 7946 en el área de Cochabamba (lon, lat)", () => {
	for (const key of Object.keys(PROFILES)) {
		const data = JSON.parse(generateFile(spec("GeoJSON", key)).toString("utf8"));
		assert.equal(data.type, "FeatureCollection");
		assert.ok(data.features.length >= 8);
		assert.match(data.nota, /ficticios/);
		const inBox = ([lon, lat]) => lon > -66.4 && lon < -65.9 && lat > -17.6 && lat < -17.2;
		for (const feature of data.features) {
			assert.equal(feature.type, "Feature");
			assert.ok(feature.properties && typeof feature.properties === "object");
			const { type, coordinates } = feature.geometry;
			if (type === "Point") assert.ok(inBox(coordinates));
			else {
				assert.equal(type, "LineString");
				assert.ok(coordinates.length >= 2);
				for (const position of coordinates) assert.ok(inBox(position));
			}
		}
	}
});

test("el GeoJSON del transporte público lleva líneas y paradas", () => {
	const key = Object.keys(PROFILES).find((k) => PROFILES[k].geo === "routes");
	assert.ok(key, "falta el perfil con rutas");
	const data = JSON.parse(generateFile(spec("GeoJSON", key)).toString("utf8"));
	const types = new Set(data.features.map((f) => f.geometry.type));
	assert.deepEqual([...types].sort(), ["LineString", "Point"]);
});

test("PDF: cabecera, cierre, xref válido, título y nota de datos ficticios", () => {
	const pdf = generateFile(spec("PDF"));
	const text = pdf.toString("latin1");
	assert.ok(text.startsWith("%PDF-1.4\n"));
	assert.ok(text.endsWith("%%EOF\n"));
	const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)?.[1]);
	assert.ok(text.startsWith("xref\n", startxref));
	const lines = text.slice(startxref).split("\n");
	const count = Number(lines[1].split(" ")[1]);
	for (let n = 1; n < count; n++) {
		assert.ok(text.startsWith(`${n} 0 obj\n`, Number(lines[2 + n].slice(0, 10))));
	}
	assert.ok(text.includes("Dataset de prueba"));
	assert.ok(text.includes("no son datos oficiales de la UMSS"));
});

test("PDF: un título con acentos y raya sale en WinAnsi sin lanzar", () => {
	for (const key of Object.keys(PROFILES)) {
		assert.ok(
			generateFile({ ...spec("PDF", key), title: "Matrícula — ñandú (2015–2025)" }).length > 500,
		);
	}
});

test("XLSX: ZIP de Office Open XML con las partes mínimas y CRC-32 correctos", () => {
	const xlsx = generateFile(spec("XLSX"));
	assert.equal(xlsx.subarray(0, 4).toString("latin1"), "PK\x03\x04");
	const entries = readZipEntries(xlsx);
	const names = entries.map((e) => e.name);
	for (const part of [
		"[Content_Types].xml",
		"_rels/.rels",
		"xl/workbook.xml",
		"xl/_rels/workbook.xml.rels",
		"xl/worksheets/sheet1.xml",
	]) {
		assert.ok(names.includes(part), part);
	}
	for (const entry of entries) {
		const data = entry.method === 8 ? inflateRawSync(entry.raw) : entry.raw;
		assert.equal(crc32(data), entry.crc, entry.name);
		assert.equal(data.length, entry.size, entry.name);
	}
	const sheet = entries.find((e) => e.name === "xl/worksheets/sheet1.xml").raw.toString("utf8");
	const profile = PROFILES[Object.keys(PROFILES)[0]];
	assert.equal(sheet.match(/<row /g)?.length, profile.rows + 1);
	assert.ok(
		entries
			.find((e) => e.name === "xl/worksheets/sheet2.xml")
			.raw.toString("utf8")
			.includes("ficticios"),
	);
});

test("crc32 coincide con el valor conocido de «123456789»", () => {
	assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("un formato desconocido lanza", () => {
	assert.throws(() => generateFile(spec("DOCX")), /Formato no soportado/);
});
