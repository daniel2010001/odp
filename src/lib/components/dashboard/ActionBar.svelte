<!--
	Barra de acciones pegajosa del panel. Se pega bajo el encabezado cuando la grilla sale de la vista (`stuck`);
	oculta, `inert` la saca del foco y de los clics, y el `pointer-events-none` del contenedor evita que el aire
	transparente se trague los clics del contenido de atrás.

	· Sobre 768 px: «prioridad+». Se miden las acciones a su ancho natural (fila oculta) y, con un
	  `ResizeObserver`, las que no entran en el ancho disponible pasan —en su orden— al menú «Más acciones». Sin
	  `ResizeObserver` (jsdom) todas quedan en línea.
	· Hasta 768 px: la acción principal + «Más acciones» (con el resto), con objetivos de 44 px. Con una sola
	  acción no hay menú.
	· «Más acciones» es el `DropdownMenu` de bits-ui. Dos detalles medidos (L41): `preventScroll={false}` en
	  `Content` —de lo contrario bits-ui bloquea el scroll del `body` y el relleno por la barra de desplazamiento
	  (≈15 px) desplaza el encabezado fijo y esta barra— y el foco entra y vuelve con `{preventScroll: true}`,
	  porque el `focus()` por defecto lleva el elemento a la vista y la página salta.
-->
<script lang="ts">
import { Ellipsis } from "@lucide/svelte";
import { DropdownMenu } from "bits-ui";
import { tick } from "svelte";
import { cn } from "$lib/utils";
import type { DashboardAction } from "./actions";

interface Props {
	actions: DashboardAction[];
	stuck: boolean;
}

let { actions, stuck }: Props = $props();

// ─── ¿Móvil? (≤ 768 px) ──────────────────────────────────────────────
let isMobile = $state(false);
$effect(() => {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
	const query = window.matchMedia("(max-width: 768px)");
	isMobile = query.matches;
	const onChange = (event: MediaQueryListEvent) => {
		isMobile = event.matches;
	};
	query.addEventListener?.("change", onChange);
	return () => query.removeEventListener?.("change", onChange);
});

// ─── Prioridad+: cuántas acciones entran ─────────────────────────────
const GAP = 8; // `gap-2`
let fit = $state(Number.POSITIVE_INFINITY);
const inline = $derived(
	isMobile ? actions.slice(0, 1) : actions.slice(0, Math.max(1, Math.min(fit, actions.length))),
);
const rest = $derived(actions.slice(inline.length));

let barEl: HTMLDivElement | undefined = $state();
let measureEl: HTMLDivElement | undefined = $state();
let menuRef: HTMLElement | null = $state(null);
let triggerRef: HTMLElement | null = $state(null);
let menuOpen = $state(false);

// Al ocultarse la barra el menú no puede quedar abierto detrás de ella.
$effect(() => {
	if (!stuck) menuOpen = false;
});

function recompute() {
	if (!barEl || !measureEl || isMobile) return;
	const widths = [...measureEl.querySelectorAll<HTMLElement>("[data-m]")].map(
		(el) => el.offsetWidth,
	);
	const more = measureEl.querySelector<HTMLElement>("[data-m-more]")?.offsetWidth ?? 0;
	// El rótulo «Acciones» sólo se ve desde `lg`: oculto mide 0 y no cuenta.
	const label = measureEl.querySelector<HTMLElement>("[data-m-label]")?.offsetWidth ?? 0;
	const avail = barEl.clientWidth;
	const n = widths.length;
	let best = 0;
	for (let k = n; k >= 1; k--) {
		const items = (label > 0 ? 1 : 0) + k + (k < n ? 1 : 0);
		const need =
			label +
			widths.slice(0, k).reduce((a, b) => a + b, 0) +
			(k < n ? more : 0) +
			GAP * (items - 1);
		if (need <= avail) {
			best = k;
			break;
		}
	}
	fit = best;
}

$effect(() => {
	if (!barEl || !measureEl || typeof ResizeObserver === "undefined") return;
	void [actions, isMobile];
	const observer = new ResizeObserver(recompute);
	observer.observe(barEl);
	observer.observe(measureEl);
	void tick().then(recompute);
	return () => observer.disconnect();
});

