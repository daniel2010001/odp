<script lang="ts">
import type { CkanResource } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { formatSize } from "$lib/utils/ckan";

let {
	resource,
	datasetId,
	class: className = "",
}: {
	resource: CkanResource;
	datasetId: string;
	class?: string;
} = $props();

const formatBadge = $derived.by(() => {
	const fmt = (resource.format ?? "").toUpperCase();
	const badges: Record<string, { label: string; class: string }> = {
		CSV: { label: "CSV", class: "bg-[oklch(0.395_0.098_257/0.10)] text-primary border-primary/20" },
		JSON: {
			label: "JSON",
			class:
				"bg-[oklch(0.45_0.12_145/0.10)] text-[oklch(0.45_0.12_145)] border-[oklch(0.45_0.12_145/0.20)]",
		},
		XML: {
			label: "XML",
			class:
				"bg-[oklch(0.55_0.10_85/0.10)] text-[oklch(0.55_0.10_85)] border-[oklch(0.55_0.10_85/0.20)]",
		},
		PDF: {
			label: "PDF",
			class: "bg-[oklch(0.528_0.178_24/0.10)] text-secondary border-secondary/20",
		},
		HTML: {
			label: "HTML",
			class:
				"bg-[oklch(0.45_0.12_285/0.10)] text-[oklch(0.45_0.12_285)] border-[oklch(0.45_0.12_285/0.20)]",
		},
		XLS: {
			label: "XLS",
			class:
				"bg-[oklch(0.45_0.12_185/0.10)] text-[oklch(0.45_0.12_185)] border-[oklch(0.45_0.12_185/0.20)]",
		},
		XLSX: {
			label: "XLSX",
			class:
				"bg-[oklch(0.45_0.12_185/0.10)] text-[oklch(0.45_0.12_185)] border-[oklch(0.45_0.12_185/0.20)]",
		},
		ZIP: {
			label: "ZIP",
			class:
				"bg-[oklch(0.55_0.015_257/0.10)] text-[oklch(0.55_0.015_257)] border-[oklch(0.55_0.015_257/0.20)]",
		},
		PNG: {
			label: "PNG",
			class:
				"bg-[oklch(0.55_0.12_340/0.10)] text-[oklch(0.55_0.12_340)] border-[oklch(0.55_0.12_340/0.20)]",
		},
		JPG: {
			label: "JPG",
			class:
				"bg-[oklch(0.55_0.12_340/0.10)] text-[oklch(0.55_0.12_340)] border-[oklch(0.55_0.12_340/0.20)]",
		},
		JPEG: {
			label: "JPEG",
			class:
				"bg-[oklch(0.55_0.12_340/0.10)] text-[oklch(0.55_0.12_340)] border-[oklch(0.55_0.12_340/0.20)]",
		},
	};
	return (
		badges[fmt] ?? { label: fmt || "FILE", class: "bg-muted text-muted-foreground border-border" }
	);
});
</script>

<a
	href={`/dataset/${datasetId}/resource/${resource.id}`}
	class={cn(
		"flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30 sm:p-4",
		className,
	)}
	aria-label="{resource.name || 'Recurso'}, detalle del recurso"
>
	<!-- Format badge -->
	<div
		class={cn(
			"flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1 text-xs font-bold",
			formatBadge.class,
		)}
	>
		{formatBadge.label}
	</div>

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
