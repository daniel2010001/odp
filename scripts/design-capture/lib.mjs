// Funciones puras de la captura de pantallas a artboards (sin red ni navegador), para poder probarlas:
//
//   node --test scripts/design-capture/lib.test.mjs

import { deflateSync, inflateSync } from "node:zlib";

/**
 * Clave de una dirección del portal: ruta + query con los parámetros ordenados. `null` si es de otro origen
 * o no es http(s). Dos enlaces que llevan a la misma pantalla dan la misma clave, sin importar el orden de
 * los parámetros ni el fragmento. Se inyecta también en la página (por eso no usa nada de afuera).
 */
export function urlKey(href, base) {
	let url;
	try {
		url = new URL(href, base);
	} catch {
		return null;
	}
	if (!/^https?:$/.test(url.protocol) || url.origin !== new URL(base).origin) return null;
	const params = [...url.searchParams.entries()].sort(([a, av], [b, bv]) =>
		a === b ? (av < bv ? -1 : av > bv ? 1 : 0) : a < b ? -1 : 1,
	);
	const query = new URLSearchParams(params).toString();
	return query ? `${url.pathname}?${query}` : url.pathname;
}

/**
 * Mapa clave → archivo del artboard, con la dirección de cada pantalla y sus alias (otras direcciones que
 * muestran la misma pantalla, p. ej. el enlace sin `vista=`). Una dirección con fragmento entra con él
 * (`/recurso#chart-a`): así cada vista de una misma página (las pestañas de un recurso) tiene su artboard.
 */
export function buildLinkMap(screens, origin) {
	const map = {};
	for (const screen of screens) {
		for (const href of [screen.url, ...(screen.aliases ?? [])]) {
			let key = urlKey(href, origin);
			if (key === null) throw new Error(`Dirección fuera del portal: ${href}`);
			key += new URL(href, origin).hash;
			if (map[key] && map[key] !== screen.file) {
				throw new Error(`${href} apunta a dos artboards: ${map[key]} y ${screen.file}`);
			}
			map[key] = screen.file;
		}
	}
	return map;
}

/**
 * Separa las pantallas que se capturan de las `linkOnly`: éstas no se cargan ni se escriben, sólo son destino de
 * los enlaces (entran igual en `buildLinkMap`). Su artboard ya tiene que existir (`fileExists(file)`), para que
 * ningún enlace lleve a un archivo que no está. Pasar `linkOnly` a `false` las vuelve a capturar.
 */
export function planBatch(screens, fileExists) {
	const capture = [];
	const linkOnly = [];
	for (const screen of screens) {
		if (!screen.linkOnly) {
			capture.push(screen);
			continue;
		}
		if (!fileExists(screen.file)) {
			throw new Error(`${screen.file}: linkOnly, pero el artboard no existe`);
		}
		linkOnly.push(screen);
	}
	return { capture, linkOnly };
}

/**
 * Destino de un enlace dentro del artboard: el archivo hermano si lleva a una pantalla capturada (el de su
 * vista, si el fragmento tiene artboard propio), el fragmento si es un ancla de la misma página, o `null`
 * (enlace inerte: se quita el `href`).
 */
export function mapHref(href, base, linkMap) {
	if (href.startsWith("#")) return href;
	const key = urlKey(href, base);
	if (key === null) return null;
	const hash = new URL(href, base).hash;
	if (hash && key + hash in linkMap) return linkMap[key + hash];
	if (!(key in linkMap)) return null;
	return linkMap[key] + hash;
}

/**
 * Artboard al que lleva una pestaña: su vista es la página `base` con el fragmento de `template`, donde
 * `{value}` es el `data-value` de la pestaña (`#chart-{value}`). Sólo si esa vista tiene artboard propio;
 * si no, `null` y la pestaña queda como botón.
 */
export function tabTarget(template, value, base, linkMap) {
	const url = new URL(template.replaceAll("{value}", value), base);
	const key = urlKey(url.href, base);
	if (key === null || !url.hash) return null;
	return linkMap[key + url.hash] ?? null;
}

