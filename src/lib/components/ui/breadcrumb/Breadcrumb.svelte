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

<nav aria-label="Breadcrumb" class="min-w-0">
	<!-- En móvil la lista **no envuelve**: cada etiqueta se recorta antes que partirse en varias líneas
	     arriba del contenido. Desde `sm` vuelve el comportamiento anterior (envolver), así el escritorio
	     no cambia. El recorte es **visual**: el texto y el nombre accesible quedan enteros, que es lo que
	     lo hace seguro, y hay tests que lo anclan (`Breadcrumb.test.ts`).

	     `min-w-0` en la raíz NO es decorativo: el `<nav>` es el item flexible de un contenedor flex en
	     quien lo usa, y un item flexible no baja de su ancho de contenido sin esto. Sin él, un
	     `truncate` adentro no puede actuar y el nav desborda en horizontal en vez de recortar — lo
	     encontró la revisión nativa `review-5ab16f231f1adb49` (`R3-001`, CRITICAL) y hay una aserción
	     que lo ancla. -->
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
