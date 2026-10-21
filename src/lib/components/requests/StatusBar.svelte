<!--
	La barra de estado de las solicitudes: sólo «Mostrar», a la derecha. Es la fila única, con su línea inferior,
	cuando no hay pestañas (una sola organización). Bajo `sm` el campo llena la fila. Desde `sm` queda pegada bajo
	el encabezado como la barra de resultados de la búsqueda (opaca, con la línea inferior en el propio elemento
	pegado); `height` publica su alto medido.
-->
<script lang="ts">
import type { Tab } from "./requests-model";
import StatusSelect from "./StatusSelect.svelte";
import { barraPegada, type Surface, surfaceClass } from "./sticky-bar";

let {
	tab,
	counts,
	ontab,
	height = $bindable(0),
	surface = "background",
}: {
	tab: Tab;
	counts: Record<Tab, number>;
	ontab: (tab: Tab) => void;
	/** Alto de la barra pegada, para el margen de desplazamiento de las filas; 0 mientras no se pega. */
	height?: number;
	/** La superficie donde está la barra: su fondo opaco es el de ella (`card` o el lienzo). */
	surface?: Surface;
} = $props();
</script>

<div
	data-testid="barra-estado"
	use:barraPegada={(alto) => (height = alto)}
	class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-border {surfaceClass(surface)} py-2 transition-[top] duration-200 ease-out motion-reduce:transition-none sm:sticky sm:top-[calc(var(--header-h)+1px)] sm:z-20"
>
	<StatusSelect {tab} {counts} {ontab} class="w-full sm:w-auto" />
</div>
