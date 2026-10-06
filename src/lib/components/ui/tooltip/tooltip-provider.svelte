<script lang="ts">
import { Tooltip as TooltipPrimitive } from "bits-ui";
import type { Snippet } from "svelte";

// Envoltorio propio sobre el `Provider` de bits-ui. No estiliza nada: existe
// para que el repositorio tenga un único punto donde fijar los valores por
// defecto del proveedor (el retardo de apertura) y para no importar bits-ui
// directo desde las features.
let {
	children,
	delayDuration = 700,
	skipDelayDuration = 300,
	...rest
}: {
	children?: Snippet;
	delayDuration?: number;
	skipDelayDuration?: number;
} & Record<string, unknown> = $props();
</script>

<TooltipPrimitive.Provider {delayDuration} {skipDelayDuration} {...rest}>
	{@render children?.()}
</TooltipPrimitive.Provider>
