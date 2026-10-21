// Test de los gráficos que siembra `seed-ckan.mjs` (sin tocar ningún CKAN).
//
//   node --test scripts/seed-charts.test.mjs
//
// Protege S7 de odd/tasks/demo-honest-data.md: cada CSV de la demo trae 2–3 vistas `umss_chart` cuya
// configuración cumple las reglas del contrato (`src/lib/charts/contract.ts`) sobre las columnas y los
// tipos de su generador, y la siembra es idempotente por título.

import assert from "node:assert/strict";
import { test } from "node:test";

import { PROFILES } from "./generate-demo-files.mjs";
import {
	CHART_VIEWS,
	chartViewPayload,
	FILE_CHART_VIEWS,
	validateSeedConfig,
	viewsToCreate,
} from "./seed-charts.mjs";
import { buildMoreDatasets, DEMOS } from "./seed-ckan.mjs";

const viewsOf = (demo) => CHART_VIEWS[demo.dataset.name] ?? [];

test("cada CSV de DEMOS trae 2 o 3 vistas, con títulos claros y distintos", () => {
	const tabular = DEMOS.filter((demo) => demo.types);
	assert.equal(tabular.length, 4);
	for (const demo of tabular) {
		const views = viewsOf(demo);
		assert.ok(views.length >= 2 && views.length <= 3, `${demo.dataset.name}: ${views.length}`);
		const titles = views.map((view) => view.title);
		assert.equal(new Set(titles).size, titles.length, demo.dataset.name);
		for (const title of titles) assert.ok(title.length >= 10 && title.length <= 120, title);
	}
});

test("no hay vistas para datasets que no están en DEMOS", () => {
	const names = new Set(DEMOS.map((demo) => demo.dataset.name));
	for (const name of Object.keys(CHART_VIEWS)) assert.ok(names.has(name), name);
});

test("entre todas las vistas hay barras, líneas y tortas", () => {
	const kinds = new Set(
		Object.values(CHART_VIEWS).flatMap((v) => v.map((x) => x.config.chart_type)),
	);
	assert.deepEqual([...kinds].sort(), ["bar", "line", "pie"]);
});

test("cada configuración cumple el contrato sobre los tipos de su generador", () => {
	for (const demo of DEMOS.filter((d) => d.types)) {
		for (const view of viewsOf(demo)) {
			assert.deepEqual(
				validateSeedConfig(view.config, demo.types),
				{},
				`${demo.dataset.name} → ${view.title}`,
			);
		}
	}
});

test("el validador espejo rechaza lo que el servidor rechaza", () => {
	const types = { cat: "text", n: "numeric", d: "timestamp" };
	const ok = { version: 1, chart_type: "bar", x_field: "cat", x_bucket: "value", y_agg: "count" };
	assert.deepEqual(validateSeedConfig(ok, types), {});
	assert.ok(validateSeedConfig({ ...ok, y_agg: "sum", y_field: "cat" }, types).y_field);
	assert.ok(validateSeedConfig({ ...ok, y_agg: "sum" }, types).y_field);
	assert.ok(validateSeedConfig({ ...ok, y_field: "n" }, types).y_field);
	assert.ok(validateSeedConfig({ ...ok, x_bucket: "month" }, types).x_bucket);
	assert.ok(validateSeedConfig({ ...ok, x_bucket: "number_step" }, types).x_bucket);
	assert.ok(validateSeedConfig({ ...ok, x_field: "nada" }, types).x_field);
	assert.ok(validateSeedConfig({ ...ok, x_field: "_id" }, types).x_field);
	assert.ok(validateSeedConfig({ ...ok, chart_type: "radar" }, types).chart_type);
	assert.ok(validateSeedConfig({ ...ok, version: 2 }, types).version);
	assert.ok(validateSeedConfig({ ...ok, x_step: 5 }, types).x_step);
	assert.ok(validateSeedConfig({ ...ok, x_bucket: "number_step", x_field: "n" }, types).x_step);
	assert.ok(validateSeedConfig({ ...ok, x_fold_case: true, x_field: "n" }, types).x_fold_case);
	assert.deepEqual(
		validateSeedConfig(
			{ ...ok, x_field: "d", x_bucket: "year", y_agg: "avg", y_field: "n" },
			types,
		),
		{},
	);
});

test("el payload es plano, con view_type umss_chart y sin credenciales", () => {
	const [view] = CHART_VIEWS["matricula-facultad-gestion-ficticia"];
	const payload = chartViewPayload("res-1", view);
	assert.equal(payload.resource_id, "res-1");
	assert.equal(payload.view_type, "umss_chart");
	assert.equal(payload.title, view.title);
	assert.equal(typeof payload.description, "string");
	for (const key of ["version", "chart_type", "x_field", "x_bucket", "y_agg"]) {
		assert.equal(payload[key], view.config[key], key);
	}
	assert.equal(payload.config, undefined);
	assert.equal(/token|authorization/i.test(JSON.stringify(payload)), false);
});

test("viewsToCreate: crea sólo los títulos que faltan, sin repetir los existentes", () => {
	const desired = [{ title: "A" }, { title: "B" }, { title: "C" }];
	assert.deepEqual(viewsToCreate(desired, []), desired);
	assert.deepEqual(viewsToCreate(desired, [{ title: "B" }]), [{ title: "A" }, { title: "C" }]);
	assert.deepEqual(viewsToCreate(desired, [{ title: "A" }, { title: "B" }, { title: "C" }]), []);
	// El título es la clave: se compara recortado y distinguiendo mayúsculas.
	assert.deepEqual(viewsToCreate(desired, [{ title: "  B " }]), [{ title: "A" }, { title: "C" }]);
	assert.deepEqual(viewsToCreate(desired, [{ title: "b" }]), desired);
	assert.deepEqual(viewsToCreate(desired, [{ title: "Otra" }]), desired);
});

// S52 de odd/tasks/v0.1.1-polish.md: los datasets adicionales (S18) con un CSV traen gráficos por defecto.
// xloader carga todo como texto y estos CSV no se tipan, así que sólo se cuenta y se agrupa por valor.
const csvOf = (ds) => ds.resources.find((resource) => resource.format === "CSV");
const withCsv = buildMoreDatasets().filter(csvOf);

test("S52: los datasets adicionales con un CSV tienen 1 o 2 gráficos, y sólo ésos", () => {
	assert.ok(withCsv.length > 0);
	assert.deepEqual(Object.keys(FILE_CHART_VIEWS).sort(), withCsv.map((ds) => ds.name).sort());
	for (const ds of withCsv) {
		const views = FILE_CHART_VIEWS[ds.name];
		assert.ok(views.length >= 1 && views.length <= 2, `${ds.name}: ${views.length}`);
		const titles = views.map((view) => view.title);
		assert.equal(new Set(titles).size, titles.length, ds.name);
		for (const title of titles) assert.ok(title.length >= 10 && title.length <= 120, title);
	}
});

test("S52: cada gráfico adicional usa columnas reales del CSV y cumple el contrato", () => {
	for (const ds of withCsv) {
		const types = Object.fromEntries(PROFILES[ds.name].columns.map(([name]) => [name, "text"]));
		for (const view of FILE_CHART_VIEWS[ds.name]) {
			assert.deepEqual(validateSeedConfig(view.config, types), {}, `${ds.name} → ${view.title}`);
			assert.equal(view.config.y_agg, "count", "sin tipos numéricos, sólo se cuenta");
		}
	}
});
