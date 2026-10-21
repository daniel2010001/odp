<!--
	El comentario de una solicitud ya resuelta, con el rótulo del historial («Motivo del rechazo» / «Comentario
	de la decisión»). Lo comparten las dos lecturas de C; si no hay comentario no dibuja nada.
-->
<script lang="ts">
import type { QueueItem } from "./requests-model";

let { item }: { item: QueueItem } = $props();
const comment = $derived(item.comments?.trim() ?? "");
</script>

{#if comment}
	<p class="mt-1 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
		<span class="text-muted-foreground"
			>{item.status === "rejected" ? "Motivo del rechazo" : "Comentario de la decisión"}:</span
		>
		{comment}
	</p>
{/if}
