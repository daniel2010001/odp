<script lang="ts">
import { BarChart, LineChart, PieChart } from "layerchart";
import type { ChartPoint, ChartType } from "$lib/charts/points";

// El gráfico en sí: sólo dibuja los puntos que le dan. Qué puntos (y qué se omite) lo decide
// `$lib/charts/points.ts`. La biblioteca pinta en SVG, así que los colores salen de los tokens
// `--chart-1..5` por CSS; no hay hex en este archivo.
//
// El nombre accesible lo pone el contenedor (`role="img"`) y dice los ejes; la alternativa
// completa —los mismos puntos como tabla— la ofrece el constructor justo debajo.
let {
	points,
	type,
	xLabel,
	yLabel,
}: {
	points: ChartPoint[];
	type: ChartType;
	xLabel: string;
	yLabel: string;
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
const step = $derived(Math.max(1, Math.ceil(points.length / MAX_X_TICKS)));

// Las líneas usan el índice de la fila como X (los rótulos son texto) y lo traducen al rótulo.
const indexed = $derived(points.map((p, i) => ({ ...p, index: i })));
const labelAt = (i: unknown) => points[Number(i)]?.label ?? "";
const lineTicks = $derived(
	points.length <= MAX_X_TICKS
		? points.map((_, i) => i)
		: points.map((_, i) => i).filter((i) => i % step === 0),
);
// Las barras usan el índice de la fila como categoría: dos filas con el mismo rótulo (X repetido,
// sin sumar) deben ser dos barras, y una escala de bandas fusiona las claves iguales.
const barTicks = $derived((scale: { domain(): unknown[] }) =>
	scale.domain().filter((_, i) => i % step === 0),
);
const barData = $derived(points.map((p, i) => ({ ...p, index: String(i) })));

const pieData = $derived(
	points.map((p, i) => ({
		key: `${i}`,
		label: p.label,
		value: p.value,
		color: PALETTE[i % PALETTE.length],
	})),
);

const name = $derived(
	type === "pie"
		? `Gráfico de pastel: ${yLabel} por ${xLabel}`
		: `Gráfico de ${type === "bar" ? "barras" : "líneas"}: ${yLabel} (eje vertical) por ${xLabel} (eje horizontal)`,
);
</script>

<div
	role="img"
	aria-label={name}
	class="resource-chart h-80 w-full min-w-0 text-foreground"
>
	{#if type === "bar"}
		<BarChart
			data={barData}
			x="index"
			y="value"
			series={[{ key: "value", label: yLabel, color: "var(--chart-1)" }]}
			padding={{ top: 8, right: 8, bottom: 64, left: 48 }}
			props={{ bars: { stroke: "none", radius: 2 }, xAxis: { ticks: barTicks, format: labelAt, tickLabelProps: { rotate: points.length > 4 ? -35 : 0, textAnchor: points.length > 4 ? "end" : "middle" } } }}
		/>
	{:else if type === "line"}
		<LineChart
			data={indexed}
			x="index"
			y="value"
			series={[{ key: "value", label: yLabel, color: "var(--chart-1)" }]}
			padding={{ top: 8, right: 12, bottom: 64, left: 48 }}
			props={{ xAxis: { ticks: lineTicks, format: labelAt, tickLabelProps: { rotate: points.length > 4 ? -35 : 0, textAnchor: points.length > 4 ? "end" : "middle" } } }}
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
