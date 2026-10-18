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
import { buildPdf, MARGIN, PAGE_HEIGHT, PAGE_WIDTH, Page, textWidth } from "./pdf-writer.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const OUTPUT_PATH = resolve(HERE, "data", "informe-matricula-ficticio.pdf");

export const TITLE = "Informe de matrícula 2015–2025";
export const SUBTITLE = "Datos ficticios para demostración";
export const FICTITIOUS_NOTE =
	"Datos ficticios para demostración: no son datos oficiales de la UMSS.";
export const PAGE_COUNT = 3;

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
	return buildPdf(pages, {
		title: "Informe de matrícula 2015-2025 - Datos ficticios para demostración",
		author: "Equipo ODP (datos sintéticos)",
		subject: FICTITIOUS_NOTE,
		producer: "scripts/generate-informe-pdf.mjs",
	});
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
