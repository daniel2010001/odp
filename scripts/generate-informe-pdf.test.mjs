// Test del generador del PDF «Informe de matrícula 2015–2025».
//
//   node --test scripts/generate-informe-pdf.test.mjs
//
// Protege lo que hace que el PDF abra sin internet y sin sorpresas: determinismo byte a byte,
// cabecera y cierre válidos, una tabla `xref` cuyos desplazamientos apuntan de verdad a cada
// `N 0 obj`, el número de páginas y la nota visible de que los datos son ficticios.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { FICTITIOUS_NOTE, generatePdf, OUTPUT_PATH, PAGE_COUNT } from "./generate-informe-pdf.mjs";

const pdf = generatePdf();
// Un carácter por byte: los desplazamientos del `xref` son de bytes.
const text = pdf.toString("latin1");

test("es determinista: dos generaciones son idénticas byte a byte", () => {
	assert.ok(generatePdf().equals(pdf));
	const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
	assert.equal(digest(generatePdf()), digest(pdf));
});

test("empieza con %PDF-1.4 y termina con %%EOF", () => {
	assert.ok(text.startsWith("%PDF-1.4\n"));
	assert.ok(text.endsWith("%%EOF\n"));
});

test("cada desplazamiento del xref apunta al `N 0 obj` correspondiente", () => {
	const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)?.[1]);
	assert.ok(text.startsWith("xref\n", startxref), "startxref no apunta a la tabla xref");

	const lines = text.slice(startxref).split("\n");
	const [first, count] = lines[1].split(" ").map(Number);
	assert.equal(first, 0);
	assert.equal(lines[2], "0000000000 65535 f ");

	const trailerSize = Number(/\/Size (\d+)/.exec(text.slice(startxref))?.[1]);
	assert.equal(trailerSize, count);

	for (let n = 1; n < count; n++) {
		const entry = lines[2 + n];
		assert.match(entry, /^\d{10} 00000 n $/);
		const offset = Number(entry.slice(0, 10));
		assert.ok(text.startsWith(`${n} 0 obj\n`, offset), `el objeto ${n} no está en ${offset}`);
	}
});

test("tiene PAGE_COUNT páginas y el árbol de páginas lo declara", () => {
	assert.ok(PAGE_COUNT >= 2 && PAGE_COUNT <= 3);
	assert.equal(text.match(/\/Type \/Page\n/g)?.length, PAGE_COUNT);
	assert.equal(Number(/\/Type \/Pages[^>]*\/Count (\d+)/.exec(text)?.[1]), PAGE_COUNT);
});

test("usa fuentes estándar con WinAnsiEncoding y no trae marcas de tiempo", () => {
	assert.match(text, /\/BaseFont \/Helvetica\n/);
	assert.match(text, /\/BaseFont \/Helvetica-Bold\n/);
	assert.equal(text.match(/\/Encoding \/WinAnsiEncoding/g)?.length, 2);
	assert.doesNotMatch(text, /CreationDate|ModDate|\/ID\s*\[/);
});

test("la nota de datos ficticios está en el documento y en cada página", () => {
	assert.match(FICTITIOUS_NOTE, /ficticios/);
	assert.match(FICTITIOUS_NOTE, /no son datos oficiales de la UMSS/);
	const encoded = Buffer.from(FICTITIOUS_NOTE, "latin1").toString("latin1");
	assert.ok(text.includes(encoded), "falta la nota de datos ficticios");
	// Pie de cada página: «Datos ficticios para demostración» (ó = 0xF3 en WinAnsi).
	assert.equal(text.match(/Datos ficticios para demostraci\xf3n/g)?.length >= PAGE_COUNT, true);
});

test("la salida por defecto es el PDF versionado en scripts/data", () => {
	assert.match(OUTPUT_PATH, /scripts[\\/]data[\\/]informe-matricula-ficticio\.pdf$/);
});

test("el PDF versionado en scripts/data coincide con el generador", () => {
	assert.ok(readFileSync(OUTPUT_PATH).equals(pdf));
});
