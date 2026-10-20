<!--
	Control compacto para saltar entre los recursos de un dataset: «‹ Recurso 3 de 12 ⇅ ›». Los extremos son
	enlaces al vecino (44 × 44 px) y el centro abre la lista de todos los recursos, con el actual marcado.
	En los extremos del orden la dirección que no existe se dibuja inerte —un `span` con `aria-hidden` y sin
	`tabindex`—, no como un enlace muerto ni como un hueco: una mitad ausente movería el contador de lugar.
	Ocupa todo el ancho de su banda y, desde `@lg` del contenedor, se ajusta a su contenido y se alinea a la
	derecha: el padre debe ser un `@container`.
-->
<script lang="ts">
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown } from "@lucide/svelte";
import { DropdownMenu } from "bits-ui";
import {
	type OrderableResource,
	type ResourceNeighbours,
	resourcePositionLabel,
} from "$lib/resources/order";
import { cn } from "$lib/utils";

let {
	datasetId,
	neighbours,
}: { datasetId: string; neighbours: ResourceNeighbours<OrderableResource> } = $props();

const END =
	"inline-flex size-11 shrink-0 items-center justify-center text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const hrefFor = (id: string) => `/dataset/${datasetId}/resource/${id}`;
</script>

<div
	class="flex w-full max-w-full items-stretch overflow-hidden rounded-lg border border-border bg-background @lg:ml-auto @lg:inline-flex @lg:w-auto"
>
	{#if neighbours.previous}
		{@const previous = neighbours.previous}
		<a
			href={hrefFor(previous.id)}
			aria-label={`Recurso anterior: ${previous.name ?? previous.id}`}
			title={previous.name ?? previous.id}
			class={cn(END, "hover:bg-accent hover:text-foreground")}
		>
			<ChevronLeft class="size-5" aria-hidden="true" />
		</a>
	{:else}
		<span class={cn(END, "text-muted-foreground/40")} aria-hidden="true" data-inert="previous">
			<ChevronLeft class="size-5" />
		</span>
	{/if}

	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 border-x border-border px-3 text-sm tabular-nums text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
			aria-label="Elegir otro recurso del conjunto de datos"
		>
			<span class="whitespace-nowrap">
				{resourcePositionLabel(neighbours.index, neighbours.ordered.length)}
			</span>
			<ChevronsUpDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content
			class="z-50 max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
			sideOffset={6}
			align="end"
		>
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading
					class="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"
				>
					Recursos de este dataset
				</DropdownMenu.GroupHeading>
				{#each neighbours.ordered as item, i (item.id)}
					{@const current = i === neighbours.index}
					<DropdownMenu.Item class="rounded-sm p-0 outline-none data-[highlighted]:bg-accent">
						<!-- El enlace ocupa la FILA ENTERA (el item va sin relleno y el ancla lleva el suyo): el clic en
						     cualquier parte navega y el enlace conserva su semántica nativa. -->
						<a
							href={hrefFor(item.id)}
							aria-current={current ? "page" : undefined}
							class="flex min-h-11 w-full items-center gap-2 px-2 py-1.5 text-sm"
						>
							<span class="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
							<span class={cn("min-w-0 flex-1 truncate", current && "font-medium")}>
								{item.name ?? item.id}
							</span>
							{#if current}
								<Check class="size-4 shrink-0 text-primary" aria-hidden="true" />
							{:else if item.format}
								<span class="w-10 shrink-0 truncate text-right text-[11px] text-muted-foreground">
									{item.format}
								</span>
							{/if}
						</a>
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	{#if neighbours.next}
		{@const next = neighbours.next}
		<a
			href={hrefFor(next.id)}
			aria-label={`Recurso siguiente: ${next.name ?? next.id}`}
			title={next.name ?? next.id}
			class={cn(END, "hover:bg-accent hover:text-foreground")}
		>
			<ChevronRight class="size-5" aria-hidden="true" />
		</a>
	{:else}
		<span class={cn(END, "text-muted-foreground/40")} aria-hidden="true" data-inert="next">
			<ChevronRight class="size-5" />
		</span>
	{/if}
</div>
