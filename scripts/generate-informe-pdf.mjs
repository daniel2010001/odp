#!/usr/bin/env node
// Generador determinista del PDF ficticio «Informe de matrícula 2015–2025».
//
// Escribe `scripts/data/informe-matricula-ficticio.pdf`. La demo corre en una laptop sin
// internet, y los PDF del catálogo sembrado son enlaces a `data.umss.edu.bo`: su vista previa
// no carga. Este informe se **sube** como archivo (ver `DEMOS` en `seed-ckan.mjs`) para que la
// vista previa del PDF funcione sin conexión.
//
// El PDF se escribe a mano, sin dependencias: PDF 1.4, fuentes estándar Helvetica y
// Helvetica-Bold con `WinAnsiEncoding` (los acentos y la «ñ» salen bien), contenido sin
// comprimir y una tabla `xref` con los desplazamientos exactos. No lleva fecha ni `/ID`: dos
// corridas dan bytes idénticos.
//
// Las cifras salen de `generate-matricula-csv.mjs` (mismos datos ficticios que el CSV de
// matrícula), así que el informe y el dataset de gráficos cuentan la misma historia. Ningún
// dato es oficial de la UMSS, y el documento lo dice en la primera página y en cada pie.
//
// Uso:
//   node scripts/generate-informe-pdf.mjs

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FIRST_YEAR, generateRows, LAST_YEAR } from "./generate-matricula-csv.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const OUTPUT_PATH = resolve(HERE, "data", "informe-matricula-ficticio.pdf");

export const TITLE = "Informe de matrícula 2015–2025";
export const SUBTITLE = "Datos ficticios para demostración";
export const FICTITIOUS_NOTE =
	"Datos ficticios para demostración: no son datos oficiales de la UMSS.";
export const PAGE_COUNT = 3;

// ── Texto en WinAnsi ──

const WIN_ANSI_EXTRA = { "–": 0x96, "—": 0x97, "•": 0x95 };

/** Cadena de texto → literal PDF `(…)`, un carácter por byte (WinAnsi ≈ Latin-1 + extras). */
function literal(text) {
	let out = "";
	for (const ch of text) {
		const code = WIN_ANSI_EXTRA[ch] ?? ch.codePointAt(0);
		if (code > 0xff) throw new Error(`Carácter fuera de WinAnsi: ${ch}`);
		const byte = String.fromCharCode(code);
		out += byte === "(" || byte === ")" || byte === "\\" ? `\\${byte}` : byte;
	}
	return `(${out})`;
}

// Ancho de Helvetica por carácter, en milésimas de em; sólo lo que hace falta para alinear a
// la derecha números (dígitos, separadores, signos y %). El resto cae en un promedio.
const WIDTHS = { " ": 278, ".": 278, ",": 278, "%": 889, "+": 584, "-": 333 };

function textWidth(text, size) {
	let units = 0;
	for (const ch of text) units += /\d/.test(ch) ? 556 : (WIDTHS[ch] ?? 556);
	return (units * size) / 1000;
}

// ── Página: operadores de contenido ──

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const FONT = { regular: "F1", bold: "F2" };

const num = (n) => String(Math.round(n * 100) / 100);

class Page {
	ops = [];

	/** `y` se mide desde el borde superior de la página, como en un maquetador. */
	text(x, y, str, { size = 11, bold = false, gray = 0 } = {}) {
		const font = bold ? FONT.bold : FONT.regular;
		this.ops.push(
			`BT ${num(gray)} g /${font} ${size} Tf ${num(x)} ${num(PAGE_HEIGHT - y)} Td ${literal(str)} Tj ET`,
		);
	}

	line(x1, y1, x2, y2, { width = 0.5, gray = 0 } = {}) {
		this.ops.push(
			`${num(gray)} G ${num(width)} w ${num(x1)} ${num(PAGE_HEIGHT - y1)} m ${num(x2)} ${num(PAGE_HEIGHT - y2)} l S`,
		);
	}

	fillRect(x, y, w, h, gray) {
		this.ops.push(`${num(gray)} g ${num(x)} ${num(PAGE_HEIGHT - y - h)} ${num(w)} ${num(h)} re f`);
	}

