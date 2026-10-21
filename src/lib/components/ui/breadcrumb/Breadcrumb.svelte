<script lang="ts" module>
export interface BreadcrumbItem {
	label: string;
	href?: string;
	/**
	 * Rótulo del **nivel** o del **tipo** de esta miga («Catálogo», «Organización», «Dataset», «CSV»). Es lo
	 * que hace legible el desplegable del chip: sin él, una lista de nombres largos no dice **qué es** cada
	 * cosa. Lo provee quien arma la lista, porque el componente no puede conocer la forma del portal.
	 */
	role?: string;
}
</script>

<script lang="ts">
	import { ChevronDown, ChevronRight, Ellipsis } from "@lucide/svelte";
	import { DropdownMenu } from "bits-ui";
	import type { Component } from "svelte";

	let {
		items,
		icon: Icon,
		collapseMiddle = false,
	}: {
		items: BreadcrumbItem[];
		/** Ícono del nivel **actual** (un dataset, un recurso…). Sólo lo usa el disparador de móvil. */
		icon?: Component;
		/**
		 * Recorrido de escritorio en **una sola línea**: se conserva la primera miga y las dos últimas, y las de
		 * en medio (organización, dataset…) se pliegan tras un «…» que las ofrece como enlaces en un
		 * desplegable. Es opt-in: sin él, el recorrido se muestra completo y puede partirse en líneas. No
		 * afecta al chip de móvil, que ya lista todo el recorrido.
		 */
		collapseMiddle?: boolean;
	} = $props();

	/** Todo menos la miga actual: el recorrido del que se viene. */
	const ancestors = $derived(items.slice(0, -1));
	const current = $derived(items[items.length - 1]);

	const last = $derived(items.length - 1);
	/** Migas plegadas tras el «…»: de la segunda a la antepenúltima. Con 3 o menos no hay nada que plegar. */
	const folded = $derived(collapseMiddle && items.length > 3 ? items.slice(1, last - 1) : []);
	const visible = $derived(
		items
			.map((item, index) => ({ item, index }))
			.filter(({ index }) => !(folded.length > 0 && index >= 1 && index < last - 1)),
	);

	/**
	 * Ancho de cada miga en la fila de una línea: la primera nunca se recorta; las de antes ceden primero
	 * y la actual casi no cede, con un mínimo legible. Sin `collapseMiddle` no se añade nada.
	 */
	function width(index: number): string {
		if (!collapseMiddle) return "";
		if (index === 0) return "shrink-0";
		return index === last ? "shrink-[0.2] min-w-[8rem]" : "shrink min-w-[3rem]";
	}
</script>

<!-- Una fila del desplegable. Es un *snippet* porque la usan los dos grupos: antes estaba duplicada, y una
     fila sin destino se veía igual que una con destino (lo señaló `review-c918f32f7c87a968`). -->
{#snippet row(item: BreadcrumbItem)}
	<DropdownMenu.Item
		class="rounded-sm p-0 outline-none data-[highlighted]:bg-accent"
		aria-current={item.href ? undefined : "page"}
	>
		{#if item.href}
			<!-- El enlace ocupa la FILA ENTERA (el item va sin padding y el ancla lleva el suyo): así el clic
			     en cualquier parte navega y el enlace conserva su semántica nativa. -->
			<a href={item.href} class="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
				{#if item.role}
					<span class="w-14 shrink-0 truncate text-[11px] text-muted-foreground">{item.role}</span>
				{/if}
				<span class="min-w-0 truncate">{item.label}</span>
			</a>
		{:else}
			<!-- Sin destino: se muestra igual, porque es información (dónde estás), pero sin apariencia de
			     enlace ni cursor de acción. -->
			<span class="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
				{#if item.role}
					<span class="w-14 shrink-0 truncate text-[11px] text-muted-foreground">{item.role}</span>
				{/if}
				<span class="min-w-0 truncate">{item.label}</span>
			</span>
		{/if}
	</DropdownMenu.Item>
{/snippet}

<nav aria-label="Ruta de navegación" class="min-w-0">
	<!-- Escritorio y tabletas: el recorrido completo. `min-w-0` en la raíz y en cada miga es lo que deja
	     actuar al `truncate`: sin él, un item flexible no baja de su ancho de contenido y la fila desborda
	     en horizontal en vez de recortar (lo encontró `review-5ab16f231f1adb49`). -->
	<ol
		class="hidden items-center gap-1 text-sm lg:flex {collapseMiddle
			? 'lg:flex-nowrap'
			: 'lg:flex-wrap'}"
	>
		{#each visible as { item, index }, position (index)}
			<li class="flex items-center gap-1 {width(index)} {index === 0 && collapseMiddle ? '' : 'min-w-0'}">
				{#if position > 0}
					<ChevronRight class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				{/if}
				{#if folded.length > 0 && index === last - 1}
					<!-- El «…» ocupa el lugar de las migas plegadas; el menú las ofrece con el mismo `row` del chip. -->
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="inline-flex shrink-0 items-center rounded-sm px-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label="Mostrar las secciones ocultas de la ruta"
						>
							<Ellipsis class="size-4" aria-hidden="true" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md"
							sideOffset={6}
						>
							{#each folded as hidden, hiddenIndex (hiddenIndex)}
								{@render row(hidden)}
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
					<ChevronRight class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				{/if}
				{#if item.href && index < items.length - 1}
					<a
						href={item.href}
						title={collapseMiddle ? item.label : undefined}
						class="truncate text-muted-foreground transition-colors hover:text-foreground"
					>
						{item.label}
					</a>
				{:else}
					<span
						title={collapseMiddle ? item.label : undefined}
						class={index === items.length - 1
							? "truncate font-medium text-foreground"
							: "truncate text-muted-foreground"}
						aria-current={index === items.length - 1 ? "page" : undefined}
					>
						{item.label}
					</span>
				{/if}
			</li>
		{/each}
	</ol>

	<!-- Móvil: el nivel ACTUAL y el árbol adentro, y el TÍTULO entero es la zona de toque. Decisión del
	     autor (A7 de la revisión de navegación): el aspecto deja de ser un chip —sin borde, sin fondo y sin relleno de
	     botón— y queda el texto con los íconos a `size-4` y el `hover` como única retroalimentación. El
	     ícono dice **de qué tipo de cosa** se trata, no a dónde va; volver es el botón del navegador, y por
	     eso no hay flecha. El disparador no cambia de tamaño cuando el recorrido crece: el nombre se
	     recorta. -->
	<div class="lg:hidden">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="inline-flex min-w-0 max-w-full items-center gap-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				{#if Icon}
					<Icon class="size-4 shrink-0" aria-hidden="true" />
				{/if}
				<span class="truncate font-medium text-foreground">{current?.label}</span>
				<ChevronDown class="size-4 shrink-0" aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md"
				sideOffset={6}
			>
				{#if ancestors.length > 0}
					<!-- `GroupHeading` exige un `Group` que lo envuelva: sin él el desplegable **revienta al
					     abrirse** (`Context "Menu.Group" not found`). Lo encontró el test, no el ojo. -->
					<DropdownMenu.Group>
						<DropdownMenu.GroupHeading
							class="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"
						>
							Recorrido
						</DropdownMenu.GroupHeading>
						{#each ancestors as item, index (index)}
							{@render row(item)}
						{/each}
					</DropdownMenu.Group>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</nav>
