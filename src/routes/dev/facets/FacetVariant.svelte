<!--
	Copia de `$lib/components/search/FacetFilter.svelte` con las variantes del estado «sin coincidencias».
	**No es el componente real**: es la propuesta que el autor compara acá antes de que se promueva una.
	La única diferencia con el real es qué hace cuando `filteredItems` queda vacío.
-->
<script lang="ts">
import { ChevronDown, Search, X } from "@lucide/svelte";
import { cn } from "$lib/utils";

export type Variant = "limpiar" | "mostrar" | "ambos";

let {
	title = "",
	items = [] as { name: string; display_name: string; count: number }[],
	selected = [] as string[],
	onselect,
	variant = "limpiar",
	initialQuery = "",
	class: className = "",
}: {
	title?: string;
	items?: { name: string; display_name: string; count: number }[];
	selected?: string[];
	onselect?: (name: string) => void;
	variant?: Variant;
	initialQuery?: string;
	class?: string;
} = $props();

let open = $state(true);
let showAll = $state(false);
// La búsqueda arranca con el texto que sembró la hoja y después la maneja el usuario: capturar el
// valor inicial es lo que se quiere, no una lectura de más.
// svelte-ignore state_referenced_locally
let query = $state(initialQuery);

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
const noMatches = $derived(Boolean(normalizedQuery) && filteredItems.length === 0);
// «mostrar» y «ambos» no esconden la lista: con la búsqueda vacía muestran todas las opciones.
const listItems = $derived(
	noMatches && variant !== "limpiar"
		? items.slice(0, DEFAULT_SHOW)
		: filteredItems.slice(0, DEFAULT_SHOW),
);
const hasMore = $derived(
	(noMatches && variant !== "limpiar" ? items : filteredItems).length > DEFAULT_SHOW,
);
const dimmed = $derived(noMatches && variant !== "limpiar");
</script>

{#if items.length > 0}
	<div class={cn('', className)}>
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			class="group flex w-full items-center gap-2 py-1 text-left transition-colors duration-200"
		>
			<span class="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{title}</span>
			<span class="min-w-0 flex-1 border-t border-border" aria-hidden="true"></span>
			<ChevronDown
				class="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-primary {open
					? 'rotate-180'
					: ''}"
			/>
		</button>

		{#if open}
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

			{#if noMatches}
				<div class="mt-2 flex items-start gap-2 rounded-md bg-muted/40 px-2 py-1.5">
					<p class="min-w-0 flex-1 text-xs text-muted-foreground">
						Sin coincidencias para «{query}».
					</p>
					{#if variant !== "mostrar"}
						<button
							type="button"
							onclick={() => (query = "")}
							class="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
						>
							<X class="size-3" aria-hidden="true" />
							Limpiar
						</button>
					{/if}
				</div>
			{/if}

			{#if noMatches && variant !== "limpiar"}
				<p class="mt-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Todas las opciones
				</p>
			{/if}

			<div class="mt-1 space-y-0.5 {dimmed ? 'opacity-60' : ''}">
				{#each listItems as item (item.name)}
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
							class="size-4 shrink-0 rounded border-border accent-primary"
						/>
						<span class="min-w-0 flex-1 truncate text-foreground" title={item.display_name}>
							{item.display_name}
						</span>
						<span
							class="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
						>
							{item.count}
						</span>
					</label>
				{/each}
			</div>

			{#if hasMore}
				<button
					type="button"
					onclick={() => (showAll = !showAll)}
					class="mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-primary underline-offset-2 transition-colors duration-200 hover:bg-primary/5 hover:underline"
				>
					{showAll ? 'Mostrar menos' : 'Ver más'}
					<ChevronDown
						class="size-3 transition-transform duration-200 {showAll ? 'rotate-180' : ''}"
					/>
				</button>
			{/if}
		{/if}
	</div>
{/if}
