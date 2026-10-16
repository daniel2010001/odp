// Qué columnas de una tabla del DataStore sirven para graficar.
//
// `datastore_search` devuelve `fields[].type`, pero ese tipo no es de fiar: según cómo se cargó el
// archivo, una columna de números puede venir como `text`. Por eso una columna es numérica si su tipo
// lo declara **o** si todos sus valores no vacíos se leen como número.

import type { DatastoreField } from "$lib/api/datastore";

const ID_COLUMN = "_id";

// Tipos numéricos de PostgreSQL / DataStore. `numeric` es el que infiere el cargador; el resto son
// los alias que CKAN acepta al definir la tabla a mano.
const NUMERIC_TYPES = new Set([
	"numeric",
	"int",
	"int2",
	"int4",
	"int8",
	"integer",
	"smallint",
	"bigint",
	"float",
	"float4",
	"float8",
	"double precision",
	"real",
]);

/** ¿El tipo declarado por el DataStore es numérico? (No dice nada de las columnas `text` con números.) */
export function isNumericType(type: string): boolean {
	return NUMERIC_TYPES.has(type);
}

const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Lee un valor de celda como número, o `null` si no lo es. Sólo acepta decimales con punto:
 * «1,5» es ambiguo (¿uno coma cinco o mil quinientos?) y se trata como texto.
 */
export function parseNumber(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string") return null;
	const text = value.trim();
	if (!DECIMAL.test(text)) return null;
	const n = Number(text);
	return Number.isFinite(n) ? n : null;
}

function isEmpty(value: unknown): boolean {
	return (
		value === null || value === undefined || (typeof value === "string" && value.trim() === "")
	);
}

/** Columnas que se ofrecen como eje Y, en el orden del recurso. */
export function numericColumns(
	fields: readonly DatastoreField[],
	records: readonly Record<string, unknown>[],
): string[] {
	return fields
		.filter((f) => f.id !== ID_COLUMN)
		.filter((f) => {
			if (isNumericType(f.type)) return true;
			if (f.type !== "text") return false;
			const filled = records.map((r) => r[f.id]).filter((v) => !isEmpty(v));
			return filled.length > 0 && filled.every((v) => parseNumber(v) !== null);
		})
		.map((f) => f.id);
}

/** Columnas que se ofrecen como eje X: todas menos el identificador interno. */
export function eligibleXColumns(fields: readonly DatastoreField[]): string[] {
	return fields.filter((f) => f.id !== ID_COLUMN).map((f) => f.id);
}
