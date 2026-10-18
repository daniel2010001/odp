// Escritor mínimo de libros XLSX (Office Open XML), compartido por los archivos ficticios del
// seed (`generate-demo-files.mjs`).
//
// Un XLSX es un ZIP. Acá se escribe a mano, sin dependencias: entradas **sin comprimir**
// (método 0, "stored") con su CRC-32, fecha DOS fija y sin campos extra, así que dos corridas
// dan bytes idénticos. Partes mínimas: tipos de contenido, relaciones, libro, estilos (sólo
// para la cabecera en negrita) y una hoja por cada tabla, con cadenas en línea (`inlineStr`).

// ── ZIP ──

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

/** CRC-32 (IEEE 802.3) de un `Buffer`, como entero sin signo. */
export function crc32(bytes) {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

// 1980-01-01 00:00:00: el valor mínimo que admite el formato, para no meter la fecha del reloj.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

function u16(n) {
	const b = Buffer.alloc(2);
	b.writeUInt16LE(n);
	return b;
}

function u32(n) {
	const b = Buffer.alloc(4);
	b.writeUInt32LE(n >>> 0);
	return b;
}

/** `files`: `[{ name, data: Buffer }]` → ZIP con entradas sin comprimir. */
export function buildZip(files) {
	const chunks = [];
	const central = [];
	let offset = 0;
	for (const { name, data } of files) {
		const nameBytes = Buffer.from(name, "utf8");
		const crc = crc32(data);
		const local = Buffer.concat([
			u32(0x04034b50),
			u16(20), // versión necesaria
			u16(0x0800), // nombres en UTF-8
			u16(0), // método 0: stored
			u16(DOS_TIME),
			u16(DOS_DATE),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(nameBytes.length),
			u16(0),
			nameBytes,
		]);
		central.push(
			Buffer.concat([
				u32(0x02014b50),
				u16(20), // versión de quien lo hizo
				u16(20),
				u16(0x0800),
				u16(0),
				u16(DOS_TIME),
				u16(DOS_DATE),
				u32(crc),
				u32(data.length),
				u32(data.length),
				u16(nameBytes.length),
				u16(0), // extra
				u16(0), // comentario
				u16(0), // disco
				u16(0), // atributos internos
				u32(0), // atributos externos
				u32(offset),
				nameBytes,
			]),
		);
		chunks.push(local, data);
		offset += local.length + data.length;
	}
	const directory = Buffer.concat(central);
	const end = Buffer.concat([
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(files.length),
		u16(files.length),
		u32(directory.length),
		u32(offset),
		u16(0),
	]);
	return Buffer.concat([...chunks, directory, end]);
}

/**
 * Lee las entradas de un ZIP por su directorio central (lo que hace un lector real). Devuelve
 * `[{ name, method, crc, size, raw }]`; `raw` son los bytes tal como están guardados.
 */
export function readZipEntries(zip) {
	const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	if (eocd < 0) throw new Error("No es un ZIP: falta el fin del directorio central");
	const count = zip.readUInt16LE(eocd + 10);
	let pos = zip.readUInt32LE(eocd + 16);
	const entries = [];
	for (let i = 0; i < count; i++) {
		if (zip.readUInt32LE(pos) !== 0x02014b50) throw new Error("Directorio central corrupto");
		const method = zip.readUInt16LE(pos + 10);
		const crc = zip.readUInt32LE(pos + 16);
		const csize = zip.readUInt32LE(pos + 20);
		const size = zip.readUInt32LE(pos + 24);
		const nameLen = zip.readUInt16LE(pos + 28);
		const extraLen = zip.readUInt16LE(pos + 30);
		const commentLen = zip.readUInt16LE(pos + 32);
		const localAt = zip.readUInt32LE(pos + 42);
		const name = zip.toString("utf8", pos + 46, pos + 46 + nameLen);
		const dataAt = localAt + 30 + zip.readUInt16LE(localAt + 26) + zip.readUInt16LE(localAt + 28);
		entries.push({ name, method, crc, size, raw: zip.subarray(dataAt, dataAt + csize) });
		pos += 46 + nameLen + extraLen + commentLen;
	}
	return entries;
}

// ── Hojas de cálculo ──

const escapeXml = (text) =>
	String(text)
		// biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 prohíbe estos controles
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

/** Índice de columna base 0 → letras de columna (`0` → `A`, `26` → `AA`). */
export function columnLetters(index) {
	let n = index + 1;
	let letters = "";
	while (n > 0) {
		letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
		n = Math.floor((n - 1) / 26);
	}
	return letters;
}

function cell(value, ref, style) {
	const s = style ? ` s="${style}"` : "";
	if (typeof value === "number" && Number.isFinite(value))
		return `<c r="${ref}"${s}><v>${value}</v></c>`;
	return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value ?? "")}</t></is></c>`;
}

function sheetXml(header, rows) {
	const lines = [header, ...rows].map((row, r) => {
		const cells = row.map((value, c) =>
			cell(value, `${columnLetters(c)}${r + 1}`, r === 0 ? 1 : 0),
		);
		return `<row r="${r + 1}">${cells.join("")}</row>`;
	});
	return (
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
		'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
		`<sheetData>${lines.join("")}</sheetData></worksheet>`
	);
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/**
 * Libro XLSX como `Buffer`. `sheets`: `[{ name, header: string[], rows: (string|number)[][] }]`.
 * Los números van como números; todo lo demás, como cadena en línea.
 */
export function buildXlsx(sheets) {
	const n = sheets.length;
	const indices = sheets.map((_, i) => i + 1);
	const files = [
		{
			name: "[Content_Types].xml",
			text:
				`${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
				'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
				'<Default Extension="xml" ContentType="application/xml"/>' +
				'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
				'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
				indices
					.map(
						(i) =>
							`<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
					)
					.join("") +
				"</Types>",
		},
		{
			name: "_rels/.rels",
			text:
				`${XML_HEAD}<Relationships xmlns="${REL_NS}">` +
				`<Relationship Id="rId1" Type="${DOC_REL}/officeDocument" Target="xl/workbook.xml"/>` +
				"</Relationships>",
		},
		{
			name: "xl/workbook.xml",
			text:
				`${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${DOC_REL}">` +
				`<sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
				"</workbook>",
		},
		{
			name: "xl/_rels/workbook.xml.rels",
			text:
				`${XML_HEAD}<Relationships xmlns="${REL_NS}">` +
				indices
					.map(
						(i) =>
							`<Relationship Id="rId${i}" Type="${DOC_REL}/worksheet" Target="worksheets/sheet${i}.xml"/>`,
					)
					.join("") +
				`<Relationship Id="rId${n + 1}" Type="${DOC_REL}/styles" Target="styles.xml"/>` +
				"</Relationships>",
		},
		{
			// Dos estilos: 0 normal y 1 negrita (la cabecera).
			name: "xl/styles.xml",
			text:
				`${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
				'<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
				'<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
				'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
				'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
				'<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
				'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
				"</styleSheet>",
		},
		...sheets.map((s, i) => ({
			name: `xl/worksheets/sheet${i + 1}.xml`,
			text: sheetXml(s.header, s.rows),
		})),
	];
	return buildZip(files.map(({ name, text }) => ({ name, data: Buffer.from(text, "utf8") })));
}
