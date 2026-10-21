// Los gráficos de ejemplo de la demo (`umss_chart`), para `seed-ckan.mjs`.
//
// Sin vistas, ningún recurso de la demo muestra pestañas de gráfico ni el botón «Insertar»
// (odd/tasks/demo-honest-data.md, S7). Acá viven las vistas de cada CSV de `DEMOS` y tres piezas puras:
//   · `validateSeedConfig`: **espejo** de `validateChartConfig` (`src/lib/charts/contract.ts`), porque un
//     script de Node no importa TypeScript con alias `$lib`. Aplica las mismas reglas del contrato v1 sobre
//     los `TYPES` del generador; el test de este archivo hace que un gráfico mal armado rompa acá y no
//     contra el CKAN de la demo. Si cambia el contrato, cambia esto.
//   · `chartViewPayload`: el cuerpo de `resource_view_create`, igual que `createView` de
//     `src/lib/api/charts.ts`: la configuración va **plana**, al tope, junto a `view_type`.
//   · `viewsToCreate`: la idempotencia, por título.
//
// La configuración no tiene filtros: cada gráfico agrupa **todas** las filas del CSV, y los títulos no
// prometen un recorte (p. ej. un año) que la vista no hace.

export const CHART_VIEW_TYPE = "umss_chart";
export const CHART_CONTRACT_VERSION = 1;

const CHART_TYPES = ["bar", "line", "pie"];
const X_BUCKETS = ["value", "number_step", "year", "quarter", "month"];
const Y_AGGREGATES = ["count", "count_distinct", "sum", "avg", "min", "max"];
const NUMERIC_TYPES = new Set(["numeric", "int2", "int4", "int8", "float4", "float8"]);
const TIMESTAMP_TYPES = new Set(["timestamp", "timestamptz", "date"]);
const INTERNAL_FIELD_ID = "_id";

const absent = (value) =>
	value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/**
 * Las reglas del contrato v1 sobre una configuración, con los tipos de columna del generador
 * (`{ columna: tipo }`). Devuelve un mensaje por clave culpable; `{}` es válida.
 */
export function validateSeedConfig(config, types) {
	const errors = {};
	const typeOf = (name) => (typeof name === "string" ? types[name] : undefined);

	if (config.version !== CHART_CONTRACT_VERSION) errors.version = "La versión debe ser 1.";
	if (!CHART_TYPES.includes(config.chart_type)) errors.chart_type = "Tipo de gráfico inválido.";

	const xType = typeOf(config.x_field);
	if (config.x_field === INTERNAL_FIELD_ID) errors.x_field = "«_id» es interna del catálogo.";
	else if (xType === undefined) errors.x_field = `La columna «${config.x_field}» no existe.`;

	const bucket = config.x_bucket;
	if (!X_BUCKETS.includes(bucket)) errors.x_bucket = "Agrupación inválida.";
	else if (xType !== undefined && bucket === "number_step" && !NUMERIC_TYPES.has(xType))
		errors.x_bucket = "Agrupar por paso requiere una columna numérica.";
	else if (
		xType !== undefined &&
		["year", "quarter", "month"].includes(bucket) &&
		!TIMESTAMP_TYPES.has(xType)
	)
		errors.x_bucket = "Agrupar por año, trimestre o mes requiere una columna de fecha.";

	if (X_BUCKETS.includes(bucket)) {
		if (bucket === "number_step") {
			if (typeof config.x_step !== "number" || !(config.x_step > 0))
				errors.x_step = "El paso debe ser un número mayor que cero.";
		} else if (!absent(config.x_step)) errors.x_step = "El paso sólo aplica con number_step.";
	}

	if (config.x_fold_case === true && X_BUCKETS.includes(bucket)) {
		if (bucket !== "value") errors.x_fold_case = "Sólo aplica agrupando por valor.";
		else if (xType !== undefined && xType !== "text") errors.x_fold_case = "Sólo aplica a texto.";
	}

	const agg = config.y_agg;
	if (!Y_AGGREGATES.includes(agg)) errors.y_agg = "Cálculo inválido.";
	else if (agg === "count") {
		if (!absent(config.y_field)) errors.y_field = "Al contar no se elige columna.";
	} else if (absent(config.y_field)) errors.y_field = "Falta la columna del eje Y.";
	else if (config.y_field === INTERNAL_FIELD_ID) errors.y_field = "«_id» es interna del catálogo.";
	else if (typeOf(config.y_field) === undefined)
		errors.y_field = `La columna «${config.y_field}» no existe.`;
	else if (agg !== "count_distinct" && !NUMERIC_TYPES.has(typeOf(config.y_field)))
		errors.y_field = "Requiere una columna numérica.";

	if (!absent(config.include_null) && typeof config.include_null !== "boolean")
		errors.include_null = "Debe ser verdadero o falso.";
	return errors;
}

