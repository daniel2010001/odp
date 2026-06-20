<script lang="ts">
import { Building2, Calendar, FileText } from "lucide-svelte";
import Card from "$lib/components/ui/card/card.svelte";
import type { CkanPackage } from "$lib/types/ckan";
import { cn, formatDate, formatSize } from "$lib/utils";

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
	CSV: "bg-emerald-50 text-emerald-700 border-emerald-200",
	JSON: "bg-accent text-primary border-primary/20",
	PDF: "bg-red-50 text-red-700 border-red-200",
	XLSX: "bg-teal-50 text-teal-700 border-teal-200",
	XLS: "bg-teal-50 text-teal-700 border-teal-200",
	GEOJSON: "bg-violet-50 text-violet-700 border-violet-200",
	BIBTEX: "bg-amber-50 text-amber-700 border-amber-200",
};

function getFormatColor(format: string): string {
	return FORMAT_COLORS[format] ?? "bg-muted text-muted-foreground border-border";
}
</script>

<Card class={cn('border border-border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md', className)}>
	<div class="space-y-3">
		<!-- Header -->
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<a
					href={`/dataset/${dataset.id}`}
					class="text-base font-semibold text-primary underline-offset-2 transition-colors duration-200 hover:text-primary/80 hover:underline"
				>
					{dataset.title || dataset.name}
				</a>
			</div>
			{#if dataset.private}
				<span
					class="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
				>
					Privado
				</span>
			{/if}
		</div>

		<!-- Description -->
		<p class="text-sm leading-relaxed text-muted-foreground line-clamp-2">
			{description}
		</p>

		<!-- Metadata row -->
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
			{#if dataset.organization}
				<span class="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-primary">
					<Building2 class="size-3" />
					{dataset.organization.title}
				</span>
			{/if}
			<span class="inline-flex items-center gap-1">
				<Calendar class="size-3" />
				{formatDate(dataset.metadata_modified)}
			</span>
		</div>

		<!-- Tags + Formats -->
		<div class="flex flex-wrap items-center gap-2">
			{#each resourceFormats as format}
				<span
					class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium {getFormatColor(format)}"
				>
					<FileText class="size-3" />
					{format}
				</span>
			{/each}
			{#if moreFormats > 0}
				<span class="text-[11px] text-muted-foreground">+{moreFormats} más</span>
			{/if}

			{#if dataset.tags?.length}
				<span class="mx-1 text-border">|</span>
				{#each dataset.tags.slice(0, 3) as tag}
					<span class="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
						{tag.display_name || tag.name}
					</span>
				{/each}
				{#if dataset.tags.length > 3}
					<span class="text-[11px] text-muted-foreground">+{dataset.tags.length - 3}</span>
				{/if}
			{/if}
		</div>
	</div>
</Card>
