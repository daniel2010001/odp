<script lang="ts">
import { FileText, Loader2 } from "lucide-svelte";
import type { DatastoreApi, DatastoreSearchResult } from "$lib/api/datastore";
import type { CkanResource } from "$lib/types/ckan";
import DataPreviewTable from "./DataPreviewTable.svelte";

let {
	resource,
	datastore,
}: {
	resource: CkanResource;
	datastore: DatastoreApi;
} = $props();

const isCsv = $derived(resource.format?.trim().toLowerCase() === "csv");

let loading = $state(true);
let error = $state(false);
let data = $state<DatastoreSearchResult | null>(null);

$effect(() => {
	const id = resource.id;
	const api = datastore;
	if (!isCsv) {
		loading = false;
		error = false;
		data = null;
		return;
	}
	loading = true;
	error = false;
	data = null;
	api
		.search(id, { limit: 20 })
		.then((result) => {
			data = result;
			loading = false;
		})
		.catch(() => {
			error = true;
			loading = false;
		});
});
</script>

{#if !isCsv}
	<div class="flex min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
		<div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
			<FileText class="size-8 text-primary" />
		</div>
		<p class="font-heading text-xl font-bold text-foreground">Vista previa no disponible</p>
		<p class="max-w-md text-sm leading-relaxed text-muted-foreground">
			La vista previa de datos está disponible únicamente para recursos CSV.
		</p>
	</div>
{:else if loading}
	<div class="flex min-h-[420px] items-center justify-center gap-3 p-10" aria-busy="true">
		<Loader2 class="size-6 animate-spin text-primary" />
		<p class="text-sm text-muted-foreground">Cargando vista previa…</p>
	</div>
{:else if error}
	<div class="flex min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
		<div class="flex size-16 items-center justify-center rounded-full bg-destructive/10">
			<FileText class="size-8 text-destructive" />
		</div>
		<p class="font-heading text-xl font-bold text-foreground">Vista previa no disponible</p>
		<p class="max-w-md text-sm leading-relaxed text-muted-foreground">
			No se pudo cargar la vista previa de datos.
		</p>
	</div>
{:else if data && data.records.length === 0}
	<div class="flex min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
		<div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
			<FileText class="size-8 text-primary" />
		</div>
		<p class="font-heading text-xl font-bold text-foreground">Sin datos</p>
		<p class="max-w-md text-sm leading-relaxed text-muted-foreground">
			Este recurso aún no tiene datos cargados en la vista previa.
		</p>
	</div>
{:else if data}
	<DataPreviewTable fields={data.fields} records={data.records} total={data.total} limit={20} />
{/if}
