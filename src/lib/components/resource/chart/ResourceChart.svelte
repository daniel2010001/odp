<script lang="ts" module>
/**
 * El estilo visual del gráfico (L28, decisión 3). `current` es el que estaba; `new` es el que el autor
 * evalúa en el playground: barras de esquinas redondeadas, sólo grilla horizontal suave, sin líneas de
 * eje, tooltip como tarjeta, área degradada bajo la línea con puntos al pasar el puntero y dona con el
 * total en el centro. Los dos estilos viven en este mismo componente y se eligen con una sola prop, así
 * que promover el nuevo es cambiar su valor por defecto.
 */
export type ChartStyle = "current" | "new";
</script>

<script lang="ts">
	import { Area, AreaChart, BarChart, LinearGradient, LineChart, PieChart } from "layerchart";
	import { type ChartGroup, type ChartType, groupLabels, type XBucket } from "$lib/charts/contract";

	// El gráfico en sí: dibuja los grupos que le dan, ya agregados por el servidor.
	//
	// Qué grupos hay lo decide la base (S6/L11); acá sólo se **rotula** cada `key` cruda y se dibuja. La tabla
	// de abajo no es un extra: es la alternativa accesible al SVG (L3), con los mismos grupos.
	//
	// Los rangos numéricos se escriben de dos maneras a propósito (L21, decisión del autor): el eje usa «0–5000»,
	// que se lee de un vistazo, y el tooltip y la tabla usan el intervalo exacto «[0, 5000)», que no deja dudas
	// de dónde cae el límite superior. `groupLabels` es quien sostiene esa diferencia, en los dos estilos.
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
		variant = "current",
	}: {
		groups: ChartGroup[];
		chartType: ChartType;
		bucket: XBucket;
		step?: number;
		xLabel: string;
		yLabel: string;
		showTable?: boolean;
		variant?: ChartStyle;
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

	const modern = $derived(variant === "new");
	const uid = $props.id();
	const gradientId = `chart-gradient-${uid}`;

	/**
	 * Los adornos del estilo nuevo, compartidos por los tres tipos de gráfico:
	 *  · **tooltip como tarjeta**: se apaga el estilo propio de la biblioteca (`variant: "none"`) y se pinta una
	 *    tarjeta con los tokens del sistema, en vez de la cajita translúcida que trae por defecto;
	 *  · **rótulos de eje chicos y apagados**: `--muted-foreground`, 11 px, sin marcas de eje — y la línea del eje
	 *    la apaga el `rule={false}` de cada gráfico, así que quedan sólo las líneas horizontales de la grilla.
	 */
	const modernTooltip = {
		root: {
			variant: "none" as const,
			classes: {
				container:
					"rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md",
			},
		},
	};
	const mutedTicks = { fill: "var(--muted-foreground)", fontSize: 11 };

	const points = $derived<Point[]>(
		groups.map((group) => {
			const labels = groupLabels(group.key, { bucket, step });
			return { axisLabel: labels.axis, intervalLabel: labels.interval, value: group.value };
		}),
	);

	/** Los rótulos del eje X del estilo actual: rotados cuando hay muchas categorías. */
	const tickLabels = $derived({
		rotate: points.length > 4 ? -35 : 0,
		textAnchor: points.length > 4 ? ("end" as const) : ("middle" as const),
	});

	// El total que se escribe en el centro de la dona: la suma de las porciones visibles.
	const total = $derived(
		points.reduce((sum, point) => sum + (Number.isFinite(point.value) ? point.value : 0), 0),
	);
	const totalLabel = $derived(
		new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 }).format(total),
	);

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
			? `Gráfico de pastel: ${yLabel} por ${xLabel}${modern ? `. Total: ${totalLabel}` : ""}`
			: `Gráfico de ${chartType === "bar" ? "barras" : "líneas"}: ${yLabel} (eje vertical) por ${xLabel} (eje horizontal)`,
	);
</script>

<div class="space-y-3">
	<div class="relative">
		<div role="img" aria-label={name} class="resource-chart h-80 w-full min-w-0 text-foreground">
			{#if chartType === "bar"}
				<BarChart
					data={barData}
					x="index"
					y="value"
					series={[{ key: "value", label: yLabel, color: "var(--chart-1)" }]}
					padding={{ top: 8, right: 8, bottom: 64, left: 48 }}
					grid={modern ? { x: false, y: { stroke: "var(--border)", strokeWidth: 1, opacity: 0.7 } } : true}
					rule={!modern}
					{motion}
					props={{
						bars: modern
							? { stroke: "none", rounded: "all", radius: 6 }
							: { stroke: "none", radius: 2 },
						tooltip: modern
							? { ...modernTooltip, header: { format: intervalLabelAt } }
							: { header: { format: intervalLabelAt } },
						xAxis: modern
							? { tickMarks: false, ticks: barTicks, format: axisLabelAt, tickLabelProps: mutedTicks }
							: { ticks: barTicks, format: axisLabelAt, tickLabelProps: tickLabels },
						yAxis: modern ? { tickMarks: false, tickLabelProps: mutedTicks } : undefined,
					}}
				/>
			{:else if chartType === "line"}
				{#if modern}
					<!-- La línea del estilo nuevo: área degradada debajo, trazo fino y puntos sólo al pasar el
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
							tooltip: { ...modernTooltip, header: { format: intervalLabelAt } },
							xAxis: { tickMarks: false, ticks: lineTicks, format: axisLabelAt, tickLabelProps: mutedTicks },
							yAxis: { tickMarks: false, tickLabelProps: mutedTicks },
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
					<LineChart
						data={indexed}
						x="index"
						y="value"
						series={[{ key: "value", label: yLabel, color: "var(--chart-1)" }]}
						padding={{ top: 8, right: 12, bottom: 64, left: 48 }}
						{motion}
						props={{ tooltip: { header: { format: intervalLabelAt } }, xAxis: { ticks: lineTicks, format: axisLabelAt, tickLabelProps: tickLabels } }}
					/>
				{/if}
			{:else}
				<PieChart
					data={pieData}
					key="key"
					label="label"
					value="value"
					c="color"
					legend={points.length <= MAX_LEGEND}
					innerRadius={modern ? 0.62 : undefined}
					cornerRadius={modern ? 4 : undefined}
					padAngle={modern ? 0.01 : undefined}
					{motion}
					props={{ tooltip: modern ? modernTooltip : undefined }}
				/>
			{/if}
		</div>

		{#if modern && chartType === "pie"}
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
