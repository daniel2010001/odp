<!--
	«Más acciones» del hero del dataset (variante C7): un botón con flecha pegado a la derecha de «Editar», la
	acción principal, formando un botón dividido. Tiene forma de botón —borde, radio y alto de las demás
	acciones—, no de insignia (L31). «Editar» cede su radio derecho (`rounded-r-none`, lo pone quien lo monta).
	Sólo se dibuja si hay acciones secundarias: sin ellas «Editar» va sola, sin flecha.

	Menú de bits-ui con `preventScroll={false}` en el contenido y el foco entrando sin desplazar (L41): con el
	bloqueo de desplazamiento por defecto, el `padding-right` que se agrega al `body` mueve el encabezado fijo.
-->
<script lang="ts">
import { ChevronDown } from "@lucide/svelte";
import { DropdownMenu } from "bits-ui";
import type { MenuItem } from "./more-menu";

let { items }: { items: MenuItem[] } = $props();

let triggerRef = $state<HTMLElement | null>(null);
let menuRef = $state<HTMLElement | null>(null);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		bind:ref={triggerRef}
		aria-label="Más acciones"
		class="relative -ml-px inline-flex size-11 shrink-0 items-center justify-center rounded-lg rounded-l-none border border-input bg-background transition-colors hover:z-10 hover:bg-accent focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @[32rem]:size-9"
	>
		<ChevronDown class="size-4" aria-hidden="true" />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content
		bind:ref={menuRef}
		preventScroll={false}
		onOpenAutoFocus={(event) => {
			// El foco entra al menú sin desplazar la página: el `focus()` por defecto la mueve.
			event.preventDefault();
			menuRef?.focus({ preventScroll: true });
		}}
		onCloseAutoFocus={(event) => {
			event.preventDefault();
			triggerRef?.focus({ preventScroll: true });
		}}
		class="z-50 w-56 rounded-md border border-border bg-popover p-1 shadow-md"
		sideOffset={6}
		align="end"
	>
		{#each items as item (item.label)}
			<DropdownMenu.Item class="rounded-sm p-0 outline-none data-[highlighted]:bg-accent">
				<a href={item.href} class="flex min-h-11 w-full items-center gap-2 px-2 text-sm">
					<item.icon class="size-4" aria-hidden="true" />
					{item.label}
				</a>
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
