<!--
	Un solo botón de copiar para todo el portal. Dos formas:
	- `form="icon"`: cuadrado con el ícono; el nombre de la acción va en un tooltip y en `aria-label`.
	- `form="label"`: ícono + texto. Con `collapseBelow`, el texto desaparece cuando el contenedor (`@container`
	  más cercano) mide menos que ese ancho: queda el ícono, con el mismo nombre accesible y el tooltip.
	El texto reserva el ancho de «Copiado» (los dos textos comparten celda), así el botón no cambia de ancho al
	copiar. El feedback es el ícono que pasa a una marca y el aviso «Copiado» en un `role="status"`.
	Tamaños: `lg` (h-9, como las acciones del hero), `md` (h-8), `sm` (h-7, dentro de una fila).
-->
<script lang="ts">
import { Check, Copy, Link2 } from "@lucide/svelte";
import { onDestroy } from "svelte";
import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
import { cn } from "$lib/utils";
import { Copier } from "./copier.svelte";

let {
	text,
	label,
	form = "icon",
	size = "lg",
	collapseBelow,
	icon = "copy",
	visibleLabel = label,
	copiedLabel = "Copiado",
	class: className = "",
}: {
	/** Lo que se copia. */
	text: string;
	/** Nombre accesible de la acción («Copiar enlace del recurso»). */
	label: string;
	form?: "icon" | "label";
	size?: "lg" | "md" | "sm";
	/** Ancho de contenedor desde el cual la forma `label` muestra el texto. */
	collapseBelow?: keyof typeof QUERY;
	icon?: "copy" | "link";
	/** Texto visible de la forma `label`; por defecto el mismo nombre de la acción. */
	visibleLabel?: string;
	/** Texto del aviso tras copiar. */
	copiedLabel?: string;
	class?: string;
} = $props();

const copier = new Copier();
onDestroy(() => copier.dispose());

// Clases literales: Tailwind sólo genera las que lee escritas.
const QUERY = {
	"22rem": {
		wide: "@[22rem]:w-auto @[22rem]:gap-1.5 @[22rem]:px-2.5",
		show: "hidden @[22rem]:inline-grid",
	},
	"24rem": {
		wide: "@[24rem]:w-auto @[24rem]:gap-1.5 @[24rem]:px-2.5",
		show: "hidden @[24rem]:inline-grid",
	},
	"40rem": {
		wide: "@[40rem]:w-auto @[40rem]:gap-1.5 @[40rem]:px-2.5",
		show: "hidden @[40rem]:inline-grid",
	},
} as const;

const SIZES = {
	lg: { box: "h-9", square: "size-9", text: "text-sm", icon: "size-4", pad: "px-3" },
	md: { box: "h-8", square: "size-8", text: "text-sm", icon: "size-4", pad: "px-2.5" },
	sm: { box: "h-7", square: "size-7", text: "text-xs", icon: "size-3.5", pad: "px-2" },
} as const;
const s = $derived(SIZES[size]);
const Idle = $derived(icon === "link" ? Link2 : Copy);

// ¿El texto está colapsado ahora? Sólo el CSS lo sabe (la consulta de contenedor): se lee el `display` real.
let collapsed = $state(false);
function track(node: HTMLElement) {
	const run = () => {
		const text = node.querySelector<HTMLElement>("[data-label]");
		collapsed = !text || getComputedStyle(text).display === "none";
	};
	run();
	// Sin `ResizeObserver` (jsdom) queda la lectura inicial.
	if (typeof ResizeObserver === "undefined") return {};
	const observer = new ResizeObserver(run);
	observer.observe(node);
	const container = node.closest<HTMLElement>(".\\@container");
	if (container) observer.observe(container);
	return { destroy: () => observer.disconnect() };
}

const buttonClass = $derived(
	cn(
		"inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		s.box,
		s.text,
		form === "icon"
			? s.square
			: collapseBelow
				? cn(s.square, QUERY[collapseBelow].wide)
				: cn("gap-1.5", s.pad),
		className,
	),
);
</script>

{#snippet face()}
	{#if copier.copied}
		<Check class={cn(s.icon, "text-emerald-700 dark:text-emerald-400")} aria-hidden="true" />
	{:else}
		<Idle class={s.icon} aria-hidden="true" />
	{/if}
	{#if form === "label"}
		<span data-label class={collapseBelow ? QUERY[collapseBelow].show : "inline-grid"}>
			<span class={cn("col-start-1 row-start-1 text-center", copier.copied && "invisible")}
				>{visibleLabel}</span
			>
			<span class={cn("col-start-1 row-start-1 text-center text-foreground", !copier.copied && "invisible")}
				>{copiedLabel}</span
			>
		</span>
	{/if}
{/snippet}

{#snippet iconButton({ props }: { props: Record<string, unknown> })}
	<button
		{...props}
		type="button"
		onclick={() => copier.copy(text)}
		aria-label={label}
		class={buttonClass}
		use:track
	>
		{@render face()}
	</button>
{/snippet}

{#if form === "icon" || collapseBelow}
	<Tooltip>
		<TooltipTrigger child={iconButton} />
		{#if form === "icon" || collapsed}
			<TooltipContent>{label}</TooltipContent>
		{/if}
	</Tooltip>
{:else}
	<button type="button" onclick={() => copier.copy(text)} aria-label={label} class={buttonClass}>
		{@render face()}
	</button>
{/if}
<span class="sr-only" role="status">{copier.copied ? copiedLabel : ""}</span>
