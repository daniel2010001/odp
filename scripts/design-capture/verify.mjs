// Verifica los artboards de un lote contra el portal en marcha:
//
//   node scripts/design-capture/verify.mjs scripts/design-capture/batch-1.json <carpeta-de-salida> [tolerancia]
//
// Por pantalla: abre el artboard desde file:// con la red apagada, en un viewport tan alto como la página
// (como lo muestra el lienzo), y la pantalla real con las mismas cookies en la ventana del lote
// (`width` × `viewportHeight`), capturada entera más allá del viewport; y compara las dos píxel a píxel. Escribe en <carpeta-de-salida> `<artboard>.live.png`, `.artboard.png` y `.diff.png` (rojo = distinto).
// También revisa el archivo: sin <script>, sin http(s) salvo los xmlns, y sin peticiones de red al abrirlo.
// Sale con código 1 si algo no coincide. `tolerancia` (0 por defecto, de 0 a 255 por canal) absorbe el
// antialiasing de los bordes de un elemento `sticky` en la captura más allá del viewport (la barra lateral de
// la ficha del dataset: diferencias de ≤ 48/255 sólo en sus bordes redondeados); se informan los dos conteos.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadScreen, measureHeight } from "./capture.mjs";
import { evaluate, launch, navigate, openPage, screenshot, setViewport, sleep } from "./cdp.mjs";
import { decodePng, diffImages, encodePng, externalReferences } from "./lib.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const bandsText = ({ bands }) =>
	bands.length ? ` (filas ${bands.map(([a, b]) => `${a}–${b}`).join(", ")})` : "";

async function main() {
	const [batchPath, outDir, toleranceArg = "0"] = process.argv.slice(2);
	const tolerance = Number(toleranceArg);
	if (!batchPath || !outDir) {
		console.error("Uso: node scripts/design-capture/verify.mjs <lote.json> <carpeta-de-salida>");
		process.exit(2);
	}
	const batch = JSON.parse(await readFile(batchPath, "utf8"));
	const { browser, close } = await launch();
	let failed = false;
	try {
		for (const screen of batch.screens) {
			const path = join(REPO, batch.outDir, screen.file);
			const html = await readFile(path, "utf8");
			const external = externalReferences(html);
			const scripts = (html.match(/<script/gi) ?? []).length;

			// El artboard, sin red.
			const board = await openPage(browser);
			const requests = [];
			board.on("Network.requestWillBeSent", ({ request }) => {
				if (!/^(data|file):/.test(request.url)) requests.push(request.url);
			});
			await board.send("Network.emulateNetworkConditions", {
				offline: true,
				latency: 0,
				downloadThroughput: -1,
				uploadThroughput: -1,
			});
			await setViewport(board, batch.width, 900);
			await navigate(board, pathToFileURL(path).href);
			await evaluate(board, "document.fonts.ready.then(() => true)");
			const height = await measureHeight(board);
			const fonts = await evaluate(
				board,
				"[...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight)",
			);
			await setViewport(board, batch.width, height);
			await sleep(300);
			const boardPng = await screenshot(board);
			await board.close();

			// La pantalla real, en su ventana, capturada entera.
			const { page: live } = await loadScreen(browser, batch, screen);
			const liveHeight = await measureHeight(live);
			const livePng = await screenshot(live, { width: batch.width, height: liveHeight });
			await live.close();

			const liveImage = decodePng(livePng);
			const boardImage = decodePng(boardPng);
			const exact = diffImages(liveImage, boardImage);
			const diff = diffImages(liveImage, boardImage, tolerance);
			const base = join(outDir, screen.file.replace(/\.html$/, ""));
			await writeFile(`${base}.live.png`, livePng);
			await writeFile(`${base}.artboard.png`, boardPng);
			if (exact.image) await writeFile(`${base}.diff.png`, encodePng(exact.image));

			const ok = diff.sameSize && diff.differing === 0 && scripts === 0 && requests.length === 0;
			failed ||= !ok;
			console.log(`${ok ? "OK " : "DIF"} ${screen.file}`);
			console.log(
				`    alto ${height} px (real: ${liveHeight} px) · ${(html.length / 1024).toFixed(0)} KiB · <script>: ${scripts}`,
			);
			console.log(`    fuentes cargadas sin red: ${fonts.join(", ") || "ninguna"}`);
			console.log(
				`    peticiones de red al abrirlo: ${requests.length ? requests.join(", ") : "ninguna"}`,
			);
			console.log(
				`    http(s) en el archivo (sin contar xmlns): ${external.length ? external.join(", ") : "ninguno"}`,
			);
			console.log(
				diff.sameSize
					? `    píxeles distintos: ${exact.differing}${bandsText(exact)}; con más de ${tolerance}/255: ${diff.differing}${bandsText(diff)}`
					: "    las capturas tienen tamaños distintos",
			);
		}
	} finally {
		await close();
	}
	process.exit(failed ? 1 : 0);
}

await main();
