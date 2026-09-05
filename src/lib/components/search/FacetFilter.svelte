<script lang="ts">
import { ChevronDown, Search } from "lucide-svelte";
import { onMount } from "svelte";
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
let query = $state("");

// En móvil (< md = 768px) los acordeones arrancan contraídos; en desktop
// (md+) quedan abiertos por defecto. Solo se ajusta al montar.
onMount(() => {
	open = window.matchMedia("(min-width: 768px)").matches;
});

const DEFAULT_SHOW = 5;

const normalizedQuery = $derived(query.trim().toLowerCase());
const filteredItems = $derived(
	normalizedQuery
		? items.filter(
				(i) =>
					i.display_name.toLowerCase().includes(normalizedQuery) ||
					i.name.toLowerCase().includes(normalizedQuery),
			)
		: items,
);
const visibleItems = $derived(
	open && showAll ? filteredItems : open ? filteredItems.slice(0, DEFAULT_SHOW) : [],
);
const hasMore = $derived(filteredItems.length > DEFAULT_SHOW);
const selectedCount = $derived(items.filter((i) => selected.includes(i.name)).length);
// El buscador solo aporta cuando hay más de DEFAULT_SHOW opciones; con
// pocas opciones sería ruido visual.
const showSearch = $derived(items.length > DEFAULT_SHOW);
</script>

{#if items.length > 0}
	<div class={cn('', className)}>
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			class="group flex w-full items-center gap-2 py-1 text-left transition-colors duration-200"
		>
			<span class="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
				{title}
			</span>
			{#if selectedCount > 0}
				<span
					class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary"
				>
					{selectedCount}
				</span>
			{/if}
			<span class="min-w-0 flex-1 border-t border-border" aria-hidden="true"></span>
			<ChevronDown
				class="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-primary {open
					? 'rotate-180'
					: ''}"
			/>
		</button>

		{#if open}
			{#if showSearch}
				<div class="relative mt-2">
					<Search
						class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="text"
						placeholder={`Buscar en ${title.toLowerCase()}...`}
						bind:value={query}
						aria-label={`Buscar en ${title}`}
						class="h-9 w-full appearance-none rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					/>
				</div>
			{/if}

			<div class="mt-1 space-y-0.5">
				{#each visibleItems as item (item.name)}
					<label
						class={cn(
							'flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150',
							selected.includes(item.name) ? 'bg-primary/10' : 'hover:bg-accent',
						)}
					>
						<input
							type="checkbox"
							checked={selected.includes(item.name)}
							onchange={() => onselect?.(item.name)}
							class="size-4 shrink-0 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
						/>
						<span
							class="min-w-0 flex-1 truncate {selected.includes(item.name)
								? 'font-medium text-primary'
								: 'text-foreground'}"
							title={item.display_name}
						>
							{item.display_name}
						</span>
						<span
							class="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
						>
							{item.count}
						</span>
					</label>
				{/each}

				{#if filteredItems.length === 0}
					<p class="px-2 py-2 text-xs text-muted-foreground">
						Sin coincidencias para «{query}».
					</p>
				{/if}
			</div>

			{#if hasMore}
				<button
					type="button"
					onclick={() => (showAll = !showAll)}
					class="mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-primary underline-offset-2 transition-colors duration-200 hover:bg-primary/5 hover:underline"
				>
					{showAll ? 'Mostrar menos' : `Ver ${filteredItems.length - DEFAULT_SHOW} más`}
					<ChevronDown
						class="size-3 transition-transform duration-200 {showAll ? 'rotate-180' : ''}"
					/>
				</button>
			{/if}
		{/if}
	</div>
{/if}

