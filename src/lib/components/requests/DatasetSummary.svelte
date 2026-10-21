<!--
	El resumen del dataset de una solicitud, dentro de su panel abierto: de qué organización es, con qué licencia, cuántos
	recursos y de qué formatos, y si es público o privado **hoy** (lo que la aprobación va a cambiar). Quien decide
	lo necesita para no abrir la ficha en otra pestaña. Se pide al montarse —es decir, al abrir la fila—, así que una
	fila cerrada no cuesta una llamada. Si el catálogo falla lo dice en voz baja (sin alerta): es contexto, y decidir
	no depende de él.
-->
<script lang="ts">
import { Globe, Lock } from "@lucide/svelte";
import { onMount } from "svelte";
import type { SummaryStore } from "./summary-store.svelte";

let {
	store,
	datasetId,
	organization = null,
}: {
	store: SummaryStore;
	datasetId: string;
	/** La organización que la fila ya conoce; es la que se lee si el catálogo no trae una. */
	organization?: string | null;
} = $props();

onMount(() => {
	void store.load(datasetId);
});

const estado = $derived(store.get(datasetId));
const summary = $derived(estado?.status === "ready" ? estado.summary : null);
const donde = $derived(summary?.organization ?? organization);
</script>

<div
	data-testid="resumen-dataset"
	aria-busy={estado === undefined || estado.status === "loading"}
	class="mt-3 border-b border-border pb-3 text-xs"
>
	{#if summary}
		<dl class="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5">
			{#if donde}
				<dt class="text-muted-foreground">Organización</dt>
				<dd class="[overflow-wrap:anywhere]">{donde}</dd>
			{/if}
			<dt class="text-muted-foreground">Licencia</dt>
			<dd class="[overflow-wrap:anywhere]">{summary.license}</dd>
			<dt class="text-muted-foreground">Recursos</dt>
			<dd class="[overflow-wrap:anywhere]">{summary.resources}</dd>
			<dt class="text-muted-foreground">Visibilidad hoy</dt>
			<dd class="flex items-center gap-1.5">
				{#if summary.visibility === "Privado"}
					<Lock class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				{:else}
					<Globe class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				{/if}
				{summary.visibility}
			</dd>
		</dl>
	{:else if estado?.status === "error"}
		<p class="text-muted-foreground">No se pudo cargar el resumen del dataset.</p>
	{:else}
		<p class="text-muted-foreground">Cargando el resumen del dataset…</p>
	{/if}
</div>
