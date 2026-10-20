<!--
	«Más acciones» de la banda del recurso (variante C): bajo `hideFrom` de la banda, las acciones secundarias
	pasan a este menú —un botón de 44 × 44 px con `aria-label`—; desde `hideFrom` el menú desaparece y las
	acciones van en línea (las dibuja la página). Mismo manejo de foco y de desplazamiento que `ActionsMenu` (L41).
-->
<script lang="ts">
import { Ellipsis } from "@lucide/svelte";
import { DropdownMenu } from "bits-ui";
import type { MenuItem } from "./more-menu";

let { items, hideFrom }: { items: MenuItem[]; hideFrom: "20rem" | "32rem" } = $props();

const HIDE = { "20rem": "@[20rem]:hidden", "32rem": "@[32rem]:hidden" } as const;
let triggerRef = $state<HTMLElement | null>(null);
let menuRef = $state<HTMLElement | null>(null);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		bind:ref={triggerRef}
		aria-label="Más acciones"
		class={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-input bg-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${HIDE[hideFrom]}`}
	>
		<Ellipsis class="size-4" aria-hidden="true" />
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
