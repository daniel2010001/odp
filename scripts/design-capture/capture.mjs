// Captura pantallas del portal en marcha como artboards autocontenidos de Gentle Design (S15 de
// `odd/tasks/prototype-presentation.md`): un HTML por pantalla, idéntico a lo que el portal dibuja hoy, sin
// scripts ni referencias externas (CSS, imágenes y fuentes embebidos como data: URIs).
//
//   node scripts/design-capture/capture.mjs scripts/design-capture/batch-1.json
//
// El lote (JSON) dice de dónde y adónde:
//   origin           portal en marcha (p. ej. http://localhost:8082)
//   cookies          [{ name, value }] para el origen (p. ej. el modo prototipo, odp_prototype=on)
//   width            ancho del viewport en CSS px (1440)
//   viewportHeight   alto de la ventana en que se mira la página (900 por defecto); las unidades vh del CSS
//                    se fijan a ese alto (ver `freezeViewportUnits`)
//   outDir           carpeta del diseño (design/prototipo), relativa a la raíz del repo
//   removeSelectors  lo que no es producto (las franjas de revisión DEV)
//   tabLinks         [{ selector, href }]: pestañas que pasan a ser enlaces al artboard de su vista; `href` es
//                    el fragmento de la vista, con `{value}` = el `data-value` de la pestaña (`#chart-{value}`)
//   screens[]        { file, url, aliases?, waitForText?, waitForSelector?, linkOnly?, replaceIframes? }
//                    `url` y `aliases` pueden llevar fragmento: `/recurso#chart-<id>` abre esa vista y es otra
//                    pantalla que `/recurso` (cada pestaña de un recurso, su artboard).
//                    `replaceIframes`: { selector, pages? } cambia cada `<iframe>` con un PDF por un visor estático
//                    con sus primeras `pages` (2) páginas como PNG (`pdfStandIn`). Requiere `pdfinfo` y `pdftoppm`.
//                    `aliases`: otras direcciones de la misma pantalla, para que sus enlaces lleven al artboard.
//                    `linkOnly`: no se captura ni se escribe; sólo es destino de los enlaces de las demás (su
//                    artboard ya tiene que existir). Un lote lista todas las pantallas y recaptura las que no lo son.
//                    `scrollStates`: [{ scrollTo, container, query }] lo que el script de la página cambia al
//                    desplazar (el encabezado que se achica, una barra que se recorta al pegarse), que sin script
//                    quedaría congelado en reposo. Por estado, en orden: se desplaza a `scrollTo` px, se comparan
//                    los estilos computados con los de reposo, y lo que cambió en un descendiente de `container`
//                    pasa al CSS bajo `@container scroll-state(<query>)` de ese contenedor (`scrollStateCss`).
//                    El encabezado: `{ container: ":root", query: "scrollable: top" }`; un pegado: su selector
//                    con `stuck: top`. Lo que cambió fuera de su contenedor queda en reposo (se avisa).
//
// Los enlaces a una pantalla del lote (por su `url` o un alias) apuntan al archivo hermano; los demás quedan
// inertes (sin `href`). Si `outDir/design.json` existe, actualiza el `height` de cada artboard capturado.
// Requiere Chromium (`/usr/bin/chromium`, o la variable CHROMIUM). Verificación: `verify.mjs`.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
	evaluate,
	launch,
	navigate,
	openPage,
	setViewport,
	sleep,
	trackNetwork,
	waitFor,
} from "./cdp.mjs";
import {
	buildLinkMap,
	embedFontFaces,
	externalReferences,
	freezeViewportUnits,
	freezeViewportUnitsInStyles,
	mapHref,
	pdfStandIn,
	planBatch,
	scrollStateCss,
	styleChanges,
	tabTarget,
	urlKey,
} from "./lib.mjs";
import { serializePage } from "./serialize-page.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const viewportHeight = (batch) => batch.viewportHeight ?? 900;

/** Abre una pantalla del lote y espera a que esté completa (red en reposo, contenido, fuentes). */
export async function loadScreen(browser, batch, screen) {
	const page = await openPage(browser);
	const network = trackNetwork(page);
	for (const cookie of batch.cookies ?? []) {
		await page.send("Network.setCookie", { ...cookie, url: `${batch.origin}/` });
	}
	await setViewport(page, batch.width, viewportHeight(batch));
	await navigate(page, new URL(screen.url, batch.origin).href);
	await network.idle(1500);
	for (const text of screen.waitForText ?? []) {
		await waitFor(page, `document.body.innerText.includes(${JSON.stringify(text)})`);
	}
	if (screen.waitForSelector) {
		await waitFor(page, `document.querySelector(${JSON.stringify(screen.waitForSelector)})`);
	}
	await evaluate(page, "document.fonts.ready.then(() => true)");
	await network.idle(1000);
	// Lo que no es producto se oculta también en la página real, para medir el alto y comparar sin ello.
	const selectors = JSON.stringify((batch.removeSelectors ?? []).join(",") || ":not(*)");
	await evaluate(
		page,
		`document.querySelectorAll(${selectors}).forEach((el) => el.style.setProperty("display", "none", "important"))`,
	);
	// Una vista abierta por fragmento hace scroll hasta ella; la captura y la comparación van desde el tope, con
	// el encabezado ya de vuelta en su estado de reposo (su sombra de «con scroll» se va con una transición).
	if (await evaluate(page, "window.scrollY > 0")) {
		await evaluate(page, `window.scrollTo({ top: 0, behavior: "instant" })`);
		await sleep(1000);
	}
	return { page, network };
}

