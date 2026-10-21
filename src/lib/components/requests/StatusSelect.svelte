<!--
	«Mostrar: Pendientes (4) ▾»: el estado de las solicitudes (Pendientes / Resueltas / Todas, con su conteo) como el
	«Ordenar» de la barra de resultados de la búsqueda —el mismo `<select>` nativo, a 44 px—, para que las dos
	pantallas se lean igual. Cuando comparte la fila con las pestañas (contenedor de 64 rem o más, un puntero fino)
	baja a 36 px y queda centrado en la fila sin llegar a la línea inferior (L64); en el resto conserva los 44 px. En ancho angosto la etiqueta y el campo llenan la fila; desde `sm`, miden lo que dicen.
-->
<script lang="ts">
import { cn } from "$lib/utils";
import { statusOptionLabel, statusOptions, type Tab } from "./requests-model";

let {
	tab,
	counts,
	ontab,
	class: className = "",
}: {
	tab: Tab;
	counts: Record<Tab, number>;
	ontab: (tab: Tab) => void;
	class?: string;
} = $props();

const options = $derived(statusOptions(counts));
</script>

<label class={cn("flex items-center gap-2 text-xs font-medium text-muted-foreground", className)}>
	<span>Mostrar:</span>
	<select
		value={tab}
		onchange={(e) => ontab((e.target as HTMLSelectElement).value as Tab)}
		class="h-11 min-w-0 @5xl:h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none"
	>
		{#each options as option (option.id)}
			<option value={option.id}>{statusOptionLabel(option)}</option>
		{/each}
	</select>
</label>
