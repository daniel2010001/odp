<!--
	Playground de los valores sobre las barras — `/dev/chart-values` (regla 8: se prueba, el autor elige, se
	promueve a `ResourceChart` y esta hoja se borra).

	Dibuja el **componente real** con datos de fixture. Lo global (el preset de datos y el ancho del
	contenedor) va en el panel; los interruptores de la variante van en la sección del gráfico, al lado de lo
	que cambian. El instrumento mide en el DOM lo que se dibujó: cuántos rótulos, cuántos se pisan y el
	contraste del texto contra su fondo.
-->
<script lang="ts">
import type { ChartGroup, XBucket } from "$lib/charts/contract";
import { contrastRatio, parseOklch } from "$lib/charts/contrast";
import type {
	ValueLabelsFormat,
	ValueLabelsMode,
	ValueLabelsPlacement,
} from "$lib/charts/value-labels";
import ResourceChart from "$lib/components/resource/chart/ResourceChart.svelte";

interface Preset {
	id: string;
	label: string;
	xLabel: string;
	yLabel: string;
	bucket: XBucket;
	step?: number;
	groups: ChartGroup[];
}

const FACULTADES = [
	"Ciencias y Tecnología",
	"Ciencias Económicas",
	"Medicina",
	"Derecho",
	"Arquitectura",
	"Humanidades",
	"Agronomía",
];

const PRESETS: Preset[] = [
	{
		id: "facultades",
		label: "7 facultades",
		xLabel: "Facultad",
		yLabel: "Estudiantes matriculados",
		bucket: "value",
		groups: FACULTADES.map((key, i) => ({
			key,
			value: [14230, 9875, 7120, 5480, 3910, 2765, 1840][i],
		})),
	},
	{
		id: "meses",
		label: "12 meses",
		xLabel: "Mes",
		yLabel: "Ejecución (Bs)",
		bucket: "month",
		groups: Array.from({ length: 12 }, (_, i) => ({
			key: `2025-${String(i + 1).padStart(2, "0")}-01`,
			value: [
				812450, 954300, 1203980, 1105600, 998740, 1450320, 760210, 1320870, 1188400, 1402550,
				1612300, 2104780,
			][i],
		})),
	},
	{
		id: "rangos",
		label: "20 rangos",
		xLabel: "Edad",
		yLabel: "Cantidad",
		bucket: "number_step",
		step: 5,
		groups: Array.from({ length: 20 }, (_, i) => ({
			key: i * 5,
			value: Math.round(400 * Math.exp(-((i - 6) ** 2) / 18)) + 3,
		})),
	},
	{
		id: "millones",
		label: "Millones con decimales",
		xLabel: "Gestión",
		yLabel: "Presupuesto promedio (Bs)",
		bucket: "value",
		groups: [2021, 2022, 2023, 2024, 2025].map((key, i) => ({
			key: String(key),
			value: [12345678.912, 13987654.3, 15204411.75, 14876002.08, 16950320.5][i],
		})),
	},
];

const WIDTHS = [
	{ id: "phone", label: "Teléfono (360 px)", px: 360 },
	{ id: "tablet", label: "Tableta (768 px)", px: 768 },
	{ id: "desktop", label: "Escritorio (1100 px)", px: 1100 },
];

let presetId = $state("facultades");
let widthId = $state("desktop");
let mode = $state<ValueLabelsMode>("on");
let placement = $state<ValueLabelsPlacement>("outside");
let format = $state<ValueLabelsFormat>("full");

const preset = $derived(PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]);
const width = $derived(WIDTHS.find((w) => w.id === widthId) ?? WIDTHS[2]);

// ─── El instrumento ────────────────────────────────────────────────
let chartBox = $state<HTMLDivElement>();
let measure = $state({ labels: 0, overlaps: 0, contrast: 0 });

function readContrast(): number {
	const root = getComputedStyle(document.documentElement);
	const token = (name: string) => root.getPropertyValue(name).trim();
	try {
		const text = placement === "inside" ? token("--primary-foreground") : token("--foreground");
		const background = placement === "inside" ? token("--chart-1") : token("--card");
		return contrastRatio(parseOklch(text), parseOklch(background));
	} catch {
		return 0;
	}
}

function remeasure() {
	if (!chartBox) return;
	const texts = Array.from(chartBox.querySelectorAll(".bar-value-labels text"));
	const boxes = texts.map((t) => t.getBoundingClientRect());
	let overlaps = 0;
	for (let i = 1; i < boxes.length; i++) {
		if (boxes[i].left < boxes[i - 1].right - 0.5) overlaps++;
	}
	measure = {
		labels: texts.length,
		overlaps,
		contrast: readContrast(),
	};
}

