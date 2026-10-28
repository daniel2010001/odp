// Test de las funciones puras de la captura a artboards (sin navegador ni red).
//
//   node --test scripts/design-capture/lib.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import {
	buildLinkMap,
	decodePng,
	diffImages,
	embedFontFaces,
	encodePng,
	externalReferences,
	freezeViewportUnits,
	freezeViewportUnitsInStyles,
	mapHref,
	pdfStandIn,
	planBatch,
	tabTarget,
	urlKey,
	waitsForRequest,
} from "./lib.mjs";

const ORIGIN = "http://localhost:8082";

test("urlKey ignora el orden de los parámetros y el fragmento, y descarta otros orígenes", () => {
	assert.equal(urlKey("/a?y=2&x=1#f", ORIGIN), "/a?x=1&y=2");
	assert.equal(urlKey("http://localhost:8082/a", ORIGIN), "/a");
	assert.equal(urlKey("https://creativecommons.org/licenses/", ORIGIN), null);
	assert.equal(urlKey("mailto:datos@umss.edu.bo", ORIGIN), null);
});

const SCREENS = [
	{
		file: "h2-7.html",
		url: "/dev/prototype/collection?c=indicadores-academicos&vista=publica",
		aliases: ["/dev/prototype/collection?c=indicadores-academicos"],
	},
	{ file: "h3-1.html", url: "/dev/prototype/collections?vista=panel" },
];

test("mapHref lleva a la pantalla capturada por su dirección o por un alias", () => {
	const map = buildLinkMap(SCREENS, ORIGIN);
	assert.equal(
		mapHref("/dev/prototype/collection?c=indicadores-academicos", ORIGIN, map),
		"h2-7.html",
	);
	assert.equal(
		mapHref("/dev/prototype/collection?vista=publica&c=indicadores-academicos", ORIGIN, map),
		"h2-7.html",
	);
	assert.equal(mapHref("/dev/prototype/collections?vista=panel#x", ORIGIN, map), "h3-1.html#x");
});

test("mapHref deja inerte lo que no está capturado y conserva las anclas de la misma página", () => {
	const map = buildLinkMap(SCREENS, ORIGIN);
	assert.equal(
		mapHref("/dev/prototype/collection?c=indicadores-academicos&vista=curador", ORIGIN, map),
		null,
	);
	assert.equal(mapHref("/dev/prototype/collections", ORIGIN, map), null);
	assert.equal(mapHref("https://creativecommons.org/", ORIGIN, map), null);
	assert.equal(mapHref("mailto:datos@umss.edu.bo", ORIGIN, map), null);
	assert.equal(mapHref("#technical-info", ORIGIN, map), "#technical-info");
});

test("buildLinkMap rechaza una dirección que apunta a dos artboards", () => {
	assert.throws(
		() =>
			buildLinkMap(
				[
					{ file: "a.html", url: "/x" },
					{ file: "b.html", url: "/y", aliases: ["/x"] },
				],
				ORIGIN,
			),
		/dos artboards/,
	);
});

// Una misma página con varias vistas (las pestañas de un recurso), cada una en su artboard por su fragmento.
const VIEWS = [
	{ file: "h2-5.html", url: "/recurso", aliases: ["/recurso#table"] },
	{ file: "h2-5b.html", url: "/recurso#chart-a" },
];

test("buildLinkMap distingue por fragmento las vistas de una misma página", () => {
	const map = buildLinkMap(VIEWS, ORIGIN);
	assert.equal(mapHref("/recurso#chart-a", ORIGIN, map), "h2-5b.html");
	assert.equal(mapHref("http://localhost:8082/recurso#table", ORIGIN, map), "h2-5.html");
	assert.equal(mapHref("/recurso", ORIGIN, map), "h2-5.html");
	// Un fragmento sin artboard propio sigue siendo un ancla dentro de la página.
	assert.equal(mapHref("/recurso#metadata", ORIGIN, map), "h2-5.html#metadata");
	assert.throws(
		() =>
			buildLinkMap(
				[
					{ file: "a.html", url: "/x#v" },
					{ file: "b.html", url: "/y", aliases: ["/x#v"] },
				],
				ORIGIN,
			),
		/dos artboards/,
	);
});

test("tabTarget lleva una pestaña al artboard de su vista sólo si esa vista se capturó", () => {
	const map = buildLinkMap(VIEWS, ORIGIN);
	const page = `${ORIGIN}/recurso#chart-a`;
	assert.equal(tabTarget("#chart-{value}", "a", page, map), "h2-5b.html");
	assert.equal(tabTarget("#table", "table", page, map), "h2-5.html");
	assert.equal(tabTarget("#chart-{value}", "z", page, map), null);
	assert.equal(tabTarget("#chart-{value}", "a", `${ORIGIN}/otro`, map), null);
});

test("waitsForRequest ignora HMR y lo que no es http(s), como el visor de PDF de Chromium", () => {
	assert.equal(waitsForRequest("http://localhost:8082/src/lib/utils.ts"), true);
	assert.equal(waitsForRequest("https://fonts.gstatic.com/s/poppins/latin.woff2"), true);
	assert.equal(waitsForRequest("http://localhost:8082/@vite/client"), false);
	assert.equal(waitsForRequest("ws://localhost:8082/?token=x&hmr"), false);
	assert.equal(
		waitsForRequest("chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html"),
		false,
	);
});

