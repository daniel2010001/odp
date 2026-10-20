// Test de los archivos ficticios del seed (CSV, XLSX, PDF, JSON, GeoJSON, PNG, JPG, TXT).
//
//   node --test scripts/generate-demo-files.test.mjs
//
// Protege que cada recurso sembrado sea un archivo real cuyos bytes coinciden con su formato
// declarado: determinismo, estructura mínima de cada formato y la nota de datos ficticios
// donde el formato lo permite.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { inflateRawSync, inflateSync } from "node:zlib";

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
	assert.ok(Object.keys(PROFILES).length >= 50);
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

// S18 de odd/tasks/v0.1.1-polish.md: el seed no generaba imágenes ni texto plano, así que dos de las
// cuatro vistas previas del portal (imagen y texto) no tenían una muestra subida de verdad.

test("el seed genera PNG, JPG y TXT con su MIME y extensión", () => {
	assert.deepEqual(FORMAT_INFO.PNG, { mime: "image/png", ext: "png" });
	assert.deepEqual(FORMAT_INFO.JPG, { mime: "image/jpeg", ext: "jpg" });
	assert.deepEqual(FORMAT_INFO.TXT, { mime: "text/plain", ext: "txt" });
});

test("PNG: firma, IHDR RGB de 8 bits, CRC de cada chunk y píxeles que descomprimen al tamaño", () => {
	const png = generateFile(spec("PNG"));
	assert.ok(
		png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
	);
	const chunks = [];
	for (let at = 8; at < png.length; ) {
		const length = png.readUInt32BE(at);
		const type = png.subarray(at + 4, at + 8).toString("latin1");
		const data = png.subarray(at + 8, at + 8 + length);
		assert.equal(
			png.readUInt32BE(at + 8 + length),
			crc32(png.subarray(at + 4, at + 8 + length)),
			type,
		);
		chunks.push({ type, data });
		at += 12 + length;
	}
	assert.deepEqual(
		chunks.map((c) => c.type),
		["IHDR", "IDAT", "IEND"],
	);
	const [width, height] = [chunks[0].data.readUInt32BE(0), chunks[0].data.readUInt32BE(4)];
	assert.ok(width >= 64 && height >= 64);
	assert.deepEqual([...chunks[0].data.subarray(8)], [8, 2, 0, 0, 0]);
	assert.equal(inflateSync(chunks[1].data).length, (1 + width * 3) * height);
});

test("JPG: SOI/EOI, SOF0 de un componente, y ningún marcador suelto dentro de los datos del scan", () => {
	const jpg = generateFile(spec("JPG"));
	assert.deepEqual([...jpg.subarray(0, 2)], [0xff, 0xd8]);
	assert.deepEqual([...jpg.subarray(-2)], [0xff, 0xd9]);
	const sof = jpg.indexOf(Buffer.from([0xff, 0xc0]));
	assert.ok(sof > 0);
	assert.equal(jpg[sof + 4], 8, "precisión");
	const height = jpg.readUInt16BE(sof + 5);
	const width = jpg.readUInt16BE(sof + 7);
	assert.ok(width >= 64 && height >= 64);
	assert.equal(jpg[sof + 9], 1, "componentes");
	const sos = jpg.indexOf(Buffer.from([0xff, 0xda]));
	assert.ok(sos > sof);
	const scan = jpg.subarray(sos + 2 + jpg.readUInt16BE(sos + 2), -2);
	for (let i = 0; i < scan.length - 1; i++) {
		if (scan[i] === 0xff) assert.equal(scan[i + 1], 0x00, `byte stuffing en ${i}`);
	}
});

test("PNG y JPG no son planos: cambiar el recurso cambia la imagen", () => {
	for (const format of ["PNG", "JPG"]) {
		const other = { ...spec(format), resourceName: "Otro recurso" };
		assert.ok(!generateFile(spec(format)).equals(generateFile(other)), format);
	}
});

test("TXT: UTF-8 con el título, la nota de datos ficticios y las variables del perfil", () => {
	for (const [key, profile] of Object.entries(PROFILES)) {
		const text = generateFile(spec("TXT", key)).toString("utf8");
		assert.ok(text.includes("Dataset de prueba"), key);
		assert.match(text, /ficticios/);
		for (const [name] of profile.columns) assert.ok(text.includes(name), `${key}: ${name}`);
		assert.ok(!text.includes("\uFFFD"), key);
	}
});

test("cada perfil nuevo tiene filas y columnas utilizables en todos los formatos", () => {
	const extra = Object.keys(PROFILES).filter((k) => !k.startsWith("observatorio-"));
	assert.ok(extra.length >= 45);
	for (const key of extra) {
		for (const format of FORMATS) assert.ok(generateFile(spec(format, key)).length > 100, key);
	}
});
