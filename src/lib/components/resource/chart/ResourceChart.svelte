<script lang="ts">
import { Area, AreaChart, BarChart, Bars, Labels, LinearGradient, PieChart } from "layerchart";
import { type ChartGroup, type ChartType, groupLabels, type XBucket } from "$lib/charts/contract";
import { formatChartNumber } from "$lib/charts/format";
import { type BarValueLabels, barValueFormatter, valueLabelsFit } from "$lib/charts/value-labels";

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
	valueLabels = { mode: "off", placement: "outside", format: "full" },
}: {
	groups: ChartGroup[];
	chartType: ChartType;
	bucket: XBucket;
	step?: number;
	xLabel: string;
	yLabel: string;
	showTable?: boolean;
	/** Los valores sobre las barras: en prueba en `/dev/chart-values` (regla 8); apagado por defecto. */
	valueLabels?: BarValueLabels;
} = $props();

const formatBarValue = $derived(barValueFormatter(valueLabels.format));

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

const uid = $props.id();
const gradientId = `chart-gradient-${uid}`;

/**
 * Los adornos del estilo del gráfico (L28, decisión 3: barras de esquinas redondeadas, grilla horizontal suave,
 * área degradada bajo la línea y dona con el total), compartidos por los tres tipos de gráfico:
 *  · **tooltip como tarjeta**: se apaga el estilo propio de la biblioteca (`variant: "none"`) y se pinta una
 *    tarjeta con los tokens del sistema, en vez de la cajita translúcida que trae por defecto;
 *  · **rótulos de eje chicos y apagados**: `--muted-foreground`, 11 px, sin marcas de eje — y la línea del eje
 *    la apaga el `rule={false}` de cada gráfico, así que quedan sólo las líneas horizontales de la grilla.
 */
const chartTooltip = {
	root: {
		variant: "none" as const,
		classes: {
			container:
				"rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md",
		},
	},
	// Los valores se escriben en es-BO y con a lo sumo dos decimales: el servidor no redondea (L23).
	item: { format: formatChartNumber },
};
const mutedTicks = { fill: "var(--muted-foreground)", fontSize: 11 };

const points = $derived<Point[]>(
	groups.map((group) => {
		const labels = groupLabels(group.key, { bucket, step });
		return { axisLabel: labels.axis, intervalLabel: labels.interval, value: group.value };
	}),
);

// El total que se escribe en el centro de la dona: la suma de las porciones visibles.
const total = $derived(
	points.reduce((sum, point) => sum + (Number.isFinite(point.value) ? point.value : 0), 0),
);
const totalLabel = $derived(formatChartNumber(total));

/**
 * Las transiciones suaves son un adorno: con `prefers-reduced-motion` se apagan (regla 7 de `AGENTS.md`).
 * LayerChart anima desde JavaScript, así que no alcanza con CSS: se le pasa `motion="none"`.
 */
let reduceMotion = $state(false);
$effect(() => {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
	const query = window.matchMedia("(prefers-reduced-motion: reduce)");
	reduceMotion = query.matches;
	const onChange = (event: MediaQueryListEvent) => {
		reduceMotion = event.matches;
	};
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
});
const motion = $derived(reduceMotion ? ("none" as const) : undefined);

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
		? `Gráfico de pastel: ${yLabel} por ${xLabel}. Total: ${totalLabel}`
		: `Gráfico de ${chartType === "bar" ? "barras" : "líneas"}: ${yLabel} (eje vertical) por ${xLabel} (eje horizontal)`,
);
</script>

