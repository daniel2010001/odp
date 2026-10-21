<script lang="ts">
import { Loader2 } from "@lucide/svelte";
import type { DatastoreApi, DatastoreSearchResult } from "$lib/api/datastore";
import { fileUrl } from "$lib/resources/file-url";
import { isTabularFormat, previewKind } from "$lib/resources/preview";
import type { CkanResource } from "$lib/types/ckan";
import DataPreviewTable from "./DataPreviewTable.svelte";

// El panel de vista previa, uno solo para toda la ficha del recurso. **Qué** se puede previsualizar
// lo decide `$lib/resources/preview.ts` (función pura, testeada aparte); acá vive **cómo** se ve.
// Antes este componente decidía con un `format === "csv"` propio —una regla nuestra, no de CKAN— y
// eso producía un falso negativo: un XLSX que el DataPusher sí cargó tiene una tabla y el panel la
// negaba. Ahora la tabla la decide `datastore_active`, y el tipo del archivo decide el resto.
//
// Todo embed pasa por `fileUrl`: un archivo alojado sale de la ruta de descarga del portal (que
// autentica con la sesión y sirve los bytes con `Range`), y cualquier otra `url` pasa por
// `safeExternalUrl`: `resource.url` es texto arbitrario en CKAN —el asistente lo valida al escribir,
// la API y la UI nativa de CKAN no— y un `javascript:` almacenado se ejecutaría en un
// `<iframe src>`. Sin URL segura no hay embed: el panel cae al estado «none».
let {
	resource,
	datastore,
}: {
	resource: CkanResource;
	datastore: DatastoreApi;
} = $props();

const kind = $derived(previewKind(resource));
const sourceUrl = $derived(fileUrl(resource));

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
	// El efecto no cancela la consulta: marca su corrida como superada. Si el recurso cambia antes
	// de que resuelva la promesa anterior, esa respuesta vieja llegaría al final y pintaría filas
	// de otro recurso —el peor fallo posible en una vista previa, datos silenciosamente ajenos—.
	// El cleanup corre antes de la próxima ejecución y neutraliza los `then`/`catch` de la corrida
	// vieja. No usamos `AbortController` porque el cliente de la API no acepta un `signal`.
	let superseded = false;
	api
		.search(id, { limit: 20 })
		.then((result) => {
			if (superseded) return;
			data = result;
			loading = false;
		})
		.catch(() => {
			if (superseded) return;
			error = true;
			loading = false;
		});
	return () => {
		superseded = true;
	};
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
		<DataPreviewTable fields={data.fields} records={data.records} total={data.total} />
	{/if}
{:else if kind === "none" || sourceUrl === null}
	{@render compactState(noneCopy)}
{:else if kind === "pdf"}
	<!-- Alto del PDF: llena la pantalla bajo el encabezado (100dvh − 65px del encabezado encogido, con su
	     borde − 41px de la barra de la tarjeta − 2px de los bordes de la tarjeta − 2 × 16px de aire = 140px,
	     y además la barra de pestañas, `--tabs-h`, que pone el contenedor), sin pasar de 1,3 veces el ancho de la columna
	     (`cqw`, del contenedor de abajo; una hoja vertical) y sin bajar de 520px. En una pantalla baja
	     manda el piso de 520px y la página se desplaza; el de 240px sólo protege a ventanas diminutas. -->
	<div class="@container">
		<iframe
			src={sourceUrl}
			title={`Vista previa de ${resource.name}`}
			loading="lazy"
			class="h-[min(max(240px,calc(100dvh-140px-var(--tabs-h,0px))),max(520px,130cqw))] w-full"
		></iframe>
	</div>
{:else if kind === "image"}
	<!-- Misma regla de alto que el PDF, y además el relleno de la tarjeta (`p-4` = 32px): 140px + 32px = 172px. -->
	<div class="flex items-center justify-center p-4">
		<img
			src={sourceUrl}
			alt={resource.name}
			class="h-auto max-h-[max(360px,calc(100dvh-172px-var(--tabs-h,0px)))] w-full object-contain"
		/>
	</div>
{:else}
	<!--
		El texto usa la misma regla de alto que el PDF y la imagen (llena la pantalla).
		El texto se muestra en un `<iframe>` y no con un `fetch`: la API de CKAN no manda cabeceras
		CORS, así que el navegador no puede leer un archivo de otro origen. El `<iframe>` no necesita
		CORS porque no lee el contenido, lo muestra.
	-->
	<iframe
		src={sourceUrl}
		title={`Vista previa de ${resource.name}`}
		loading="lazy"
		class="h-[max(360px,calc(100dvh-140px-var(--tabs-h,0px)))] w-full"
	></iframe>
{/if}
