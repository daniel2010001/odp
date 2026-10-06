<script lang="ts">
import type { TooltipRootProps } from "bits-ui";
import { Tooltip as TooltipPrimitive } from "bits-ui";
import type { Snippet } from "svelte";

// Raíz del tooltip. Trae el `Provider` adentro para que un uso suelto funcione
// sin cablearlo a mano; quien necesite compartir el retardo entre varios
// tooltips puede usar `TooltipProvider` y la raíz por separado.
let {
	children,
	open = $bindable(false),
	delayDuration = 700,
	skipDelayDuration = 300,
	...rest
}: Omit<TooltipRootProps, "children" | "open"> & {
	children?: Snippet;
	open?: boolean;
	delayDuration?: number;
	skipDelayDuration?: number;
} = $props();
</script>

<TooltipPrimitive.Provider {delayDuration} {skipDelayDuration}>
	<TooltipPrimitive.Root bind:open {...rest}>
		{@render children?.()}
	</TooltipPrimitive.Root>
</TooltipPrimitive.Provider>
