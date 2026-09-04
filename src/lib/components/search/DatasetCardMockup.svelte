<script lang="ts">
import { ArrowRight } from "lucide-svelte";
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

const description = $derived(
	dataset.notes ? dataset.notes.replace(/<[^>]*>/g, "").slice(0, 240) : "Sin descripción",
);

const resourceCount = $derived(dataset.resources?.length ?? 0);
const resourceCountLabel = $derived(
	resourceCount === 1 ? "1 recurso" : `${resourceCount} recursos`,
);

// Formatos únicos, en el orden en que aparecen (hasta 3 para no saturar)
const formats = $derived(
	[
		...new Set(
			(dataset.resources ?? [])
				.map((r) => r.format?.toUpperCase())
				.filter((f): f is string => Boolean(f)),
		),
	].slice(0, 3),
);

// El mockup pinta los formatos como texto de color (no badges):
// API en verde, el resto en azul primario.
const FORMAT_TEXT_COLOR: Record<string, string> = {
	API: "text-emerald-700 dark:text-emerald-400",
};

function formatTextClass(format: string): string {
	return FORMAT_TEXT_COLOR[format] ?? "text-primary";
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

<!-- ResultCard — implementación del mockup OpenPencil (Catalogo/Search) -->
<a
	href={`/dataset/${dataset.id}`}
	class="group block no-underline focus-visible:outline-none"
>
	<Card
		class={cn(
			'cursor-pointer border-primary/15 transition-all duration-200 group-hover:border-primary/30 group-hover:shadow-md',
			className,
		)}
	>
		<div class="space-y-3 p-6">
			<!-- Title -->
			<h3
				class="font-heading text-xl font-bold leading-[1.2] text-foreground"
			>
				{dataset.title || dataset.name}
			</h3>

			<!-- Description -->
			<p class="text-sm leading-[1.5] text-muted-foreground line-clamp-2">
				{description}
			</p>

			<!-- Footer meta: org · versión · fecha · recursos · formatos · Ver → -->
			<div
				class="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-sm"
			>
				{#if dataset.organization}
					<span class="font-semibold text-destructive">
						{dataset.organization.title}
					</span>
					<span class="text-muted-foreground" aria-hidden="true">·</span>
				{/if}

				{#if dataset.version}
					<span class="font-semibold text-primary">v{dataset.version}</span>
					<span class="text-muted-foreground" aria-hidden="true">·</span>
				{/if}

				<span class="text-muted-foreground">
					{shortDate(dataset.metadata_modified)}
				</span>
				<span class="text-muted-foreground" aria-hidden="true">·</span>

				<span class="text-muted-foreground">{resourceCountLabel}</span>

				{#if formats.length}
					<span class="text-muted-foreground" aria-hidden="true">·</span>
					{#each formats as format, i (format)}
						{#if i > 0}
							<span class="text-muted-foreground" aria-hidden="true">/</span>
						{/if}
						<span class={formatTextClass(format)}>{format}</span>
					{/each}
				{/if}

				<span class="ml-auto inline-flex items-center gap-1 font-semibold text-destructive">
					Ver
					<ArrowRight
						class="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</span>
			</div>
		</div>
	</Card>
</a>
