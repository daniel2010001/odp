// Test de los datos que siembra `seed-ckan.mjs` (sin tocar ningún CKAN).
//
//   node --test scripts/seed-ckan.test.mjs
//
// Protege S4 de odd/tasks/demo-honest-data.md: todo recurso sembrado es un archivo real —sin URL
// falsa ni tamaño inventado— cuyos bytes coinciden con su formato declarado.

import assert from "node:assert/strict";
import { test } from "node:test";

import { PROFILES } from "./generate-demo-files.mjs";
import {
	buildBaseDatasets,
	DEMOS,
	readJson,
	SHOWCASE,
	sessionHeaders,
	uploadForm,
} from "./seed-ckan.mjs";

const datasets = [...buildBaseDatasets(), SHOWCASE];
const resources = datasets.flatMap((ds) => ds.resources.map((resource) => ({ ds, resource })));

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
	const ext = { CSV: "csv", XLSX: "xlsx", PDF: "pdf", JSON: "json", GeoJSON: "geojson" };
	for (const { resource } of resources) {
		assert.ok(PROFILES[resource.profile], resource.name);
		assert.ok(resource.filename.endsWith(`.${ext[resource.format]}`), resource.filename);
		assert.match(resource.mime, /^(text|application)\//);
	}
});

test("los bytes de cada recurso coinciden con su formato y son deterministas", () => {
	const magic = {
		PDF: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
		XLSX: (b) => b.subarray(0, 4).toString("latin1") === "PK\x03\x04",
		JSON: (b) => Array.isArray(JSON.parse(b.toString("utf8"))),
		GeoJSON: (b) => JSON.parse(b.toString("utf8")).type === "FeatureCollection",
		CSV: (b) => b.toString("utf8").split("\n")[0].includes(","),
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
