// El doble de `umss_chart_data` que usa el playground. No es código de producto: es el servidor que todavía
// no existe en vivo, con la misma aritmética que el contrato le exige.
//
// Lo que estos tests fijan no es «que el doble funcione», es que el formulario se pueda revisar contra la
// respuesta **del contrato**: los grupos ordenados con el nulo al final, el tope de 500, `total_rows` con
// las filas de la tabla y no con las agrupadas, la regla de L17 —en una columna de texto, una cadena vacía
// es «sin dato»: cae en el grupo nulo y no cuenta como valor distinto— y los dos errores que el publicador
// tiene que saber leer (`ValidationError` con clave culpable y `NotAuthorized`).

import { describe, expect, it } from "vitest";
import type { ChartConfig, ChartData } from "$lib/charts/contract";
import { MAX_CHART_GROUPS } from "$lib/charts/contract";
import { CkanApiError } from "$lib/types/api";
import { createFakeChartApi, type FakeScenario } from "./fake-api";
import { type DemoTable, demoTable } from "./fixtures";

const TABLE = demoTable();

function api(options: { table?: DemoTable; scenario?: FakeScenario } = {}) {
	return createFakeChartApi({ table: TABLE, ...options });
}

async function preview(
	config: ChartConfig,
	options: { table?: DemoTable; scenario?: FakeScenario } = {},
) {
	return api(options).preview("recurso-demo", config);
}

/** Cuenta filas por `turno`. */
const COUNT_BY_SHIFT: ChartConfig = {
	version: 1,
	chart_type: "bar",
	x_field: "turno",
	x_bucket: "value",
	y_agg: "count",
};

const isBlank = (value: unknown) =>
	value === null || value === undefined || String(value).trim() === "";

describe("el doble agrupa como el contrato", () => {
	it("cuenta filas por turno, con las filas sin dato en un grupo propio al final", async () => {
		const data: ChartData = await preview(COUNT_BY_SHIFT);

		const withoutShift = TABLE.records.filter((row) => isBlank(row.turno)).length;
		expect(withoutShift).toBeGreaterThan(0);

		expect(data.groups.map((g) => g.key)).toEqual(["mañana", "noche", "tarde", null]);
		expect(data.groups.at(-1)?.value).toBe(withoutShift);
		expect(data.groups.reduce((sum, g) => sum + g.value, 0)).toBe(TABLE.total);
	});

	it("`total_rows` son las filas de la tabla, no las que entraron en grupos", async () => {
		const data = await preview(COUNT_BY_SHIFT);
		expect(data.total_rows).toBe(TABLE.total);
	});

	it("con `include_null: false` el grupo nulo no se devuelve", async () => {
		const data = await preview({ ...COUNT_BY_SHIFT, include_null: false });

		expect(data.groups.some((g) => g.key === null)).toBe(false);
		expect(data.groups.reduce((sum, g) => sum + g.value, 0)).toBeLessThan(TABLE.total);
	});

	it("devuelve la configuración normalizada, con los valores por defecto aplicados", async () => {
		const data = await preview(COUNT_BY_SHIFT);

		expect(data.version).toBe(1);
		expect(data.config).toEqual({
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			x_fold_case: false,
			y_agg: "count",
			include_null: true,
		});
	});

	it("promedia el salario por turno", async () => {
		const data = await preview({
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			y_agg: "avg",
			y_field: "salario",
		});

		for (const group of data.groups) {
			const rows = TABLE.records.filter((row) =>
				group.key === null ? isBlank(row.turno) : row.turno === group.key,
			);
			const expected =
				Math.round((rows.reduce((sum, row) => sum + Number(row.salario), 0) / rows.length) * 100) /
				100;
			expect(group.value).toBeCloseTo(expected, 2);
		}
	});

	it("agrupa números por paso, con el límite inferior del rango como clave", async () => {
		const data = await preview({
			version: 1,
			chart_type: "bar",
			x_field: "salario",
			x_bucket: "number_step",
			x_step: 5000,
			y_agg: "count",
		});

		expect(data.groups.length).toBeGreaterThan(1);
		for (const group of data.groups) {
			expect(typeof group.key).toBe("number");
			expect((group.key as number) % 5000).toBe(0);
		}
		expect(data.groups.map((g) => g.key)).toEqual(
			[...data.groups.map((g) => g.key)].sort((a, b) => Number(a) - Number(b)),
		);
	});

	it("agrupa fechas por año, trimestre o mes, con el nulo al final", async () => {
		const year = await preview({
			version: 1,
			chart_type: "line",
			x_field: "fecha_ingreso",
			x_bucket: "year",
			y_agg: "count",
		});
		expect(
			year.groups.filter((g) => g.key !== null).every((g) => /^\d{4}$/.test(String(g.key))),
		).toBe(true);
		expect(year.groups.at(-1)?.key).toBeNull();
		expect(year.groups.at(-1)?.value).toBe(
			TABLE.records.filter((row) => isBlank(row.fecha_ingreso)).length,
		);

		const quarter = await preview({
			version: 1,
			chart_type: "bar",
			x_field: "fecha_ingreso",
			x_bucket: "quarter",
			y_agg: "count",
		});
		expect(
			quarter.groups
				.filter((g) => g.key !== null)
				.every((g) => /^\d{4}-Q[1-4]$/.test(String(g.key))),
		).toBe(true);

		const month = await preview({
			version: 1,
			chart_type: "bar",
			x_field: "fecha_ingreso",
			x_bucket: "month",
			y_agg: "count",
		});
		expect(
			month.groups
				.filter((g) => g.key !== null)
				.every((g) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(g.key))),
		).toBe(true);
	});
});

