<script lang="ts">
import { formatDotClass, formatIcon, formatTileClass } from "$lib/resources/format-visual";
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

// El tipo lo decide `url_type`: un archivo alojado muestra su formato (enlace a `/search?format=`),
// una referencia externa dice «Enlace externo». Un enlace nunca lleva el formato —esa era la mentira: un
// `format` y un `size` sobre una URL externa— y es neutro, como un formato desconocido.
//
// Enlace estirado (variante D + E4 + I4 + B1, elegida por el autor el 2026-10-20): el título es el enlace a la
// ficha y su `::after` cubre la fila; el formato es **otro** enlace, hermano y por encima (`z-10`).
// Nunca hay `<a>` dentro de `<a>`.
const isLink = $derived(resourceKind(resource) === "link");
const format = $derived(isLink ? null : resource.format?.trim().toUpperCase() || null);
const Icon = $derived(formatIcon(format, isLink));
const name = $derived(resource.name || resource.url.split("/").pop() || "Recurso");
</script>

<div
	class={cn(
		"relative flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30 sm:p-4",
		className,
	)}
>
	<span class={formatTileClass(format, isLink)}><Icon class="size-4" aria-hidden="true" /></span>

	<div class="min-w-0 flex-1">
		<a
			href={`/dataset/${datasetSlug}/resource/${resource.id}`}
			aria-label="{name}, detalle del recurso"
			class="block truncate rounded-sm text-sm font-medium text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			{name}
		</a>
		<p class="mt-0.5 text-xs text-muted-foreground">
			{resource.description || "Sin descripción"}
		</p>
		<p class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
			{#if isLink}
				<span>Enlace externo</span>
			{:else if format}
				<!-- Área de toque de ~44 px: el `before:` amplía sin cambiar el alto visible ni mover el layout. -->
				<a
					href={`/search?format=${encodeURIComponent(format)}`}
					title="Buscar datasets con formato {format}"
					aria-label="{format}, buscar datasets con este formato"
					class="relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold text-muted-foreground transition-colors before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					<span class={cn("size-2 rounded-full", formatDotClass(format))} aria-hidden="true"></span>
					{format}
				</a>
			{:else}
				<span>Archivo</span>
			{/if}
			{#if resource.size !== undefined && resource.size !== null}
				<span aria-hidden="true">·</span><span>{formatSize(resource.size)}</span>
			{/if}
			{#if resource.last_modified}
				<span aria-hidden="true">·</span>
				<span>Actualizado: {new Date(resource.last_modified).toLocaleDateString("es-BO")}</span>
			{/if}
		</p>
	</div>
</div>
