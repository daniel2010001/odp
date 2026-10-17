// El doble de `umss_chart_data` del playground: un servidor que todavía no existe en vivo, con la misma
// aritmética que el contrato le exige.
//
// Es un **doble de prueba**, no código de producto, y por eso vive en la ruta del playground y no en
// `$lib/charts/`: el día que la acción esté desplegada, este archivo se borra con el playground y nada del
// portal depende de él. Lo que sí es contrato —y por eso lo prueba `fake-api.test.ts`— es lo que devuelve:
// grupos ordenados por clave con el nulo al final, `truncated` en el tope de 500, `total_rows` con las
// filas de la tabla, la regla de L17 (en una columna de texto, una cadena vacía es «sin dato», igual que
// `NULLIF(btrim(col), '')`) y los dos errores que el publicador tiene que saber leer.
//
// Las dos formas de llamada del contrato quedan representadas: `preview` es la del editor
// (`{resource_id, config}`) y `createView` la escritura plana de la vista.

import type { ChartApi, ChartView } from "$lib/api/charts";
import {
	CHART_VIEW_TYPE,
	type ChartConfig,
	type ChartData,
	type ChartGroup,
	type ChartGroupKey,
	MAX_CHART_GROUPS,
	type NormalizedChartConfig,
	validateChartConfig,
} from "$lib/charts/contract";
import { CkanApiError } from "$lib/types/api";
import { type DemoTable, demoTable } from "./fixtures";

/** Qué hace el servidor en esta pasada: responder bien, rechazar la consulta o negar el permiso. */
export type FakeScenario = "ok" | "server-error" | "not-authorized";

export interface FakeChartApiOptions {
	/** La tabla del recurso. Por defecto, la muestra determinista de la demo. */
	table?: DemoTable;
	scenario?: FakeScenario;
}

/** Los cálculos de Y que necesitan una columna numérica. */
const NUMERIC_AGGS = new Set(["sum", "avg", "min", "max"]);

/** Una cadena vacía o de sólo espacios es «sin dato»: el `NULLIF(btrim(col), '')` del servidor (L17). */
function sinDato(value: unknown): boolean {
	return (
		value === null || value === undefined || (typeof value === "string" && value.trim() === "")
	);
}

/** `btrim`: el valor sin espacios en los bordes. */
function trim(value: unknown): string {
	return typeof value === "string" ? value.trim() : String(value);
}

