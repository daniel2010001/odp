// Test de los datos que siembra `seed-ckan.mjs` (sin tocar ningún CKAN).
//
//   node --test scripts/seed-ckan.test.mjs
//
// Protege S4 de odd/tasks/demo-honest-data.md: todo recurso sembrado es un archivo real —sin URL
// falsa ni tamaño inventado— cuyos bytes coinciden con su formato declarado.

import assert from "node:assert/strict";
import { test } from "node:test";

import { PROFILES } from "./generate-demo-files.mjs";
import { FILE_CHART_VIEWS } from "./seed-charts.mjs";
import {
	buildBaseDatasets,
	buildMoreDatasets,
	CHARTS_NOTE,
	DEMOS,
	MAX_SUMMARY_LENGTH,
	ORGS,
	readJson,
	SHOWCASE,
	SUMMARY_EXTRA_KEY,
	seedChartsLast,
	seedFileDataset,
	sessionHeaders,
	summaryWithChartsNote,
	uploadForm,
} from "./seed-ckan.mjs";

const datasets = [...buildBaseDatasets(), SHOWCASE];
const more = buildMoreDatasets();
const resources = [...datasets, ...more].flatMap((ds) =>
	ds.resources.map((resource) => ({ ds, resource })),
);

test("hay 15 datasets base más el Observatorio, y cada uno con recursos", () => {
	assert.equal(datasets.length, 16);
	for (const ds of datasets) assert.ok(ds.resources.length >= 1, ds.name);
});

test("ningún recurso trae URL ni tamaño inventados", () => {
	for (const { resource } of resources) {
		assert.equal(resource.url, undefined, resource.name);
		assert.equal(resource.size, undefined, resource.name);
	}
});

