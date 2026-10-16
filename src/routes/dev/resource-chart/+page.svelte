<!--
	Playground del constructor de gráficos (`/dev/resource-chart`) — borrador a revisar con el autor.

	Duplica el área de vista previa de la página del recurso (`Card` con «Vista previa» y
	`ResourcePreview`) y le suma, dentro de la misma tarjeta, el constructor de gráficos. El panel
	global sólo tiene presets de caso; cada variante vive en la sección que cambia. Los datos son
	fixtures con la forma de `datastore_search`; el `datastore` stub respeta el `limit` pedido.
-->
<script lang="ts">
import { page } from "$app/state";
import type { DatastoreApi, DatastoreSearchResult } from "$lib/api/datastore";
import type { ChartType } from "$lib/charts/points";
import ChartBuilder from "$lib/components/resource/chart/ChartBuilder.svelte";
import ResourcePreview from "$lib/components/resource/ResourcePreview.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import type { CkanResource } from "$lib/types/ckan";
import { manyRows, numericTable, textOnlyTable } from "./fixtures";

type PresetId = "numeric" | "text-only" | "no-datastore" | "many-rows";

const PRESETS: { id: PresetId; label: string; note: string }[] = [
	{
		id: "numeric",
		label: "CSV con columnas numéricas",
		note: "Mezcla `numeric` y `text` con números; municipios repetidos.",
	},
	{
		id: "text-only",
		label: "CSV sin columnas numéricas",
		note: "El constructor debe decirlo en vez de ofrecer ejes vacíos.",
	},
	{
		id: "no-datastore",
		label: "Recurso sin tabla cargada",
		note: "Sin DataStore no hay constructor.",
	},
	{ id: "many-rows", label: "Muchas filas", note: "500 puntos de una tabla de 12 480 filas." },
];

// Estado inicial desde la URL (`?caso=`, `?tipo=`) sólo para abrir un caso directo; mover un control no
// reescribe la URL.
const initialPreset = page.url.searchParams.get("caso");
const initialType = (page.url.searchParams.get("tipo") ?? "bar") as ChartType;
let preset = $state<PresetId>(
	PRESETS.some((p) => p.id === initialPreset) ? (initialPreset as PresetId) : "numeric",
);

// Variantes, cada una al lado de lo que cambia (regla 8).
let aggregate = $state<"choice" | "sum" | "none">("choice");
let chartLimit = $state(500);

const source = $derived<DatastoreSearchResult | null>(
	preset === "numeric"
		? numericTable()
		: preset === "text-only"
			? textOnlyTable()
			: preset === "many-rows"
				? manyRows(500)
				: null,
);

const resource = $derived<CkanResource>({
	id: `dev-chart-${preset}`,
	package_id: "pkg-dev-chart",
	name: PRESETS.find((p) => p.id === preset)?.label ?? "Recurso",
	url: "https://data.umss.edu.bo/dataset/ejemplo/resource/tabla.csv",
	url_type: "upload",
	format: "CSV",
	datastore_active: preset !== "no-datastore",
	created: "2026-09-01T00:00:00Z",
	last_modified: "2026-09-01T00:00:00Z",
	state: "active",
	position: 0,
});

const datastore = $derived<DatastoreApi>({
	search: async (_id, options = {}) => {
		const rows = source?.records ?? [];
		const limit = options.limit ?? 20;
		const offset = options.offset ?? 0;
		return {
			fields: source?.fields ?? [],
			records: rows.slice(offset, offset + limit),
			total: source?.total ?? 0,
		};
	},
});

// El constructor pide sus propias filas (`chartLimit`), aparte de las 20 de la vista previa.
let chartData = $state<DatastoreSearchResult | null>(null);
$effect(() => {
	const api = datastore;
	const limit = chartLimit;
	let superseded = false;
	chartData = null;
	if (resource.datastore_active !== true) return;
	api.search(resource.id, { limit }).then((r) => {
		if (!superseded) chartData = r;
	});
	return () => {
		superseded = true;
	};
});
</script>

<svelte:head><title>Playground · gráfico del recurso</title></svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
	<header>
		<p class="text-xs font-medium uppercase tracking-wider text-destructive">Playground</p>
		<h1 class="mt-1 font-heading text-2xl font-bold text-primary">Gráfico de un recurso tabular</h1>
	</header>

	<!-- Panel global: sólo presets de caso. -->
	<Card class="p-4">
		<p class="text-sm font-semibold text-foreground">Caso</p>
		<div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Caso de ejemplo">
			{#each PRESETS as p (p.id)}
				<button
					type="button"
					aria-pressed={preset === p.id}
					onclick={() => (preset = p.id)}
					class="cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none {preset === p.id
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-input bg-background text-foreground hover:bg-accent'}"
				>
					{p.label}
				</button>
			{/each}
		</div>
		<p class="mt-2 text-xs text-muted-foreground">{PRESETS.find((p) => p.id === preset)?.note}</p>
	</Card>

	<Card class="overflow-hidden border-primary/20">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
			<p class="text-xs font-medium uppercase tracking-wider text-destructive">Vista previa</p>
		</div>
		{#key resource.id}
			<ResourcePreview {resource} {datastore} />
		{/key}

		{#if resource.datastore_active === true}
			<!-- Variantes de esta sección: cuántas filas se piden y qué hacer con un X repetido. -->
			<div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
				<span class="font-semibold text-foreground">Variantes del gráfico</span>
				<label class="flex items-center gap-2">
					Filas pedidas
					<select bind:value={chartLimit} class="cursor-pointer rounded-md border border-input bg-background px-2 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
						<option value={20}>20</option>
						<option value={100}>100</option>
						<option value={500}>500</option>
					</select>
				</label>
				<label class="flex items-center gap-2">
					X repetido
					<select bind:value={aggregate} class="cursor-pointer rounded-md border border-input bg-background px-2 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
						<option value="choice">Lo decide el usuario</option>
						<option value="sum">Siempre sumar</option>
						<option value="none">Filas tal cual</option>
					</select>
				</label>
			</div>
			{#if chartData}
				{#key resource.id + chartLimit}
					<ChartBuilder fields={chartData.fields} records={chartData.records} total={chartData.total} {aggregate} {initialType} />
				{/key}
			{:else}
				<p class="border-t border-border px-4 py-6 text-sm text-muted-foreground" aria-busy="true">Cargando datos del gráfico…</p>
			{/if}
		{/if}
	</Card>
</div>