$effect(() => {
	// Se vuelve a medir cuando cambia cualquier entrada; la espera deja que LayerChart termine de dibujar.
	void [presetId, widthId, mode, placement, format];
	const timer = setTimeout(remeasure, 600);
	return () => clearTimeout(timer);
});

const optionClass = (active: boolean) =>
	`rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
		active
			? "border-primary bg-primary text-primary-foreground"
			: "border-border bg-card text-foreground hover:bg-muted"
	}`;
</script>

<svelte:head><title>Playground · valores sobre las barras</title></svelte:head>

<main class="mx-auto max-w-6xl space-y-6 px-4 py-8">
	<header class="space-y-1">
		<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Playground · regla 8</p>
		<h1 class="font-heading text-3xl font-bold text-primary">Valores sobre las barras</h1>
		<p class="text-sm text-muted-foreground">
			El componente real con datos de ejemplo. Elija una variante; la que apruebe pasa a la página del recurso y esta
			hoja se borra.
		</p>
	</header>

	<!-- El panel: sólo lo global. -->
	<section class="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Panel de control">
		<div class="flex flex-wrap items-center gap-2">
			<span class="w-20 text-sm font-medium text-foreground">Datos</span>
			{#each PRESETS as p (p.id)}
				<button type="button" class={optionClass(presetId === p.id)} aria-pressed={presetId === p.id} onclick={() => (presetId = p.id)}>
					{p.label}
				</button>
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<span class="w-20 text-sm font-medium text-foreground">Ancho</span>
			{#each WIDTHS as w (w.id)}
				<button type="button" class={optionClass(widthId === w.id)} aria-pressed={widthId === w.id} onclick={() => (widthId = w.id)}>
					{w.label}
				</button>
			{/each}
		</div>
	</section>

	<!-- La sección del gráfico, con sus interruptores al lado. -->
	<section class="space-y-4 rounded-xl border border-border bg-card p-4">
		<div class="flex flex-wrap gap-x-6 gap-y-3">
			<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Valores">
				<span class="text-sm font-medium text-foreground">Valores</span>
				{#each [["off", "Sin valores (hoy)"], ["on", "Siempre"], ["fit", "Sólo si caben"]] as [value, label] (value)}
					<button type="button" class={optionClass(mode === value)} aria-pressed={mode === value} onclick={() => (mode = value as ValueLabelsMode)}>
						{label}
					</button>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Posición">
				<span class="text-sm font-medium text-foreground">Posición</span>
				{#each [["outside", "Encima"], ["inside", "Dentro"]] as [value, label] (value)}
					<button type="button" class={optionClass(placement === value)} aria-pressed={placement === value} onclick={() => (placement = value as ValueLabelsPlacement)}>
						{label}
					</button>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Formato">
				<span class="text-sm font-medium text-foreground">Formato</span>
				{#each [["full", "Completo"], ["compact", "Compacto (1,2 M)"]] as [value, label] (value)}
					<button type="button" class={optionClass(format === value)} aria-pressed={format === value} onclick={() => (format = value as ValueLabelsFormat)}>
						{label}
					</button>
				{/each}
			</div>
		</div>

		<!-- El instrumento. -->
		<dl class="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-4">
			<div><dt class="text-muted-foreground">Barras</dt><dd class="font-mono font-semibold">{preset.groups.length}</dd></div>
			<div><dt class="text-muted-foreground">Rótulos dibujados</dt><dd class="font-mono font-semibold">{measure.labels}</dd></div>
			<div>
				<dt class="text-muted-foreground">Rótulos que se pisan</dt>
				<dd class="font-mono font-semibold {measure.overlaps > 0 ? 'text-destructive' : ''}">{measure.overlaps}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Contraste del texto (≥ 4,5)</dt>
				<dd class="font-mono font-semibold {measure.contrast > 0 && measure.contrast < 4.5 ? 'text-destructive' : ''}">
					{measure.contrast > 0 ? `${measure.contrast.toFixed(2)}:1` : "—"}
				</dd>
			</div>
		</dl>

		<div class="overflow-x-auto">
			<div bind:this={chartBox} class="rounded-lg border border-border bg-card p-4" style:width="{width.px}px">
				{#key `${presetId}-${widthId}`}
					<ResourceChart
						groups={preset.groups}
						chartType="bar"
						bucket={preset.bucket}
						step={preset.step}
						xLabel={preset.xLabel}
						yLabel={preset.yLabel}
						showTable={false}
						valueLabels={{ mode, placement, format }}
					/>
				{/key}
			</div>
		</div>
	</section>
</main>
