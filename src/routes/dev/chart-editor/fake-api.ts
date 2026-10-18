// El doble de la API de gráficos del playground: responde a la vista previa con grupos plausibles para las
// columnas de la planilla, sin servidor. Es un doble de prueba (no hay agregación real): su único trabajo es
// que el gráfico tenga algo creíble que dibujar mientras se compara la disposición.

import type { ChartApi, ChartView } from "$lib/api/charts";
import type { ChartConfig, ChartData, ChartGroup } from "$lib/charts/contract";

/** Los grupos por columna de texto; la última clave `null` es el grupo «sin dato». */
const TEXT_KEYS: Record<string, (string | null)[]> = {
	turno: ["Mañana", "Noche", "Tarde", null],
	cargo: ["Auxiliar", "Docente", "Jefe de carrera", "Investigador"],
	departamento: ["Ciencias", "Humanidades", "Ingeniería", "Salud", "Tecnología"],
	facultad: ["Arquitectura", "Ciencias y Tecnología", "Economía", "Humanidades", "Medicina"],
};
const DEFAULT_TEXT_KEYS = ["A", "B", "C", "D", "E"];

/** Un valor determinista por posición: gráficos que no saltan entre pedidos. */
function valueAt(index: number, config: ChartConfig): number {
	const base = [42, 87, 65, 23, 54, 31, 76][index % 7];
	if (config.y_agg === "count" || config.y_agg === "count_distinct") return base * 3;
	if (config.y_agg === "sum") return base * 12000;
	return base * 90;
}

function keysFor(config: ChartConfig): (string | number | null)[] {
	switch (config.x_bucket) {
		case "year":
			return ["2018", "2019", "2020", "2021", "2022", "2023", null];
		case "quarter":
			return ["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4"];
		case "month":
			return ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06"];
		case "number_step": {
			const step = config.x_step ?? 5000;
			return [0, 1, 2, 3, 4, 5].map((k) => k * step);
		}
		default:
			return TEXT_KEYS[config.x_field] ?? DEFAULT_TEXT_KEYS;
	}
}

export function createFakeChartApi(): Pick<ChartApi, "preview" | "createView" | "updateView"> {
	const view = (title = "", description = ""): ChartView => ({
		id: "vista-demo",
		resource_id: "recurso-demo",
		view_type: "umss_chart",
		title,
		description,
		config: {},
	});
	return {
		async preview(_resourceId, config): Promise<ChartData> {
			// Una pausa corta, para que se vea el estado «actualizando» como con el servidor real.
			await new Promise((resolve) => setTimeout(resolve, 250));
			const groups: ChartGroup[] = keysFor(config)
				.filter((key) => key !== null || config.include_null !== false)
				.map((key, index) => ({ key, value: valueAt(index, config) }));
			return {
				version: 1,
				config: {
					...config,
					x_fold_case: config.x_fold_case ?? false,
					include_null: config.include_null ?? true,
				},
				groups,
				truncated: false,
				total_rows: 2500,
			};
		},
		async createView(_resourceId, title, description) {
			return view(title, description);
		},
		async updateView(_viewId, changes) {
			return view(changes.title, changes.description);
		},
	};
}
