<!--
	Etiqueta de visibilidad de una colección (Q10). La comparten las maquetas de colecciones y las páginas reales
	en modo prototipo (la ficha del dataset y la de la organización).

	S22: una colección pública no lleva etiqueta —es lo normal y no hace falta decirlo—; sólo la llevan la interna y
	la privada. Es el mismo chip que las siglas de organización y los formatos de estas pantallas (borde, radio `md`,
	texto `xs`, sin ícono), no una píldora aparte.
-->
<script lang="ts">
import type { Visibility } from "./data";

let { visibility, testid }: { visibility: Visibility; testid?: string } = $props();
</script>

{#if visibility !== "Pública"}
	<span
		class="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
		data-testid={testid}
	>
		{visibility}
	</span>
{/if}
