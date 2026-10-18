<!--
	Playground de las vistas del recurso — superficie sólo para desarrollo (`/dev/resource-views`).

	Duplica la parte de la página del recurso (`src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`) que
	muestra la vista previa y los gráficos, con los **componentes reales** (`ResourcePreview`, `ResourceCharts`) y
	dobles del DataStore y de la API de gráficos (`fixtures.ts`). Sirve para comparar dos cosas que el autor aún
	no eligió (L37, puntos 1 y 3; L40, P6b):

	· la **disposición**: apilado (hoy: la tabla y debajo los gráficos) o pestañas `Tabla | <gráfico 1> | …`
	  con `Tabs` de bits-ui, la idea de las pestañas simuladas que se quitaron en `ce8670a`, ahora con
	  contenido real;
	· el **lugar de «Crear gráfico»**: a la derecha del encabezado de la sección (hoy), al final de la barra de
	  pestañas, en la banda de acciones del encabezado del recurso, o como tarjeta punteada al final de la lista.

	El panel global es liviano: sólo los presets (cuántos gráficos hay, quién mira). Cada interruptor de variante
	vive en la sección donde aplica. Todo se guarda en la URL (`?graficos=&rol=&disposicion=&crear=`); un valor
	desconocido cae al de hoy. La ruta no existe en producción: la compuerta está en `+page.ts`.
-->
<script lang="ts">
import { Download } from "@lucide/svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import ResourceCharts from "$lib/components/resource/chart/ResourceCharts.svelte";
import ResourcePreview from "$lib/components/resource/ResourcePreview.svelte";
import CreateChartLink from "$lib/components/resource/views/CreateChartLink.svelte";
import type { ChartsLayout, CreatePlacement } from "$lib/components/resource/views/types";
import Card from "$lib/components/ui/card/card.svelte";
import { cn } from "$lib/utils";
import { DATASET_ID, datastore, makeChartApi, RESOURCE } from "./fixtures";

type Count = "0" | "1" | "3";
type Rol = "editor" | "visitante";

const COUNTS: { id: Count; label: string }[] = [
	{ id: "0", label: "Sin gráficos" },
	{ id: "1", label: "Un gráfico" },
	{ id: "3", label: "Tres gráficos" },
];
const ROLES: { id: Rol; label: string }[] = [
	{ id: "editor", label: "Quien puede editar" },
	{ id: "visitante", label: "Visitante anónimo" },
];
const LAYOUTS: { id: ChartsLayout; label: string }[] = [
	{ id: "stacked", label: "Apilado (hoy)" },
	{ id: "tabs", label: "Pestañas" },
];
const PLACEMENTS: { id: CreatePlacement | "header"; label: string }[] = [
	{ id: "heading", label: "Encabezado de la sección (hoy)" },
	{ id: "tabs", label: "Final de la barra de pestañas" },
	{ id: "header", label: "Banda del encabezado del recurso" },
	{ id: "card", label: "Tarjeta punteada al final" },
];

function paramOr<T extends string>(key: string, allowed: readonly { id: T }[], fallback: T): T {
	const raw = $page.url.searchParams.get(key);
	return allowed.find((item) => item.id === raw)?.id ?? fallback;
}

let count = $state<Count>(paramOr("graficos", COUNTS, "3"));
let rol = $state<Rol>(paramOr("rol", ROLES, "editor"));
let layout = $state<ChartsLayout>(paramOr("disposicion", LAYOUTS, "stacked"));
let placement = $state<CreatePlacement | "header">(paramOr("crear", PLACEMENTS, "heading"));

const canEdit = $derived(rol === "editor");
// Un doble nuevo por preset: el borrado del doble no sobrevive a un cambio de caso.
const chartApi = $derived(makeChartApi(Number(count)));
const basePath = `/dataset/${DATASET_ID}/resource/${RESOURCE.id}/charts`;

function syncUrl(): void {
	const params = new URLSearchParams({
		graficos: count,
		rol,
		disposicion: layout,
		crear: placement,
	});
	replaceState(`/dev/resource-views?${params.toString()}`, {});
}

function setCount(id: Count): void {
	count = id;
	syncUrl();
}
function setRol(id: Rol): void {
	rol = id;
	syncUrl();
}
function setLayout(id: ChartsLayout): void {
	layout = id;
	syncUrl();
}
function setPlacement(id: CreatePlacement | "header"): void {
	placement = id;
	syncUrl();
}

const segmentClass = (active: boolean) =>
	cn(
		"cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
		active
			? "border-primary bg-primary text-primary-foreground"
			: "border-border bg-background text-foreground hover:bg-accent",
	);
</script>

{#snippet segmented<T extends string>(
	label: string,
	items: { id: T; label: string }[],
	value: T,
	onpick: (id: T) => void,
)}
	<div role="group" aria-label={label} class="flex flex-wrap items-center gap-2">
		<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
		{#each items as item (item.id)}
			<button type="button" aria-pressed={value === item.id} class={segmentClass(value === item.id)} onclick={() => onpick(item.id)}>
				{item.label}
			</button>
		{/each}
	</div>
{/snippet}

<div class="min-h-screen bg-background">
	<!-- Panel global: sólo los presets de caso. -->
	<div class="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur" data-testid="panel">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
			<p class="text-xs font-bold uppercase tracking-wider text-destructive">/dev/resource-views</p>
			{@render segmented("Gráficos guardados", COUNTS, count, setCount)}
			{@render segmented("Quién mira", ROLES, rol, setRol)}
		</div>
	</div>

	<!-- Encabezado del recurso (resumen): trae la banda de acciones, un lugar posible de «Crear gráfico». -->
	<section class="border-b border-border bg-card" data-testid="banda-encabezado">
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<h1 class="font-heading text-3xl font-bold leading-tight text-foreground">{RESOURCE.name}</h1>
			<p class="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{RESOURCE.description}</p>
			<div class="mt-5 flex flex-wrap items-center gap-3">
				<a
					href={RESOURCE.url}
					class="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90"
				>
					<Download class="size-4" aria-hidden="true" />
					Descargar recurso
				</a>
				{#if canEdit && placement === "header"}
					<CreateChartLink href="{basePath}/new" />
				{/if}
			</div>
		</div>
	</section>

	<section class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
		<!-- Variantes de esta sección: disposición y lugar de «Crear gráfico». -->
		<div class="space-y-2 rounded-lg border border-dashed border-border bg-muted/40 p-3" data-testid="variantes">
			{@render segmented("Disposición", LAYOUTS, layout, setLayout)}
			{@render segmented("Lugar de «Crear gráfico»", PLACEMENTS, placement, setPlacement)}
			{#if layout === "stacked" && placement === "tabs"}
				<p class="text-xs text-muted-foreground">
					Sin pestañas no hay barra: «Crear gráfico» cae al encabezado de la sección.
				</p>
			{/if}
		</div>

		{#snippet previewCard()}
			<Card class="overflow-hidden border-primary/20">
				<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">Vista previa</p>
				</div>
				<ResourcePreview resource={RESOURCE} {datastore} />
			</Card>
		{/snippet}

		{#key `${count}`}
			{#if layout === "stacked"}
				{@render previewCard()}
			{/if}
			<ResourceCharts
				resourceId={RESOURCE.id}
				datasetId={DATASET_ID}
				api={chartApi}
				{canEdit}
				{layout}
				createPlacement={placement === "header" ? "none" : placement}
				table={previewCard}
			/>
		{/key}
	</section>
</div>