/**
 * ¿La espera de red en reposo cuenta esta petición? No las de HMR de Vite, que quedan abiertas, ni lo que no
 * es http(s): el visor de PDF de Chromium (`chrome-extension://…`) nunca termina su carga.
 */
export function waitsForRequest(url) {
	return /^https?:/.test(url) && !/\/@vite\/|__vite_ping|hmr/.test(url);
}

const escapeHtml = (text) =>
	String(text).replace(
		/[&<>"]/g,
		(char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
	);

/**
 * Reemplazo estático de un `<iframe>` con un PDF: un artboard no puede llevar el visor del navegador, así
 * que se dibuja uno con las primeras páginas como imágenes (`pages`: `{ src, width, height }` en CSS px, al
 * 100 %). Lleva la clase del iframe (mismo tamaño) y los colores del visor de Chromium: barra #3c3c3c con el
 * título y el contador, fondo #282828. Las páginas se recorren con el scroll del propio visor.
 */
export function pdfStandIn({ className, title, pageCount, pages }) {
	const images = pages
		.map(
			({ src, width, height }, index) =>
				`<img src="${src}" width="${width}" height="${height}" alt="Página ${index + 1} de ${pageCount}" style="display:block;flex:none;max-width:none;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">`,
		)
		.join("");
	return (
		`<div class="${escapeHtml(className)}" data-stand-in="pdf" style="display:flex;flex-direction:column;background:#282828;overflow:hidden">` +
		`<div style="flex:none;display:flex;align-items:center;gap:24px;height:56px;padding:0 24px;background:#3c3c3c;color:#f1f1f1;font-size:14px;font-weight:500">` +
		`<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(title)}</span>` +
		`<span style="flex:none;font-variant-numeric:tabular-nums">1 / ${pageCount}</span>` +
		`<span style="flex:none;padding:2px 8px;background:#191919">100%</span>` +
		`</div>` +
		`<div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:16px;padding:4px 0 16px">${images}</div>` +
		`</div>`
	);
}

/**
 * Reemplaza cada `@font-face` de una hoja externa (Google Fonts) por su versión embebida: la fuente que el
 * navegador descargó va como `data:` en base64; las caras que no descargó (subconjuntos de otros alfabetos,
 * pesos sin uso) se descartan, porque la página tampoco las usó. `fontBody(url)` devuelve el Buffer o `null`.
 */
export async function embedFontFaces(css, fontBody) {
	const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
	const out = [];
	for (const face of faces) {
		const urls = [...face.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]);
		let embedded = face;
		let complete = urls.length > 0;
		for (const url of urls) {
			const body = await fontBody(url);
			if (!body) {
				complete = false;
				break;
			}
			const mime = fontMime(url);
			embedded = embedded.replace(url, `data:${mime};base64,${body.toString("base64")}`);
		}
		if (complete) out.push(embedded.replace(/\s+/g, " ").trim());
	}
	return out;
}

function fontMime(url) {
	if (/\.woff2(\?|$)/.test(url)) return "font/woff2";
	if (/\.woff(\?|$)/.test(url)) return "font/woff";
	if (/\.ttf(\?|$)/.test(url)) return "font/ttf";
	if (/\.otf(\?|$)/.test(url)) return "font/otf";
	return "application/octet-stream";
}

/**
 * Fija las unidades relativas al viewport (`vh`, `dvh`, `svh`, `lvh`) al alto de la ventana en que se capturó.
 * El artboard se muestra en un marco tan alto como la página entera: sin esto, un `min-h-screen` crece con el
 * marco y empuja el pie fuera de la vista. Con esto, el artboard es la página tal como se ve al recorrer una
 * ventana de `width` × `viewportHeight`. No toca los `url(...)` (los data: URIs pueden contener "9vh") ni
 * los selectores de Tailwind, donde la unidad va escapada (`.min-h-\[calc\(100dvh-140px\)\]`).
 */
export function freezeViewportUnits(css, viewportHeight) {
	return css
		.split(/(url\([^)]*\))/)
		.map((part, index) =>
			index % 2 === 1
				? part
				: part.replace(/(?<![\w.\\-])(?<!\\.)(\d*\.?\d+)(?:d|s|l)?vh\b/g, (_, value) => {
						const px = Math.round(((Number(value) * viewportHeight) / 100) * 100) / 100;
						return `${px}px`;
					}),
		)
		.join("");
}