	/** Párrafo con corte de línea por palabras (ancho aproximado de 0,5 em por carácter). */
	paragraph(x, y, str, { size = 11, leading = 16, maxChars = 84 } = {}) {
		const lines = [];
		let current = "";
		for (const word of str.split(" ")) {
			if (current && `${current} ${word}`.length > maxChars) {
				lines.push(current);
				current = word;
			} else current = current ? `${current} ${word}` : word;
		}
		if (current) lines.push(current);
		lines.forEach((l, i) => {
			this.text(x, y + i * leading, l, { size });
		});
		return y + lines.length * leading;
	}

	/**
	 * Tabla de texto y líneas. `columns`: `{ header, x, align }` (`x` es el borde izquierdo, o el
	 * derecho si `align: "right"`). Devuelve la `y` donde termina.
	 */
	table(y, columns, rows, { rowHeight = 20, boldLast = false } = {}) {
		const left = MARGIN;
		const right = PAGE_WIDTH - MARGIN;
		this.fillRect(left, y, right - left, rowHeight, 0.9);
		this.line(left, y, right, y, { width: 1 });
		const put = (col, str, rowY, bold) => {
			const x = col.align === "right" ? col.x - textWidth(str, 10) : col.x;
			this.text(x, rowY + rowHeight - 6, str, { size: 10, bold });
		};
		for (const col of columns) put(col, col.header, y, true);
		let rowY = y + rowHeight;
		this.line(left, rowY, right, rowY, { width: 1 });
		rows.forEach((row, i) => {
			const last = boldLast && i === rows.length - 1;
			if (last) this.line(left, rowY, right, rowY, { width: 1 });
			columns.forEach((col, c) => {
				put(col, row[c], rowY, last);
			});
			rowY += rowHeight;
			this.line(left, rowY, right, rowY, { width: last ? 1 : 0.25, gray: last ? 0 : 0.6 });
		});
		return rowY;
	}

	content() {
		return `${this.ops.join("\n")}\n`;
	}
}

// ── Cifras (derivadas del CSV ficticio de matrícula) ──

// Separador de miles con punto, como en el resto de la demo (no depende de la versión de ICU).
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const pct = (n) => `${(Math.round(n * 10) / 10).toFixed(1).replace(".", ",")}%`;
const signed = (n) => `${n >= 0 ? "+" : "-"}${pct(Math.abs(n))}`;

function figures() {
	const rows = generateRows();
	const byYear = new Map();
	const byFaculty = new Map();
	const byModality = new Map();
	for (const r of rows) {
		const n = Number(r.inscritos);
		const year = Number(r.gestion);
		byYear.set(year, (byYear.get(year) ?? 0) + n);
		const f = byFaculty.get(r.facultad) ?? new Map();
		f.set(year, (f.get(year) ?? 0) + n);
		byFaculty.set(r.facultad, f);
		if (r.modalidad) {
			const m = byModality.get(r.modalidad) ?? new Map();
			m.set(year, (m.get(year) ?? 0) + n);
			byModality.set(r.modalidad, m);
		}
	}
	return { byYear, byFaculty, byModality };
}

// ── Maquetación ──

function header(page, n) {
	page.text(MARGIN, 40, "UMSS · Portal de Datos Abiertos", { size: 9, gray: 0.35 });
	page.line(MARGIN, 48, PAGE_WIDTH - MARGIN, 48, { gray: 0.6 });
	footer(page, n);
}

function footer(page, n) {
	page.line(MARGIN, PAGE_HEIGHT - 52, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 52, { gray: 0.6 });
	page.text(MARGIN, PAGE_HEIGHT - 38, `${SUBTITLE} · no son datos oficiales de la UMSS`, {
		size: 8.5,
		gray: 0.35,
	});
	const label = `Página ${n} de ${PAGE_COUNT}`;
	page.text(PAGE_WIDTH - MARGIN - textWidth(label, 8.5), PAGE_HEIGHT - 38, label, {
		size: 8.5,
		gray: 0.35,
	});
}

