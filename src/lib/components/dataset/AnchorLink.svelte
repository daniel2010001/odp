<!--
	El enlace de una sección de la ficha (variante A, elegida por el autor el 2026-10-20):
	un ícono de enlace que copia la URL completa con su fragmento (`#summary`, `#license`…) sin cambiar la URL de
	la página. Queda siempre visible en pantallas táctiles (donde no hay cursor).

	Por defecto (`reveal="card"`, variante «Unificado» de `/dev/dataset-panel`, S18 de
	`odd/tasks/prototype-presentation.md`) va junto a la línea del título de una tarjeta y aparece al pasar el
	cursor por **toda la tarjeta** o al enfocar cualquier cosa dentro de ella: la tarjeta debe llevar
	`group/tarjeta`. `reveal="title"` es para una fila dentro de una tarjeta (la licencia y los términos del
	«Resumen»): aparece al pasar por esa fila, que debe llevar `group/ancla`.
-->
<script lang="ts">
import { page } from "$app/stores";
import { shareLink } from "$lib/components/resource/preview-views";
import { CopyButton } from "$lib/components/ui/copy-button";

let {
	id,
	title,
	reveal = "card",
}: { id: string; title: string; reveal?: "title" | "card" } = $props();

// Clases literales: Tailwind sólo genera las que lee escritas.
const REVEAL = {
	title:
		"opacity-0 transition-opacity group-hover/ancla:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100",
	card: "opacity-0 transition-opacity group-hover/tarjeta:opacity-100 group-focus-within/tarjeta:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100",
} as const;
</script>

<CopyButton
	text={shareLink($page.url.toString(), id)}
	label="Copiar enlace a la sección {title}"
	copiedLabel="Enlace copiado"
	icon="link"
	size="sm"
	class={REVEAL[reveal]}
/>
