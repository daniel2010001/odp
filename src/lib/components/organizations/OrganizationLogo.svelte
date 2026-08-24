<script lang="ts">
import { cn } from "$lib/utils";

let {
	imageUrl,
	name,
	class: className = "",
}: {
	imageUrl?: string;
	name: string;
	class?: string;
} = $props();

// Palabras sin significado propio para el monograma (artículos, conjunciones, preposiciones)
const STOPWORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "o", "u", "al"]);

const initials = $derived.by(() => {
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
			"flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base font-semibold text-primary",
			className,
		)}
		aria-hidden="true"
	>
		{initials}
	</div>
{/if}
