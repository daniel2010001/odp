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
//   screens[]        { file, url, aliases?, waitForText?, waitForSelector? }
//                    `aliases`: otras direcciones de la misma pantalla, para que sus enlaces lleven al artboard.
//
// Los enlaces a una pantalla del lote (por su `url` o un alias) apuntan al archivo hermano; los demás quedan
// inertes (sin `href`). Si `outDir/design.json` existe, actualiza el `height` de cada artboard capturado.
// Requiere Chromium (`/usr/bin/chromium`, o la variable CHROMIUM). Verificación: `verify.mjs`.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
	evaluate,
	launch,
	navigate,
	openPage,
	setViewport,
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
	return { page, network };
}

/** Alto completo de la página en CSS px. */
export const measureHeight = (page) =>
	evaluate(
		page,
		"Math.max(document.documentElement.scrollHeight, Math.ceil(document.documentElement.getBoundingClientRect().height))",
	);

async function captureScreen(browser, batch, screen, linkMap) {
	const { page, network } = await loadScreen(browser, batch, screen);
	const height = await measureHeight(page);
	const expression = `(async () => {
		const urlKey = ${urlKey.toString()};
		const mapHref = ${mapHref.toString()};
		return (${serializePage.toString()})(${JSON.stringify({
			linkMap,
			removeSelectors: batch.removeSelectors ?? [],
		})});
	})()`;
	const result = await evaluate(page, expression);

	let css = freezeViewportUnits(result.css, viewportHeight(batch));
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
	return { html, height, inertLinks: result.inertLinks, warnings: result.warnings };
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
	const { browser, close } = await launch();
	const heights = {};
	try {
		for (const screen of batch.screens) {
			const { html, height, inertLinks, warnings } = await captureScreen(
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
				`${screen.file}: ${height} px de alto, ${(html.length / 1024).toFixed(0)} KiB, ${inertLinks} enlaces inertes`,
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
