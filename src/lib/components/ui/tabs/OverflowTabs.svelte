<!--
	Una barra de pestañas con línea que SIEMPRE ocupa una fila (S39, L66–L74): las vistas del recurso y las
	organizaciones de «Solicitudes». Dos formas según el ancho del CONTENEDOR (`mobileBelow`):

	· Desde el punto de cambio, las pestañas «prioridad+»: las que caben se quedan y el resto va al menú
	  «Más (n) ▾» al final de la fila (`ResizeObserver`, como `ActionBar`). La activa siempre es visible. El botón
	  sigue el patrón de `ResponsiveAction`: texto + chevron y, bajo 48 rem de barra, sólo ícono y conteo (el nombre
	  accesible es el mismo, 44 px). El menú es un `DropdownMenu` de bits-ui que cabe en la ventana.
	· Bajo el punto, un desplegable con todas las pestañas (`FIELD_CLASS`, 44 px), igual al campo que lo acompañe.

	`leading` (extremo izquierdo de la fila) y `trailing` (a su derecha) comparten la fila con las pestañas desde el
	punto; bajo él, `leading` va arriba y `trailing` junto al desplegable. `children` va dentro de las pestañas, para
	que el contenido (`Tabs.Content`) y una barra pegada (`class` + `barRef`) compartan contenedor.

	Teclado: flechas entre las pestañas (`Tabs` de bits-ui); desde la última visible, la derecha llega a «Más».
-->
<script lang="ts">
import { Check, ChevronDown, Ellipsis } from "@lucide/svelte";
import { DropdownMenu, Select, Tabs } from "bits-ui";
import { type Snippet, tick } from "svelte";
import { cn } from "$lib/utils";
import {
	FIELD_CHEVRON_CLASS,
	FIELD_CLASS,
	FORMS,
	fitTabs,
	labelWithCount,
	type MobileBelow,
	type OverflowItem,
	TAB_GAP,
} from "./overflow-tabs";

let {
	items,
	value,
	onchange,
	label,
	leading,
	trailing,
	children,
	maxTabWidth = "max-w-64",
	moreLabel = "Más",
	mobileBelow = "32rem",
	countLabel,
	class: className = "",
	barTestId = "tabs-bar",
	barRef = $bindable(null),
	height = $bindable(0),
}: {
	items: OverflowItem[];
	value: string;
	onchange: (id: string) => void;
	/** El nombre de la lista de pestañas y del desplegable («Vistas del recurso», «Organización»). */
	label: string;
	leading?: Snippet;
	trailing?: Snippet;
	/** Lo que va bajo la barra, dentro de las pestañas (los `Tabs.Content`). */
	children?: Snippet;
	/** Clase de ancho máximo de una pestaña; la que la pasa se trunca. */
	maxTabWidth?: string;
	/** El texto del botón que guarda las que no caben. */
	moreLabel?: string;
	/** Ancho de contenedor desde el que hay pestañas; bajo él, el desplegable. */
	mobileBelow?: MobileBelow;
	/** Cómo se dice un conteo en el desplegable y en su insignia accesible («2 pendientes»). Por defecto, el número. */
	countLabel?: (n: number) => string;
	/** Clases de la barra (fondo, pegada, relleno): lo que le pone quien la monta. */
	class?: string;
	barTestId?: string;
	barRef?: HTMLElement | null;
	/** Alto de la barra (`clientHeight`). */
	height?: number;
} = $props();

const form = $derived(FORMS[mobileBelow]);

const triggerClass = $derived(
	cn(
		"inline-flex h-12 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary motion-reduce:transition-none",
		maxTabWidth,
	),
);
// «Más»: texto + chevron desde 48 rem de barra; más angosta, sólo ícono y conteo. Mide 44 px o más de ancho. La fila
// de medición usa las mismas clases, así el reparto cuenta el botón ya reducido.
const moreClass = $derived(
	cn(triggerClass, "min-w-11 justify-center gap-1.5 px-3 text-foreground @3xl:gap-2 @3xl:px-4"),
);

const activeIndex = $derived(
	Math.max(
		0,
		items.findIndex((t) => t.id === value),
	),
);
const activeItem = $derived(items[activeIndex]);
const textOf = (t: OverflowItem) => labelWithCount(t, countLabel);