/** Atajo: la configuración completa (con los valores por defecto que el servidor devuelve aplicados). */
const config = (chart_type, x_field, x_bucket, y_agg, y_field, include_null = true) => ({
	version: CHART_CONTRACT_VERSION,
	chart_type,
	x_field,
	x_bucket,
	x_fold_case: false,
	y_agg,
	...(y_field ? { y_field } : {}),
	include_null,
});

/**
 * Las vistas de cada CSV de `DEMOS`, por `dataset.name`. Las columnas y sus tipos son los `TYPES` de
 * `generate-*.mjs`; los títulos son la clave de la idempotencia: renombrar uno crea otra vista.
 */
export const CHART_VIEWS = {
	"planilla-docente-ficticia": [
		{
			title: "Docentes por facultad",
			description: "Cantidad de docentes de la planilla ficticia en cada facultad.",
			config: config("bar", "facultad", "value", "count"),
		},
		{
			title: "Docentes por turno",
			description: "Proporción de docentes por turno; las filas sin turno forman «Sin dato».",
			config: config("pie", "turno", "value", "count"),
		},
		{
			title: "Docentes que ingresaron por año",
			description: "Ingresos de docentes por año de ingreso, sin contar las filas sin fecha.",
			config: config("line", "fecha_ingreso", "year", "count", undefined, false),
		},
	],
	"matricula-facultad-gestion-ficticia": [
		{
			title: "Matrícula por facultad (2015–2025)",
			description: "Estudiantes inscritos entre 2015 y 2025 sumados por facultad.",
			config: config("bar", "facultad", "value", "sum", "inscritos"),
		},
		{
			title: "Matrícula por gestión",
			description: "Evolución de los estudiantes inscritos en cada gestión, de 2015 a 2025.",
			config: config("line", "gestion", "value", "sum", "inscritos"),
		},
		{
			title: "Matrícula por modalidad",
			description: "Proporción de estudiantes inscritos por modalidad de estudio.",
			config: config("pie", "modalidad", "value", "sum", "inscritos"),
		},
	],
	"ejecucion-presupuestaria-ficticia": [
		{
			title: "Ejecución presupuestaria mensual",
			description: "Monto ejecutado (Bs) sumado por mes de registro, 2024–2025.",
			config: config("line", "fecha_registro", "month", "sum", "monto_ejecutado", false),
		},
		{
			title: "Monto ejecutado por unidad",
			description: "Monto ejecutado (Bs) sumado por unidad, 2024–2025.",
			config: config("bar", "unidad", "value", "sum", "monto_ejecutado"),
		},
		{
			title: "Monto ejecutado por partida",
			description: "Distribución del monto ejecutado (Bs) entre las partidas presupuestarias.",
			config: config("pie", "partida", "value", "sum", "monto_ejecutado"),
		},
	],
	"produccion-investigacion-ficticia": [
		{
			title: "Productos de investigación por departamento",
			description: "Cantidad de productos de investigación de cada departamento, 2015–2025.",
			config: config("bar", "departamento", "value", "count"),
		},
		{
			title: "Productos de investigación por año",
			description: "Evolución de la cantidad de productos de investigación por año.",
			config: config("line", "anio", "value", "count"),
		},
		{
			title: "Productos de investigación por tipo",
			description: "Proporción de cada tipo de producto: artículos, libros, tesis, patentes…",
			config: config("pie", "tipo_producto", "value", "count"),
		},
	],
};

