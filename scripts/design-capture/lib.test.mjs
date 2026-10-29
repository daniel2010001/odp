// Test de las funciones puras de la captura a artboards (sin navegador ni red).
//
//   node --test scripts/design-capture/lib.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import {
	accountCredentials,
	batchAccounts,
	buildLinkMap,
	cookieHeader,
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
	screenCookies,
	scrollStateCss,
	sessionCookies,
	styleChanges,
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

test("styleChanges devuelve, por elemento, sólo las propiedades que cambiaron y no reclamó un estado anterior", () => {
	const rest = [
		{ height: "80px", opacity: "1" },
		{ "clip-path": "inset(0px)", transform: "none" },
	];
	const sample = [
		{ height: "64px", opacity: "1" },
		{ "clip-path": "inset(0px 104px 0px 416px)", transform: "none" },
	];
	assert.deepEqual(styleChanges(rest, sample), [
		[0, { height: "64px" }],
		[1, { "clip-path": "inset(0px 104px 0px 416px)" }],
	]);
	// Lo que ya cambió en un estado anterior es de ese estado: no se repite en el siguiente.
	assert.deepEqual(styleChanges(rest, sample, { 0: { height: "64px" } }), [
		[1, { "clip-path": "inset(0px 104px 0px 416px)" }],
	]);
	assert.deepEqual(styleChanges(rest, rest), []);
});

test("scrollStateCss declara cada contenedor y aplica los cambios bajo su consulta scroll-state", () => {
	const states = [
		{ container: ":root", query: "scrollable: top" },
		{ container: "[data-results-bar]", query: "stuck: top" },
	];
	const claims = [
		[{ id: 0, decls: { height: "64px" } }],
		[{ id: 1, decls: { "clip-path": "inset(0px 104px 0px 416px)", transform: "none" } }],
	];
	assert.equal(
		scrollStateCss(states, claims),
		[
			":root { container: capture-scroll-0 / scroll-state; }",
			"[data-results-bar] { container: capture-scroll-1 / scroll-state; }",
			'@container capture-scroll-0 scroll-state(scrollable: top) { [data-capture-scroll="0"] { height: 64px !important; } }',
			'@container capture-scroll-1 scroll-state(stuck: top) { [data-capture-scroll="1"] { clip-path: inset(0px 104px 0px 416px) !important; transform: none !important; } }',
		].join("\n"),
	);
	// Un estado sin cambios no declara contenedor ni consulta.
	assert.equal(scrollStateCss(states, [[], []]), "");
});

test("batchAccounts lista una vez cada cuenta que piden las pantallas, en orden", () => {
	const screens = [{ as: "editor" }, { file: "x" }, { as: "admin" }, { as: "editor" }];
	assert.deepEqual(batchAccounts(screens), ["admin", "editor"]);
	assert.deepEqual(batchAccounts([{ file: "x" }]), []);
	assert.throws(() => batchAccounts([{ as: "Editor 1" }]), /Cuenta inválida: Editor 1/);
});

test("accountCredentials lee usuario y contraseña de DEMO_<CUENTA>_USER / _PASSWORD", () => {
	const env = { DEMO_EDITOR_USER: "ed", DEMO_EDITOR_PASSWORD: "pw" };
	assert.deepEqual(accountCredentials("editor", env), { user: "ed", password: "pw" });
	// Sin una de las dos, el error nombra las variables, nunca sus valores.
	assert.throws(
		() => accountCredentials("admin", { DEMO_ADMIN_USER: "usuario-secreto" }),
		(error) =>
			error.message === "Faltan DEMO_ADMIN_USER / DEMO_ADMIN_PASSWORD (pantallas «as: admin»)",
	);
	assert.throws(() => accountCredentials("editor", {}), /Faltan DEMO_EDITOR_USER/);
});

test("sessionCookies toma nombre y valor de cada Set-Cookie y descarta las que se borran", () => {
	assert.deepEqual(
		sessionCookies([
			"odp_session=abc.def=; Path=/; HttpOnly; SameSite=Lax",
			"otra=; Path=/; Max-Age=0",
			"vieja=x; Path=/; Max-Age=0",
			"flag=1",
		]),
		[
			{ name: "odp_session", value: "abc.def=" },
			{ name: "flag", value: "1" },
		],
	);
	assert.deepEqual(sessionCookies([]), []);
});

test("screenCookies suma a las cookies del lote la sesión de la cuenta de la pantalla", () => {
	const batch = { cookies: [{ name: "odp_prototype", value: "on" }] };
	const sessions = { editor: [{ name: "odp_session", value: "s1" }] };
	assert.deepEqual(screenCookies(batch, { file: "a" }, sessions), batch.cookies);
	assert.deepEqual(screenCookies(batch, { file: "b", as: "editor" }, sessions), [
		{ name: "odp_prototype", value: "on" },
		{ name: "odp_session", value: "s1" },
	]);
	assert.deepEqual(screenCookies({}, { file: "c" }, {}), []);
	assert.throws(
		() => screenCookies(batch, { file: "d.html", as: "admin" }, sessions),
		/d\.html: no hay sesión de «admin»/,
	);
});

test("cookieHeader arma la cabecera Cookie", () => {
	assert.equal(
		cookieHeader([
			{ name: "a", value: "1" },
			{ name: "b", value: "x=y" },
		]),
		"a=1; b=x=y",
	);
	assert.equal(cookieHeader([]), "");
});

test("buildLinkMap con cuenta: una misma dirección con y sin sesión lleva al artboard de quien mira", () => {
	const screens = [
		{ file: "h1-5-con-sesion.html", url: "/dataset/a", as: "editor" },
		{ file: "h1-7-publica.html", url: "/dataset/a" },
		{ file: "h1-6.html", url: "/dashboard/requests", as: "admin" },
	];
	// Sin sesión, la pública; con la sesión del editor, la suya.
	assert.equal(buildLinkMap(screens, ORIGIN)["/dataset/a"], "h1-7-publica.html");
	assert.equal(buildLinkMap(screens, ORIGIN, "editor")["/dataset/a"], "h1-5-con-sesion.html");
	// Otra cuenta sin artboard propio de esa dirección: la versión sin sesión.
	assert.equal(buildLinkMap(screens, ORIGIN, "admin")["/dataset/a"], "h1-7-publica.html");
	// Una dirección con un solo artboard lleva a él, se mire con la cuenta que se mire.
	assert.equal(buildLinkMap(screens, ORIGIN)["/dashboard/requests"], "h1-6.html");
	// Dos artboards de la misma dirección y la misma cuenta siguen siendo un error.
	assert.throws(
		() =>
			buildLinkMap([...screens, { file: "otro.html", url: "/dataset/a", as: "editor" }], ORIGIN),
		/\/dataset\/a apunta a dos artboards: h1-5-con-sesion\.html y otro\.html/,
	);
});
