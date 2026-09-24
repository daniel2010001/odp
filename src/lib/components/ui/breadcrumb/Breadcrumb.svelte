<script lang="ts" module>
export interface BreadcrumbItem {
	label: string;
	href?: string;
}
</script>

<script lang="ts">
import { ChevronRight } from "@lucide/svelte";

let {
	items,
}: {
	items: BreadcrumbItem[];
} = $props();
</script>

<nav aria-label="Breadcrumb">
	<!-- En móvil la lista **no envuelve**: cada etiqueta se recorta antes que partirse en varias líneas
	     arriba del contenido. Desde `sm` vuelve el comportamiento anterior (envolver), así el escritorio
	     no cambia. El recorte es **visual**: el texto y el nombre accesible quedan enteros, que es lo que
	     lo hace seguro, y hay tests que lo anclan (`Breadcrumb.test.ts`). -->
	<ol class="flex items-center gap-1 text-sm sm:flex-wrap">
		{#each items as item, index}
			<li class="flex min-w-0 items-center gap-1">
				{#if index > 0}
					<ChevronRight class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				{/if}
				{#if item.href && index < items.length - 1}
					<a
						href={item.href}
						class="truncate text-muted-foreground transition-colors hover:text-foreground"
					>
						{item.label}
					</a>
				{:else}
					<span
						class={index === items.length - 1
							? "truncate font-medium text-foreground"
							: "truncate text-muted-foreground"}
						aria-current={index === items.length - 1 ? "page" : undefined}
					>
						{item.label}
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