function buildPages() {
	const { byYear, byFaculty, byModality } = figures();
	const years = [...byYear.keys()].sort((a, b) => a - b);
	const first = byYear.get(FIRST_YEAR);
	const last = byYear.get(LAST_YEAR);
	const growth = ((last - first) / first) * 100;
	const dip = ((byYear.get(2020) - byYear.get(2019)) / byYear.get(2019)) * 100;

	// Página 1: título, introducción, nota y serie por gestión.
	const p1 = new Page();
	header(p1, 1);
	p1.text(MARGIN, 100, TITLE, { size: 22, bold: true });
	p1.text(MARGIN, 124, SUBTITLE, { size: 13, gray: 0.35 });

	p1.fillRect(MARGIN, 144, PAGE_WIDTH - 2 * MARGIN, 30, 0.93);
	p1.text(MARGIN + 10, 163, FICTITIOUS_NOTE, { size: 10, bold: true });

	p1.text(MARGIN, 208, "1. Introducción", { size: 14, bold: true });
	const introEnd = p1.paragraph(
		MARGIN,
		232,
		"Este informe resume la matrícula inventada de ocho facultades entre las gestiones " +
			`${FIRST_YEAR} y ${LAST_YEAR}. Sirve para probar la vista previa de documentos del ` +
			"portal sin conexión a internet: las cifras provienen del mismo conjunto de datos " +
			"ficticios que alimenta las vistas de gráficos y no describen a la universidad real.",
	);

	p1.text(MARGIN, introEnd + 24, "2. Inscritos por gestión", { size: 14, bold: true });
	const rows1 = years.map((y, i) => [
		String(y),
		fmt(byYear.get(y)),
		i === 0
			? "—"
			: signed(((byYear.get(y) - byYear.get(years[i - 1])) / byYear.get(years[i - 1])) * 100),
	]);
	rows1.push(["Total", fmt(years.reduce((s, y) => s + byYear.get(y), 0)), ""]);
	const t1End = p1.table(
		introEnd + 40,
		[
			{ header: "Gestión", x: MARGIN + 8 },
			{ header: "Inscritos", x: 300, align: "right" },
			{ header: "Variación anual", x: PAGE_WIDTH - MARGIN - 8, align: "right" },
		],
		rows1,
		{ rowHeight: 19, boldLast: true },
	);
	p1.text(
		MARGIN,
		t1End + 18,
		"Cuadro 1. Inscritos por gestión, todas las facultades. Datos ficticios.",
		{
			size: 8.5,
			gray: 0.35,
		},
	);

	// Página 2: facultades.
	const p2 = new Page();
	header(p2, 2);
	p2.text(MARGIN, 100, "3. Inscritos por facultad", { size: 14, bold: true });
	const faculties = [...byFaculty.entries()]
		.map(([name, series]) => ({ name, series }))
		.sort((a, b) => b.series.get(LAST_YEAR) - a.series.get(LAST_YEAR));
	const total = faculties.reduce((s, f) => s + f.series.get(LAST_YEAR), 0);
	const rows2 = faculties.map((f) => [
		f.name,
		fmt(f.series.get(FIRST_YEAR)),
		fmt(f.series.get(LAST_YEAR)),
		pct((f.series.get(LAST_YEAR) / total) * 100),
	]);
	const t2End = p2.table(
		118,
		[
			{ header: "Facultad", x: MARGIN + 8 },
			{ header: String(FIRST_YEAR), x: 340, align: "right" },
			{ header: String(LAST_YEAR), x: 410, align: "right" },
			{ header: "Participación", x: PAGE_WIDTH - MARGIN - 8, align: "right" },
		],
		rows2,
		{ rowHeight: 22 },
	);
	p2.text(
		MARGIN,
		t2End + 18,
		`Cuadro 2. Inscritos por facultad, gestiones ${FIRST_YEAR} y ${LAST_YEAR}. Datos ficticios.`,
		{
			size: 8.5,
			gray: 0.35,
		},
	);

	p2.text(MARGIN, t2End + 56, "4. Lectura de las cifras", { size: 14, bold: true });
	p2.paragraph(
		MARGIN,
		t2End + 80,
		`Entre ${FIRST_YEAR} y ${LAST_YEAR} la matrícula ficticia crece ${pct(growth)}. ` +
			`${faculties[0].name} y ${faculties[1].name} concentran la mayor parte de los inscritos, ` +
			`y ${faculties[faculties.length - 1].name} queda al final. En 2020 la matrícula cae ` +
			`${pct(Math.abs(dip))} respecto de 2019, y ese año aparece la modalidad virtual.`,
	);

	// Página 3: modalidad y notas.
	const p3 = new Page();
	header(p3, 3);
	p3.text(MARGIN, 100, "5. Inscritos por modalidad", { size: 14, bold: true });
	const modalities = ["Presencial", "Semipresencial", "Virtual"];
	const sample = [2015, 2019, 2020, 2022, 2025];
	const rows3 = modalities.map((m) => [
		m,
		...sample.map((y) => fmt(byModality.get(m)?.get(y) ?? 0)),
	]);
	const t3End = p3.table(
		118,
		[
			{ header: "Modalidad", x: MARGIN + 8 },
			...sample.map((y, i) => ({
				header: String(y),
				x: 270 + i * 55,
				align: "right",
			})),
		],
		rows3,
		{ rowHeight: 22 },
	);
	p3.text(
		MARGIN,
		t3End + 18,
		"Cuadro 3. Inscritos por modalidad, gestiones seleccionadas. Datos ficticios.",
		{
			size: 8.5,
			gray: 0.35,
		},
	);

	p3.text(MARGIN, t3End + 56, "6. Notas metodológicas", { size: 14, bold: true });
	let y = t3End + 80;
	for (const note of [
		"Las filas del conjunto de origen son inscritos por carrera, gestión, sexo y modalidad; " +
			"algunas celdas de sexo y modalidad están vacías a propósito y no entran en el Cuadro 3.",
		"Los valores se generan con una semilla fija: el mismo comando produce siempre el mismo documento.",
		"Los nombres de facultades y carreras son plausibles, pero las cifras son inventadas.",
	]) {
		p3.text(MARGIN, y, "•", { size: 11 });
		y = p3.paragraph(MARGIN + 14, y, note, { maxChars: 78 }) + 6;
	}
	p3.fillRect(MARGIN, y + 14, PAGE_WIDTH - 2 * MARGIN, 30, 0.93);
	p3.text(MARGIN + 10, y + 33, FICTITIOUS_NOTE, { size: 10, bold: true });

	return [p1, p2, p3];
}

