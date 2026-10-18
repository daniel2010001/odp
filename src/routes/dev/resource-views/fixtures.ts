// Fixtures de `/dev/resource-views`. Sólo datos y dobles: ninguna lógica de producto vive acá. Los tipos salen
// del cliente real, así que si el contrato de los gráficos o del DataStore cambia, esto deja de compilar.

import type { ChartApi, ChartView } from "$lib/api/charts";
import type { DatastoreApi } from "$lib/api/datastore";
import type { ChartData, NormalizedChartConfig } from "$lib/charts/contract";
import type { CkanResource } from "$lib/types/ckan";

export const DATASET_ID = "planilla-docente";

/** Un CSV alojado y ya cargado en el DataStore: lo que hace que existan la tabla y los gráficos. */
export const RESOURCE: CkanResource = {
	id: "res-planilla",
	package_id: "pkg-planilla",
	name: "Planilla docente 2026.csv",
	description: "Planilla de docentes con turno, facultad y salario mensual.",
	format: "CSV",
	url: "http://localhost/dataset/planilla-docente/resource/res-planilla/download/planilla.csv",
	url_type: "upload",
	datastore_active: true,
	created: "2026-10-01T10:00:00",
	last_modified: "2026-10-10T10:00:00",
	state: "active",
	position: 0,
};

const TURNOS = ["mañana", "tarde", "noche"];
const FACULTADES = ["Tecnología", "Medicina", "Economía", "Humanidades"];

/** Las primeras 20 filas de 2500, como la vista previa real. */
export const datastore: DatastoreApi = {
	search: async () => ({
		fields: [
			{ id: "_id", type: "int4" },
			{ id: "docente", type: "text" },
			{ id: "facultad", type: "text" },
			{ id: "turno", type: "text" },
			{ id: "salario", type: "numeric" },
		],
		records: Array.from({ length: 20 }, (_, i) => ({
			_id: i + 1,
			docente: `Docente ${i + 1}`,
			facultad: FACULTADES[i % FACULTADES.length],
			turno: TURNOS[i % TURNOS.length],
			salario: 3000 + ((i * 937) % 6000),
		})),
		total: 2500,
	}),
};

const BASE: NormalizedChartConfig = {
	version: 1,
	chart_type: "bar",
	x_field: "turno",
	x_bucket: "value",
	x_fold_case: false,
	y_agg: "avg",
	y_field: "salario",
	include_null: true,
};

interface Sample {
	title: string;
	description: string;
	config: NormalizedChartConfig;
	groups: ChartData["groups"];
}

const SAMPLES: Sample[] = [
	{
		title: "Salario promedio por turno",
		description: "Promedio mensual del salario, según el turno del docente.",
		config: BASE,
		groups: [
			{ key: "mañana", value: 8496.75 },
			{ key: "noche", value: 3986.38 },
			{ key: "tarde", value: 5120.1 },
		],
	},
	{
		title: "Docentes por facultad",
		description: "",
		config: { ...BASE, chart_type: "pie", x_field: "facultad", y_agg: "count", y_field: undefined },
		groups: [
			{ key: "Economía", value: 480 },
			{ key: "Humanidades", value: 390 },
			{ key: "Medicina", value: 720 },
			{ key: "Tecnología", value: 910 },
		],
	},
	{
		title: "Salario máximo por facultad",
		description: "El mayor salario registrado en cada facultad.",
		config: { ...BASE, chart_type: "line", x_field: "facultad", y_agg: "max" },
		groups: [
			{ key: "Economía", value: 9100 },
			{ key: "Humanidades", value: 7400 },
			{ key: "Medicina", value: 11800 },
			{ key: "Tecnología", value: 10250 },
		],
	},
];

/**
 * Un doble de la API de gráficos con `count` vistas guardadas. Es con estado: `deleteView` quita la vista y la
 * siguiente `listViews` ya no la trae, como el catálogo.
 */
export function makeChartApi(count: number): Pick<ChartApi, "listViews" | "data" | "deleteView"> {
	let samples = SAMPLES.slice(0, count).map((sample, i) => ({ id: `view-${i + 1}`, ...sample }));
	return {
		listViews: async () =>
			samples.map(
				({ id, title, description, config }): ChartView => ({
					id,
					resource_id: RESOURCE.id,
					view_type: "umss_chart",
					title,
					description,
					config,
				}),
			),
		data: async (viewId: string) => {
			const sample = samples.find((s) => s.id === viewId);
			if (!sample) throw new Error(`Vista inexistente: ${viewId}`);
			return {
				version: 1,
				config: sample.config,
				groups: sample.groups,
				truncated: false,
				total_rows: 2500,
			};
		},
		deleteView: async (viewId: string) => {
			samples = samples.filter((s) => s.id !== viewId);
		},
	};
}
