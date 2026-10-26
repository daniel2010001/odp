<!--
	Etiqueta de visibilidad de una colección (Q10): Pública, Interna o Privada. La comparten las tres maquetas
	de colecciones.
-->
<script lang="ts">
import { Globe, Lock, Users } from "@lucide/svelte";
import type { Visibility } from "./data";

let { visibility, testid }: { visibility: Visibility; testid?: string } = $props();

const STYLES: Record<Visibility, string> = {
	Pública: "bg-accent text-accent-foreground",
	Interna: "bg-muted text-muted-foreground",
	Privada: "bg-secondary text-secondary-foreground",
};
</script>

<span
	class="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium {STYLES[visibility]}"
	data-testid={testid}
>
	{#if visibility === "Pública"}
		<Globe class="size-3" aria-hidden="true" />
	{:else if visibility === "Interna"}
		<Users class="size-3" aria-hidden="true" />
	{:else}
		<Lock class="size-3" aria-hidden="true" />
	{/if}
	{visibility}
</span>
