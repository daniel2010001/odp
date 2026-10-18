// Test de los datos que siembra `seed-ckan.mjs` (sin tocar ningún CKAN).
//
//   node --test scripts/seed-ckan.test.mjs
//
// Protege S4 de odd/tasks/demo-honest-data.md: todo recurso sembrado es un archivo real —sin URL
// falsa ni tamaño inventado— cuyos bytes coinciden con su formato declarado.

import assert from "node:assert/strict";
import { test } from "node:test";

import { PROFILES } from "./generate-demo-files.mjs";
import { buildBaseDatasets, DEMOS, SHOWCASE } from "./seed-ckan.mjs";

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
