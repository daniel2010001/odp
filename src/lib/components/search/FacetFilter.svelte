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

let open = $state(true);
let showAll = $state(false);
const DEFAULT_SHOW = 5;
const visibleItems = $derived(open && showAll ? items : open ? items.slice(0, DEFAULT_SHOW) : []);
const hasMore = $derived(items.length > DEFAULT_SHOW);
</script>

<div class={cn('', className)}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-expanded={open}
		class="group flex w-full items-baseline gap-2 py-1 text-left transition-colors duration-200"
	>
		<span class="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
			{title}
		</span>
		{#if items.length > 0}
			<span class="text-[11px] font-medium text-muted-foreground">({items.length})</span>
		{/if}
		<span class="min-w-0 flex-1 border-t border-border" aria-hidden="true"></span>
		<ChevronDown
			class="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-primary {open ? 'rotate-180' : ''}"
		/>
	</button>

	{#if open}
		<div class="mt-1 space-y-0.5">
			{#each visibleItems as item (item.name)}
				<label
					class={cn(
						"flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150",
						selected.includes(item.name) ? "bg-primary/10" : "hover:bg-accent",
					)}
				>
					<input
						type="checkbox"
						checked={selected.includes(item.name)}
						onchange={() => onselect?.(item.name)}
						class="size-4 shrink-0 rounded border-border text-primary accent-primary focus:ring-2 focus:ring-primary focus:ring-offset-1"
					/>
					<span
						class="min-w-0 flex-1 truncate {selected.includes(item.name)
							? 'font-medium text-primary'
							: 'text-foreground'}"
						title={item.display_name}
					>
						{item.display_name}
					</span>
					<span class="shrink-0 text-xs font-medium text-muted-foreground">{item.count}</span>
				</label>
			{/each}
		</div>

		{#if hasMore}
			<button
				type="button"
				onclick={() => (showAll = !showAll)}
				class="mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-destructive underline-offset-2 transition-colors duration-200 hover:bg-destructive/5 hover:underline"
			>
				{showAll ? 'Mostrar menos' : `Ver ${items.length - DEFAULT_SHOW} más`}
				<ChevronDown
					class="size-3 transition-transform duration-200 {showAll ? 'rotate-180' : ''}"
				/>
			</button>
		{/if}
	{/if}
</div>