test("cada recurso tiene perfil, nombre de archivo con la extensión de su formato y MIME", () => {
	const ext = {
		CSV: "csv",
		XLSX: "xlsx",
		PDF: "pdf",
		JSON: "json",
		GeoJSON: "geojson",
		PNG: "png",
		JPG: "jpg",
		TXT: "txt",
	};
	for (const { resource } of resources) {
		assert.ok(PROFILES[resource.profile], resource.name);
		assert.ok(resource.filename.endsWith(`.${ext[resource.format]}`), resource.filename);
		assert.match(resource.mime, /^(text|application|image)\//);
	}
});

test("los bytes de cada recurso coinciden con su formato y son deterministas", () => {
	const magic = {
		PDF: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
		XLSX: (b) => b.subarray(0, 4).toString("latin1") === "PK\x03\x04",
		JSON: (b) => Array.isArray(JSON.parse(b.toString("utf8"))),
		GeoJSON: (b) => JSON.parse(b.toString("utf8")).type === "FeatureCollection",
		CSV: (b) => b.toString("utf8").split("\n")[0].includes(","),
		PNG: (b) => b.subarray(1, 4).toString("latin1") === "PNG",
		JPG: (b) => b[0] === 0xff && b[1] === 0xd8 && b.at(-2) === 0xff && b.at(-1) === 0xd9,
		TXT: (b) => b.toString("utf8").includes("Datos ficticios"),
	};
	for (const { resource } of resources) {
		const bytes = resource.bytes();
		assert.ok(bytes.length > 200, resource.name);
		assert.ok(magic[resource.format](bytes), `${resource.name} (${resource.format})`);
		assert.ok(bytes.equals(resource.bytes()), resource.name);
	}
});

test("nombres de recurso únicos dentro de cada dataset (la idempotencia los usa)", () => {
	for (const ds of datasets) {
		const names = ds.resources.map((r) => r.name);
		assert.equal(new Set(names).size, names.length, ds.name);
	}
});

test("la descripción de cada recurso y las notas del dataset dicen que son datos ficticios", () => {
	for (const { resource } of resources) assert.match(resource.description, /ficticios/);
	for (const ds of datasets) assert.match(ds.notes, /ficticios/);
});

test("los recursos de DEMOS siguen siendo subidas desde scripts/data con su ruta", () => {
	assert.equal(DEMOS.length, 5);
	for (const demo of DEMOS) assert.match(demo.resource.path, /scripts[\\/]data[\\/]/);
	assert.equal(DEMOS.filter((demo) => demo.types).length, 4);
});

// Una respuesta que no es JSON (una página de error HTML de CKAN o del proxy) se informa con su status,
// su URL y el comienzo del cuerpo, en vez del «Unexpected token '<'» del parseo (demo, 2026-10-18).
test("readJson informa status, URL y comienzo del cuerpo cuando la respuesta no es JSON", async () => {
	const html = new Response("<!DOCTYPE html><html><title>400 Bad Request</title></html>", {
		status: 400,
		headers: { "Content-Type": "text/html" },
	});
	Object.defineProperty(html, "url", { value: "https://ckan.test/api/3/action/api_token_create" });
	await assert.rejects(readJson(html, "api_token_create"), (error) => {
		assert.match(error.message, /^api_token_create: HTTP 400 /);
		assert.match(error.message, /https:\/\/ckan\.test\/api\/3\/action\/api_token_create/);
		assert.match(error.message, /<!DOCTYPE html><html><title>400 Bad Request/);
		return true;
	});
});

test("readJson devuelve el cuerpo parseado cuando la respuesta es JSON", async () => {
	const ok = new Response(JSON.stringify({ success: true, result: { token: "t" } }), {
		status: 200,
	});
	assert.deepEqual(await readJson(ok, "api_token_create"), {
		success: true,
		result: { token: "t" },
	});
});

// Por HTTPS, el chequeo CSRF de CKAN (Flask-WTF, SSL estricto) exige un `Referer` del mismo origen en las
// llamadas con cookie de sesión; sin él responde 400 «The referrer header is missing.» (log de la demo,
// 2026-10-18).
test("sessionHeaders manda el token CSRF, la cookie y un Referer del mismo origen que CKAN", () => {
	const headers = sessionHeaders("cookie=1", "csrf-1", "https://api.demo.odp.hs.lan");
	assert.equal(headers["X-CSRFToken"], "csrf-1");
	assert.equal(headers.Cookie, "cookie=1");
	assert.equal(headers["Content-Type"], "application/json");
	assert.equal(headers.Referer, "https://api.demo.odp.hs.lan/");
	assert.equal(new URL(headers.Referer).origin, "https://api.demo.odp.hs.lan");
});

// CKAN sólo adivina el `mimetype` por la extensión, y `.geojson` no la conoce: quedaba vacío, el archivo se
// servía como `application/octet-stream` y el iframe de la vista previa quedaba en blanco (demo, 2026-10-18).
// Con `mimetype` explícito, CKAN lo guarda (update.py:339) y lo usa como `Content-Type` (resource.py:202).
test("uploadForm declara el mimetype del formato, y el GeoJSON como application/geo+json", () => {
	const geo = [...buildBaseDatasets(), SHOWCASE]
		.flatMap((ds) => ds.resources)
		.find((resource) => resource.format === "GeoJSON");
	const form = uploadForm("pkg-1", geo, new Uint8Array([123, 125]));
	assert.equal(form.get("mimetype"), "application/geo+json");
	assert.equal(form.get("format"), "GeoJSON");
	assert.equal(form.get("package_id"), "pkg-1");
	assert.equal(form.get("upload").type, "application/geo+json");
});

test("uploadForm no declara mimetype para un recurso sin `mime` (los CSV de DEMOS siguen igual)", () => {
	const csv = DEMOS.find((demo) => demo.resource.format === "CSV").resource;
	const form = uploadForm("pkg-1", csv, new Uint8Array([97]));
	assert.equal(form.get("mimetype"), null);
	assert.equal(form.get("upload").type, "text/csv");
});

// ── S18 de odd/tasks/v0.1.1-polish.md: más datasets para probar el buscador y el paginado ──

const PAGE_SIZE = 20;
const existingNames = [...datasets, ...DEMOS.map((demo) => demo.dataset)].map((ds) => ds.name);

test("los datasets nuevos hacen que el catálogo sembrado llene al menos 3 páginas de 20", () => {
	assert.equal(more.length, 30);
	const total = existingNames.length + more.length;
	assert.equal(existingNames.length, 21);
	assert.ok(Math.ceil(total / PAGE_SIZE) >= 3, `${total} datasets`);
	assert.ok(total > 2 * PAGE_SIZE);
});

test("los nombres nuevos son válidos para CKAN y no chocan con ninguno existente ni entre sí", () => {
	const names = more.map((ds) => ds.name);
	assert.equal(new Set(names).size, names.length);
	for (const name of names) {
		assert.match(name, /^[a-z0-9_-]{2,100}$/);
		assert.ok(!existingNames.includes(name), name);
	}
	const titles = [...datasets, ...more].map((ds) => ds.title);
	assert.equal(new Set(titles).size, titles.length);
});

test("los nuevos se reparten por todas las organizaciones, etiquetas, licencias y formatos", () => {
	const orgs = new Map();
	for (const ds of more) orgs.set(ds.owner_org_name, (orgs.get(ds.owner_org_name) ?? 0) + 1);
	assert.deepEqual([...orgs.keys()].sort(), ORGS.map((o) => o.name).sort());
	for (const count of orgs.values()) assert.ok(count >= 5);
	assert.ok(new Set(more.flatMap((ds) => ds.tags.map((t) => t.name))).size >= 20);
	for (const ds of more) assert.ok(ds.tags.length >= 2, ds.name);
	assert.ok(new Set(more.map((ds) => ds.license_id)).size >= 5);
	const formats = new Set(more.flatMap((ds) => ds.resources.map((r) => r.format)));
	assert.deepEqual(
		[...formats].sort(),
		["CSV", "GeoJSON", "JPG", "JSON", "PDF", "PNG", "TXT", "XLSX"].sort(),
	);
});

test("todo tipo de vista previa del portal (tabla, PDF, imagen, texto) tiene una muestra subida", () => {
	const formats = new Set(resources.map(({ resource }) => resource.format));
	for (const needed of ["CSV", "XLSX", "PDF", "PNG", "JPG", "TXT", "JSON"]) {
		assert.ok(formats.has(needed), needed);
	}
});

test("los datasets nuevos son datos ficticios, con título, descripción y un recurso como mínimo", () => {
	for (const ds of more) {
		assert.ok(ds.title.length > 10 && ds.notes.length > 80, ds.name);
		assert.ok(ds.resources.length >= 1, ds.name);
		const names = ds.resources.map((r) => r.name);
		assert.equal(new Set(names).size, names.length, ds.name);
	}
});

// S53 (mitad de la siembra) de odd/tasks/v0.1.1-polish.md: todo dataset sembrado trae su resumen, el texto
// corto de la tarjeta, en el extra que lee el portal (`SUMMARY_EXTRA_KEY`, src/lib/utils/dataset-summary.ts).
const summaryOf = (ds) => ds.extras?.find((extra) => extra.key === SUMMARY_EXTRA_KEY)?.value;
const everyDataset = [...datasets, ...more, ...DEMOS.map((demo) => demo.dataset)];

test("S53: la clave y el límite del resumen son los del portal", () => {
	assert.equal(SUMMARY_EXTRA_KEY, "summary");
	assert.equal(MAX_SUMMARY_LENGTH, 200);
});

test("S53: todo dataset sembrado trae un resumen de una oración, breve y en español formal", () => {
	assert.equal(everyDataset.length, 15 + 1 + 30 + 5);
	for (const ds of everyDataset) {
		const summary = summaryOf(ds);
		assert.equal(typeof summary, "string", ds.name);
		assert.ok(
			summary.length >= 20 && summary.length <= MAX_SUMMARY_LENGTH,
			`${ds.name}: ${summary.length}`,
		);
		assert.equal(summary, summary.trim(), ds.name);
		assert.match(summary, /[.]$/, `${ds.name}: termina en punto`);
		assert.equal(summary.slice(0, -1).includes(". "), false, `${ds.name}: una sola oración`);
		assert.equal(/\b(vos|tenés|podés|mirá|descargá)\b/i.test(summary), false, ds.name);
		assert.equal(ds.extras.filter((extra) => extra.key === SUMMARY_EXTRA_KEY).length, 1, ds.name);
	}
});

test("S53: un resumen no promete datos reales", () => {
	for (const ds of everyDataset)
		assert.match(summaryOf(ds), /fictici|muestra|demostración/i, ds.name);
});

// CKAN falso en memoria: package_show / package_create / resource_create / publicación.
function fakeCkan(initial = [], tableFields = []) {
	const patches = [];
	const views = new Map();
	const packages = new Map(initial.map((pkg) => [pkg.name, pkg]));
	const calls = [];
	const json = (body) => new Response(JSON.stringify(body), { status: 200 });
	const handler = async (url, init) => {
		const action = String(url).split("/").pop();
		calls.push(action);
		if (action === "resource_create") {
			const form = init.body;
			const pkg = [...packages.values()].find((p) => p.id === form.get("package_id"));
			const resource = { id: `r${calls.length}`, name: form.get("name"), url_type: "upload" };
			pkg.resources.push(resource);
			return json({ success: true, result: resource });
		}
		const data = JSON.parse(init.body);
		if (action === "package_show") {
			const pkg = packages.get(data.id) ?? [...packages.values()].find((p) => p.id === data.id);
			return json(pkg ? { success: true, result: pkg } : { success: false, error: {} });
		}
		if (action === "package_create") {
			const pkg = { ...data, id: `p${packages.size}`, state: "active", resources: [] };
			packages.set(pkg.name, pkg);
			return json({ success: true, result: pkg });
		}
		if (action === "package_patch") {
			const pkg = packages.get(data.id) ?? [...packages.values()].find((p) => p.id === data.id);
			Object.assign(pkg, data, { id: pkg.id });
			patches.push(data);
			return json({ success: true, result: pkg });
		}
		if (action === "resource_show")
			return json({ success: true, result: { datastore_active: true } });
		if (action === "datastore_search")
			return json({
				success: true,
				result: { fields: tableFields.map((id) => ({ id, type: "text" })) },
			});
		if (action === "resource_view_list")
			return json({ success: true, result: views.get(data.id) ?? [] });
		if (action === "resource_view_create") {
			views.set(data.resource_id, [...(views.get(data.resource_id) ?? []), { title: data.title }]);
			return json({ success: true, result: { id: `v${calls.length}` } });
		}
		if (action === "publication_request_list") return json({ success: true, result: [] });
		if (action === "publication_request_create")
			return json({ success: true, result: { id: "q1" } });
		if (action === "publication_request_decide") {
			for (const pkg of packages.values()) pkg.private = false;
			return json({ success: true, result: {} });
		}
		return json({ success: false, error: { message: action } });
	};
	return { packages, calls, handler, patches, views };
}

async function withFakeFetch(fake, run) {
	const realFetch = globalThis.fetch;
	const realLog = console.log;
	globalThis.fetch = fake.handler;
	console.log = () => {};
	try {
		return await run();
	} finally {
		globalThis.fetch = realFetch;
		console.log = realLog;
	}
}

test("sembrar un dataset nuevo lo crea, sube todos sus archivos y lo publica; repetirlo no hace nada", async () => {
	const ds = more[0];
	const orgs = new Map(ORGS.map((o) => [o.name, `org-${o.name}`]));
	const fake = fakeCkan();
	const first = await withFakeFetch(fake, () => seedFileDataset("t", orgs, ds));
	assert.equal(first.created, true);
	const pkg = fake.packages.get(ds.name);
	assert.equal(pkg.resources.length, ds.resources.length);
	assert.equal(pkg.private, false);
	assert.ok(pkg.resources.every((r) => r.url_type === "upload"));

	fake.calls.length = 0;
	const second = await withFakeFetch(fake, () => seedFileDataset("t", orgs, ds));
	assert.equal(second.created, false);
	assert.equal(second.skipped, true);
	assert.deepEqual(fake.calls, ["package_show"], "la segunda corrida sólo lee");
});

test("sembrar los 30 nuevos no toca un dataset existente de otro nombre", async () => {
	const orgs = new Map(ORGS.map((o) => [o.name, `org-${o.name}`]));
	const old = {
		id: "old-1",
		name: datasets[0].name,
		private: false,
		state: "active",
		resources: [{ id: "x", name: "intacto" }],
	};
	const before = JSON.stringify(old);
	const fake = fakeCkan([old]);
	await withFakeFetch(fake, async () => {
		for (const ds of more) await seedFileDataset("t", orgs, ds);
	});
	assert.equal(JSON.stringify(fake.packages.get(old.name)), before);
	assert.equal(fake.packages.size, 31);
});

test("S53: a un dataset existente sin resumen se le agrega, conservando sus otros extras", async () => {
	const ds = more[0];
	const orgs = new Map(ORGS.map((o) => [o.name, `org-${o.name}`]));
	const old = {
		id: "old-2",
		name: ds.name,
		private: false,
		state: "active",
		extras: [{ key: "otro", value: "x" }],
		resources: ds.resources.map((r, i) => ({ id: `x${i}`, name: r.name })),
	};
	const fake = fakeCkan([old]);
	await withFakeFetch(fake, () => seedFileDataset("t", orgs, ds));
	assert.equal(fake.patches.length, 1);
	assert.deepEqual(fake.patches[0].extras, [
		{ key: "otro", value: "x" },
		{ key: SUMMARY_EXTRA_KEY, value: summaryOf(ds) },
	]);
	fake.calls.length = 0;
	await withFakeFetch(fake, () => seedFileDataset("t", orgs, ds));
	assert.deepEqual(fake.calls, ["package_show"], "con resumen, la segunda corrida sólo lee");
});

test("S53: un resumen que el editor ya cambió no se pisa", async () => {
	const ds = more[0];
	const orgs = new Map(ORGS.map((o) => [o.name, `org-${o.name}`]));
	const mine = [{ key: SUMMARY_EXTRA_KEY, value: "Resumen propio." }];
	const old = {
		id: "old-3",
		name: ds.name,
		private: false,
		state: "active",
		extras: mine,
		resources: ds.resources.map((r, i) => ({ id: `x${i}`, name: r.name })),
	};
	const fake = fakeCkan([old]);
	await withFakeFetch(fake, () => seedFileDataset("t", orgs, ds));
	assert.deepEqual(fake.patches, []);
	assert.deepEqual(fake.packages.get(ds.name).extras, mine);
});

// S52 + S54: los gráficos se siembran al final y los datasets con gráficos se tocan en último lugar, para
// que «más recientes» (metadata_modified desc) los muestre primero.
const csvDataset = more.find((ds) => ds.resources.some((r) => r.format === "CSV"));
const plainDataset = more.find((ds) => !ds.resources.some((r) => r.format === "CSV"));

test("S52/S54: siembra los gráficos que faltan y toca al final sólo los datasets con gráficos", async () => {
	const orgs = new Map(ORGS.map((o) => [o.name, `org-${o.name}`]));
	const fake = fakeCkan(
		[],
		PROFILES[csvDataset.name].columns.map(([name]) => name),
	);
	await withFakeFetch(fake, async () => {
		await seedFileDataset("t", orgs, csvDataset);
		await seedFileDataset("t", orgs, plainDataset);
		fake.calls.length = 0;
		const result = await seedChartsLast("t", [csvDataset, plainDataset], []);
		assert.equal(result.failed, 0);
		assert.equal(result.created, FILE_CHART_VIEWS[csvDataset.name].length);
	});
	const created = fake.calls.filter((call) => call === "resource_view_create");
	assert.equal(created.length, FILE_CHART_VIEWS[csvDataset.name].length);
	const touches = fake.calls.filter((call) => call === "package_patch");
	assert.equal(touches.length, 1);
	assert.equal(fake.patches.at(-1).id, fake.packages.get(csvDataset.name).id);
	assert.ok(
		fake.calls.lastIndexOf(created.at(-1)) < fake.calls.indexOf(touches[0]),
		"toca después de crear",
	);
	assert.equal(fake.calls.at(-1), touches[0], "el toque es lo último que se hace");
	// El toque es un cambio de verdad (CKAN 2.12 no mueve `metadata_modified` con un patch idéntico): el
	// resumen pasa a anunciar los gráficos.
	const summary = fake.packages
		.get(csvDataset.name)
		.extras.find((extra) => extra.key === SUMMARY_EXTRA_KEY).value;
	assert.ok(summary.endsWith(CHARTS_NOTE), summary);
	assert.ok(summary.length <= MAX_SUMMARY_LENGTH);
	const plainSummary = fake.packages
		.get(plainDataset.name)
		.extras.find((extra) => extra.key === SUMMARY_EXTRA_KEY).value;
	assert.ok(!plainSummary.includes(CHARTS_NOTE), "sin gráficos, el resumen no los anuncia");

	// Segunda corrida: no duplica vistas.
	fake.calls.length = 0;
	const again = await withFakeFetch(fake, () =>
		seedChartsLast("t", [csvDataset, plainDataset], []),
	);
	assert.equal(again.created, 0);
	assert.equal(fake.calls.filter((call) => call === "resource_view_create").length, 0);
	assert.equal(
		fake.calls.filter((call) => call === "package_patch").length,
		0,
		"con el resumen ya anunciando los gráficos, la segunda corrida no escribe",
	);
	assert.equal(
		fake.views.get(fake.packages.get(csvDataset.name).resources[0].id).length,
		FILE_CHART_VIEWS[csvDataset.name].length,
	);
});

test("S54: el anuncio de los gráficos cabe en el tope del resumen y no se repite", () => {
	assert.equal(summaryWithChartsNote("Matrícula ficticia."), `Matrícula ficticia. ${CHARTS_NOTE}`);
	assert.equal(summaryWithChartsNote(`Ya está. ${CHARTS_NOTE}`), `Ya está. ${CHARTS_NOTE}`);
	assert.equal(summaryWithChartsNote(""), CHARTS_NOTE);
	const long = `${"palabra ".repeat(30).trim()}.`;
	const fitted = summaryWithChartsNote(long);
	assert.ok(fitted.length <= MAX_SUMMARY_LENGTH, String(fitted.length));
	assert.ok(fitted.endsWith(`… ${CHARTS_NOTE}`), fitted);
});
