<script module lang="ts">
/**
 * Largo máximo de una sigla de organización para que entre legible en el mosaico.
 *
 * Se exporta desde el módulo para que el formulario de alta/edición de organizaciones (cuando
 * exista) valide **el mismo** límite: con dos números distintos, los bordes derivan.
 */
export const MAX_SIGLA_LENGTH = 6;
</script>

<script lang="ts">
import { cn } from "$lib/utils";

let {
	imageUrl,
	name,
	abbr,
	class: className = "",
}: {
	imageUrl?: string;
	name: string;
	/** Sigla explícita de la organización (p. ej. `extras.sigla`). Si falta, se deriva del nombre. */
	abbr?: string;
	class?: string;
} = $props();

// Palabras sin significado propio para el monograma (artículos, conjunciones, preposiciones)
const STOPWORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "o", "u", "al"]);

const initials = $derived.by(() => {
	// 1) Sigla declarada por la organización; se respeta **tal como se escribió** (p. ej. `FCyT`,
	//    no `FCYT`): es dato del administrador, no un monograma derivado. Si excede el máximo se
	//    recorta, para que un dato largo no rompa el mosaico (el valor completo sigue en el extra).
	const declared = abbr?.trim();
	if (declared) return declared.slice(0, MAX_SIGLA_LENGTH);

	// 2) Monograma derivado del nombre (fallback: la mayoría de las organizaciones tiene sigla, pero
	//    no todas). Acá sí se pasa a mayúsculas.
	const words = name
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0 && !STOPWORDS.has(w.toLowerCase()));

	if (words.length === 0) {
		return (name.trim() || "?").slice(0, 2).toUpperCase();
	}
	if (words.length === 1) {
		return words[0].slice(0, 2).toUpperCase();
	}
	return words
		.slice(0, 2)
		.map((w) => w[0])
		.join("")
		.toUpperCase();
});

/**
 * El mosaico mide 40-48 px: cuanto más larga la sigla, más chico el texto. Se calcula acá y no en el
 * llamador para que ninguna pantalla tenga que acordarse del detalle.
 */
const initialsSize = $derived.by(() => {
	const length = initials.length;
	if (length <= 2) return "text-base";
	if (length === 3) return "text-sm";
	if (length === 4) return "text-xs";
	return "text-[10px] tracking-tight";
});
</script>

{#if imageUrl}
	<img
		src={imageUrl}
		alt={name}
		loading="lazy"
		class={cn("size-12 rounded-lg object-cover", className)}
	/>
{:else}
	<div
		class={cn(
			"flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary",
			initialsSize,
			className,
		)}
		aria-hidden="true"
	>
		{initials}
	</div>
{/if}
