// Imágenes de muestra para los recursos del seed, sin dependencias: un PNG en color y un JPEG en
// escala de grises, los dos con el mismo dibujo (un gráfico de barras inventado).
//
// El PNG usa `zlib` de Node para el IDAT y el CRC-32 de `xlsx-writer.mjs`. El JPEG es un baseline
// (SOF0) de un solo componente donde cada bloque de 8×8 lleva sólo su coeficiente DC —el promedio
// del bloque— y el fin de bloque: queda un mosaico, pero es un JPEG válido que el navegador decodifica.
//
// Uso: `drawChart(rnd)` → `{ width, height, rgb }`; `encodePng(image)`; `encodeJpeg(image)`.

import { deflateSync } from "node:zlib";

import { crc32 } from "./xlsx-writer.mjs";

export const IMAGE_WIDTH = 320;
export const IMAGE_HEIGHT = 200;

const PALETTE = [
	[59, 111, 181],
	[231, 111, 99],
	[84, 160, 140],
	[226, 178, 80],
	[134, 109, 186],
];
const BACKGROUND = [247, 248, 250];
const AXIS = [70, 76, 88];

/** Dibuja un gráfico de barras: `rnd` es el PRNG de `generate-csv-common.mjs`. */
export function drawChart(rnd) {
	const width = IMAGE_WIDTH;
	const height = IMAGE_HEIGHT;
	const rgb = Buffer.alloc(width * height * 3);
	const paint = (x, y, color) => {
		const at = (y * width + x) * 3;
		rgb[at] = color[0];
		rgb[at + 1] = color[1];
		rgb[at + 2] = color[2];
	};
	const fill = (x0, y0, x1, y1, color) => {
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) paint(x, y, color);
	};

	fill(0, 0, width, height, BACKGROUND);
	const bars = rnd.int(5, 8);
	const left = 32;
	const base = height - 24;
	const slot = Math.floor((width - left - 16) / bars);
	const color = rnd.int(0, PALETTE.length - 1);
	for (let i = 0; i < bars; i++) {
		const top = base - rnd.int(30, base - 20);
		fill(
			left + i * slot + 6,
			top,
			left + (i + 1) * slot - 6,
			base,
			PALETTE[(color + i) % PALETTE.length],
		);
	}
	fill(left - 2, 12, left, base + 2, AXIS);
	fill(left - 2, base, width - 8, base + 2, AXIS);
	return { width, height, rgb };
}

const chunk = (type, data) => {
	const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
	const out = Buffer.alloc(body.length + 8);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body), body.length + 4);
	return out;
};

/** PNG RGB de 8 bits, sin entrelazado y con filtro 0 en cada fila. */
export function encodePng({ width, height, rgb }) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header.set([8, 2, 0, 0, 0], 8);
	const stride = width * 3;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++)
		rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// ── JPEG ──

// Tabla DC de luminancia del Anexo K.3 del estándar: cuántos códigos hay de cada longitud y sus símbolos.
const DC_COUNTS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_SYMBOLS = Array.from({ length: 12 }, (_, i) => i);
// Tabla AC mínima: un solo código de un bit para el símbolo 0x00 (fin de bloque).
const AC_COUNTS = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const AC_SYMBOLS = [0x00];

/** Códigos de Huffman canónicos (B.2 del estándar): símbolo → `{ code, length }`. */
function huffmanCodes(counts, symbols) {
	const codes = new Map();
	let code = 0;
	let index = 0;
	for (let length = 1; length <= 16; length++) {
		for (let n = 0; n < counts[length - 1]; n++)
			codes.set(symbols[index++], { code: code++, length });
		code <<= 1;
	}
	return codes;
}

const segment = (marker, data) => {
	const out = Buffer.alloc(data.length + 4);
	out[0] = 0xff;
	out[1] = marker;
	out.writeUInt16BE(data.length + 2, 2);
	data.copy(out, 4);
	return out;
};

const huffmanTable = (id, counts, symbols) =>
	segment(0xc4, Buffer.from([id, ...counts, ...symbols]));

/** JPEG baseline en escala de grises (ancho y alto múltiplos de 8). */
export function encodeJpeg({ width, height, rgb }) {
	const dc = huffmanCodes(DC_COUNTS, DC_SYMBOLS);
	const eob = huffmanCodes(AC_COUNTS, AC_SYMBOLS).get(0);

	const bytes = [];
	let acc = 0;
	let nbits = 0;
	const put = (value, length) => {
		for (let bit = length - 1; bit >= 0; bit--) {
			acc = (acc << 1) | ((value >> bit) & 1);
			if (++nbits === 8) {
				bytes.push(acc);
				if (acc === 0xff) bytes.push(0x00);
				acc = 0;
				nbits = 0;
			}
		}
	};

	// Con cuantización 8 en el DC, el coeficiente es el promedio del bloque menos 128.
	let previous = 0;
	for (let by = 0; by < height; by += 8) {
		for (let bx = 0; bx < width; bx += 8) {
			let sum = 0;
			for (let y = by; y < by + 8; y++) {
				for (let x = bx; x < bx + 8; x++) {
					const at = (y * width + x) * 3;
					sum += 0.299 * rgb[at] + 0.587 * rgb[at + 1] + 0.114 * rgb[at + 2];
				}
			}
			const value = Math.round(sum / 64) - 128;
			const diff = value - previous;
			previous = value;
			const size = diff === 0 ? 0 : Math.floor(Math.log2(Math.abs(diff))) + 1;
			const { code, length } = dc.get(size);
			put(code, length);
			if (size > 0) put(diff > 0 ? diff : diff + (1 << size) - 1, size);
			put(eob.code, eob.length);
		}
	}
	// Relleno con unos hasta completar el byte.
	if (nbits > 0) put((1 << (8 - nbits)) - 1, 8 - nbits);

	const frame = Buffer.alloc(9);
	frame[0] = 8;
	frame.writeUInt16BE(height, 1);
	frame.writeUInt16BE(width, 3);
	frame.set([1, 1, 0x11, 0], 5);

	return Buffer.concat([
		Buffer.from([0xff, 0xd8]),
		segment(0xdb, Buffer.from([0, ...new Array(64).fill(8)])),
		segment(0xc0, frame),
		huffmanTable(0x00, DC_COUNTS, DC_SYMBOLS),
		huffmanTable(0x10, AC_COUNTS, AC_SYMBOLS),
		segment(0xda, Buffer.from([1, 1, 0x00, 0, 63, 0])),
		Buffer.from(bytes),
		Buffer.from([0xff, 0xd9]),
	]);
}
