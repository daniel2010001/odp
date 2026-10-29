<!--
	Una sección que se puede compartir (S27 de `odd/tasks/prototype-presentation.md`): el destino del fragmento
	(`id`), su `scroll-margin` bajo el encabezado fijo, la línea del título en mayúsculas y, a su lado, el ícono que
	copia la URL actual con ese fragmento (`AnchorLink`, variante «Unificado» de S18: aparece al pasar el cursor o
	enfocar en toda la sección). Una sección nueva la obtiene usando esta pieza, sin copiar el marcado.

	Por defecto es una tarjeta (`Card`); `card={false}` deja el mismo destino y la misma línea sin el marco, para
	una sección que agrupa varias tarjetas (la API de la página del recurso). `label` es el texto de la línea y el
	nombre del enlace («Copiar enlace a la sección {label}»). Lo que sigue a la línea —el `h2`, el cuerpo— va como
	contenido. El resto de los atributos (`data-testid`…) pasa al contenedor.
-->
<script lang="ts">
import type { Snippet } from "svelte";
import AnchorLink from "$lib/components/dataset/AnchorLink.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { cn } from "$lib/utils";

let {
	id,
	label,
	card = true,
	class: className = "",
	children,
	...rest
}: {
	id: string;
	label: string;
	card?: boolean;
	class?: string;
	children?: Snippet;
} & Record<string, unknown> = $props();

const classes = $derived(
	cn("group/tarjeta scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))]", className),
);
</script>

{#snippet content()}
	<div class="flex h-4 items-center gap-2">
		<p class="text-xs font-medium uppercase tracking-wider text-destructive">{label}</p>
		<AnchorLink {id} title={label} />
	</div>
	{@render children?.()}
{/snippet}

{#if card}
	<Card {id} class={classes} {...rest}>{@render content()}</Card>
{:else}
	<div {id} class={classes} {...rest}>{@render content()}</div>
{/if}
