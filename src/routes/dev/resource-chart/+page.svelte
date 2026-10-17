<!--
	Playground del formulario del publicador (`/dev/resource-chart`) — regla 8 de `AGENTS.md`.

	Duplica el área donde va a vivir el formulario y monta el **componente real** (`ChartForm`) sobre un
	**doble** del servidor (`fake-api.ts`): la acción `umss_chart_data` todavía no existe en vivo, así que acá
	se revisa el formulario contra la respuesta del contrato y no contra un catálogo que no puede contestar.

	El panel global es **liviano** y sólo tiene presets de caso; el único interruptor de variante —el rótulo
	de los rangos numéricos, que el autor tiene que decidir (L12)— está en la sección que cambia, al lado de
	la vista previa, y no en el panel.

	La hoja es material de revisión y se borra al promover el formulario: la compuerta de producción está en
	`+page.ts`.
-->
<script lang="ts">
import { page } from "$app/state";
import type { RangeLabelStyle, XBucket } from "$lib/charts/contract";
import type { ChartDraft } from "$lib/charts/form";
import ChartForm from "$lib/components/resource/chart/ChartForm.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { createFakeChartApi, type FakeScenario } from "./fake-api";
import { demoTable } from "./fixtures";

type PresetId =
	| "turno-salario"
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
		note: "Rangos numéricos de 5.000: acá se mira el interruptor del rótulo de los rangos.",
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
const initialPreset = page.url.searchParams.get("caso");
let presetId = $state<PresetId>(
	PRESETS.some((preset) => preset.id === initialPreset)
		? (initialPreset as PresetId)
		: "turno-salario",
);
/** La variante que el autor tiene que decidir: cómo se escribe un rango numérico (L12). */
let rangeStyle = $state<RangeLabelStyle>(
	page.url.searchParams.get("rangos") === "dash" ? "dash" : "interval",
);

const TABLE = demoTable();
const preset = $derived(PRESETS.find((candidate) => candidate.id === presetId) ?? PRESETS[0]);
const api = $derived(createFakeChartApi({ table: TABLE, scenario: preset.scenario }));

const RANGE_STYLES: { value: RangeLabelStyle; label: string; example: string }[] = [
	{ value: "interval", label: "Intervalo", example: "[0, 5000)" },
	{ value: "dash", label: "Guion", example: "0–5000" },
];

const bucketOf = (config: Partial<ChartDraft>): XBucket =>
	(config.x_bucket as XBucket | undefined) ?? "value";
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

	<Card class="overflow-hidden border-primary/20">
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
			{#key presetId + rangeStyle}
				<ChartForm
					fields={TABLE.fields}
					{api}
					resourceId="37a71273-2523-47d9-8ec0-bb7debddfb43"
					initialTitle={preset.title}
					initialDescription={preset.description}
					initialConfig={preset.config}
					{rangeStyle}
				>
					{#snippet previewControls()}
						<!-- Variante del autor (L12), al lado del gráfico que cambia. -->
						<div class="mr-1 flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1">
							<span class="text-xs font-semibold text-foreground">Rótulo de los rangos</span>
							<div class="flex gap-1" role="group" aria-label="Rótulo de los rangos numéricos">
								{#each RANGE_STYLES as style (style.value)}
									<button
										type="button"
										aria-pressed={rangeStyle === style.value}
										onclick={() => (rangeStyle = style.value)}
										class="cursor-pointer rounded-sm px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none {rangeStyle ===
										style.value
											? 'bg-primary text-primary-foreground'
											: 'text-foreground hover:bg-accent'}"
									>
										{style.label} <span class="font-mono">{style.example}</span>
									</button>
								{/each}
							</div>
							{#if bucketOf(preset.config) !== "number_step"}
								<span class="text-xs text-muted-foreground">(se ve en «Salario por rango»)</span>
							{/if}
						</div>
					{/snippet}
				</ChartForm>
			{/key}
		</div>
	</Card>

	<p class="text-xs leading-relaxed text-muted-foreground">
		El guardado de esta hoja es una simulación: no escribe ninguna vista. En la página real, guardar
		crea la vista del recurso y los visitantes la ven en el recurso.
	</p>
</div>
