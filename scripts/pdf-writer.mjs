// Escritor de PDF mínimo, compartido por los generadores de documentos de la demo
// (`generate-informe-pdf.mjs` y `generate-demo-files.mjs`).
//
// PDF 1.4 a mano, sin dependencias: fuentes estándar Helvetica y Helvetica-Bold con
// `WinAnsiEncoding` (los acentos y la «ñ» salen bien), contenido sin comprimir y una tabla
// `xref` con los desplazamientos exactos. No lleva fecha ni `/ID`: dos corridas dan bytes
// idénticos.

// ── Texto en WinAnsi ──

const WIN_ANSI_EXTRA = { "–": 0x96, "—": 0x97, "•": 0x95 };

/** Cadena de texto → literal PDF `(…)`, un carácter por byte (WinAnsi ≈ Latin-1 + extras). */
export function literal(text) {
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

export function textWidth(text, size) {
	let units = 0;
	for (const ch of text) units += /\d/.test(ch) ? 556 : (WIDTHS[ch] ?? 556);
	return (units * size) / 1000;
}

// ── Página: operadores de contenido ──

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;
export const MARGIN = 56;
const FONT = { regular: "F1", bold: "F2" };

export const num = (n) => String(Math.round(n * 100) / 100);

export class Page {
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

// ── Serialización del PDF ──

/**
 * Documento completo como `Buffer` (un carácter de la cadena = un byte). `info` lleva
 * `title`, `author`, `subject` y `producer`.
 */
export function buildPdf(pages, info) {
	// Números de objeto: 1 catálogo, 2 árbol de páginas, 3 y 4 fuentes, 5 info; después, para
	// cada página, su objeto y su contenido.
	const pageObj = (i) => 6 + i * 2;
	const contentObj = (i) => 7 + i * 2;
	const objects = [
		"<< /Type /Catalog\n/Pages 2 0 R\n>>",
		`<< /Type /Pages\n/Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}]\n/Count ${pages.length}\n>>`,
		"<< /Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n/Encoding /WinAnsiEncoding\n>>",
		"<< /Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica-Bold\n/Encoding /WinAnsiEncoding\n>>",
		`<< /Title ${literal(info.title)}\n/Author ${literal(info.author)}\n/Subject ${literal(info.subject)}\n/Producer ${literal(info.producer)}\n>>`,
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
