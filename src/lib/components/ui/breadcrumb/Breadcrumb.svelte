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

/** Grupo extra del desplegable del chip: los hermanos del nivel actual. */
export interface BreadcrumbGroup {
	heading: string;
	items: BreadcrumbItem[];
}
</script>

<script lang="ts">
	import { ChevronDown, ChevronRight } from "@lucide/svelte";
	import { DropdownMenu } from "bits-ui";
	import type { Component } from "svelte";

	let {
		items,
		icon: Icon,
		related,
	}: {
		items: BreadcrumbItem[];
		/** Ícono del nivel **actual** (un dataset, un recurso…). Sólo lo usa el chip de móvil. */
		icon?: Component;
		/**
		 * Segundo grupo del desplegable: los **hermanos** del nivel actual («Recursos de este dataset»). El
		 * item **sin `href`** es el actual, y se marca como la página.
		 */
		related?: BreadcrumbGroup;
	} = $props();

	/** Todo menos la miga actual: el recorrido del que se viene. */
	const ancestors = $derived(items.slice(0, -1));
	const current = $derived(items[items.length - 1]);
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
					<span class="w-24 shrink-0 text-[11px] text-muted-foreground">{item.role}</span>
				{/if}
				<span class="truncate">{item.label}</span>
			</a>
		{:else}
			<!-- Sin destino: se muestra igual, porque es información (dónde estás), pero sin apariencia de
			     enlace ni cursor de acción. -->
			<span class="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
				{#if item.role}
					<span class="w-24 shrink-0 text-[11px] text-muted-foreground">{item.role}</span>
				{/if}
				<span class="truncate">{item.label}</span>
			</span>
		{/if}
	</DropdownMenu.Item>
{/snippet}

<nav aria-label="Breadcrumb" class="min-w-0">
	<!-- Escritorio y tabletas: el recorrido completo. `min-w-0` en la raíz y en cada miga es lo que deja
	     actuar al `truncate`: sin él, un item flexible no baja de su ancho de contenido y la fila desborda
	     en horizontal en vez de recortar (lo encontró `review-5ab16f231f1adb49`). -->
	<ol class="hidden items-center gap-1 text-sm lg:flex lg:flex-wrap">
		{#each items as item, index (index)}
			<li class="flex min-w-0 items-center gap-1">
				{#if index > 0}
					<ChevronRight class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				{/if}
				{#if item.href && index < items.length - 1}
					<a
						href={item.href}
						class="truncate text-muted-foreground transition-colors hover:text-foreground"
					>
						{item.label}
					</a>
				{:else}
					<span
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

	<!-- Móvil: un chip con el nivel ACTUAL y el árbol adentro. El ícono dice **de qué tipo de cosa** se
	     trata, no a dónde va; volver es el botón del navegador, y por eso no hay flecha. El chip no cambia
	     de tamaño cuando el recorrido crece: el nombre se recorta. Si hay hermanos, van en un segundo grupo:
	     el desplegable contesta «¿dónde estoy?» y «¿qué más hay?» en el mismo lugar. -->
	<div class="lg:hidden">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
			>
				{#if Icon}
					<Icon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				{/if}
				<span class="truncate font-medium text-foreground">{current?.label}</span>
				<ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="z-50 min-w-72 rounded-md border border-border bg-popover p-1 shadow-md"
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

				{#if related && related.items.length > 0}
					<DropdownMenu.Separator class="my-1 h-px bg-border" />
					<DropdownMenu.Group>
						<DropdownMenu.GroupHeading
							class="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"
						>
							{related.heading}
						</DropdownMenu.GroupHeading>
						{#each related.items as item, index (index)}
							{@render row(item)}
						{/each}
					</DropdownMenu.Group>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</nav>
