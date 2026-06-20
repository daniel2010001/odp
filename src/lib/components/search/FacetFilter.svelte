<script lang="ts">
import { ChevronDown } from "lucide-svelte";
import { cn } from "$lib/utils";

let {
	title = "",
	items = [] as { name: string; display_name: string; count: number }[],
	selected = [] as string[],
	onselect,
	class: className = "",
}: {
	title?: string;
	items?: { name: string; display_name: string; count: number }[];
	selected?: string[];
	onselect?: (name: string) => void;
	class?: string;
} = $props();

let showAll = $state(false);
const DEFAULT_SHOW = 5;
const visibleItems = $derived(showAll ? items : items.slice(0, DEFAULT_SHOW));
const hasMore = $derived(items.length > DEFAULT_SHOW);
</script>

<fieldset class={cn('space-y-1', className)}>
	<legend class="mb-2 text-sm font-semibold text-primary">
		{title}
	</legend>

	{#each visibleItems as item (item.name)}
		<label
			class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all duration-150 hover:bg-accent"
		>
			<input
				type="checkbox"
				checked={selected.includes(item.name)}
				onchange={() => onselect?.(item.name)}
				class="size-4 rounded border-border text-primary accent-primary focus:ring-2 focus:ring-primary focus:ring-offset-1"
			/>
			<span class="flex-1 truncate text-primary">{item.display_name}</span>
			<span class="text-xs font-medium text-muted-foreground">{item.count}</span>
		</label>
	{/each}

	{#if hasMore}
		<button
			type="button"
			onclick={() => (showAll = !showAll)}
			class="flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-all duration-200 hover:bg-accent"
		>
			{showAll ? 'Mostrar menos' : `Mostrar ${items.length - DEFAULT_SHOW} más`}
			<ChevronDown
				class="size-3 transition-transform duration-200 {showAll ? 'rotate-180' : ''}"
			/>
		</button>
	{/if}
</fieldset>
