<!--
	Lo que se ve al abrir una solicitud pendiente:
	 · el control **real** de decidir (`PublicationDecision`: cuatro ojos, comentario con su contador de 1000
	   caracteres, motivo obligatorio para rechazar, confirmación contra el valor almacenado);
	 · si otra persona ya respondió (409 de `request_id`) → «ya fue decidida» y actualizar la lista, en vez del
	   genérico «No se pudo registrar la decisión», que invita a reintentar algo que no va a funcionar.
	Los botones del control miden 36 px; acá se los sube a 44 con una regla del contenedor, sin tocarlo.
-->
<script lang="ts">
import { CircleAlert, RefreshCw } from "@lucide/svelte";
import PublicationDecision from "$lib/components/dataset/PublicationDecision.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import type { CkanPackage } from "$lib/types/ckan";
import type { QueueState } from "./queue-state.svelte";
import { type QueueItem, STALE_MESSAGE } from "./requests-model";

let {
	item,
	queue,
	viewer,
	readDataset,
	onrefresh,
}: {
	item: QueueItem;
	queue: QueueState;
	viewer: string | null;
	readDataset: (id: string) => Promise<CkanPackage>;
	/** «Actualizar la lista»: vuelve a pedir las solicitudes al catálogo. */
	onrefresh: () => void;
} = $props();
</script>

{#if queue.stale[item.id]}
	<div
		role="alert"
		class="mt-3 flex w-full flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
	>
		<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
		<span>{STALE_MESSAGE}</span>
		<Button variant="outline" size="sm" class="min-h-11" onclick={onrefresh}>
			<RefreshCw class="size-4" aria-hidden="true" />
			Actualizar la lista
		</Button>
	</div>
{:else}
	<div class="[&_button]:min-h-11">
		<PublicationDecision
			{item}
			decide={queue.decide}
			{readDataset}
			currentUser={viewer}
			disabled={queue.deciding !== null && queue.deciding !== item.id}
			onpendingchange={queue.setDeciding}
			ondecided={queue.confirm}
		/>
	</div>
{/if}
