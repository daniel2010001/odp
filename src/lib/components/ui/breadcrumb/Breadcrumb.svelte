<script lang="ts" module>
export interface BreadcrumbItem {
	label: string;
	href?: string;
}
</script>

<script lang="ts">
import { ChevronRight } from "lucide-svelte";

let {
	items,
}: {
	items: BreadcrumbItem[];
} = $props();
</script>

<nav aria-label="Breadcrumb">
	<ol class="flex flex-wrap items-center gap-1 text-sm">
		{#each items as item, index}
			<li class="flex items-center gap-1">
				{#if index > 0}
					<ChevronRight class="size-3.5 text-muted-foreground" aria-hidden="true" />
				{/if}
				{#if item.href && index < items.length - 1}
					<a
						href={item.href}
						class="text-muted-foreground transition-colors hover:text-foreground"
					>
						{item.label}
					</a>
				{:else}
					<span
						class={index === items.length - 1
							? "font-medium text-foreground"
							: "text-muted-foreground"}
						aria-current={index === items.length - 1 ? "page" : undefined}
					>
						{item.label}
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
