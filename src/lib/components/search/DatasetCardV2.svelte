<script lang="ts">
import { Building2, Calendar, FileText } from "lucide-svelte";
import Card from "$lib/components/ui/card/card.svelte";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";

let {
	dataset,
	class: className = "",
}: {
	dataset: CkanPackage;
	class?: string;
} = $props();

const resourceFormats = $derived(
	dataset.resources
		?.map((r) => r.format?.toUpperCase())
		.filter((f): f is string => Boolean(f))
		.slice(0, 4) ?? [],
);

const moreFormats = $derived(
	dataset.resources ? dataset.resources.length - resourceFormats.length : 0,
);

const resourceCount = $derived(dataset.resources?.length ?? 0);
const resourceCountLabel = $derived(
	resourceCount === 1 ? "1 recurso" : `${resourceCount} recursos`,
);

const description = $derived(
	dataset.notes ? dataset.notes.replace(/<[^>]*>/g, "").slice(0, 200) : "Sin descripción",
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

<a href={`/dataset/${dataset.id}`} class="group block no-underline focus-visible:outline-none">
	<Card
		class={cn(
			'cursor-pointer border-primary/15 transition-all duration-200 group-hover:border-primary/35 group-hover:shadow-md',
			className,
		)}
	>
		<div class="space-y-2.5 p-6">
			<!-- Title: escala del mockup (text-xl bold) para que domine sobre la meta -->
			<h3
				class="font-heading text-xl font-bold leading-[1.2] text-primary underline-offset-2 transition-colors group-hover:text-primary/80 group-hover:underline"
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
			{#if dataset.tags?.length}
				<div class="flex flex-wrap items-center gap-1.5">
					{#each dataset.tags.slice(0, 3) as tag}
						<span
							class="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
						>
							#{tag.display_name || tag.name}
						</span>
					{/each}
					{#if dataset.tags.length > 3}
						<span class="text-xs text-muted-foreground">+{dataset.tags.length - 3}</span>
					{/if}
				</div>
			{/if}

			<!-- Footer: format chips (acento sobre neutro) + count de recursos + fecha -->
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/70 pt-3">
				<div class="flex flex-wrap items-center gap-1.5">
					{#each resourceFormats as format}
						<span
							class="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold {getFormatAccent(format)}"
						>
							{format}
						</span>
					{/each}
					{#if moreFormats > 0}
						<span class="text-xs text-muted-foreground">+{moreFormats} más</span>
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
	</Card>
</a>
