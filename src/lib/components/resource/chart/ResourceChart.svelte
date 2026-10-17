<script lang="ts">
import { BarChart, LineChart, PieChart } from "layerchart";
import { type ChartGroup, type ChartType, groupLabels, type XBucket } from "$lib/charts/contract";

// El gráfico en sí: dibuja los grupos que le dan, ya agregados por el servidor.
//
// Qué grupos hay lo decide la base (S6/L11); acá sólo se **rotula** cada `key` cruda y se dibuja. La tabla
// de abajo no es un extra: es la alternativa accesible al SVG (L3), con los mismos grupos.
//
// Los rangos numéricos se escriben de dos maneras a propósito (L21, decisión del autor): el eje usa «0–5000»,
// que se lee de un vistazo, y el tooltip y la tabla usan el intervalo exacto «[0, 5000)», que no deja dudas
// de dónde cae el límite superior. `groupLabels` es quien sostiene esa diferencia.
//
// La biblioteca pinta en SVG, así que los colores salen de los tokens `--chart-1..5` por CSS; no hay hex en
// este archivo.
let {
	groups,
	chartType,
	bucket,
	step,
	xLabel,
	yLabel,
	showTable = true,
}: {
	groups: ChartGroup[];
	chartType: ChartType;
	bucket: XBucket;
	step?: number;
	xLabel: string;
	yLabel: string;
	showTable?: boolean;
} = $props();

const PALETTE = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

// Con muchas categorías los rótulos del eje X se pisan: se muestran a lo sumo ~8, repartidos parejo.
const MAX_X_TICKS = 8;
// La leyenda del pastel no se parte en renglones: pasadas estas porciones se omite y queda la tabla.
const MAX_LEGEND = 8;

interface Point {
	/** El rótulo del eje: en un rango numérico, «0–5000» (L21). */
	axisLabel: string;
	/** El rótulo exacto del tooltip y de la tabla: el intervalo semiabierto «[0, 5000)» (L21). */
	intervalLabel: string;
	value: number;
}

const points = $derived<Point[]>(
	groups.map((group) => {
		const labels = groupLabels(group.key, { bucket, step });
		return { axisLabel: labels.axis, intervalLabel: labels.interval, value: group.value };
	}),
);

const tickStep = $derived(Math.max(1, Math.ceil(points.length / MAX_X_TICKS)));

// Las líneas usan el índice del grupo como X (los rótulos son texto) y lo traducen al rótulo.
const indexed = $derived(points.map((p, i) => ({ ...p, index: i })));
const axisLabelAt = (i: unknown) => points[Number(i)]?.axisLabel ?? "";
// El tooltip de barras y líneas recibe el índice del grupo como X; el rótulo exacto lo pone acá.
const intervalLabelAt = (i: unknown) => points[Number(i)]?.intervalLabel ?? String(i);
const lineTicks = $derived(
	points.length <= MAX_X_TICKS
		? points.map((_, i) => i)
		: points.map((_, i) => i).filter((i) => i % tickStep === 0),
);
// Las barras usan el índice del grupo como categoría: una escala de bandas con los mismos rótulos
// fusionaría dos grupos distintos.
const barTicks = $derived((scale: { domain(): unknown[] }) =>
	scale.domain().filter((_, i) => i % tickStep === 0),
);
const barData = $derived(points.map((p, i) => ({ ...p, index: String(i) })));

// El pastel no tiene eje: su rótulo —leyenda y tooltip— es el intervalo exacto.
const pieData = $derived(
	points.map((p, i) => ({
		key: `${i}`,
		label: p.intervalLabel,
		value: p.value,
		color: PALETTE[i % PALETTE.length],
	})),
);

const name = $derived(
	chartType === "pie"
		? `Gráfico de pastel: ${yLabel} por ${xLabel}`
		: `Gráfico de ${chartType === "bar" ? "barras" : "líneas"}: ${yLabel} (eje vertical) por ${xLabel} (eje horizontal)`,
);
</script>

<div class="space-y-3">
	<div role="img" aria-label={name} class="resource-chart h-80 w-full min-w-0 text-foreground">
		{#if chartType === "bar"}
			<BarChart
				data={barData}
				x="index"
				y="value"
				series={[{ key: "value", label: yLabel, color: "var(--chart-1)" }]}
				padding={{ top: 8, right: 8, bottom: 64, left: 48 }}
				props={{ bars: { stroke: "none", radius: 2 }, tooltip: { header: { format: intervalLabelAt } }, xAxis: { ticks: barTicks, format: axisLabelAt, tickLabelProps: { rotate: points.length > 4 ? -35 : 0, textAnchor: points.length > 4 ? "end" : "middle" } } }}
			/>
		{:else if chartType === "line"}
			<LineChart
				data={indexed}
				x="index"
				y="value"
				series={[{ key: "value", label: yLabel, color: "var(--chart-1)" }]}
				padding={{ top: 8, right: 12, bottom: 64, left: 48 }}
				props={{ tooltip: { header: { format: intervalLabelAt } }, xAxis: { ticks: lineTicks, format: axisLabelAt, tickLabelProps: { rotate: points.length > 4 ? -35 : 0, textAnchor: points.length > 4 ? "end" : "middle" } } }}
			/>
		{:else}
			<PieChart
				data={pieData}
				key="key"
				label="label"
				value="value"
				c="color"
				legend={points.length <= MAX_LEGEND}
			/>
		{/if}
	</div>

	{#if showTable}
		<details class="text-sm">
			<summary class="cursor-pointer rounded-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
				Ver los datos del gráfico en una tabla
			</summary>
			<div class="mt-3 max-h-72 overflow-auto">
				<table class="w-full border-collapse text-left text-sm">
					<caption class="sr-only">Datos del gráfico: {yLabel} por {xLabel}</caption>
					<thead>
						<tr class="border-b border-border bg-muted/50">
							<th scope="col" class="px-3 py-2 font-semibold text-foreground">{xLabel}</th>
							<th scope="col" class="px-3 py-2 font-semibold text-foreground">{yLabel}</th>
						</tr>
					</thead>
					<tbody>
						{#each points as point, i (i)}
							<tr class="border-b border-border/60 last:border-0">
								<td class="px-3 py-1.5 text-muted-foreground">{point.intervalLabel}</td>
								<td class="px-3 py-1.5 text-muted-foreground">{point.value}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	{/if}
</div>

<style>
	/* Ancla las variables de LayerChart a nuestros tokens (también el tooltip, que se porta fuera). */
	.resource-chart,
	:global(.lc-tooltip-root) {
		--color-primary: var(--primary);
		--color-surface-100: var(--card);
		--color-surface-200: var(--muted);
		--color-surface-300: var(--border);
		--color-surface-content: var(--foreground);
	}
</style>
