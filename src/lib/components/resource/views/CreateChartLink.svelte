<script lang="ts">
import { Plus } from "@lucide/svelte";

// El acceso a «Crear gráfico»: un solo enlace para los cuatro lugares donde puede vivir (encabezado de la
// sección, final de la barra de pestañas, banda de acciones del recurso). Cambia el tamaño, no el destino.
let { href, compact = false }: { href: string; compact?: boolean } = $props();
</script>

<a
	{href}
	class="inline-flex items-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none {compact
		? 'h-9 px-3'
		: 'h-10 px-4'}"
>
	<Plus class="size-4" aria-hidden="true" />
	Crear gráfico
</a>