// ─── Prioridad+ ──────────────────────────────────────────────────
let fit = $state<{ visible: number[]; hidden: number[] } | null>(null);
let host: HTMLDivElement | undefined = $state();
let measureEl: HTMLDivElement | undefined = $state();
let moreEl: HTMLElement | null = $state(null);
let menuEl: HTMLElement | null = $state(null);
let menuOpen = $state(false);
// La fila de medición existe sólo donde se puede medir (no en el servidor ni en jsdom): así no duplica el texto.
let canMeasure = $state(false);

const shown = $derived(fit ? fit.visible.map((i) => items[i]) : items);
const inMenu = $derived(fit ? fit.hidden.map((i) => items[i]) : []);

function recompute() {
	if (!host || !measureEl) return;
	const avail = host.clientWidth;
	if (avail === 0) return;
	const widths = [...measureEl.querySelectorAll<HTMLElement>("[data-m]")].map((e) => e.offsetWidth);
	const moreWidth = measureEl.querySelector<HTMLElement>("[data-m-more]")?.offsetWidth ?? 0;
	fit = fitTabs({ widths, active: activeIndex, available: avail, moreWidth, gap: TAB_GAP });
}

$effect(() => {
	canMeasure = typeof ResizeObserver !== "undefined";
});

$effect(() => {
	if (!canMeasure || !host || !measureEl) return;
	void [items, activeIndex, moreLabel, maxTabWidth];
	const observer = new ResizeObserver(recompute);
	observer.observe(host);
	observer.observe(measureEl);
	void tick().then(recompute);
	return () => observer.disconnect();
});

// ─── Teclado: de la última pestaña visible a «Más» y de vuelta ───────
const visibleTabs = () => [
	...(host?.querySelectorAll<HTMLElement>('[role="tab"]:not([data-m])') ?? []),
];

function onKeydown(event: KeyboardEvent) {
	if (inMenu.length === 0 || !moreEl) return;
	const target = event.target as HTMLElement;
	if (event.key === "ArrowRight" && target.getAttribute("role") === "tab") {
		const tabs = visibleTabs();
		if (target === tabs[tabs.length - 1]) {
			event.preventDefault();
			event.stopPropagation();
			moreEl.focus();
		}
	} else if (event.key === "ArrowLeft" && target === moreEl) {
		event.preventDefault();
		visibleTabs().at(-1)?.focus();
	}
}
</script>

