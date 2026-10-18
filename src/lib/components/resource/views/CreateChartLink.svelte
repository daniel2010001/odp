<script lang="ts">
import { Plus } from "@lucide/svelte";
import { ACCION_BASE } from "$lib/components/dataset/action-class";

// «Crear gráfico» en la banda de acciones del encabezado del recurso, con la misma forma que las acciones del
// encabezado del dataset (`ACCION_BASE`).
let { href }: { href: string } = $props();
</script>

<a {href} class={ACCION_BASE}>
	<Plus class="size-4" aria-hidden="true" />
	Crear gráfico
</a>
