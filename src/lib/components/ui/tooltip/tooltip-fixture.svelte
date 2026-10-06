<script lang="ts">
import Tooltip from "./tooltip.svelte";
import TooltipContent from "./tooltip-content.svelte";
import TooltipTrigger from "./tooltip-trigger.svelte";

// Arnés mínimo para el test del primitivo. `wrapper-button` es el camino por defecto de bits-ui
// (`Tooltip.Trigger` renderiza su propio `<button>`); `delegated-button` es la delegación por `child`,
// donde el elemento lo elige quien consume. No es código de producción.
let {
	mode = "wrapper-button" as "wrapper-button" | "delegated-button",
	delayDuration = 0,
}: { mode?: "wrapper-button" | "delegated-button"; delayDuration?: number } = $props();
</script>

{#snippet delegatedButton({ props }: { props: Record<string, unknown> })}
	<button {...props} data-testid="delegated-button">Disparador delegado</button>
{/snippet}

<Tooltip {delayDuration}>
	{#if mode === "delegated-button"}
		<TooltipTrigger child={delegatedButton} />
	{:else}
		<TooltipTrigger>Disparador</TooltipTrigger>
	{/if}
	<TooltipContent>Contenido del tooltip</TooltipContent>
</Tooltip>
