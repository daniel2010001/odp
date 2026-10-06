<script lang="ts">
import { Building2, Calendar, FileText } from "@lucide/svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
import { formatChips, MAX_FORMAT_CHIPS, normalizeFormats } from "$lib/resources/formats";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { datasetSummary } from "$lib/utils/dataset-summary";

// La card sigue siendo **un solo enlace** clicable. Cuando el recorte esconde tags o formatos,
// ese mismo `<a>` es el disparador de un tooltip que los lista; sin nada escondido, degrada al
// enlace normal (un tooltip vacío sería ruido). No hay `<button>` ni región: ningún interactivo
// anida dentro del enlace.
let { dataset, class: className = "" }: { dataset: CkanPackage; class?: string } = $props();

const formatSummary = $derived(formatChips(dataset.resources));

const resourceCount = $derived(dataset.resources?.length ?? 0);
const resourceCountLabel = $derived(
	resourceCount === 1 ? "1 recurso" : `${resourceCount} recursos`,
);

const description = $derived(datasetSummary(dataset) || "Sin descripción");

const tags = $derived(dataset.tags ?? []);

// Formatos ocultos por el recorte. La normalización (recorte + mayúsculas + dedupe en
// orden de aparición) vive en `normalizeFormats`: acá sólo se recorta con el mismo tope
// que usan los chips visibles, para que el recorte y su contraparte no puedan divergir.
const hiddenFormats = $derived(normalizeFormats(dataset.resources).slice(MAX_FORMAT_CHIPS));
const hiddenTags = $derived(tags.slice(3));

const hiddenTagCount = $derived(hiddenTags.length);
const hiddenFormatCount = $derived(hiddenFormats.length);
const hasHidden = $derived(hiddenTagCount > 0 || hiddenFormatCount > 0);

// El disparador del tooltip es un `<a>`: bits-ui inyecta `type="button"` en las props
// delegadas (su tipado es un primitivo de botón) y sobre un enlace ese atributo es
// inválido. Se descarta acá, donde se elige el elemento; el envoltorio del tooltip no
// debe reescribir props (§ `tooltip-trigger.svelte`).
function dropButtonType(props: Record<string, unknown>): Record<string, unknown> {
	const { type: _type, ...anchorProps } = props;
	return anchorProps;
}

const cardClass = $derived(
	cn(
		"cursor-pointer border-primary/15 transition-all duration-200 group-hover:border-primary/35 group-hover:shadow-md",
		className,
	),
);

// Color como ACENTO sobre contenedor neutro: los chips comparten el mismo
// frame (bg-muted/50 + border) y solo el texto lleva el color del formato.
// Así la fila se lee como un conjunto ordenado y el color distingue sin
// competir. Con variantes dark (a diferencia de los oklch hardcodeados).
const FORMAT_ACCENT: Record<string, string> = {
	CSV: "text-blue-700 dark:text-blue-300",
	JSON: "text-emerald-700 dark:text-emerald-300",
	PDF: "text-red-700 dark:text-red-300",
	XLSX: "text-teal-700 dark:text-teal-300",
	XLS: "text-teal-700 dark:text-teal-300",
	GEOJSON: "text-violet-700 dark:text-violet-300",
	BIBTEX: "text-amber-700 dark:text-amber-300",
	RDF: "text-sky-700 dark:text-sky-300",
	XML: "text-sky-700 dark:text-sky-300",
};

function getFormatAccent(format: string): string {
	return FORMAT_ACCENT[format] ?? "text-muted-foreground";
}

function shortDate(iso: string): string {
	try {
		return new Date(iso).toLocaleDateString("es-BO", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	} catch {
		return iso;
	}
}
</script>

<!-- Detalles escondidos por el recorte, en español neutro y trato de usted. Sólo los consume el
     `Tooltip`; el recorte visible de la card sigue siendo el `+N` pelado de siempre. -->
{#snippet hiddenDetails()}
	{#if hiddenTags.length > 0}
		<div class="space-y-1">
			<p class="font-medium">Otras etiquetas</p>
			<p>{hiddenTags.map((tag) => `#${tag.display_name || tag.name}`).join(", ")}</p>
		</div>
	{/if}
	{#if hiddenFormats.length > 0}
		<div class="space-y-1">
			<p class="font-medium">Otros formatos</p>
			<p>{hiddenFormats.join(", ")}</p>
		</div>
	{/if}
{/snippet}

{#snippet cardBody()}
	<div class="space-y-2.5 p-6">
		<!-- Title: text-xl bold para que domine sobre la meta -->
		<h3
			class="font-heading text-xl font-bold leading-[1.2] line-clamp-2 break-words text-primary underline-offset-2 transition-colors group-hover:text-primary/80 group-hover:underline"
		>
			{dataset.title || dataset.name}
		</h3>

		<!-- Meta: org (con icono, estilo actual) + privado -->
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
			{#if dataset.organization}
				<span class="inline-flex items-center gap-1.5 font-medium text-destructive">
					<Building2 class="size-3.5" aria-hidden="true" />
					{dataset.organization.title}
				</span>
			{/if}
			{#if dataset.private}
				<span class="text-destructive">· Privado</span>
			{/if}
		</div>

		<!-- Description -->
		<p class="text-sm text-muted-foreground line-clamp-2">
			{description}
		</p>

		<!-- Tags: chips con fondo muted suave -->
		{#if tags.length}
			<div class="flex flex-wrap items-center gap-1.5">
				{#each tags.slice(0, 3) as tag}
					<span
						class="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
					>
						#{tag.display_name || tag.name}
					</span>
				{/each}
				{#if tags.length > 3}
					<span class="text-xs text-muted-foreground">+{tags.length - 3}</span>
				{/if}
			</div>
		{/if}

		<!-- Footer: format chips (acento sobre neutro) + count de recursos + fecha -->
		<div
			class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/70 pt-3"
		>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each formatSummary.chips as format}
					<span
						class="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold {getFormatAccent(
							format,
						)}"
					>
						{format}
					</span>
				{/each}
				{#if formatSummary.more > 0}
					<span class="text-xs text-muted-foreground">+{formatSummary.more} más</span>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
				<span class="inline-flex items-center gap-1.5">
					<FileText class="size-3.5" aria-hidden="true" />
					{resourceCountLabel}
				</span>
				<span class="inline-flex items-center gap-1.5">
					<Calendar class="size-3.5" aria-hidden="true" />
					Actualizado {shortDate(dataset.metadata_modified)}
				</span>
			</div>
		</div>
	</div>
{/snippet}

{#snippet linkTrigger({ props }: { props: Record<string, unknown> })}
	{@const anchorProps = dropButtonType(props)}
	<a
		{...anchorProps}
		href={`/dataset/${dataset.name}`}
		class="group block rounded-xl no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	>
		<Card class={cardClass}>{@render cardBody()}</Card>
	</a>
{/snippet}

{#if hasHidden}
	<Tooltip>
		<TooltipTrigger child={linkTrigger} />
		<TooltipContent class="space-y-2">{@render hiddenDetails()}</TooltipContent>
	</Tooltip>
{:else}
	<a
		href={`/dataset/${dataset.name}`}
		class="group block rounded-xl no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	>
		<Card class={cardClass}>{@render cardBody()}</Card>
	</a>
{/if}
