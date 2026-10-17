<!--
	Playground del formulario del publicador (`/dev/resource-chart`) — regla 8 de `AGENTS.md`.

	Duplica el área donde va a vivir el formulario y monta el **componente real** (`ChartForm`) sobre un
	**doble** del servidor (`fake-api.ts`): la acción `umss_chart_data` todavía no existe en vivo, así que acá
	se revisa el formulario contra la respuesta del contrato y no contra un catálogo que no puede contestar.

	El panel global es **liviano** y sólo tiene presets de caso: el único interruptor de variante —«Estilo del
gráfico», actual o nuevo— vive al lado del gráfico, que es lo que cambia (regla 8). El rótulo de los rangos
numéricos ya está decidido (L21): el eje escribe «0–5000» y la tabla el intervalo exacto «[0, 5000)», sin nada
que elegir.

	La vista previa tiene dos niveles (L28): tipo de gráfico, título y descripción se aplican al instante, y las
	opciones de datos piden los grupos solas. No hay botón «Vista previa» que pulsar ni que bajar a buscar.

	La hoja es material de revisión y se borra al promover el formulario: la compuerta de producción está en
	`+page.ts`.
-->
<script lang="ts">
import { page } from "$app/state";
import type { ChartDraft } from "$lib/charts/form";
import ChartForm from "$lib/components/resource/chart/ChartForm.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { createFakeChartApi, type FakeScenario } from "./fake-api";
import { demoTable } from "./fixtures";

type PresetId =
	| "turno-salario"
	| "turno-pastel"
	| "ingreso-anio"
	| "cargo-conteo"
	| "paso-numerico"
	| "error-servidor"
	| "sin-permiso";

interface Preset {
	id: PresetId;
	label: string;
	note: string;
	scenario: FakeScenario;
	title: string;
	description: string;
	config: Partial<ChartDraft>;
}

const PRESETS: Preset[] = [
	{
		id: "turno-salario",
		label: "Turno y salario promedio",
		note: "El caso que pidió el autor: tres turnos, promedio del salario en el eje vertical y las cadenas vacías de `turno` como grupo sin dato.",
		scenario: "ok",
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
		id: "turno-pastel",
		label: "Turno, en pastel",
		note: "El mismo caso en pastel: en el estilo nuevo es una dona con el total en el centro, y cada porción lleva el intervalo exacto en la leyenda y en el tooltip.",
		scenario: "ok",
		title: "Salario promedio por turno",
		description: "Promedio del salario mensual según el turno del docente.",
		config: {
			chart_type: "pie",
			x_field: "turno",
			x_bucket: "value",
			y_agg: "avg",
			y_field: "salario",
		},
	},
	{
		id: "ingreso-anio",
		label: "Salario promedio por año de ingreso",
		note: "Fecha agrupada por año; las filas con la fecha vacía forman el grupo «Sin dato».",
		scenario: "ok",
		title: "Salario promedio por año de ingreso",
		description: "Promedio del salario según el año de ingreso del docente.",
		config: {
			chart_type: "line",
			x_field: "fecha_ingreso",
			x_bucket: "year",
			y_agg: "avg",
			y_field: "salario",
		},
	},
	{
		id: "cargo-conteo",
		label: "Cargos, contar filas",
		note: "Una columna de texto con «contar filas»: no hay columna del eje vertical que elegir.",
		scenario: "ok",
		title: "Docentes por cargo",
		description: "Cantidad de docentes en cada cargo.",
		config: { chart_type: "bar", x_field: "cargo", x_bucket: "value", y_agg: "count" },
	},
	{
		id: "paso-numerico",
		label: "Salario por rango",
		note: "Rangos numéricos de 5.000: el eje los escribe «0–5000» y la tabla, «[0, 5000)» (L21).",
		scenario: "ok",
		title: "Docentes por rango de salario",
		description: "Cantidad de docentes según el rango de salario mensual.",
		config: {
			chart_type: "bar",
			x_field: "salario",
			x_bucket: "number_step",
			x_step: "5000",
			y_agg: "count",
		},
	},
	{
		id: "error-servidor",
		label: "Error del servidor",
		note: "La consulta vence el tiempo máximo: el error llega con la clave «query», fuera de los campos del formulario.",
		scenario: "server-error",
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
		id: "sin-permiso",
		label: "Sin permiso",
		note: "Quien no puede editar el recurso recibe una negativa, aunque el recurso sea público.",
		scenario: "not-authorized",
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
];

// Sólo para abrir un caso directo; mover un control no reescribe la URL (regla 8).
const initialPreset = page.url.searchParams.get("case");
let presetId = $state<PresetId>(
	PRESETS.some((preset) => preset.id === initialPreset)
		? (initialPreset as PresetId)
		: "turno-salario",
);
const TABLE = demoTable();
const preset = $derived(PRESETS.find((candidate) => candidate.id === presetId) ?? PRESETS[0]);
const api = $derived(createFakeChartApi({ table: TABLE, scenario: preset.scenario }));
</script>

<svelte:head><title>Playground · gráfico del recurso</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
	<header>
		<p class="text-xs font-medium uppercase tracking-wider text-destructive">Playground</p>
		<h1 class="mt-1 font-heading text-2xl font-bold text-primary">
			Configuración del gráfico de un recurso
		</h1>
		<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
			Lo que quien publica configura y guarda como una vista del recurso; el visitante sólo la ve. Los
			datos son una muestra determinista de la tabla de la demo y el servidor es un doble: la acción
			que agrega todavía no está desplegada.
		</p>
	</header>

	<!-- Panel global: sólo presets de caso. -->
	<Card class="p-4">
		<p class="text-sm font-semibold text-foreground">Caso</p>
		<div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Caso de ejemplo">
			{#each PRESETS as option (option.id)}
				<button
					type="button"
					aria-pressed={presetId === option.id}
					onclick={() => (presetId = option.id)}
					class="cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none {presetId ===
					option.id
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background text-foreground hover:bg-accent'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
		<p class="mt-2 text-xs leading-relaxed text-muted-foreground">{preset.note}</p>
	</Card>

	<Card class="overflow-hidden border-primary/20 lg:overflow-visible">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
			<div>
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">Recurso</p>
				<p class="mt-0.5 font-heading text-base font-bold text-foreground">
					planilla-docente-ficticia.csv
				</p>
			</div>
			<p class="text-xs text-muted-foreground">
				{TABLE.total} filas · {TABLE.fields.length - 1} columnas de datos
			</p>
		</div>

		<div class="p-5">
			{#key presetId}
				<ChartForm
					fields={TABLE.fields}
					{api}
					resourceId="37a71273-2523-47d9-8ec0-bb7debddfb43"
					initialTitle={preset.title}
					initialDescription={preset.description}
					initialConfig={preset.config}
				/>
			{/key}
		</div>
	</Card>

	<p class="text-xs leading-relaxed text-muted-foreground">
		El guardado de esta hoja es una simulación: no escribe ninguna vista. En la página real, guardar
		crea la vista del recurso y los visitantes la ven en el recurso.
	</p>
</div>