<!-- Las barras con su valor: mismas barras y mismo atenuado al resaltar que las de la biblioteca, más los
     rótulos. «Sólo si caben» compara el ancho de cada barra con el del rótulo más largo. -->
{#snippet barMarks({ context }: { context: any })}
	<Bars
		seriesKey="value"
		stroke="none"
		rounded="all"
		radius={6}
		opacity={(d: any) => (context.series.isHighlighted(context.cKey(d) ?? "value", true) ? 1 : 0.1)}
	/>
	{#if valueLabels.mode === "on" || valueLabelsFit(context.xScale.bandwidth?.() ?? 0, points.map((p) => formatBarValue(p.value)))}
		<g class="bar-value-labels" aria-hidden="true">
			<Labels
				seriesKey="value"
				placement={valueLabels.placement}
				format={formatBarValue}
				fill={valueLabels.placement === "inside" ? "var(--primary-foreground)" : "var(--foreground)"}
				class="text-[11px] font-medium tabular-nums"
			/>
		</g>
	{/if}
{/snippet}

<div class="space-y-3">
	<div class="relative">
		<div role="img" aria-label={name} class="resource-chart h-80 w-full min-w-0 text-foreground">
			{#if chartType === "bar"}
				<BarChart
					data={barData}
					x="index"
					y="value"
					series={[{ key: "value", label: yLabel, color: "var(--chart-1)" }]}
					padding={{
						// El valor encima de la barra más alta necesita aire para no recortarse contra el borde.
						top: valueLabels.mode !== "off" && valueLabels.placement === "outside" ? 22 : 8,
						right: 8,
						bottom: 64,
						left: 48,
					}}
					grid={{ x: false, y: { stroke: "var(--border)", strokeWidth: 1, opacity: 0.7 } }}
					rule={false}
					{motion}
					marks={valueLabels.mode === "off" ? undefined : barMarks}
					props={{
						bars: { stroke: "none", rounded: "all", radius: 6 },
						tooltip: { ...chartTooltip, header: { format: intervalLabelAt } },
						xAxis: { tickMarks: false, ticks: barTicks, format: axisLabelAt, tickLabelProps: mutedTicks },
						yAxis: { tickMarks: false, format: formatChartNumber, tickLabelProps: mutedTicks },
					}}
				/>
			{:else if chartType === "line"}
				<!-- La línea: área degradada debajo, trazo fino y puntos sólo al pasar el
				     puntero (`highlight`), que es lo que evita el ruido de un punto por grupo. -->
				<AreaChart
					data={indexed}
					x="index"
					y="value"
					series={[{ key: "value", label: yLabel, color: "var(--chart-1)" }]}
					padding={{ top: 8, right: 12, bottom: 64, left: 48 }}
					highlight={{ lines: false, points: { r: 4, stroke: "var(--card)", strokeWidth: 2 } }}
					grid={{ x: false, y: { stroke: "var(--border)", strokeWidth: 1, opacity: 0.7 } }}
					rule={false}
					{motion}
					props={{
						tooltip: { ...chartTooltip, header: { format: intervalLabelAt } },
						xAxis: { tickMarks: false, ticks: lineTicks, format: axisLabelAt, tickLabelProps: mutedTicks },
						yAxis: { tickMarks: false, format: formatChartNumber, tickLabelProps: mutedTicks },
					}}
				>
					{#snippet marks({ context })}
						<LinearGradient
							id={gradientId}
							vertical
							stops={[
								[0, "var(--chart-1)"],
								[1, "transparent"],
							]}
						/>
						{#each context.series.visibleSeries as s (s.key)}
							<Area
								seriesKey={s.key}
								fill={`url(#${gradientId})`}
								opacity={0.35}
								line={{ stroke: "var(--chart-1)", strokeWidth: 2.5 }}
							/>
						{/each}
					{/snippet}
				</AreaChart>
			{:else}
				<PieChart
					data={pieData}
					key="key"
					label="label"
					value="value"
					c="color"
					legend={points.length <= MAX_LEGEND}
					innerRadius={0.62}
					cornerRadius={4}
					padAngle={0.01}
					{motion}
					props={{ tooltip: chartTooltip }}
				/>
			{/if}
		</div>

		{#if chartType === "pie"}
			<!-- El total en el centro de la dona: es un adorno de lectura, así que no se anuncia dos veces; el
			     mismo número viaja en la etiqueta del gráfico y en la tabla está el detalle. -->
			<div
				class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center {points.length <=
				MAX_LEGEND
					? 'pb-8'
					: ''}"
				aria-hidden="true"
			>
				<span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total</span>
				<span class="font-heading text-xl font-bold text-foreground">{totalLabel}</span>
			</div>
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
								<td class="px-3 py-1.5 text-muted-foreground">{formatChartNumber(point.value)}</td>
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