const moreClass = $derived(
	cn(
		"relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		isMobile ? "h-11 min-w-11" : "h-9",
	),
);
</script>

{#snippet moreInner()}
	<Ellipsis class="size-4" aria-hidden="true" />
	<span class="hidden xl:inline">Más acciones</span>
	{#if rest.some((a) => a.count)}
		<span class="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" aria-hidden="true"></span>
	{/if}
{/snippet}

{#snippet actionLink(action: DashboardAction, measuring: boolean)}
	{@const Icon = action.icon}
	<a
		href={measuring ? undefined : action.href}
		data-m={measuring ? "" : undefined}
		tabindex={measuring ? -1 : undefined}
		aria-label={action.badge && !measuring ? `${action.title}, ${action.badge}` : undefined}
		class={cn(
			"inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-card px-3 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			isMobile ? "h-11 min-w-0 flex-1 justify-center" : "h-9 shrink-0",
		)}
	>
		<Icon class="size-4 shrink-0" aria-hidden="true" />
		<span class={cn(isMobile && "truncate")}>{action.title}</span>
		{#if action.count && !isMobile}
			<span class="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold ring-1 ring-primary/30">
				{action.count}
			</span>
		{/if}
	</a>
{/snippet}

<div
	class={cn(
		"pointer-events-none fixed inset-x-0 top-[calc(var(--header-h)+1px)] z-30 px-4 pt-[var(--sticky-air)] transition-all duration-200 ease-out sm:px-6 lg:px-8",
		stuck ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
	)}
	inert={!stuck}
>
	<div
		class="pointer-events-auto relative mx-auto max-w-7xl rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur"
		data-sticky-actions=""
	>
		<div bind:this={barEl} class={cn("flex items-center gap-2", !isMobile && "overflow-hidden")}>
			{#if !isMobile}
				<span
					class="hidden shrink-0 pl-2 pr-1 text-xs font-medium uppercase tracking-wider text-destructive lg:inline"
				>
					Acciones
				</span>
			{/if}
			{#each inline as action (action.id)}
				{@render actionLink(action, false)}
			{/each}
			{#if rest.length > 0}
				<DropdownMenu.Root bind:open={menuOpen}>
					<DropdownMenu.Trigger bind:ref={triggerRef} aria-label="Más acciones" class={moreClass}>
						{@render moreInner()}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						preventScroll={false}
						align="end"
						sideOffset={8}
						collisionPadding={8}
						bind:ref={menuRef}
						onOpenAutoFocus={(event) => {
							event.preventDefault();
							menuRef?.focus({ preventScroll: true });
						}}
						onCloseAutoFocus={(event) => {
							event.preventDefault();
							triggerRef?.focus({ preventScroll: true });
						}}
						class="z-40 max-h-[380px] w-64 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
					>
						{#each rest as action (action.id)}
							{@const Icon = action.icon}
							<DropdownMenu.Item
								class="h-11 cursor-pointer rounded-lg p-0 text-sm font-medium text-foreground outline-none data-[highlighted]:bg-accent"
							>
								{#snippet child({ props })}
									<a
										{...props}
										href={action.href}
										class="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground outline-none data-[highlighted]:bg-accent"
									>
										<Icon class="size-4 shrink-0" aria-hidden="true" />
										<span class="min-w-0 flex-1 truncate">{action.title}</span>
										{#if action.badge}
											<span
												class="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary ring-1 ring-primary/30"
											>
												{action.badge}
											</span>
										{/if}
									</a>
								{/snippet}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</div>
		<!-- Fila de medición (prioridad+): las acciones a su ancho natural; no se ve ni se enfoca. -->
		{#if !isMobile}
			<div
				bind:this={measureEl}
				class="pointer-events-none invisible absolute left-0 top-0 -z-10 flex h-0 w-max items-center gap-2 overflow-hidden"
				aria-hidden="true"
				inert
			>
				<span
					data-m-label=""
					class="hidden shrink-0 pl-2 pr-1 text-xs font-medium uppercase tracking-wider lg:inline"
				>
					Acciones
				</span>
				{#each actions as action (action.id)}
					{@render actionLink(action, true)}
				{/each}
				<span data-m-more="" class={moreClass}>{@render moreInner()}</span>
			</div>
		{/if}
	</div>
</div>