test("pdfStandIn dibuja el visor con las páginas como imágenes, con la clase del iframe y sin red", () => {
	const html = pdfStandIn({
		className: "h-[760px] w-full",
		title: 'Informe <2025> & "anexo"',
		pageCount: 3,
		pages: [
			{ src: "data:image/png;base64,AAA", width: 794, height: 1123 },
			{ src: "data:image/png;base64,BBB", width: 794, height: 1123 },
		],
	});
	assert.doesNotMatch(html, /<iframe|<script/i);
	assert.deepEqual(externalReferences(html), []);
	assert.match(html, /^<div class="h-\[760px\] w-full" /);
	assert.match(html, /data-stand-in="pdf"/);
	assert.match(html, /Informe &lt;2025&gt; &amp; &quot;anexo&quot;/);
	assert.match(html, />1 \/ 3</);
	const images = [
		...html.matchAll(/<img src="([^"]+)" width="(\d+)" height="(\d+)" alt="([^"]+)"/g),
	];
	assert.deepEqual(
		images.map(([, src, width, height, alt]) => [src, width, height, alt]),
		[
			["data:image/png;base64,AAA", "794", "1123", "Página 1 de 3"],
			["data:image/png;base64,BBB", "794", "1123", "Página 2 de 3"],
		],
	);
	// Las páginas se recorren dentro del visor, como en el iframe: el artboard no tiene scripts, pero sí scroll.
	assert.match(html, /overflow-y:auto/);
});

test("planBatch no captura las pantallas linkOnly, pero siguen siendo destino de los enlaces", () => {
	const screens = [
		{ file: "h2-4.html", url: "/dataset/matricula", linkOnly: true },
		{ file: "h2-3.html", url: "/search?q=matrícula" },
	];
	const existing = new Set(["h2-4.html"]);
	const plan = planBatch(screens, (file) => existing.has(file));
	assert.deepEqual(
		plan.capture.map((screen) => screen.file),
		["h2-3.html"],
	);
	assert.deepEqual(
		plan.linkOnly.map((screen) => screen.file),
		["h2-4.html"],
	);
	assert.equal(mapHref("/dataset/matricula", ORIGIN, buildLinkMap(screens, ORIGIN)), "h2-4.html");
});

test("planBatch rechaza una pantalla linkOnly cuyo artboard no existe", () => {
	assert.throws(
		() =>
			planBatch([{ file: "h2-4.html", url: "/dataset/matricula", linkOnly: true }], () => false),
		/h2-4\.html: linkOnly, pero el artboard no existe/,
	);
});

test("embedFontFaces embebe las caras descargadas y descarta las que no", async () => {
	const css = `/* latin-ext */
@font-face {
  font-family: 'Poppins';
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/poppins/ext.woff2) format('woff2');
}
/* latin */
@font-face {
  font-family: 'Poppins';
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/poppins/latin.woff2) format('woff2');
}`;
	const faces = await embedFontFaces(css, async (url) =>
		url.endsWith("latin.woff2") ? Buffer.from("FONT") : null,
	);
	assert.equal(faces.length, 1);
	assert.match(faces[0], /url\(data:font\/woff2;base64,Rk9OVA==\)/);
	assert.deepEqual(externalReferences(faces[0]), []);
});

test("freezeViewportUnits fija vh/dvh al alto de la ventana sin tocar selectores ni data: URIs", () => {
	const css = [
		".min-h-screen { min-height: 100vh; }",
		".max-h-\\[calc\\(100dvh-140px\\)\\] { max-height: calc(100dvh - 140px); }",
		".a { height: 50svh; top: 12.5lvh; width: 10vw; }",
		'@font-face { src: url(data:font/woff2;base64,AB9vh+CD) format("woff2"); }',
	].join("\n");
	assert.equal(
		freezeViewportUnits(css, 900),
		[
			".min-h-screen { min-height: 900px; }",
			".max-h-\\[calc\\(100dvh-140px\\)\\] { max-height: calc(900px - 140px); }",
			".a { height: 450px; top: 112.5px; width: 10vw; }",
			'@font-face { src: url(data:font/woff2;base64,AB9vh+CD) format("woff2"); }',
		].join("\n"),
	);
	assert.equal(
		freezeViewportUnitsInStyles('<div style="height: 100dvh" class="h-[100vh]">', 900),
		'<div style="height: 900px" class="h-[100vh]">',
	);
});

test("externalReferences permite los espacios de nombres XML y reporta lo demás", () => {
	const html = `<svg xmlns="http://www.w3.org/2000/svg"></svg><p>https://datos.umss.edu/x</p>`;
	assert.deepEqual(externalReferences(html), ["https://datos.umss.edu/x"]);
});

test("encodePng y decodePng ida y vuelta; diffImages cuenta y ubica los píxeles distintos", () => {
	const make = () => ({ width: 3, height: 20, data: Buffer.alloc(3 * 20 * 4, 255) });
	const a = make();
	const b = make();
	b.data.set([0, 0, 0, 255], (15 * 3 + 1) * 4);
	const decoded = decodePng(encodePng(b));
	assert.equal(decoded.width, 3);
	assert.deepEqual(decoded.data, b.data);
	const diff = diffImages(a, decoded);
	assert.equal(diff.differing, 1);
	assert.deepEqual(diff.bands, [[15, 15]]);
	assert.equal(diffImages(a, a).differing, 0);
	assert.equal(diffImages(a, { width: 3, height: 1, data: Buffer.alloc(12) }).sameSize, false);
});
