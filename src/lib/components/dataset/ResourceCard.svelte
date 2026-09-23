<script lang="ts">
import ResourceKindChip from "$lib/components/resource/ResourceKindChip.svelte";
import { resourceKind } from "$lib/resources/kind";
import type { CkanResource } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { formatSize } from "$lib/utils/ckan";

let {
	resource,
	datasetSlug,
	class: className = "",
}: {
	resource: CkanResource;
	datasetSlug: string;
	class?: string;
} = $props();

// El chip de la tarjeta es uno solo y lo decide el tipo de recurso (`url_type`): un archivo alojado
// muestra su formato, una referencia externa muestra «Enlace». Un enlace nunca lleva el chip de
// formato —esa era la mentira: un `format` y un `size` sobre una URL externa— y un archivo nunca
// lleva el de enlace.
const kind = $derived(resourceKind(resource));
</script>

<a
	href={`/dataset/${datasetSlug}/resource/${resource.id}`}
	class={cn(
		"flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30 sm:p-4",
		className,
	)}
	aria-label="{resource.name || 'Recurso'}, detalle del recurso"
>
	<!-- Kind badge: formato para un archivo alojado, «Enlace» para una referencia externa -->
	<ResourceKindChip {kind} format={resource.format} />

	<!-- Resource info -->
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium text-foreground">
			{resource.name || resource.url.split("/").pop() || "Recurso"}
		</p>
		<p class="mt-0.5 text-xs text-muted-foreground">
			{resource.description || "Sin descripción"}
		</p>
		<div class="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
			{#if resource.size !== undefined && resource.size !== null}
				<span>{formatSize(resource.size)}</span>
			{/if}
			{#if resource.last_modified}
				<span>Actualizado: {new Date(resource.last_modified).toLocaleDateString("es-BO")}</span>
			{/if}
		</div>
	</div>
</a>