/** Lo mismo, en los atributos `style` del HTML. */
export function freezeViewportUnitsInStyles(html, viewportHeight) {
	return html.replace(
		/(\sstyle=")([^"]*)(")/g,
		(_, open, value, close) => open + freezeViewportUnits(value, viewportHeight) + close,
	);
}

/**
 * Lo que el script de la página cambia al desplazar, sin script (`scrollStates` de una pantalla, ver
 * `capture.mjs`). `rest` y `sample` son los estilos computados de cada elemento (por índice) en reposo y en una
 * muestra con scroll; devuelve `[índice, { propiedad: valor }]` con lo que difiere. `claimed` (índice →
 * propiedades) es lo que ya reclamó un estado anterior: ese cambio es de aquél y no se repite.
 * Se inyecta en la página como texto (`toString()`): no usa nada de afuera.
 */
export function styleChanges(rest, sample, claimed = {}) {
	const changes = [];
	for (const [index, after] of sample.entries()) {
		const before = rest[index] ?? {};
		const decls = {};
		for (const [prop, value] of Object.entries(after)) {
			if (before[prop] !== value && !(prop in (claimed[index] ?? {}))) decls[prop] = value;
		}
		if (Object.keys(decls).length) changes.push([index, decls]);
	}
	return changes;
}

/**
 * El CSS que reproduce esos cambios: cada estado declara su `container` como contenedor `scroll-state` con
 * nombre propio, y sus cambios (`claims[i]`: `{ id, decls }`, el `id` es el `data-capture-scroll` del
 * elemento) se aplican bajo `@container <nombre> scroll-state(<query>)`. Con `!important`, porque en reposo
 * los pone el script en `style`; las transiciones de la página siguen valiendo (son de mayor prioridad).
 */
export function scrollStateCss(states, claims) {
	const containers = [];
	const rules = [];
	for (const [index, state] of states.entries()) {
		if (!claims[index]?.length) continue;
		const name = `capture-scroll-${index}`;
		containers.push(`${state.container} { container: ${name} / scroll-state; }`);
		const body = claims[index]
			.map(({ id, decls }) => {
				const list = Object.entries(decls).map(([prop, value]) => `${prop}: ${value} !important;`);
				return `[data-capture-scroll="${id}"] { ${list.join(" ")} }`;
			})
			.join(" ");
		rules.push(`@container ${name} scroll-state(${state.query}) { ${body} }`);
	}
	return [...containers, ...rules].join("\n");
}

/**
 * Apariciones de `http` en el artboard que no son referencias permitidas. Se permiten los espacios de
 * nombres XML (`xmlns="http://www.w3.org/..."`), que no se descargan.
 */
