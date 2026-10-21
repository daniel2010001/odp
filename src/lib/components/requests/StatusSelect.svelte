<!--
	«Mostrar: Pendientes (4) ▾»: el estado de las solicitudes (Pendientes / Resueltas / Todas, con su conteo) como un
	`<select>` nativo, pero con el MISMO campo que el desplegable de organización de `OverflowTabs` (`FIELD_CLASS` y
	`FIELD_CHEVRON_CLASS`: 44 px, borde, radio, letra y chevron) para que, lado a lado, se vean idénticos.
	`inBar` es cuando comparte la fila con las pestañas (`OrgTabs`): desde 701 px de ventana mide 36 px y su etiqueta
	«Mostrar:» se lee; en la forma angosta mide 44 px y la etiqueta es sólo para lectores de pantalla (el campo ya
	dice el estado), salvo apilado (bajo 18 rem de contenedor), donde ocupa su fila con la etiqueta a la vista.
	Fuera de la barra (la barra de una sola organización) la etiqueta siempre se ve.
-->
<script lang="ts">
import { ChevronDown } from "@lucide/svelte";
import { FIELD_CHEVRON_CLASS, FIELD_CLASS, FORMS } from "$lib/components/ui/tabs/overflow-tabs";
import { cn } from "$lib/utils";
import { statusOptionLabel, statusOptions, type Tab } from "./requests-model";

let {
	tab,
	counts,
	ontab,
	inBar = false,
	class: className = "",
}: {
	tab: Tab;
	counts: Record<Tab, number>;
	ontab: (tab: Tab) => void;
	/** Comparte la fila con las pestañas de organización. */
	inBar?: boolean;
	class?: string;
} = $props();

const options = $derived(statusOptions(counts));
const form = FORMS["611px"];
</script>

<label
	class={cn(
		"flex items-center gap-2 text-xs font-medium text-muted-foreground @max-[18rem]:w-full",
		className,
	)}
>
	<span class={inBar ? cn("sr-only @max-[18rem]:not-sr-only", form.wideLabel) : undefined}>Mostrar:</span>
	<span class="relative min-w-0 flex-1">
		<select
			value={tab}
			onchange={(e) => ontab((e.target as HTMLSelectElement).value as Tab)}
			class={cn(FIELD_CLASS, "w-full appearance-none", inBar && form.wideFieldH)}
		>
			{#each options as option (option.id)}
				<option value={option.id}>{statusOptionLabel(option)}</option>
			{/each}
		</select>
		<ChevronDown class={FIELD_CHEVRON_CLASS} aria-hidden="true" />
	</span>
</label>
