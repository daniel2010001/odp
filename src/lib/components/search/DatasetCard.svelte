<script lang="ts">
import { Building2, Calendar } from "lucide-svelte";
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

const description = $derived(
	dataset.notes ? dataset.notes.replace(/<[^>]*>/g, "").slice(0, 200) : "Sin descripción",
);

const FORMAT_COLORS: Record<string, string> = {
	CSV: "bg-[oklch(0.395_0.098_257/0.10)] text-primary border-primary/20",
	JSON: "bg-[oklch(0.45_0.12_145/0.10)] text-[oklch(0.45_0.12_145)] border-[oklch(0.45_0.12_145/0.20)]",
	PDF: "bg-[oklch(0.528_0.178_24/0.10)] text-secondary border-secondary/20",
	XLSX: "bg-[oklch(0.45_0.12_185/0.10)] text-[oklch(0.45_0.12_185)] border-[oklch(0.45_0.12_185/0.20)]",
	XLS: "bg-[oklch(0.45_0.12_185/0.10)] text-[oklch(0.45_0.12_185)] border-[oklch(0.45_0.12_185/0.20)]",
	GEOJSON:
		"bg-[oklch(0.45_0.12_285/0.10)] text-[oklch(0.45_0.12_285)] border-[oklch(0.45_0.12_285/0.20)]",
	BIBTEX:
		"bg-[oklch(0.55_0.10_85/0.10)] text-[oklch(0.55_0.10_85)] border-[oklch(0.55_0.10_85/0.20)]",
};

function getFormatColor(format: string): string {
	return FORMAT_COLORS[format] ?? "bg-muted text-muted-foreground border-border";
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

<a href={`/dataset/${dataset.id}`} class="group block no-underline">
	<Card class={cn('cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200', className)}>
		<div class="p-4 space-y-2">
			<!-- Header: org + private -->
			<div class="flex items-start justify-between gap-2">
				{#if dataset.organization}
					<span class="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-primary">
						<Building2 class="size-3" />
						{dataset.organization.title}
					</span>
				{/if}
				{#if dataset.private}
					<span class="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-destructive/20">
						Privado
					</span>
				{/if}
			</div>

			<!-- Title -->
			<h3 class="font-heading text-base font-semibold text-primary underline-offset-2 transition-colors group-hover:text-primary/80 group-hover:underline">
				{dataset.title || dataset.name}
			</h3>

			<!-- Description -->
			<p class="text-sm text-muted-foreground line-clamp-2">
				{description}
			</p>

			<!-- Tags -->
			{#if dataset.tags?.length}
				<div class="flex flex-wrap items-center gap-1.5">
					{#each dataset.tags.slice(0, 3) as tag}
						<span class="rounded-md border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
							#{tag.display_name || tag.name}
						</span>
					{/each}
					{#if dataset.tags.length > 3}
						<span class="text-[10px] text-muted-foreground">+{dataset.tags.length - 3}</span>
					{/if}
				</div>
			{/if}

			<!-- Footer: formats + date -->
			<div class="flex items-center justify-between gap-2 pt-1">
				<div class="flex flex-wrap items-center gap-1.5">
					{#each resourceFormats as format}
						<span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium {getFormatColor(format)}">
							{format}
						</span>
					{/each}
					{#if moreFormats > 0}
						<span class="text-[10px] text-muted-foreground">+{moreFormats} más</span>
					{/if}
				</div>

				<span class="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
					<Calendar class="size-3" />
					Actualizado {shortDate(dataset.metadata_modified)}
				</span>
			</div>
		</div>
	</Card>
</a>
