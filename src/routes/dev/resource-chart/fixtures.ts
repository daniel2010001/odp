// Fixtures con la forma exacta de `datastore_search` (`DatastoreSearchResult`).
//
// MEDICIÓN (2026-10-16): ninguno de los 17 conjuntos del catálogo sembrado tiene `datastore_active`
// (todo `datastore_search` anónimo responde «Resource not found»), así que no hay tipos reales que
// copiar. Las formas de abajo salen del comportamiento documentado del cargador de CKAN: el
// DataPusher infiere `numeric`/`timestamp`/`text`; xloader carga todo como `text` salvo que el
// diccionario de datos diga otra cosa. Se cubren ambas, y la columna «text» con números es la
// razón por la que el selector parsea valores en vez de confiar en el tipo.

import type { DatastoreSearchResult } from "$lib/api/datastore";

const MUNICIPIOS = ["Cochabamba", "Sacaba", "Quillacollo", "Tiquipaya", "Vinto", "Colcapirhua"];

/** Tipos inferidos: `numeric` donde hay números, `text` donde no. Se repite el municipio por año. */
export function numericTable(rows = 18): DatastoreSearchResult {
	const records = Array.from({ length: rows }, (_, i) => ({
		_id: i + 1,
		municipio: MUNICIPIOS[i % MUNICIPIOS.length],
		anio: String(2019 + Math.floor(i / MUNICIPIOS.length)),
		vehiculos: 20000 + ((i * 7919) % 160000),
		tasa: i % 7 === 3 ? null : Math.round(((i * 37) % 100) * 10) / 10,
		// Cargada como texto por xloader: sólo parsear los valores revela que es numérica.
		accidentes: i % 5 === 4 ? "" : String(10 + ((i * 13) % 90)),
	}));
	return {
		fields: [
			{ id: "_id", type: "int" },
			{ id: "municipio", type: "text" },
			{ id: "anio", type: "text" },
			{ id: "vehiculos", type: "numeric" },
			{ id: "tasa", type: "numeric" },
			{ id: "accidentes", type: "text" },
		],
		records,
		total: rows,
	};
}

/** Un CSV de puro texto: no hay nada que graficar. */
export function textOnlyTable(): DatastoreSearchResult {
	return {
		fields: [
			{ id: "_id", type: "int" },
			{ id: "carrera", type: "text" },
			{ id: "responsable", type: "text" },
			{ id: "observacion", type: "text" },
		],
		records: [
			{ _id: 1, carrera: "Ingeniería Civil", responsable: "M. Rojas", observacion: "En revisión" },
			{ _id: 2, carrera: "Medicina", responsable: "L. Flores", observacion: "" },
			{ _id: 3, carrera: "Derecho", responsable: "P. Vargas", observacion: "Aprobada" },
		],
		total: 3,
	};
}

/** Muchas filas: 500 puntos (y un `total` mayor, como una tabla real paginada). */
export function manyRows(rows = 500, total = 12480): DatastoreSearchResult {
	const records = Array.from({ length: rows }, (_, i) => ({
		_id: i + 1,
		punto: `P-${String(i + 1).padStart(4, "0")}`,
		flujo: Math.round(1000 + 800 * Math.sin(i / 17) + ((i * 7919) % 400)),
	}));
	return {
		fields: [
			{ id: "_id", type: "int" },
			{ id: "punto", type: "text" },
			{ id: "flujo", type: "numeric" },
		],
		records,
		total,
	};
}
