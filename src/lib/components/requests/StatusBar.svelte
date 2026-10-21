<!--
	La barra de resultados de las solicitudes, como la de la búsqueda: el conteo a la izquierda (el número grande
	y su frase) y «Mostrar» a la derecha. Sirve de segunda fila bajo las pestañas de organización y, cuando no hay
	pestañas (una sola organización), de fila única con su línea inferior. Bajo `sm` el conteo ocupa su línea y el
	campo llena la siguiente. Desde `sm` (antes son dos filas apiladas) pegada bajo el encabezado como la barra de resultados de la búsqueda (opaca, con la
	línea inferior en el propio elemento pegado); `height` publica su alto medido.
-->
<script lang="ts">
import { requestCountLabel, type Tab } from "./requests-model";
import StatusSelect from "./StatusSelect.svelte";
import { barraPegada, type Surface, surfaceClass } from "./sticky-bar";

let {
	tab,
	counts,
	shown,
	ontab,
	height = $bindable(0),
	surface = "background",
}: {
	tab: Tab;
	counts: Record<Tab, number>;
	/** Cuántas solicitudes lista hoy el estado elegido. */
	shown: number;
	ontab: (tab: Tab) => void;
	/** Alto de la barra pegada, para el margen de desplazamiento de las filas; 0 mientras no se pega. */
	height?: number;
	/** La superficie donde está la barra: su fondo opaco es el de ella (`card` o el lienzo). */
	surface?: Surface;
} = $props();

const count = $derived(requestCountLabel(tab, shown));
</script>

<div
	data-testid="barra-estado"
	use:barraPegada={(alto) => (height = alto)}
	class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border {surfaceClass(surface)} py-2 transition-[top] duration-200 ease-out motion-reduce:transition-none sm:sticky sm:top-[calc(var(--header-h)+1px)] sm:z-20"
>
	<p class="flex items-baseline gap-2" aria-live="polite">
		<span class="font-heading text-2xl font-bold text-foreground">{count.number}</span>
		<span class="text-sm text-muted-foreground">{count.text}</span>
	</p>
	<StatusSelect {tab} {counts} {ontab} class="w-full sm:w-auto" />
</div>
