<!--
	La línea de estado de una fila: «Pendiente», «Aprobada por Ana el 17 de octubre de 2026», «Retirada el 14 de
	octubre de 2026». La palabra del estado lleva el color del historial y el resto, el texto atenuado. El espacio
	entre ambas es una expresión propia (`{" "}`): dentro de un `{#if}` Svelte lo recorta y quedaba «Aprobadapor».
-->
<script lang="ts">
import { cn } from "$lib/utils";
import { type QueueItem, statusLineParts } from "./requests-model";

let { item, class: className = "" }: { item: QueueItem; class?: string } = $props();

const parts = $derived(statusLineParts(item));
</script>

<p data-testid="status-line" class={cn("text-xs text-muted-foreground [overflow-wrap:anywhere]", className)}><span class={cn("font-semibold", parts.tone)}>{parts.label}</span>{#if parts.detail}{" "}{parts.detail}{/if}</p>
