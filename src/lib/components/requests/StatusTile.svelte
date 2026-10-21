<!--
	El estado de una solicitud como cuadro de icono: el de `ResourceCard` (40 px, borde, radio 8) con el color de las insignias de la solicitud
	(`insigniaDeLaSolicitud`: pendiente azul, rechazada coral, anulada neutra) y, donde esa insignia no existe
	(aprobada, retirada), el tono del historial. El rótulo lo dice el texto de al lado: acá el color no es la señal.
-->
<script lang="ts">
import type { PublicationRequestStatus } from "$lib/api/publication";
import { estadoDelHistorial, insigniaDeLaSolicitud } from "$lib/copy/publication";
import { formatTileClass } from "$lib/resources/format-visual";
import { cn } from "$lib/utils";
import { statusIcon } from "./status-icons";

let { status }: { status: PublicationRequestStatus } = $props();

const tono = $derived(insigniaDeLaSolicitud(status)?.tone ?? estadoDelHistorial(status).tone);
const Icono = $derived(statusIcon(status));
</script>

<span
	data-testid="status-tile"
	class={cn(formatTileClass(null, true), tono)}
>
	<Icono class="size-4" aria-hidden="true" />
</span>
