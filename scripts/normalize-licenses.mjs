#!/usr/bin/env node
// Normaliza «sin licencia» a `notspecified` en un catálogo CKAN (odp, v0.1.1 T24 / S23).
//
// Un dataset con `license_id` vacío o ausente no cae en ningún bucket de la faceta de licencias,
// así que no se puede filtrar en el buscador. El portal ya escribe `notspecified` al crear y al
// editar; este script migra los que quedaron vacíos.
//
// Uso (DRY-RUN por defecto: sólo imprime lo que cambiaría):
//   CKAN_URL=http://localhost:5000 \
//   CKAN_API_TOKEN=... \
//   node scripts/normalize-licenses.mjs
//
// Para escribir, agregue `--apply`:
//   CKAN_URL=... CKAN_API_TOKEN=... node scripts/normalize-licenses.mjs --apply
//
// - El token sale de `CKAN_API_TOKEN` y nunca se imprime. Para ver privados y borradores de toda
//   la instalación debe ser de un sysadmin.
// - Busca con `fq=-license_id:[* TO *]` (`include_private` e `include_drafts`) y vuelve a
//   comprobar cada resultado: sólo parchea (`package_patch`, una sola clave) los que de verdad no
//   tienen licencia. Un dataset con licencia —`notspecified` incluido— no se toca jamás.
// - Idempotente: tras `--apply`, una segunda corrida no encuentra nada.
// - Sale con código 1 si algún parche falla.

import { pathToFileURL } from "node:url";

const NO_LICENSE_ID = "notspecified";
const PAGE_SIZE = 100;

export function parseArgs(argv) {
	return { apply: argv.includes("--apply") };
}

async function call(fetchImpl, { url, token }, action, data) {
	const res = await fetchImpl(`${url}/api/3/action/${action}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: token },
		body: JSON.stringify(data),
	});
	const json = await res.json().catch(() => null);
	if (!json?.success) {
		const detail = json?.error?.message ?? `HTTP ${res.status}`;
		throw new Error(`${action}: ${detail}`);
	}
	return json.result;
}

/** Todos los datasets sin licencia, paginando (se junta todo antes de parchear: parchear los saca de la búsqueda). */
async function findUnlicensed(fetchImpl, config) {
	const found = [];
	for (let start = 0; ; start += PAGE_SIZE) {
		const page = await call(fetchImpl, config, "package_search", {
			fq: "-license_id:[* TO *]",
			rows: PAGE_SIZE,
			start,
			include_private: true,
			include_drafts: true,
		});
		found.push(...page.results);
		if (page.results.length === 0 || start + PAGE_SIZE >= page.count) break;
	}
	return found.filter((dataset) => !dataset.license_id);
}

export async function normalizeLicenses({
	url,
	token,
	apply = false,
	fetchImpl = fetch,
	log = console.log,
}) {
	const config = { url: url.replace(/\/+$/, ""), token };
	const datasets = await findUnlicensed(fetchImpl, config);
	log(`${datasets.length} dataset(s) sin licencia.`);
	let patched = 0;
	let failed = 0;
	for (const dataset of datasets) {
		const label = `${dataset.name ?? dataset.id} (${dataset.id})`;
		if (!apply) {
			log(`  [dry-run] ${label}: license_id → ${NO_LICENSE_ID}`);
			continue;
		}
		try {
			await call(fetchImpl, config, "package_patch", {
				id: dataset.id,
				license_id: NO_LICENSE_ID,
			});
			patched += 1;
			log(`  ${label}: license_id → ${NO_LICENSE_ID}`);
		} catch (err) {
			failed += 1;
			log(`  ${label}: error, falló el parche (${err.message})`);
		}
	}
	if (!apply && datasets.length > 0) {
		log("Dry-run: no se escribió nada. Agregue --apply para aplicar los cambios.");
	}
	return { found: datasets.length, patched, failed, applied: apply };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
	const token = process.env.CKAN_API_TOKEN?.trim();
	if (!token) {
		console.error("Falta CKAN_API_TOKEN (token de un sysadmin).");
		process.exit(1);
	}
	const url = process.env.CKAN_URL ?? "http://localhost:5000";
	const { apply } = parseArgs(process.argv.slice(2));
	console.log(`${apply ? "APLICAR" : "Dry-run"} → ${url}`);
	normalizeLicenses({ url, token, apply })
		.then((result) => {
			if (result.failed > 0) process.exit(1);
		})
		.catch((err) => {
			console.error("Abortado:", err.message);
			process.exit(1);
		});
}