// ── Serialización del PDF ──

/** Documento completo como `Buffer` (un carácter de la cadena = un byte). */
export function generatePdf() {
	const pages = buildPages();
	if (pages.length !== PAGE_COUNT) throw new Error("PAGE_COUNT no coincide con las páginas");

	// Números de objeto: 1 catálogo, 2 árbol de páginas, 3 y 4 fuentes, 5 info; después, para
	// cada página, su objeto y su contenido.
	const pageObj = (i) => 6 + i * 2;
	const contentObj = (i) => 7 + i * 2;
	const objects = [
		"<< /Type /Catalog\n/Pages 2 0 R\n>>",
		`<< /Type /Pages\n/Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}]\n/Count ${pages.length}\n>>`,
		"<< /Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n/Encoding /WinAnsiEncoding\n>>",
		"<< /Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica-Bold\n/Encoding /WinAnsiEncoding\n>>",
		`<< /Title ${literal("Informe de matrícula 2015-2025 - Datos ficticios para demostración")}\n/Author ${literal("Equipo ODP (datos sintéticos)")}\n/Subject ${literal(FICTITIOUS_NOTE)}\n/Producer ${literal("scripts/generate-informe-pdf.mjs")}\n>>`,
	];
	pages.forEach((page, i) => {
		objects.push(
			`<< /Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]\n` +
				`/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>\n/Contents ${contentObj(i)} 0 R\n>>`,
		);
		const body = page.content();
		objects.push(`<< /Length ${body.length} >>\nstream\n${body}endstream`);
	});

	let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
	const offsets = [];
	objects.forEach((body, i) => {
		offsets.push(out.length);
		out += `${i + 1} 0 obj\n${body}\nendobj\n`;
	});

	const xrefAt = out.length;
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
	out += `trailer\n<< /Size ${objects.length + 1}\n/Root 1 0 R\n/Info 5 0 R\n>>\nstartxref\n${xrefAt}\n%%EOF\n`;

	return Buffer.from(out, "latin1");
}

// ── CLI ──

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
	const pdf = generatePdf();
	mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
	writeFileSync(OUTPUT_PATH, pdf);
	const sha256 = createHash("sha256").update(pdf).digest("hex");
	console.log(`✓ ${OUTPUT_PATH}`);
	console.log(`  ${PAGE_COUNT} páginas · ${pdf.length} bytes · sha256 ${sha256}`);
}
