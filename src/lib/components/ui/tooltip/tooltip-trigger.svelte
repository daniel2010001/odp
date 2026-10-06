<script lang="ts">
import type { TooltipTriggerProps } from "bits-ui";
import { Tooltip as TooltipPrimitive } from "bits-ui";
import type { Snippet } from "svelte";
import { cn } from "$lib/utils";

let {
	class: className = "",
	children,
	child,
	...rest
}: Omit<TooltipTriggerProps, "child" | "children" | "class"> & {
	children?: Snippet;
	child?: Snippet<[{ props: Record<string, unknown> }]>;
	class?: string;
} = $props();

// Envoltorio fiel: no reescribe las props del disparador. bits-ui inyecta
// `type="button"` (su tipado es un primitivo de botón) y ese `type` es correcto
// para el `<button>` por defecto y para un `<button>` delegado. Cuando el
// elemento elegido no es un botón —el `<a>` de la card—, descartarlo es
// responsabilidad de quien elige el elemento, no de este envoltorio.
</script>

{#if child}
	<TooltipPrimitive.Trigger {...rest} class={cn(className) || undefined} {child} />
{:else}
	<TooltipPrimitive.Trigger {...rest} class={cn(className) || undefined}>
		{@render children?.()}
	</TooltipPrimitive.Trigger>
{/if}
