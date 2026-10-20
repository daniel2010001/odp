// Test de `normalize-licenses.mjs` (sin tocar ningún CKAN: `fetch` es un doble).
//
//   node --test scripts/normalize-licenses.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeLicenses, parseArgs } from "./normalize-licenses.mjs";

/** CKAN falso: `package_search` devuelve los datasets sin licencia; registra los `package_patch`. */
function fakeCkan(datasets) {
	const calls = [];
	const fetchImpl = async (url, init) => {
		const action = url.split("/api/3/action/")[1];
		const body = JSON.parse(init.body);
		calls.push({ action, body, headers: init.headers });
		if (action === "package_search") {
			const start = body.start ?? 0;
			const rows = datasets.slice(start, start + body.rows);
			return Response.json({ success: true, result: { count: datasets.length, results: rows } });
		}
		if (action === "package_patch") {
			return Response.json({ success: true, result: { id: body.id } });
		}
		return Response.json({ success: false, error: { message: "acción inesperada" } });
	};
	return { calls, fetchImpl };
}

const config = { url: "http://ckan.test", token: "SECRETO-123", apply: false };
const logs = () => {
	const lines = [];
	return { lines, log: (line) => lines.push(line) };
};

test("parseArgs: dry-run por defecto, --apply escribe", () => {
	assert.equal(parseArgs([]).apply, false);
	assert.equal(parseArgs(["--apply"]).apply, true);
});

test("busca sólo los datasets sin licencia, con privados y borradores", async () => {
	const { calls, fetchImpl } = fakeCkan([]);
	await normalizeLicenses({ ...config, fetchImpl, log: () => {} });
	const search = calls.find((c) => c.action === "package_search");
	assert.equal(search.body.fq, "-license_id:[* TO *]");
	assert.equal(search.body.include_private, true);
	assert.equal(search.body.include_drafts, true);
});

test("dry-run lista lo que cambiaría y no escribe nada", async () => {
	const { calls, fetchImpl } = fakeCkan([
		{ id: "a1", name: "uno" },
		{ id: "b2", name: "dos", license_id: "" },
	]);
	const { lines, log } = logs();
	const result = await normalizeLicenses({ ...config, fetchImpl, log });
	assert.equal(calls.filter((c) => c.action === "package_patch").length, 0);
	assert.deepEqual(result, { found: 2, patched: 0, failed: 0, applied: false });
	assert.ok(lines.some((l) => l.includes("uno")) && lines.some((l) => l.includes("dos")));
	assert.ok(lines.some((l) => /dry-run/i.test(l)));
});

test("--apply parchea license_id=notspecified en cada uno", async () => {
	const { calls, fetchImpl } = fakeCkan([
		{ id: "a1", name: "uno" },
		{ id: "b2", name: "dos", license_id: "" },
	]);
	const result = await normalizeLicenses({ ...config, apply: true, fetchImpl, log: () => {} });
	const patches = calls.filter((c) => c.action === "package_patch");
	assert.deepEqual(
		patches.map((p) => p.body),
		[
			{ id: "a1", license_id: "notspecified" },
			{ id: "b2", license_id: "notspecified" },
		],
	);
	assert.deepEqual(result, { found: 2, patched: 2, failed: 0, applied: true });
});

test("nunca toca un dataset que ya tiene licencia, aunque la búsqueda lo devuelva", async () => {
	const { calls, fetchImpl } = fakeCkan([
		{ id: "a1", name: "uno", license_id: "cc-by" },
		{ id: "b2", name: "dos", license_id: "notspecified" },
		{ id: "c3", name: "tres" },
	]);
	const result = await normalizeLicenses({ ...config, apply: true, fetchImpl, log: () => {} });
	const patches = calls.filter((c) => c.action === "package_patch");
	assert.deepEqual(
		patches.map((p) => p.body.id),
		["c3"],
	);
	assert.equal(result.found, 1);
});

test("es idempotente: sin datasets vacíos no escribe nada", async () => {
	const { calls, fetchImpl } = fakeCkan([]);
	const result = await normalizeLicenses({ ...config, apply: true, fetchImpl, log: () => {} });
	assert.equal(calls.filter((c) => c.action === "package_patch").length, 0);
	assert.deepEqual(result, { found: 0, patched: 0, failed: 0, applied: true });
});

test("pagina la búsqueda hasta agotar el conteo", async () => {
	const many = Array.from({ length: 250 }, (_, i) => ({ id: `id${i}`, name: `d${i}` }));
	const { calls, fetchImpl } = fakeCkan(many);
	const result = await normalizeLicenses({ ...config, fetchImpl, log: () => {} });
	assert.equal(result.found, 250);
	assert.ok(calls.filter((c) => c.action === "package_search").length >= 3);
});

test("manda el token por Authorization y nunca lo imprime", async () => {
	const { calls, fetchImpl } = fakeCkan([{ id: "a1", name: "uno" }]);
	const { lines, log } = logs();
	await normalizeLicenses({ ...config, apply: true, fetchImpl, log });
	assert.ok(calls.every((c) => c.headers.Authorization === "SECRETO-123"));
	assert.ok(lines.every((l) => !l.includes("SECRETO-123")));
});

test("un package_patch fallido se informa y no oculta el resto", async () => {
	const fetchImpl = async (url, init) => {
		const action = url.split("/api/3/action/")[1];
		const body = JSON.parse(init.body);
		if (action === "package_search") {
			return Response.json({
				success: true,
				result: {
					count: 2,
					results: [
						{ id: "a1", name: "uno" },
						{ id: "b2", name: "dos" },
					],
				},
			});
		}
		if (body.id === "a1") return Response.json({ success: false, error: { message: "no" } });
		return Response.json({ success: true, result: {} });
	};
	const { lines, log } = logs();
	const result = await normalizeLicenses({ ...config, apply: true, fetchImpl, log });
	assert.equal(result.patched, 1);
	assert.equal(result.failed, 1);
	assert.ok(lines.some((l) => l.includes("uno") && /error|falló/i.test(l)));
});
