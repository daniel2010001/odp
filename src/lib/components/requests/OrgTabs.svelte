<!--
	Las organizaciones como pestañas, con la forma de las vistas del recurso: ambas son un `OverflowTabs` (S39), una
	sola fila siempre. «Todas» primero y, en cada una, la insignia de sus PENDIENTES (ninguna si no tiene; «Todas»,
	la suma): los totales se leen en «Mostrar». Las que no caben van a «Más (n)»; la activa siempre se ve.
	`trailing` es el control de estado: desde 701 px de ventana (611 px de contenedor dentro de la tarjeta de la
	page) comparte la fila con las pestañas —«Mostrar» a la derecha, centrado en el texto sin llegar a la línea—;
	hasta 700 px la barra es el desplegable de organización con «Mostrar» al lado, ambos de 44 px y con el mismo campo.
	Con una sola organización no se dibuja nada: una pestaña que no filtra es ruido.
	La barra queda pegada bajo el encabezado desde el punto de cambio (`top` = `--header-h` + el borde de 1px, como la
	barra de resultados de la búsqueda; bajo él son dos filas apiladas que no valen la pena): fondo opaco, la línea
	inferior en el propio elemento pegado. El fondo tiene que ser el de la superficie donde está (`surface`): sobre una
	tarjeta, `bg-background` es una franja de otro tono —en oscuro, muy visible—.
-->
<script lang="ts">
import { Tabs } from "bits-ui";
import type { Snippet } from "svelte";
import OverflowTabs from "$lib/components/ui/tabs/OverflowTabs.svelte";
import type { OverflowItem } from "$lib/components/ui/tabs/overflow-tabs";
import {
	hasOrganizationTabs,
	type OrganizationTab,
	pendingBadgeLabel,
	TODAS_LAS_ORGANIZACIONES,
} from "./requests-model";
import { barraPegada, type Surface, surfaceClass } from "./sticky-bar";

let {
	tabs,
	value,
	onchange,
	trailing,
	barHeight = $bindable(0),
	surface = "background",
	children,
}: {
	tabs: OrganizationTab[];
	/** La organización activa, o `null` para «Todas». */
	value: string | null;
	onchange: (org: string | null) => void;
	/** Lo que comparte la fila con las pestañas, a su derecha. */
	trailing?: Snippet;
	/** Alto de la barra pegada (pestañas + `trailing`); 0 mientras no se pega. */
	barHeight?: number;
	/** La superficie donde está la barra: su fondo es opaco y tiene que ser el de ella (`card` o el lienzo). */
	surface?: Surface;
	children: Snippet;
} = $props();

const active = $derived(value ?? TODAS_LAS_ORGANIZACIONES);
const items = $derived<OverflowItem[]>(
	tabs.map((t) => ({ id: t.id, label: t.label, count: t.pending > 0 ? t.pending : undefined })),
);
const choose = (id: string) => onchange(id === TODAS_LAS_ORGANIZACIONES ? null : id);

// El alto que la barra ocupa pegada (0 si no se pega): las filas frenan debajo de ella.
let bar = $state<HTMLElement | null>(null);
$effect(() => {
	if (!bar) return;
	const sticky = barraPegada(bar, (alto) => (barHeight = alto));
	return () => sticky.destroy();
});
</script>

{#if !hasOrganizationTabs(tabs)}
	{@render children()}
{:else}
	<OverflowTabs
		{items}
		value={active}
		onchange={choose}
		label="Organización"
		mobileBelow="611px"
		countLabel={pendingBadgeLabel}
		class={surfaceClass(surface)}
		barTestId="barra-pestanas"
		bind:barRef={bar}
		{trailing}
	>
		{#each tabs as t (t.id)}
			<Tabs.Content value={t.id} class="pt-4">
				{#if active === t.id}{@render children()}{/if}
			</Tabs.Content>
		{/each}
	</OverflowTabs>
{/if}