/** Alto completo de la página en CSS px. */
export const measureHeight = (page) =>
	evaluate(
		page,
		"Math.max(document.documentElement.scrollHeight, Math.ceil(document.documentElement.getBoundingClientRect().height))",
	);

const run = promisify(execFile);

/**
 * El reemplazo estático de cada `<iframe>` con un PDF que cumple `selector`: descarga el PDF con las cookies del
 * lote, dibuja sus primeras `pages` páginas a 192 ppp (2× de 96: nítidas al ampliar el lienzo) y las muestra al
 * 100 %, como el visor de Chromium.
 */
async function pdfStandIns(page, batch, { selector, pages = 2 }) {
	const frames = await evaluate(
		page,
		`[...document.querySelectorAll(${JSON.stringify(selector)})].map((f) => ({ src: f.src, title: f.title, className: f.getAttribute("class") ?? "" }))`,
	);
	const cookie = (batch.cookies ?? []).map(({ name, value }) => `${name}=${value}`).join("; ");
	const dir = await mkdtemp(join(tmpdir(), "design-capture-pdf-"));
	try {
		const html = [];
		for (const [index, frame] of frames.entries()) {
			const response = await fetch(frame.src, { headers: cookie ? { cookie } : {} });
			const bytes = Buffer.from(await response.arrayBuffer());
			if (!response.ok || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
				throw new Error(`${frame.src}: no es un PDF (HTTP ${response.status})`);
			}
			const pdf = join(dir, `${index}.pdf`);
			await writeFile(pdf, bytes);
			const { stdout: info } = await run("pdfinfo", [pdf]);
			const pageCount = Number(/^Pages:\s+(\d+)/m.exec(info)[1]);
			const title = /^Title:\s+(.+)$/m.exec(info)?.[1].trim() || frame.title;
			const last = Math.min(pages, pageCount);
			await run("pdftoppm", [
				"-png",
				"-r",
				"192",
				"-f",
				"1",
				"-l",
				String(last),
				pdf,
				join(dir, `${index}-p`),
			]);
			const files = (await readdir(dir)).filter((f) => f.startsWith(`${index}-p-`)).sort();
			const images = [];
			for (const file of files) {
				const png = await readFile(join(dir, file));
				images.push({
					src: `data:image/png;base64,${png.toString("base64")}`,
					width: Math.round(png.readUInt32BE(16) / 2),
					height: Math.round(png.readUInt32BE(20) / 2),
				});
			}
			html.push(pdfStandIn({ className: frame.className, title, pageCount, pages: images }));
		}
		return { selector, html };
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/**
 * Recorre los `scrollStates` de la pantalla (ver arriba) y marca con `data-capture-scroll` cada elemento que
 * cambia; devuelve el CSS que reproduce esos cambios sin script. Deja la página de nuevo en el tope.
 */
async function sampleScrollStates(page, states) {
	await evaluate(
		page,
		`(() => {
			const elements = [...document.querySelectorAll("*")];
			window.__capture = {
				elements,
				claimed: {},
				next: 0,
				// Valores computados, no resueltos: un \`height: auto\` sigue siendo \`auto\` y no se clava en px lo que
				// sólo es consecuencia del layout (el \`<header>\` crece con su hijo, que es el que se anima).
				snapshot: () => elements.map((el) => {
					const out = {};
					for (const [prop, values] of el.computedStyleMap()) {
						if (!prop.startsWith("--")) out[prop] = values.map(String).join(", ");
					}
					return out;
				}),
			};
			window.__capture.rest = window.__capture.snapshot();
			return true;
		})()`,
	);
	const claims = [];
	const warnings = [];
	for (const state of states) {
		await evaluate(
			page,
			`window.scrollTo({ top: ${Number(state.scrollTo)}, behavior: "instant" })`,
		);
		// Las transiciones de la página duran 200–250 ms: se mide con todo ya quieto.
		await sleep(1000);
		const { claimed, outside } = await evaluate(
			page,
			`(() => {
				const styleChanges = ${styleChanges.toString()};
				const c = window.__capture;
				const claimed = [];
				let outside = 0;
				for (const [index, decls] of styleChanges(c.rest, c.snapshot(), c.claimed)) {
					const el = c.elements[index];
					if (!el.parentElement?.closest(${JSON.stringify(state.container)})) { outside++; continue; }
					el.dataset.captureScroll ??= String(c.next++);
					c.claimed[index] = { ...c.claimed[index], ...decls };
					claimed.push({ id: Number(el.dataset.captureScroll), decls });
				}
				return { claimed, outside };
			})()`,
		);
		claims.push(claimed);
		if (outside) {
			warnings.push(
				`scroll ${state.scrollTo}: ${outside} elementos cambian fuera de ${state.container} y quedan en reposo`,
			);
		}
	}
	await evaluate(page, `window.scrollTo({ top: 0, behavior: "instant" })`);
	await sleep(1000);
	return { css: scrollStateCss(states, claims), warnings };
}

async function captureScreen(browser, batch, screen, linkMap) {
	const { page, network } = await loadScreen(browser, batch, screen);
	const height = await measureHeight(page);
	const scroll = screen.scrollStates
		? await sampleScrollStates(page, screen.scrollStates)
		: { css: "", warnings: [] };
	const standIns = screen.replaceIframes
		? await pdfStandIns(page, batch, screen.replaceIframes)
		: null;
	const expression = `(async () => {
		const urlKey = ${urlKey.toString()};
		const mapHref = ${mapHref.toString()};
		const tabTarget = ${tabTarget.toString()};
		return (${serializePage.toString()})(${JSON.stringify({
			linkMap,
			removeSelectors: batch.removeSelectors ?? [],
			tabLinks: batch.tabLinks ?? [],
			standIns,
		})});
	})()`;
	const result = await evaluate(page, expression);

	let css = freezeViewportUnits(`${result.css}\n${scroll.css}`, viewportHeight(batch));
	for (const [index, href] of result.imports.entries()) {
		const sheet = await network.body(href);
		if (!sheet) throw new Error(`La hoja externa no se descargó: ${href}`);
		const faces = await embedFontFaces(sheet.toString("utf8"), (url) => network.body(url));
		css = css.replace(`/*@@IMPORT:${index}@@*/`, faces.join("\n"));
	}
	if (/<\/style/i.test(css)) throw new Error("El CSS contiene </style>");
	const html = freezeViewportUnitsInStyles(result.html, viewportHeight(batch)).replace(
		"/*@@CSS@@*/",
		() => `\n${css}\n`,
	);
	await page.close();
	return {
		html,
		height,
		inertLinks: result.inertLinks,
		tabLinks: result.tabLinks,
		warnings: [...scroll.warnings, ...result.warnings],
	};
}

async function main() {
	const batchPath = process.argv[2];
	if (!batchPath) {
		console.error("Uso: node scripts/design-capture/capture.mjs <lote.json>");
		process.exit(2);
	}
	const batch = JSON.parse(await readFile(batchPath, "utf8"));
	const outDir = join(REPO, batch.outDir);
	const linkMap = buildLinkMap(batch.screens, batch.origin);
	const plan = planBatch(batch.screens, (file) => existsSync(join(outDir, file)));
	for (const screen of plan.linkOnly)
		console.log(`${screen.file}: sólo destino de enlaces (linkOnly)`);
	const { browser, close } = await launch();
	const heights = {};
	try {
		for (const screen of plan.capture) {
			const { html, height, inertLinks, tabLinks, warnings } = await captureScreen(
				browser,
				batch,
				screen,
				linkMap,
			);
			if (/<script/i.test(html)) throw new Error(`${screen.file}: quedó un <script>`);
			await writeFile(join(outDir, screen.file), html);
			heights[screen.file] = height;
			const external = externalReferences(html);
			console.log(
				`${screen.file}: ${height} px de alto, ${(html.length / 1024).toFixed(0)} KiB, ${inertLinks} enlaces inertes, ${tabLinks} pestañas enlazadas`,
			);
			for (const reference of external) console.log(`  http en el archivo: ${reference}`);
			for (const warning of warnings) console.log(`  aviso: ${warning}`);
		}
	} finally {
		await close();
	}

	const manifestPath = join(outDir, "design.json");
	let manifest;
	try {
		manifest = JSON.parse(await readFile(manifestPath, "utf8"));
	} catch {
		console.log("Sin design.json: escríbalo con los altos de arriba.");
		return;
	}
	for (const artboard of manifest.artboards) {
		if (artboard.file in heights) {
			artboard.width = batch.width;
			artboard.height = heights[artboard.file];
		}
	}
	const missing = Object.keys(heights).filter(
		(file) => !manifest.artboards.some((artboard) => artboard.file === file),
	);
	for (const file of missing) console.log(`Falta en design.json: ${file} (${heights[file]} px)`);
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
