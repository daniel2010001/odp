<!--
	El enlace de una sección de la ficha (variante A, elegida por el autor el 2026-10-20):
	un ícono de enlace junto al título de la sección que copia la URL completa con su fragmento (`#resumen`,
	`#licencia`…) sin cambiar la URL de la página. Aparece al pasar el cursor o enfocar y queda siempre visible en
	pantallas táctiles (donde no hay cursor). La fila del título debe llevar `group/ancla`.
-->
<script lang="ts">
import { page } from "$app/stores";
import { shareLink } from "$lib/components/resource/preview-views";
import { CopyButton } from "$lib/components/ui/copy-button";

let { id, title }: { id: string; title: string } = $props();
</script>

<CopyButton
	text={shareLink($page.url.toString(), id)}
	label="Copiar enlace a la sección {title}"
	copiedLabel="Enlace copiado"
	icon="link"
	size="sm"
	class="opacity-0 transition-opacity group-hover/ancla:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
/>
