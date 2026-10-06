<script lang="ts" module>
/**
 * Cómo se divulga lo que el recorte de tags y formatos esconde.
 *
 * - `off`: el comportamiento de hoy (3 tags + un `+N` pelado, 4 formatos + `+N más`).
 * - `link-tooltip`: la card entera sigue siendo un `<a>` y ese enlace es el disparador
 *   del tooltip; el contenido lista las etiquetas y los formatos que el recorte esconde.
 * - `title-link`: el `<h3>` envuelve el `<a>` y la divulgación es un `<button>` real que
 *   despliega una región; la card deja de ser un enlace clicable.
 */
export type CardDisclosure = "off" | "link-tooltip" | "title-link";
</script>

<script lang="ts">
import { Building2, Calendar, ChevronDown, FileText } from "@lucide/svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
import { formatChips, MAX_FORMAT_CHIPS, normalizeFormats } from "$lib/resources/formats";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { datasetSummary } from "$lib/utils/dataset-summary";

let {
	dataset,
	class: className = "",
	disclosure = "off",
	forceOpen = false,
}: {
	dataset: CkanPackage;
	class?: string;
	disclosure?: CardDisclosure;
	forceOpen?: boolean;
} = $props();

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

// Rótulo preciso sobre qué hay escondido; en español neutro y trato de usted.
const disclosureLabel = $derived.by(() => {
	if (hiddenTagCount > 0 && hiddenFormatCount > 0)
		return `Ver ${hiddenTagCount} etiquetas y ${hiddenFormatCount} formatos ocultos`;
	if (hiddenTagCount > 0) return `Ver ${hiddenTagCount} etiquetas ocultas`;
	if (hiddenFormatCount > 0) return `Ver ${hiddenFormatCount} formatos ocultos`;
	return "Ver más";
});

const regionId = $props.id();
let expanded = $state(false);
let tooltipOpen = $state(false);
const isExpanded = $derived(forceOpen || expanded);
// Marca que el abierto del tooltip vino del forzado, para poder cerrarlo al apagarlo.
let wasForced = false;

// `forceOpen` fija la divulgación mientras está encendido: si el puntero o el foco la cierran, el
// efecto la vuelve a abrir. Al **apagarlo** hay que cerrarla: con `forceOpen || tooltipOpen` a
// secas, el `true` forzado quedaría pegado y el tooltip seguiría abierto hasta un blur o un
// pointer-leave. `wasForced` distingue el abierto forzado del abierto real del usuario.
$effect(() => {
	if (forceOpen) {
		wasForced = true;
		if (!tooltipOpen) tooltipOpen = true;
		return;
	}
	if (wasForced) {
		wasForced = false;
		if (tooltipOpen) tooltipOpen = false;
	}
});

function toggleDisclosure() {
	expanded = !expanded;
}

// El disparador del tooltip es un `<a>`: bits-ui inyecta `type="button"` en las props
// delegadas (su tipado es un primitivo de botón) y sobre un enlace ese atributo es
// inválido. Se descarta acá, donde se elige el elemento; el envoltorio del tooltip no
// debe reescribir props (§ `tooltip-trigger.svelte`).
function dropButtonType(props: Record<string, unknown>): Record<string, unknown> {
	const { type: _type, ...anchorProps } = props;
	return anchorProps;
}

// En `title-link` la card deja de ser un enlace, así que pierde el `cursor-pointer`
// y los realces de `group-hover` (no hay `group`); el resto de las formas conserva
// las clases de hoy.
const cardClass = $derived(
	disclosure === "title-link"
		? cn("border-primary/15 transition-all duration-200", className)
		: cn(
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

<!-- Un solo bloque de detalles escondidos, compartido por las dos formas: lo
     consume el `Tooltip` de `link-tooltip` y la región de `title-link`. Es el
     punto donde «un mecanismo arregla los dos recortes» se vuelve literal. -->
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

<!-- El cuerpo de la card, idéntico en las tres formas salvo el título (que en
     `title-link` envuelve el enlace) y el bloque de divulgación. -->
{#snippet cardBody()}
	<div class="space-y-2.5 p-6">
		{#if disclosure === "title-link"}
			<h3
				class="font-heading text-xl font-bold leading-[1.2] line-clamp-2 break-words text-primary"
			>
				<a
					href={`/dataset/${dataset.name}`}
					class="rounded-sm underline-offset-2 hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					{dataset.title || dataset.name}
				</a>
			</h3>
		{:else}
			<!-- Title: text-xl bold para que domine sobre la meta -->
			<h3
				class="font-heading text-xl font-bold leading-[1.2] line-clamp-2 break-words text-primary underline-offset-2 transition-colors group-hover:text-primary/80 group-hover:underline"
			>
				{dataset.title || dataset.name}
			</h3>
		{/if}

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

		{#if disclosure === "title-link" && hasHidden}
			<button
				type="button"
				class="inline-flex w-fit items-center gap-1.5 rounded-md text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				aria-expanded={isExpanded}
				aria-controls={regionId}
				onclick={toggleDisclosure}
			>
				{isExpanded ? "Ocultar" : disclosureLabel}
				<ChevronDown
					class={cn(
						"size-3.5 transition-transform motion-reduce:transition-none",
						isExpanded && "rotate-180",
					)}
					aria-hidden="true"
				/>
			</button>
			<div
				id={regionId}
				hidden={!isExpanded}
				class="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
			>
				{@render hiddenDetails()}
			</div>
		{/if}
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

{#if disclosure === "link-tooltip" && hasHidden}
	<Tooltip bind:open={tooltipOpen}>
		<TooltipTrigger child={linkTrigger} />
		<TooltipContent class="space-y-2">{@render hiddenDetails()}</TooltipContent>
	</Tooltip>
{:else if disclosure === "title-link"}
	<Card class={cardClass}>{@render cardBody()}</Card>
{:else}
	<a
		href={`/dataset/${dataset.name}`}
		class="group block rounded-xl no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	>
		<Card class={cardClass}>{@render cardBody()}</Card>
	</a>
{/if}
