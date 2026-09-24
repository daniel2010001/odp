<script lang="ts">
import { Loader2 } from "@lucide/svelte";
import type { DatastoreApi, DatastoreSearchResult } from "$lib/api/datastore";
import { isTabularFormat, previewKind } from "$lib/resources/preview";
import type { CkanResource } from "$lib/types/ckan";
import { safeExternalUrl } from "$lib/utils/external-url";
import DataPreviewTable from "./DataPreviewTable.svelte";

// El panel de vista previa, uno solo para toda la ficha del recurso. **Qué** se puede previsualizar
// lo decide `$lib/resources/preview.ts` (función pura, testeada aparte); acá vive **cómo** se ve.
// Antes este componente decidía con un `format === "csv"` propio —una regla nuestra, no de CKAN— y
// eso producía un falso negativo: un XLSX que el DataPusher sí cargó tiene una tabla y el panel la
// negaba. Ahora la tabla la decide `datastore_active`, y el tipo del archivo decide el resto.
//
// Todo embed pasa por `safeExternalUrl`: `resource.url` es texto arbitrario en CKAN —el asistente lo
// valida al escribir, la API y la UI nativa de CKAN no— y un `javascript:` almacenado se ejecutaría
// en un `<iframe src>`. Sin URL segura no hay embed: el panel cae al estado «none».
let {
	resource,
	datastore,
}: {
	resource: CkanResource;
	datastore: DatastoreApi;
} = $props();

const kind = $derived(previewKind(resource));
const sourceUrl = $derived(safeExternalUrl(resource.url));

interface StateCopy {
	title: string;
	detail: string;
}

// El estado «none» dice la verdad en dos casos que no son el mismo: un formato tabular que todavía
// no tiene tabla (el DataPusher puede cargarla) no es lo mismo que un tipo de archivo que el portal
// no previsualiza en absoluto. `isTabularFormat` espeja la lista de CKAN; si esa lista cambia, el
// texto cambia con ella.
const noneCopy = $derived<StateCopy>(
	isTabularFormat(resource)
		? {
				title: "Sin vista previa disponible",
				detail: "Este recurso todavía no tiene datos cargados en la vista previa del portal.",
			}
		: {
				title: "Sin vista previa disponible",
				detail: "El portal no puede previsualizar este tipo de archivo. Descárguelo para verlo.",
			},
);

// Los dos únicos estados del tipo «table» que no tienen tabla que mostrar. La copy es la de antes;
// lo que cambió es la densidad: la caja alta con el círculo de 64px decía demasiado poco para el
// hueco que ocupaba (el autor lo marcó en `BACKLOG.md`).
const tableError: StateCopy = {
	title: "Vista previa no disponible",
	detail: "No se pudo cargar la vista previa de datos.",
};
const tableEmpty: StateCopy = {
	title: "Sin datos",
	detail: "Este recurso aún no tiene datos cargados en la vista previa.",
};

let loading = $state(true);
let error = $state(false);
let data = $state<DatastoreSearchResult | null>(null);

$effect(() => {
	const id = resource.id;
	const api = datastore;
	if (kind !== "table") {
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

{#snippet compactState(copy: StateCopy)}
	<div class="px-6 py-8 text-center">
		<p class="font-heading text-base font-bold text-foreground">{copy.title}</p>
		<p class="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
			{copy.detail}
		</p>
	</div>
{/snippet}

{#if kind === "table"}
	{#if loading}
		<div class="flex min-h-[420px] items-center justify-center gap-3 p-10" aria-busy="true">
			<Loader2 class="size-6 animate-spin text-primary" />
			<p class="text-sm text-muted-foreground">Cargando vista previa…</p>
		</div>
	{:else if error}
		{@render compactState(tableError)}
	{:else if data && data.records.length === 0}
		{@render compactState(tableEmpty)}
	{:else if data}
		<DataPreviewTable fields={data.fields} records={data.records} total={data.total} limit={20} />
	{/if}
{:else if kind === "none" || sourceUrl === null}
	{@render compactState(noneCopy)}
{:else if kind === "pdf"}
	<iframe
		src={sourceUrl}
		title={`Vista previa de ${resource.name}`}
		loading="lazy"
		class="h-[520px] w-full"
	></iframe>
{:else if kind === "image"}
	<div class="flex items-center justify-center p-4">
		<img
			src={sourceUrl}
			alt={resource.name}
			class="max-h-[520px] w-auto max-w-full object-contain"
		/>
	</div>
{:else}
	<!--
		El texto se muestra en un `<iframe>` y no con un `fetch`: la API de CKAN no manda cabeceras
		CORS, así que el navegador no puede leer un archivo de otro origen. El `<iframe>` no necesita
		CORS porque no lee el contenido, lo muestra.
	-->
	<iframe
		src={sourceUrl}
		title={`Vista previa de ${resource.name}`}
		loading="lazy"
		class="h-[360px] w-full"
	></iframe>
{/if}
