<script lang="ts">
import { Loader2 } from "@lucide/svelte";
import { get } from "svelte/store";
import type { ChartApi, ChartView } from "$lib/api/charts";
import { describeFailure } from "$lib/api/failure";
import { type ChartData, isSupportedChartVersion } from "$lib/charts/contract";
import { xAxisLabel, yAxisLabel } from "$lib/charts/labels";
import Button from "$lib/components/ui/button/button.svelte";
import { auth } from "$lib/stores/auth";
import ResourceChart from "./ResourceChart.svelte";

// El cuerpo de una vista guardada: pide los grupos de **esa** vista (`umss_chart_data { view_id }`, la forma del
// visitante) y los dibuja. Tiene cuatro estados que no se confunden:
//  · una versión que el portal no conoce **no se dibuja** (L12, punto 5) y no pide nada: se avisa;
//  · cargando;
//  · un fallo del catálogo, dicho con el texto del portal y con reintento;
//  · los grupos, o «sin datos» si la tabla no produjo ninguno.
let { view, api }: { view: ChartView; api: Pick<ChartApi, "data"> } = $props();

type State =
	| { status: "loading" }
	| { status: "unsupported" }
	| { status: "failed"; title: string; message: string }
	| { status: "ready"; data: ChartData };

let state = $state<State>({ status: "loading" });
/** El número del último pedido: una respuesta vieja no pisa a la nueva. */
let requestSeq = 0;

async function load() {
	const seq = ++requestSeq;
	if (!isSupportedChartVersion(view.config.version)) {
		state = { status: "unsupported" };
		return;
	}
	state = { status: "loading" };
	try {
		const data = await api.data(view.id);
		if (seq !== requestSeq) return;
		state = isSupportedChartVersion(data.version)
			? { status: "ready", data }
			: { status: "unsupported" };
	} catch (err) {
		if (seq !== requestSeq) return;
		const described = describeFailure(err, "resource", get(auth).user ? "unknown" : "anonymous");
		state = { status: "failed", title: described.title, message: described.message };
	}
}

$effect(() => {
	void view.id;
	void view.config.version;
	load();
});
</script>

{#if state.status === "unsupported"}
	<p
		class="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm leading-relaxed text-foreground"
		role="note"
	>
		Este gráfico se guardó con una versión del formato que el portal no reconoce, por eso no se
		muestra.
	</p>
{:else if state.status === "loading"}
	<div class="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
		<Loader2 class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
		Cargando el gráfico…
	</div>
{:else if state.status === "failed"}
	<div class="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3" role="alert">
		<div>
			<p class="text-sm font-medium text-foreground">No se pudo mostrar este gráfico</p>
			<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{state.message}</p>
		</div>
		<Button type="button" variant="outline" size="sm" onclick={load}>Intentar nuevamente</Button>
	</div>
{:else}
	{@const data = state.data}
	{#if data.groups.length === 0}
		<div class="rounded-lg border border-dashed border-border px-4 py-10 text-center">
			<p class="font-heading text-base font-bold text-foreground">Sin datos para este gráfico</p>
			<p class="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
				Ninguna fila del recurso tiene un valor que se pueda agrupar con esta configuración.
			</p>
		</div>
	{:else}
		<ResourceChart
			groups={data.groups}
			chartType={data.config.chart_type}
			bucket={data.config.x_bucket}
			step={data.config.x_step}
			xLabel={xAxisLabel(data.config.x_bucket, data.config.x_field, data.config.x_step)}
			yLabel={yAxisLabel(data.config.y_agg, data.config.y_field)}
		/>
	{/if}
	{#if data.truncated}
		<p class="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground">
			El gráfico muestra sólo los primeros grupos: la tabla produce más de los que se pueden dibujar.
		</p>
	{/if}
{/if}