function round2(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function numero(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string" || value.trim() === "") return null;
	const parsed = Number(value.trim());
	return Number.isFinite(parsed) ? parsed : null;
}

function fecha(value: unknown): Date | null {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value !== "string" || value.trim() === "") return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * La `key` cruda de una fila, tal como la devolvería el servidor: `value` el valor tal cual (en minúsculas
 * con `x_fold_case`), `number_step` el límite inferior del rango, las fechas en su forma compacta, y `null`
 * para las filas sin dato —que es también donde caen las cadenas vacías (L17).
 */
function keyOf(row: Record<string, unknown>, config: NormalizedChartConfig): ChartGroupKey {
	const raw = row[config.x_field];
	if (sinDato(raw)) return null;

	switch (config.x_bucket) {
		case "value": {
			if (config.x_fold_case && typeof raw === "string") return raw.trim().toLowerCase();
			return raw as ChartGroupKey;
		}
		case "number_step": {
			const n = numero(raw);
			if (n === null) return null;
			const step = config.x_step ?? 1;
			// Redondeo a diez decimales: `floor` con pasos fraccionarios arrastra el error del punto flotante.
			return Math.round(Math.floor(n / step) * step * 1e10) / 1e10;
		}
		case "year": {
			const d = fecha(raw);
			return d ? String(d.getUTCFullYear()) : null;
		}
		case "quarter": {
			const d = fecha(raw);
			if (!d) return null;
			return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
		}
		case "month": {
			const d = fecha(raw);
			if (!d) return null;
			return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
		}
		default:
			return null;
	}
}

/** El valor de Y de una fila: el número que entra en el cálculo, o `null` si la fila no aporta. */
function measureOf(row: Record<string, unknown>, config: NormalizedChartConfig): number | null {
	if (config.y_agg === "count") return 1;
	if (!config.y_field) return null;
	const raw = row[config.y_field];
	if (sinDato(raw)) return null;
	if (config.y_agg === "count_distinct") return 1;
	if (!NUMERIC_AGGS.has(config.y_agg)) return null;
	return numero(raw);
}

/** La `key` que cuenta para «contar distintos»: el valor sin espacios; `null` no es un valor (L17). */
function distinctKeyOf(row: Record<string, unknown>, config: NormalizedChartConfig): string | null {
	if (!config.y_field) return null;
	const raw = row[config.y_field];
	if (sinDato(raw)) return null;
	return trim(raw);
}

/**
 * Compara claves crudas: números por valor, texto por punto de código y el nulo siempre al final.
 *
 * El orden del texto lo fija la base que agrupa, y el contrato pide «por `key` ascendente» sin nombrar
 * colación: acá se usa el orden de punto de código (la colación «C» de Postgres), que es determinista y no
 * depende del idioma del proceso. El portal no decide el orden: dibuja los grupos como llegan.
 */
function compareKeys(a: ChartGroupKey, b: ChartGroupKey): number {
	if (a === null) return b === null ? 0 : 1;
	if (b === null) return -1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	const left = String(a);
	const right = String(b);
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

function aggregate(table: DemoTable, config: NormalizedChartConfig): ChartData {
	interface Bucket {
		count: number;
		sum: number;
		min: number | null;
		max: number | null;
		distinct: Set<string>;
	}

	const buckets = new Map<ChartGroupKey, Bucket>();
	for (const row of table.records) {
		const key = keyOf(row, config);
		if (key === null && config.include_null === false) continue;

		let bucket = buckets.get(key);
		if (!bucket) {
			bucket = { count: 0, sum: 0, min: null, max: null, distinct: new Set() };
			buckets.set(key, bucket);
		}

		bucket.count += 1;
		const distinct = distinctKeyOf(row, config);
		if (distinct !== null) bucket.distinct.add(distinct);

		const measure = measureOf(row, config);
		if (measure !== null) {
			bucket.sum += measure;
			bucket.min = bucket.min === null ? measure : Math.min(bucket.min, measure);
			bucket.max = bucket.max === null ? measure : Math.max(bucket.max, measure);
		}
	}

	const groups: ChartGroup[] = [];
	for (const [key, bucket] of buckets) {
		groups.push({ key, value: aggregateValueOf(bucket, config) });
	}
	groups.sort((a, b) => compareKeys(a.key, b.key));

	const truncated = groups.length > MAX_CHART_GROUPS;
	return {
		version: config.version,
		config,
		groups: truncated ? groups.slice(0, MAX_CHART_GROUPS) : groups,
		truncated,
		total_rows: table.total,
	};
}

function aggregateValueOf(
	bucket: {
		count: number;
		sum: number;
		min: number | null;
		max: number | null;
		distinct: Set<string>;
	},
	config: NormalizedChartConfig,
): number {
	switch (config.y_agg) {
		case "count":
			return bucket.count;
		case "count_distinct":
			return bucket.distinct.size;
		case "sum":
			return round2(bucket.sum);
		case "avg":
			return bucket.count === 0 ? 0 : round2(bucket.sum / bucket.count);
		case "min":
			return bucket.min ?? 0;
		case "max":
			return bucket.max ?? 0;
		default:
			return 0;
	}
}

function validationError(errors: Record<string, string>): CkanApiError {
	return new CkanApiError("Validation Error", 409, "Validation Error", {
		__type: "Validation Error",
		message: "Bad request",
		...Object.fromEntries(Object.entries(errors).map(([key, message]) => [key, [message]])),
	});
}

function notAuthorized(): CkanApiError {
	return new CkanApiError("Not authorized to update resource", 403, "Authorization Error", {
		__type: "Authorization Error",
		message: "Not authorized to update resource",
	});
}

/** Valida como el servidor y devuelve la configuración normalizada, o lanza el error con la clave culpable. */
function normalizedOrThrow(config: unknown, table: DemoTable): NormalizedChartConfig {
	const result = validateChartConfig(config, table.fields);
	if (!result.valid || !result.config)
		throw validationError(result.errors as Record<string, string>);
	return result.config;
}

export function createFakeChartApi({
	table = demoTable(),
	scenario = "ok",
}: FakeChartApiOptions = {}): Pick<ChartApi, "preview" | "createView"> {
	return {
		async preview(_resourceId: string, config: ChartConfig): Promise<ChartData> {
			if (scenario === "not-authorized") throw notAuthorized();
			if (scenario === "server-error") {
				// El caso del contrato que no depende de la configuración: la consulta venció el tope de tiempo
				// (`statement_timeout`), que llega como `ValidationError` con la clave `query`.
				throw validationError({
					query: "La consulta superó el tiempo máximo de espera. Intente con menos datos.",
				});
			}
			return aggregate(table, normalizedOrThrow(config, table));
		},

		async createView(
			resourceId: string,
			title: string,
			description: string,
			config: ChartConfig,
		): Promise<ChartView> {
			if (scenario === "not-authorized") throw notAuthorized();
			const normalized = normalizedOrThrow(config, table);
			return {
				id: `vista-demo-${resourceId}`,
				resource_id: resourceId,
				view_type: CHART_VIEW_TYPE,
				title,
				description,
				config: normalized,
			};
		},
	};
}

/** Lo que el playground necesita del cliente: el doble no habla con nadie. */
export type FakeChartProxy = ReturnType<typeof createFakeChartApi>;