/**
 * Los gráficos por defecto de los datasets adicionales (S18; S52 de odd/tasks/v0.1.1-polish.md), por
 * `dataset.name`: sólo los que tienen un recurso CSV, y sobre ese CSV. Estos CSV los carga xloader como
 * texto y el seed no declara sus tipos (a diferencia de `DEMOS`), así que cada gráfico sólo **cuenta filas**
 * agrupando por el valor de una columna de texto; los títulos dicen lo que se cuenta, no una suma.
 */
export const FILE_CHART_VIEWS = {
	"inventario-de-equipos-de-computo-por-laboratorio": [
		{
			title: "Equipos por laboratorio",
			description: "Cantidad de equipos de cómputo registrados en cada laboratorio.",
			config: config("bar", "laboratorio", "value", "count"),
		},
		{
			title: "Equipos por estado de operación",
			description: "Proporción de equipos operativos, en mantenimiento o de baja.",
			config: config("pie", "estado", "value", "count"),
		},
	],
	"campanas-de-vacunacion-estudiantil": [
		{
			title: "Campañas de vacunación por vacuna",
			description: "Cantidad de campañas registradas para cada vacuna.",
			config: config("bar", "vacuna", "value", "count"),
		},
		{
			title: "Campañas de vacunación por gestión",
			description: "Evolución de la cantidad de campañas registradas en cada gestión.",
			config: config("line", "gestion", "value", "count"),
		},
	],
	"practicas-clinicas-por-centro-de-salud": [
		{
			title: "Prácticas clínicas por centro de salud",
			description: "Cantidad de prácticas registradas en cada centro de salud.",
			config: config("bar", "centro", "value", "count"),
		},
		{
			title: "Prácticas clínicas por carrera",
			description: "Proporción de las prácticas registradas según la carrera.",
			config: config("pie", "carrera", "value", "count"),
		},
	],
	"estaciones-experimentales-y-superficie-cultivada": [
		{
			title: "Estaciones experimentales por municipio",
			description: "Cantidad de estaciones experimentales registradas en cada municipio.",
			config: config("bar", "municipio", "value", "count"),
		},
	],
	"consumo-de-agua-de-riego-en-parcelas": [
		{
			title: "Mediciones de riego por sistema",
			description: "Proporción de las mediciones registradas según el sistema de riego.",
			config: config("pie", "sistema", "value", "count"),
		},
		{
			title: "Mediciones de riego por mes",
			description: "Cantidad de mediciones de riego registradas en cada mes de 2025.",
			config: config("line", "mes", "value", "count"),
		},
	],
	"reclamos-y-sugerencias-recibidos-por-canal": [
		{
			title: "Reclamos y sugerencias por canal",
			description: "Cantidad de registros recibidos por cada canal de atención.",
			config: config("bar", "canal", "value", "count"),
		},
		{
			title: "Reclamos y sugerencias por tipo",
			description: "Proporción de reclamos, sugerencias y felicitaciones recibidos.",
			config: config("pie", "tipo", "value", "count"),
		},
	],
	"convocatorias-de-investigacion-y-proyectos-adjudicados": [
		{
			title: "Convocatorias de investigación por línea",
			description: "Cantidad de convocatorias registradas en cada línea de investigación.",
			config: config("bar", "linea", "value", "count"),
		},
		{
			title: "Convocatorias de investigación por gestión",
			description: "Evolución de la cantidad de convocatorias registradas en cada gestión.",
			config: config("line", "gestion", "value", "count"),
		},
	],
};

/** El cuerpo de `resource_view_create`: la configuración va plana, al tope (`createView` del portal). */
export function chartViewPayload(resourceId, view) {
	return {
		resource_id: resourceId,
		title: view.title,
		description: view.description ?? "",
		view_type: CHART_VIEW_TYPE,
		...view.config,
	};
}

/** Las vistas deseadas que aún no existen, comparando por título (recortado, con mayúsculas). */
export function viewsToCreate(desired, existing) {
	const present = new Set(existing.map((view) => String(view.title ?? "").trim()));
	return desired.filter((view) => !present.has(view.title.trim()));
}
