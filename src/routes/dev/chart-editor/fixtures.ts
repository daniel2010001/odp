// Los casos del panel: las columnas de la planilla docente (L16) en tres recortes.
//
// Son lo que `datastore_search` informa por columna; el formulario real decide con ellas qué selectores
// ofrece, así que los tres presets muestran el editor con mucho, poco y casi nada que elegir.

import type { DatastoreField } from "$lib/api/datastore";
import type { ChartDraft } from "$lib/charts/form";

export type PresetId = "planilla" | "texto" | "numerica";

export interface Preset {
	id: PresetId;
	label: string;
	note: string;
	fields: DatastoreField[];
	title: string;
	description: string;
	config: Partial<ChartDraft>;
}

export const PRESETS: Preset[] = [
	{
		id: "planilla",
		label: "Planilla completa",
		note: "Todas las columnas: texto, números y una fecha. Es el caso con más selectores.",
		fields: [
			{ id: "_id", type: "int4" },
			{ id: "n", type: "numeric" },
			{ id: "nombre", type: "text" },
			{ id: "apellido", type: "text" },
			{ id: "departamento", type: "text" },
			{ id: "facultad", type: "text" },
			{ id: "cargo", type: "text" },
			{ id: "turno", type: "text" },
			{ id: "horas_mes", type: "numeric" },
			{ id: "bs_hora", type: "numeric" },
			{ id: "salario", type: "numeric" },
			{ id: "fecha_ingreso", type: "timestamp" },
		],
		title: "Salario promedio por turno",
		description: "Promedio del salario mensual según el turno del docente.",
		config: {
			chart_type: "bar",
			x_field: "turno",
			x_bucket: "value",
			y_agg: "avg",
			y_field: "salario",
		},
	},
	{
		id: "texto",
		label: "Sólo columnas de texto",
		note: "Sin números ni fechas: la agrupación y el cálculo casi no tienen opciones y los selectores se ocultan.",
		fields: [
			{ id: "_id", type: "int4" },
			{ id: "nombre", type: "text" },
			{ id: "departamento", type: "text" },
			{ id: "cargo", type: "text" },
			{ id: "turno", type: "text" },
		],
		title: "",
		description: "",
		config: { chart_type: "bar", x_field: "turno", x_bucket: "value", y_agg: "count" },
	},
	{
		id: "numerica",
		label: "Una sola columna numérica",
		note: "La tabla mínima: una columna graficable, así que casi nada queda por elegir.",
		fields: [
			{ id: "_id", type: "int4" },
			{ id: "salario", type: "numeric" },
		],
		title: "",
		description: "",
		config: {},
	},
];

export const PRESET_IDS = PRESETS.map((preset) => preset.id);