describe("L17 — en una columna de texto, una cadena vacía es «sin dato»", () => {
	const smallTable: DemoTable = {
		fields: [
			{ id: "_id", type: "int" },
			{ id: "letra", type: "text" },
		],
		records: [
			{ _id: 1, letra: "A" },
			{ _id: 2, letra: "a" },
			{ _id: 3, letra: "" },
			{ _id: 4, letra: "   " },
			{ _id: 5, letra: "B" },
		],
		total: 5,
	};

	it("las cadenas vacías y de sólo espacios forman el grupo nulo", async () => {
		const data = await preview(
			{ version: 1, chart_type: "bar", x_field: "letra", x_bucket: "value", y_agg: "count" },
			{ table: smallTable },
		);

		expect(data.groups).toEqual([
			{ key: "A", value: 1 },
			{ key: "B", value: 1 },
			{ key: "a", value: 1 },
			{ key: null, value: 2 },
		]);
	});

	it("contar distintos no cuenta la cadena vacía como un valor", async () => {
		const data = await preview(
			{
				version: 1,
				chart_type: "bar",
				x_field: "letra",
				x_bucket: "value",
				y_agg: "count_distinct",
				y_field: "letra",
				include_null: false,
			},
			{ table: smallTable },
		);

		for (const group of data.groups) {
			expect(group.value).toBe(1);
		}
	});

	it("por defecto no se cuentan los espacios, y con `x_fold_case` se unifican las mayúsculas", async () => {
		const data = await preview(
			{
				version: 1,
				chart_type: "bar",
				x_field: "letra",
				x_bucket: "value",
				x_fold_case: true,
				y_agg: "count",
			},
			{ table: smallTable },
		);

		expect(data.groups).toEqual([
			{ key: "a", value: 2 },
			{ key: "b", value: 1 },
			{ key: null, value: 2 },
		]);
	});
});

describe("el tope de grupos y los errores", () => {
	it("corta en MAX_CHART_GROUPS grupos y lo declara", async () => {
		const bigTable = demoTable(MAX_CHART_GROUPS + 100);
		const data = await preview(
			{ version: 1, chart_type: "bar", x_field: "n", x_bucket: "value", y_agg: "count" },
			{ table: bigTable },
		);

		expect(data.groups).toHaveLength(MAX_CHART_GROUPS);
		expect(data.truncated).toBe(true);
		expect(data.total_rows).toBe(MAX_CHART_GROUPS + 100);
	});

	it("no declara truncado cuando los grupos entran", async () => {
		const data = await preview(COUNT_BY_SHIFT);
		expect(data.truncated).toBe(false);
	});

	it("una configuración que el servidor rechazaría falla con la clave culpable", async () => {
		const error = await preview({
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			y_agg: "sum",
			y_field: "turno",
		}).catch((err: unknown) => err);

		expect(error).toBeInstanceOf(CkanApiError);
		const apiError = error as CkanApiError;
		expect(apiError.ckanType).toBe("Validation Error");
		expect(apiError.status).toBe(409);
		expect(Object.keys(apiError.payload ?? {})).toContain("y_field");
		expect(Array.isArray(apiError.payload?.y_field)).toBe(true);
	});

	it("el caso «error del servidor» devuelve un ValidationError aunque la configuración sea válida", async () => {
		const error = await preview(COUNT_BY_SHIFT, { scenario: "server-error" }).catch(
			(err: unknown) => err,
		);

		expect(error).toBeInstanceOf(CkanApiError);
		expect((error as CkanApiError).payload?.query).toEqual([
			"La consulta superó el tiempo máximo de espera. Intente con menos datos.",
		]);
	});

	it("el caso «sin permiso» devuelve NotAuthorized", async () => {
		const error = await preview(COUNT_BY_SHIFT, { scenario: "not-authorized" }).catch(
			(err: unknown) => err,
		);

		expect(error).toBeInstanceOf(CkanApiError);
		expect((error as CkanApiError).status).toBe(403);
		expect((error as CkanApiError).ckanType).toBe("Authorization Error");
	});
});

describe("el doble guarda la vista", () => {
	it("devuelve la vista con su título, su descripción y la configuración normalizada", async () => {
		const view = await api().createView("recurso-demo", "Salario por turno", "Promedio", {
			version: 1,
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			y_agg: "count",
		});

		expect(view.title).toBe("Salario por turno");
		expect(view.description).toBe("Promedio");
		expect(view.view_type).toBe("umss_chart");
		expect(view.config.include_null).toBe(true);
	});
});
