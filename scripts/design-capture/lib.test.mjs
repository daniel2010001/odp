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
	planBatch,
	urlKey,
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
