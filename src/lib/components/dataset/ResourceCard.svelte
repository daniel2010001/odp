<script lang="ts">
import { Download } from "lucide-svelte";
import type { CkanResource } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { formatSize } from "$lib/utils/ckan";

let {
	resource,
	class: className = "",
}: {
	resource: CkanResource;
	class?: string;
} = $props();

const formatBadge = $derived.by(() => {
	const fmt = (resource.format ?? "").toUpperCase();
	const badges: Record<string, { label: string; class: string }> = {
		CSV: { label: "CSV", class: "bg-blue-100 text-blue-700" },
		JSON: { label: "JSON", class: "bg-green-100 text-green-700" },
		XML: { label: "XML", class: "bg-amber-100 text-amber-700" },
		PDF: { label: "PDF", class: "bg-red-100 text-red-700" },
		HTML: { label: "HTML", class: "bg-purple-100 text-purple-700" },
		XLS: { label: "XLS", class: "bg-emerald-100 text-emerald-700" },
		XLSX: { label: "XLSX", class: "bg-emerald-100 text-emerald-700" },
		ZIP: { label: "ZIP", class: "bg-slate-100 text-slate-700" },
		PNG: { label: "PNG", class: "bg-pink-100 text-pink-700" },
		JPG: { label: "JPG", class: "bg-pink-100 text-pink-700" },
		JPEG: { label: "JPEG", class: "bg-pink-100 text-pink-700" },
	};
	return badges[fmt] ?? { label: fmt || "FILE", class: "bg-gray-100 text-gray-700" };
});

</script>

<div
	class={cn(
		"flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30 sm:p-4",
		className,
	)}
>
	<!-- Format badge -->
	<div
		class={cn(
			"flex shrink-0 items-center justify-center rounded-md px-2.5 py-1 text-xs font-bold",
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

	<!-- Download link -->
	<a
		href={resource.url}
		target="_blank"
		rel="noopener noreferrer"
		class="flex shrink-0 items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
	>
		<Download class="size-3.5" />
		<span class="hidden sm:inline">Descargar</span>
	</a>
</div>