{#snippet content(t: OverflowItem, active: boolean)}
	{#if t.icon}
		{@const Icon = t.icon}
		<Icon class="size-4 shrink-0" aria-hidden="true" />
	{/if}
	<span class="truncate">{t.label}</span>
	{#if t.count !== undefined}
		<span
			data-testid="insignia"
			aria-label={countLabel ? countLabel(t.count) : undefined}
			class={cn(
				"rounded-full border px-1.5 text-xs font-semibold tabular-nums",
				active
					? "border-primary/30 bg-primary/10 text-primary"
					: "border-border bg-muted text-muted-foreground",
			)}>{t.count}</span
		>
	{/if}
{/snippet}

{#snippet moreFace(n: number)}
	<Ellipsis class="size-4 shrink-0 @3xl:hidden" aria-hidden="true" />
	<span class="hidden @3xl:inline">{moreLabel} ({n})</span>
	<span
		class="rounded-full border border-border bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground @3xl:hidden"
		>{n}</span
	>
	<ChevronDown class="hidden size-4 shrink-0 @3xl:block" aria-hidden="true" />
{/snippet}

<div class="@container">
	<Tabs.Root {value} onValueChange={onchange}>
		<div
			bind:this={barRef}
			bind:clientHeight={height}
			data-testid={barTestId}
			data-hidden={inMenu.length}
			class={cn("flex border-b border-border bg-background", form.bar, form.sticky, className)}
			onkeydowncapture={onKeydown}
		>
			{#if leading}
				<div data-lead class={cn("text-sm text-muted-foreground", form.lead)}>
					{@render leading()}
				</div>
			{/if}
			<div bind:this={host} data-overflow-host class="relative min-w-0 flex-1 @max-[18rem]:basis-full">
				<div class={cn("relative", form.selectOnly)}>
					<Select.Root
						type="single"
						{value}
						onValueChange={onchange}
						items={items.map((t) => ({ value: t.id, label: textOf(t) }))}
					>
						<Select.Trigger aria-label={label} class={cn("block w-full truncate text-left", FIELD_CLASS)}>
							{activeItem ? textOf(activeItem) : ""}
						</Select.Trigger>
						<Select.Portal>
							<Select.Content
								sideOffset={4}
								collisionPadding={8}
								class="z-50 max-h-72 w-max min-w-[var(--bits-select-anchor-width)] max-w-[min(24rem,calc(100vw-1rem))] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
							>
								<Select.Viewport>
									{#each items as t (t.id)}
										<Select.Item
											value={t.id}
											label={textOf(t)}
											class="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground motion-reduce:transition-none"
										>
											{#snippet children({ selected })}
												<span class="min-w-0">{textOf(t)}</span>
												{#if selected}<Check class="size-4 shrink-0 text-primary" aria-hidden="true" />{/if}
											{/snippet}
										</Select.Item>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
					<!-- El chevron va fuera del botón, como en «Mostrar» (`<select>`): así queda en el mismo lugar. -->
					<ChevronDown class={FIELD_CHEVRON_CLASS} aria-hidden="true" />
				</div>
				<div class={form.tabsOnly}>
					<div data-list class={cn("flex items-center gap-1", !fit && canMeasure && "overflow-hidden")}>
						<div class="-mb-px flex min-w-0 items-center gap-1">
							<Tabs.List class="flex min-w-0 flex-nowrap gap-1" aria-label={label}>
								{#each shown as t (t.id)}
									<Tabs.Trigger value={t.id} title={t.label} class={triggerClass}>
										{@render content(t, t.id === value)}
									</Tabs.Trigger>
								{/each}
							</Tabs.List>
							{#if inMenu.length > 0}
								<DropdownMenu.Root bind:open={menuOpen}>
									<DropdownMenu.Trigger
										bind:ref={moreEl}
										aria-label="{moreLabel} {label.toLowerCase()}: {inMenu.length} más"
										title="{moreLabel} {label.toLowerCase()}: {inMenu.length} más"
										class={moreClass}
									>
										{@render moreFace(inMenu.length)}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content
										preventScroll={false}
										align="end"
										sideOffset={4}
										collisionPadding={8}
										bind:ref={menuEl}
										onOpenAutoFocus={(event) => {
											event.preventDefault();
											menuEl?.focus({ preventScroll: true });
										}}
										onCloseAutoFocus={(event) => {
											event.preventDefault();
											moreEl?.focus({ preventScroll: true });
										}}
										class="z-50 max-h-72 w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
									>
										{#each inMenu as t (t.id)}
											<DropdownMenu.Item
												onSelect={() => onchange(t.id)}
												class="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground motion-reduce:transition-none"
											>
												<span class="min-w-0 truncate">{t.label}</span>
												{#if t.count !== undefined}
													<span class="shrink-0 text-xs tabular-nums text-muted-foreground"
														>{countLabel ? countLabel(t.count) : t.count}</span
													>
												{/if}
											</DropdownMenu.Item>
										{/each}
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							{/if}
						</div>
					</div>
					<!-- Fila de medición: todas las pestañas a su ancho natural; no se ve ni se enfoca. -->
					{#if canMeasure}
						<div
							bind:this={measureEl}
							class="pointer-events-none invisible absolute left-0 top-0 -z-10 flex h-0 w-max items-center gap-1 overflow-hidden"
							aria-hidden="true"
							inert
						>
							{#each items as t (t.id)}
								<span data-m class={triggerClass}>{@render content(t, t.id === value)}</span>
							{/each}
							<span data-m-more class={moreClass}>{@render moreFace(items.length)}</span>
						</div>
					{/if}
				</div>
			</div>
			{#if trailing}
				<div data-trailing class={form.trailing}>
					{@render trailing()}
				</div>
			{/if}
		</div>
		{@render children?.()}
	</Tabs.Root>
</div>
