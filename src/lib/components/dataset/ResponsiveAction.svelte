<!--
	Acción de banda (enlace o botón) con la forma del botón de copiar: ícono + texto que, cuando el
	contenedor (`@container` más cercano) mide menos que `collapseBelow`, queda sólo en ícono. El nombre
	accesible (`aria-label`) no cambia y, colapsado, el nombre sale en un tooltip.
	`suffix` es la cola opcional del texto («Descargar» + «recurso»): se oculta bajo `suffixFrom`, antes de
	llegar a colapsar el botón entero. Un botón sin `collapseBelow` conserva siempre su texto.
	Colapsado mide 44 × 44 px (regla 7); con texto, `height` (h-9 de las acciones del hero, h-11 de la banda del
	recurso). La forma base de las demás acciones del hero es `ACCION_BASE`; ésta repite su borde, radio y
	foco porque cambia el alto y el ancho con el contenedor. `external` abre el destino en otra pestaña.
	Quien la monta debe estar dentro de un `@container`: sin él los umbrales nunca se cumplen.
-->
<script lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
import { cn } from "$lib/utils";

type Threshold = "20rem" | "22rem" | "24rem" | "32rem";

let {
	icon: Icon,
	label,
	text = label,
	suffix,
	suffixFrom = "24rem",
	collapseBelow,
	height = "9",
	tone = "neutral",
	href,
	external = false,
	onclick,
	disabled = false,
	title,
	describedby,
	iconClass = "",
	class: className = "",
}: {
	icon: typeof import("@lucide/svelte").Pencil;
	/** Nombre accesible completo. */
	label: string;
	/** Texto visible; por defecto el mismo nombre. */
	text?: string;
	suffix?: string;
	suffixFrom?: Threshold;
	collapseBelow?: Threshold;
	height?: "9" | "11";
	tone?: "neutral" | "coral" | "ghost";
	href?: string;
	/** Abre el destino en otra pestaña (`noopener noreferrer`). */
	external?: boolean;
	onclick?: () => void;
	/** Sólo un botón puede deshabilitarse. */
	disabled?: boolean;
	title?: string;
	/** `id` del texto que describe la acción (el `title` solo no alcanza al teclado). */
	describedby?: string;
	/** Clases del ícono, p. ej. `animate-spin` mientras la acción está en curso. */
	iconClass?: string;
	class?: string;
} = $props();

// Clases literales: Tailwind sólo genera las que lee escritas.
const QUERY: Record<Threshold, { w9: string; w11: string; show: string; tail: string }> = {
	"20rem": {
		w9: "@[20rem]:h-9 @[20rem]:w-auto @[20rem]:gap-2 @[20rem]:px-3",
		w11: "@[20rem]:w-auto @[20rem]:gap-2 @[20rem]:px-3",
		show: "hidden @[20rem]:inline",
		tail: "hidden @[20rem]:inline",
	},
	"22rem": {
		w9: "@[22rem]:h-9 @[22rem]:w-auto @[22rem]:gap-2 @[22rem]:px-3",
		w11: "@[22rem]:w-auto @[22rem]:gap-2 @[22rem]:px-3",
		show: "hidden @[22rem]:inline",
		tail: "hidden @[22rem]:inline",
	},
	"24rem": {
		w9: "@[24rem]:h-9 @[24rem]:w-auto @[24rem]:gap-2 @[24rem]:px-3",
		w11: "@[24rem]:w-auto @[24rem]:gap-2 @[24rem]:px-3",
		show: "hidden @[24rem]:inline",
		tail: "hidden @[24rem]:inline",
	},
	"32rem": {
		w9: "@[32rem]:h-9 @[32rem]:w-auto @[32rem]:gap-2 @[32rem]:px-3",
		w11: "@[32rem]:w-auto @[32rem]:gap-2 @[32rem]:px-3",
		show: "hidden @[32rem]:inline",
		tail: "hidden @[32rem]:inline",
	},
};

const base =
	"inline-flex shrink-0 items-center justify-center rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TONE = {
	neutral: "border-input bg-background hover:bg-accent disabled:opacity-60",
	ghost: "border-transparent bg-transparent hover:bg-accent",
	coral:
		"border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
};

const buttonClass = $derived(
	cn(
		base,
		TONE[tone],
		collapseBelow
			? cn("size-11", QUERY[collapseBelow][height === "9" ? "w9" : "w11"])
			: cn("gap-2 px-3", height === "9" ? "h-9" : "h-11"),
		className,
	),
);

// ¿El texto está colapsado ahora? Sólo el CSS lo sabe: se lee el `display` real (como `CopyButton`).
let collapsed = $state(false);
function track(node: HTMLElement) {
	const run = () => {
		const el = node.querySelector<HTMLElement>("[data-label]");
		collapsed = !el || getComputedStyle(el).display === "none";
	};
	run();
	if (typeof ResizeObserver === "undefined") return {};
	const observer = new ResizeObserver(run);
	observer.observe(node);
	const container = node.closest<HTMLElement>(".\\@container");
	if (container) observer.observe(container);
	return { destroy: () => observer.disconnect() };
}

function activate() {
	onclick?.();
}
</script>

{#snippet face()}
	<Icon class={cn("size-4 shrink-0", iconClass)} aria-hidden="true" />
	<span data-label class={collapseBelow ? QUERY[collapseBelow].show : ""}
		>{text}{#if suffix}<span class={QUERY[suffixFrom].tail}>{" "}{suffix}</span>{/if}</span
	>
{/snippet}

{#snippet control({ props }: { props: Record<string, unknown> })}
	{#if href}
		<a
			{...props}
			{href}
			target={external ? "_blank" : undefined}
			rel={external ? "noopener noreferrer" : undefined}
			aria-label={label}
			{title}
			aria-describedby={describedby}
			class={buttonClass}
			onclick={activate}
			use:track
		>
			{@render face()}
		</a>
	{:else}
		<button
			{...props}
			type="button"
			aria-label={label}
			{title}
			aria-describedby={describedby}
			{disabled}
			class={buttonClass}
			onclick={activate}
			use:track
		>
			{@render face()}
		</button>
	{/if}
{/snippet}

{#if collapseBelow}
	<Tooltip>
		<TooltipTrigger child={control} />
		{#if collapsed}
			<TooltipContent>{label}</TooltipContent>
		{/if}
	</Tooltip>
{:else}
	{@render control({ props: {} })}
{/if}