export function externalReferences(html) {
	const found = [];
	for (const match of html.matchAll(/https?:\/\/[^\s"'<>)]*/g)) {
		if (/^http:\/\/www\.w3\.org\//.test(match[0])) continue;
		found.push(match[0]);
	}
	return found;
}

// ─── PNG (para comparar capturas sin dependencias) ─────────────────────────────────────────────────────

/** Decodifica un PNG de 8 bits sin entrelazado (RGB o RGBA) a `{ width, height, data }` RGBA. */
export function decodePng(buffer) {
	if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("No es un PNG");
	let offset = 8;
	let width = 0;
	let height = 0;
	let colorType = 0;
	const idat = [];
	while (offset < buffer.length) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.toString("ascii", offset + 4, offset + 8);
		const chunk = buffer.subarray(offset + 8, offset + 8 + length);
		if (type === "IHDR") {
			width = chunk.readUInt32BE(0);
			height = chunk.readUInt32BE(4);
			const depth = chunk[8];
			colorType = chunk[9];
			if (depth !== 8 || chunk[12] !== 0 || (colorType !== 2 && colorType !== 6)) {
				throw new Error(`PNG no soportado (profundidad ${depth}, tipo ${colorType})`);
			}
		} else if (type === "IDAT") {
			idat.push(chunk);
		} else if (type === "IEND") {
			break;
		}
		offset += 12 + length;
	}
	const channels = colorType === 6 ? 4 : 3;
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * channels;
	const pixels = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		const out = pixels.subarray(y * stride, (y + 1) * stride);
		const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
		for (let x = 0; x < stride; x++) {
			const a = x >= channels ? out[x - channels] : 0;
			const b = prev ? prev[x] : 0;
			const c = prev && x >= channels ? prev[x - channels] : 0;
			let value = line[x];
			if (filter === 1) value += a;
			else if (filter === 2) value += b;
			else if (filter === 3) value += (a + b) >> 1;
			else if (filter === 4) {
				const p = a + b - c;
				const pa = Math.abs(p - a);
				const pb = Math.abs(p - b);
				const pc = Math.abs(p - c);
				value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			out[x] = value & 0xff;
		}
	}
	const data = Buffer.alloc(width * height * 4);
	for (let i = 0, j = 0; i < width * height; i++, j += channels) {
		data[i * 4] = pixels[j];
		data[i * 4 + 1] = pixels[j + 1];
		data[i * 4 + 2] = pixels[j + 2];
		data[i * 4 + 3] = channels === 4 ? pixels[j + 3] : 255;
	}
	return { width, height, data };
}

/** Codifica RGBA a PNG (filtro 0), para la imagen de diferencias. */
export function encodePng({ width, height, data }) {
	const raw = Buffer.alloc((width * 4 + 1) * height);
	for (let y = 0; y < height; y++) {
		data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
	}
	const chunk = (type, body) => {
		const head = Buffer.alloc(8);
		head.writeUInt32BE(body.length, 0);
		head.write(type, 4, "ascii");
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
		return Buffer.concat([head, body, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

let crcTable;
function crc32(buffer) {
	if (!crcTable) {
		crcTable = new Uint32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			crcTable[n] = c >>> 0;
		}
	}
	let crc = 0xffffffff;
	for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Compara dos imágenes del mismo tamaño. Devuelve los píxeles distintos (algún canal difiere más que
 * `tolerance`), las franjas de filas donde están y una imagen de diferencias (rojo sobre la captura atenuada).
 */
export function diffImages(a, b, tolerance = 0) {
	if (a.width !== b.width || a.height !== b.height) {
		return { sameSize: false, differing: null, bands: [], image: null };
	}
	const image = { width: a.width, height: a.height, data: Buffer.alloc(a.data.length) };
	let differing = 0;
	const rows = new Uint8Array(a.height);
	for (let i = 0; i < a.data.length; i += 4) {
		const delta = Math.max(
			Math.abs(a.data[i] - b.data[i]),
			Math.abs(a.data[i + 1] - b.data[i + 1]),
			Math.abs(a.data[i + 2] - b.data[i + 2]),
		);
		if (delta > tolerance) {
			differing++;
			rows[Math.floor(i / 4 / a.width)] = 1;
			image.data.set([255, 0, 0, 255], i);
		} else {
			const grey = 200 + (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3 / 5;
			image.data.set([grey, grey, grey, 255], i);
		}
	}
	const bands = [];
	for (let y = 0; y < rows.length; y++) {
		if (!rows[y]) continue;
		const last = bands.at(-1);
		if (last && y - last[1] <= 8) last[1] = y;
		else bands.push([y, y]);
	}
	return { sameSize: true, differing, bands, image };
}
