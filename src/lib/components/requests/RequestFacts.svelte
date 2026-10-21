<!--
	Los datos de una solicitud «con rótulos» (L62): una lista de definiciones, Estado / Solicitada, en vez de frases
	sueltas. La comparten C1 y C2; el estado conserva el color del historial y el espacio antes de «por X».
-->
<script lang="ts">
import { cn } from "$lib/utils";
import RequestMeta from "./RequestMeta.svelte";
import type { QueueItem } from "./requests-model";
import StatusLine from "./StatusLine.svelte";

let { item, now, class: className = "" }: { item: QueueItem; now: Date; class?: string } = $props();
</script>

<dl class={cn("grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5 text-xs", className)}>
	<dt class="text-muted-foreground">Estado</dt>
	<dd><StatusLine {item} /></dd>
	<dt class="text-muted-foreground">Solicitada</dt>
	<dd><RequestMeta {item} {now} prefix={false} /></dd>
</dl>
