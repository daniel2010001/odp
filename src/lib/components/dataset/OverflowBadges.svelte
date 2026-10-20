<!--
	Regla de las insignias: una insignia es enlace sólo si existe un filtro de búsqueda para su valor
	(organización → `/search?org=`, etiquetas → `tags`, formato → `format`, licencia → `license`). Los estados
	(«Privado», las solicitudes, los informativos futuros) informan y no son enlaces. «Público» y «Activo» son
	estados por defecto y la página decide no mostrarlos. En código: `linkable` + `href` + `linkLabel`; sin `linkable` es texto.

	Fila de insignias que nunca envuelve (T4). Orden de recorte, explícito en `priority` (menor = se queda
	más): 1) la insignia que encoge (`shrinks`, la organización) se trunca con «…» hasta `SHRINK_MIN`; 2) si
	aun así no cabe, las demás se ocultan de la de mayor `priority` a la menor y pasan a un chip «+N» que
	abre un panel con las ocultas. La insignia que encoge nunca se oculta. El nombre completo va en `title`.
	Las anchuras naturales se leen de una fila gemela invisible y recortada (no cuenta para el desborde).
-->
<script module lang="ts">
export interface BadgeItem {
	id: string;
	label: string;
	/** Menor = más importante. */
	priority: number;
	/** Clases de color y forma de la insignia. */
	tone: string;
	/** Encoge (trunca) antes de ocultar nada (la organización). */
	shrinks?: boolean;
	/** Sólo si existe un filtro de búsqueda para su valor: entonces `href` y `linkLabel` son obligatorios. */
	linkable?: boolean;
	/** Destino del enlace (`/search?…`). */
	href?: string;
	/** Nombre accesible del enlace. */
	linkLabel?: string;
}
</script>

<script lang="ts">
import { Popover } from "bits-ui";
import { cn } from "$lib/utils";

let { badges }: { badges: BadgeItem[] } = $props();

const GAP = 8;
const SHRINK_MIN = 144;
// El texto de la fila gemela sale de un pseudoelemento: mide lo mismo sin duplicar el texto en el DOM.
const TWIN_TEXT = "before:content-[attr(data-text)]";
const CHIP = "inline-block rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap";

let available = $state(0);
let root = $state<HTMLElement>();
let twin = $state<HTMLElement>();
let natural = $state<Record<string, number>>({});
let moreWidth = $state(44);

$effect(() => {
	if (!twin || !root) return;
	const node = twin;
	const box = root;
	const read = () => {
		available = box.clientWidth;
		const next: Record<string, number> = {};
		for (const el of node.querySelectorAll<HTMLElement>("[data-twin]")) {
			// Se redondea hacia arriba: `offsetWidth` redondea al entero más cercano y una insignia 0,4 px más
			// angosta que su texto lo trunca con «…» aunque sobre lugar.
			next[el.dataset.twin as string] = Math.ceil(el.getBoundingClientRect().width);
		}
		moreWidth = next["+"] ?? moreWidth;
		if (JSON.stringify(next) !== JSON.stringify(natural)) natural = next;
	};
	read();
	// jsdom (y navegadores muy viejos) no tienen `ResizeObserver`: se queda con la primera lectura.
	if (typeof ResizeObserver === "undefined") return;
	const observer = new ResizeObserver(read);
	observer.observe(node);
	observer.observe(box);
	void document.fonts?.ready.then(read);
	return () => observer.disconnect();
});

const fit = $derived.by(() => {
	const hidden: string[] = [];
	const droppable = badges
		.filter((b) => !b.shrinks)
		.toSorted((a, b) => b.priority - a.priority);
	const shrinker = badges.find((b) => b.shrinks);
	const width = (b: BadgeItem) => natural[b.id] ?? 0;
	for (;;) {
		const shown = badges.filter((b) => !hidden.includes(b.id));
		const parts = shown.length + (hidden.length > 0 ? 1 : 0);
		const fixed =
			shown.filter((b) => !b.shrinks).reduce((sum, b) => sum + width(b), 0) +
			(hidden.length > 0 ? moreWidth : 0) +
			Math.max(0, parts - 1) * GAP;
		const room = available - fixed;
		const want = shrinker ? Math.min(SHRINK_MIN, width(shrinker)) : 0;
		const next = droppable.find((b) => !hidden.includes(b.id));
		if (room >= want || !next || available === 0) {
			return { hidden, shrinkWidth: shrinker ? Math.min(width(shrinker), Math.max(room, 48)) : 0 };
		}
		hidden.push(next.id);
	}
});

const visible = $derived(badges.filter((b) => !fit.hidden.includes(b.id)));
const hiddenItems = $derived(badges.filter((b) => fit.hidden.includes(b.id)));
</script>

<div
	class="relative min-w-[10rem] flex-1"
	data-badges
	data-hidden={hiddenItems.length}
	bind:this={root}
>
	<div aria-hidden="true" class="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
		<div bind:this={twin} class="flex w-max gap-2">
			{#each badges as b (b.id)}
				<span
					data-twin={b.id}
					data-text={b.label}
					class={cn(CHIP, b.tone, TWIN_TEXT)}
				></span>
			{/each}
			<span
				data-twin="+"
				data-text="+99"
				class={cn(CHIP, "border-border bg-muted", TWIN_TEXT)}
			></span>
		</div>
	</div>
	<div class="flex flex-nowrap items-center gap-2">
		{#each visible as b (b.id)}
			{#if b.linkable && b.href}
				<a
					href={b.href}
					title={b.label}
					aria-label={b.linkLabel}
					style={b.shrinks ? `max-width:${fit.shrinkWidth || natural[b.id] || 0}px` : undefined}
					class={cn(
						CHIP,
						"relative inline-flex hover:bg-primary/20 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']",
						b.shrinks ? "min-w-0" : "shrink-0",
						b.tone,
					)}
					><span class="truncate">{b.label}</span></a
				>
			{:else if b.shrinks}
				<span
					title={b.label}
					style={`max-width:${fit.shrinkWidth || natural[b.id] || 0}px`}
					class={cn(CHIP, "inline-flex min-w-0", b.tone)}
					><span class="truncate">{b.label}</span></span
				>
			{:else}
				<span class={cn(CHIP, "shrink-0", b.tone)}>{b.label}</span>
			{/if}
		{/each}
		{#if hiddenItems.length > 0}
			<Popover.Root>
				<Popover.Trigger
					aria-label={`${hiddenItems.length} ${hiddenItems.length === 1 ? "insignia más" : "insignias más"}`}
					class="relative inline-flex shrink-0 items-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>+{hiddenItems.length}</Popover.Trigger
				>
				<Popover.Content
					sideOffset={6}
					align="start"
					class="z-50 w-64 rounded-md border border-border bg-popover p-3 shadow-md"
				>
					<p class="mb-2 text-xs font-medium text-muted-foreground">Más insignias</p>
					<div class="flex flex-wrap gap-2">
						{#each hiddenItems as b (b.id)}
							{#if b.linkable && b.href}
								<a
									href={b.href}
									aria-label={b.linkLabel}
									class={cn(CHIP, "hover:underline", b.tone)}>{b.label}</a
								>
							{:else}
								<span class={cn(CHIP, b.tone)}>{b.label}</span>
							{/if}
						{/each}
					</div>
				</Popover.Content>
			</Popover.Root>
		{/if}
	</div>
</div>
