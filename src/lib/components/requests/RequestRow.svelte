<!--
	Una fila de la cola, como las de recursos del dataset (`ResourceCard`): un cuadro de icono con el estado, el dataset
	como título, la organización y los datos «con rótulos». La fila entera es el clic (acordeón): un botón estirado sobre
	el título, como el enlace estirado de las tarjetas, con un chevron que sólo indica; sin botones que se enciendan.

	El botón estirado (`after:inset-0`) cubre a su ancestro posicionado más cercano. Por eso la cabecera de la fila
	es ese ancestro y el panel es su **hermano**, no su descendiente: si el ancestro fuera el `<li>` entero, el
	pseudo-elemento taparía el panel, y escribir el comentario o pulsar «Aprobar» caería en el botón y plegaría la
	fila. Sólo la cabecera y el botón «Cerrar» del panel pliegan; Escape no.

	Responsive: la cabecera es una rejilla —icono, título, chevron— y los datos «con rótulos» bajan a todo el ancho bajo
	`sm`, para que el título no quede en 140 px en un móvil. El pie del panel (abrir el dataset, el historial,
	«Cerrar») son filas de 44 px a todo el ancho de la tarjeta con su chevron, como los «Ver…» de la ficha del
	dataset, mientras la tarjeta mida menos de 28 rem; desde ahí vuelven a una línea compacta.
-->
<script lang="ts">
import { ChevronDown, ChevronRight, ChevronUp, ExternalLink, History } from "@lucide/svelte";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import DatasetSummary from "./DatasetSummary.svelte";
import DecisionPanel from "./DecisionPanel.svelte";
import { datasetLinks } from "./dataset-links";
import type { QueueState } from "./queue-state.svelte";
import RequestFacts from "./RequestFacts.svelte";
import ResolvedNote from "./ResolvedNote.svelte";
import { actionLabel, type QueueItem } from "./requests-model";
import StatusTile from "./StatusTile.svelte";
import type { SummaryStore } from "./summary-store.svelte";

let {
	item,
	viewer,
	now,
	open,
	panelId,
	queue,
	summaries,
	readDataset,
	ontoggle,
	onclose,
	onrefresh,
}: {
	item: QueueItem;
	viewer: string | null;
	now: Date;
	open: boolean;
	/** Id del panel; el botón de la cabecera lo controla (`aria-controls`). */
	panelId: string;
	queue: QueueState;
	summaries: SummaryStore;
	readDataset: (id: string) => Promise<CkanPackage>;
	ontoggle: () => void;
	/** «Cerrar» desde el panel: quien lo atiende pliega la fila y devuelve el foco a la cabecera. */
	onclose: () => void;
	onrefresh: () => void;
} = $props();

const label = $derived(actionLabel(item, viewer));

const ENLACE =
	"rounded-sm text-sm font-medium text-foreground [overflow-wrap:anywhere] hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
// El pie: fila de 44 px a todo el ancho de la tarjeta; desde `@md` (28 rem) un enlace compacto en línea.
const PIE =
	"group flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 text-left text-sm font-medium text-foreground transition-colors last:rounded-b-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:px-4 @md:w-auto @md:px-0 @md:text-xs @md:font-semibold @md:text-primary @md:last:rounded-none @md:hover:bg-transparent @md:hover:underline @md:focus-visible:ring-0 @md:focus-visible:outline-2 @md:focus-visible:outline-offset-2 @md:focus-visible:outline-ring";
const PIE_CHEVRON = "ml-auto size-4 shrink-0 text-muted-foreground @md:hidden";

// Lo que se desplaza a la vista (el foco que vuelve a la cabecera, un ancla) frena bajo el encabezado y la barra
// pegada, no debajo de ellos; `--barra-h` la publica `RequestsQueue`. `scroll-mt-*` no existe en este repo.
const AL_ENFOCAR =
	"[scroll-margin-top:calc(var(--header-h)+1px+var(--barra-h,0px)+var(--sticky-air))]";
// El foco cae en el título, 1.25 rem bajo el borde de la tarjeta: con este margen extra la tarjeta entera queda a la vista.
const AL_ENFOCAR_TITULO =
	"[scroll-margin-top:calc(var(--header-h)+1px+var(--barra-h,0px)+var(--sticky-air)+1.25rem)]";
</script>

<li
	class={cn(
		"@container rounded-lg border bg-card transition-colors",
		AL_ENFOCAR,
		open ? "bg-accent/30" : "hover:bg-accent/30",
	)}
	data-request-id={item.id}
>
	<div
		class="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 p-3 sm:p-4"
		data-testid="fila-cabecera"
	>
		<StatusTile status={item.status} />
		<div class="min-w-0">
			{#if label}
				<button
					type="button"
					id={`${panelId}-toggle`}
					aria-expanded={open}
					aria-controls={panelId}
					onclick={ontoggle}
					class={cn(
						ENLACE,
						AL_ENFOCAR_TITULO,
						"cursor-pointer text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring",
					)}
				>
					{item.dataset_title}
					<span class="sr-only"> ({label === "Decidir" ? "decidir" : "ver"})</span>
				</button>
			{:else}
				<a
					href={`/dataset/${encodeURIComponent(item.dataset_id)}`}
					target="_blank"
					rel="noopener noreferrer"
					class={cn(ENLACE, "relative block before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-['']")}
				>
					{item.dataset_title}
					<span class="sr-only"> (se abre en una pestaña nueva)</span>
				</a>
			{/if}
			{#if item.organization_title}
				<p class="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.organization_title}</p>
			{/if}
		</div>
		{#if label}
			<ChevronDown
				class={cn("col-start-3 mt-2.5 size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")}
				aria-hidden="true"
			/>
		{/if}
		<RequestFacts {item} {now} class="col-span-3 sm:col-span-2 sm:col-start-2" />
	</div>
	<div id={panelId} class={cn(open && "border-t border-border px-3 pb-0 sm:px-4 @md:pb-1")}>
		{#if open}
			{#if item.status === "pending"}
				<DatasetSummary store={summaries} datasetId={item.dataset_id} organization={item.organization_title ?? null} />
				<DecisionPanel {item} {queue} {viewer} {readDataset} {onrefresh} />
			{:else}
				<ResolvedNote {item} />
			{/if}
			<div
				data-testid="fila-pie"
				class="-mx-3 mt-3 flex flex-col divide-y divide-border border-t border-border sm:-mx-4 @md:mx-0 @md:mt-2 @md:flex-row @md:flex-wrap @md:items-center @md:gap-x-4 @md:divide-y-0 @md:border-t-0"
			>
				{#each datasetLinks(item) as link, i (link.label)}
					<a href={link.href} target="_blank" rel="noopener noreferrer" class={PIE}>
						{#if i === 0}<ExternalLink class="size-4 shrink-0" aria-hidden="true" />{:else}<History class="size-4 shrink-0" aria-hidden="true" />{/if}
						{link.label}
						<ChevronRight class={PIE_CHEVRON} aria-hidden="true" />
					</a>
				{/each}
				<button type="button" onclick={onclose} class={PIE}>
					<ChevronUp class="size-4 shrink-0" aria-hidden="true" />
					Cerrar
					<span class="sr-only">{item.dataset_title}</span>
				</button>
			</div>
		{/if}
	</div>
</li>
