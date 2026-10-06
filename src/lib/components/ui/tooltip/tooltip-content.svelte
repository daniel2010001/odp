<script lang="ts">
import type { TooltipContentProps } from "bits-ui";
import { Tooltip as TooltipPrimitive } from "bits-ui";
import type { Snippet } from "svelte";
import { cn } from "$lib/utils";

// La superficie del tooltip: tokens propios (`popover`, `border`, `shadow-md`),
// Poppins (`font-sans`) y sin transición (respeta el movimiento reducido por
// ausencia, no por un `prefers-reduced-motion` que habría que neutralizar).
//
// `role="tooltip"` se agrega acá a propósito: medido sobre bits-ui 2.19.2, su
// `Tooltip.Content` sale al DOM con `data-tooltip-content` e `id` pero **sin
// rol**, y sin rol el contenido no se anuncia como tooltip ni se puede consultar
// por rol. El rol que pide ARIA es éste, y el envoltorio es el lugar donde se
// restituye.
let {
	class: className = "",
	children,
	sideOffset = 4,
	...rest
}: Omit<TooltipContentProps, "children"> & {
	children?: Snippet;
	class?: string;
} = $props();
</script>

<TooltipPrimitive.Content
	role="tooltip"
	{sideOffset}
	{...rest}
	class={cn(
		"z-50 w-max max-w-xs rounded-md border border-border bg-popover px-3 py-1.5 font-sans text-sm text-popover-foreground shadow-md",
		className,
	)}
>
	{@render children?.()}
</TooltipPrimitive.Content>
