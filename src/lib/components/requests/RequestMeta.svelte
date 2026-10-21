<!--
	«Solicitada por Ana · 17 de octubre de 2026 · hace 3 días». La misma línea y el mismo énfasis de la cola
	real (a partir de 90 días la antigüedad se marca), para que las variantes se comparen por su estructura y
	no por cómo dicen la fecha.
-->
<script lang="ts">
import { cn, formatDate, formatRelativeAge } from "$lib/utils";
import type { QueueItem } from "./requests-model";

let {
	item,
	now,
	prefix = true,
	class: className = "",
}: {
	item: QueueItem;
	now: Date;
	/** Con `false` omite la palabra «Solicitada» (la dice el rótulo de al lado): queda «por Ana · …». */
	prefix?: boolean;
	class?: string;
} = $props();

const UMBRAL_ANTIGUA_MS = 90 * 24 * 60 * 60 * 1000;

const nombre = $derived(
	item.requested_by_name ?? (item.requested_by ? "un usuario del catálogo" : null),
);
const edad = $derived.by(() => {
	if (!item.created_at) return null;
	const texto = formatRelativeAge(item.created_at, now);
	if (texto === "") return null;
	const creada = new Date(item.created_at).getTime();
	return { texto, antigua: now.getTime() - creada >= UMBRAL_ANTIGUA_MS };
});
</script>

{#if nombre || item.created_at}
	<p class={cn("text-xs text-muted-foreground [overflow-wrap:anywhere]", className)}>
		{#if nombre}{prefix ? "Solicitada " : ""}por {nombre}{/if}
		{#if nombre && item.created_at} · {/if}
		{#if item.created_at}
			{formatDate(item.created_at)}
			{#if edad}
				·
				<span
					data-testid="request-age"
					data-stale={edad.antigua ? "true" : "false"}
					class={cn("whitespace-nowrap", edad.antigua && "font-semibold text-destructive")}
				>{edad.texto}</span>
			{/if}
		{/if}
	</p>
{/if}
