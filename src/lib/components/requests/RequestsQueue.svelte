<!--
	La cola de solicitudes de publicación, con la presentación que el autor eligió (la variante C1, ronda 6):
	las organizaciones como pestañas (`OrgTabs`, como las vistas del recurso), el estado —Pendientes / Resueltas / Todas,
	con su conteo— como «Mostrar» en la misma fila, las filas en acordeón con los datos «con rótulos» y, abierta una
	pendiente, el resumen de su dataset y el control real de decidir.

	Qué es de la cola y qué no:
	 · **Las llamadas entran inyectadas** (`list`, `decide`, `readDataset`). Una sola `list()` al montar: el filtro por
	   organización y el de estado se aplican sobre lo ya cargado.
	 · **Pendientes en orden de llegada** (la más antigua arriba: quien esperó más); resueltas, la más nueva primero y
	   acotadas a cinco con «Ver N más».
	 · **Sólo la primera pendiente decidible arranca abierta**; abrir o cerrar a mano manda. Una fila decidida **queda**
	   en la lista, ya como resuelta, y el anuncio nombra el desenlace.
	 · **Cuatro ojos y el resto de las reglas de decidir** son de `PublicationDecision`, no de la cola.
	Con una sola organización no hay pestañas: una barra delgada con el conteo ocupa su lugar. Las pestañas y esa barra
	quedan pegadas bajo el encabezado, y su alto se publica como `--barra-h` para que las filas frenen debajo de ella.
	`surface` es la superficie donde se monta la cola: el fondo opaco de la barra pegada tiene que ser el suyo.
-->
<script lang="ts">
import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw } from "@lucide/svelte";
import { onMount, tick } from "svelte";
import type { DecidePublicationRequest } from "$lib/components/dataset/publication-decision";
import Button from "$lib/components/ui/button/button.svelte";
import { currentUser as currentUserStore } from "$lib/stores/auth";
import type { CkanPackage } from "$lib/types/ckan";
import OrgTabs from "./OrgTabs.svelte";
import { QueueState } from "./queue-state.svelte";
import RequestRow from "./RequestRow.svelte";
import type { QueueItem } from "./requests-model";
import {
	acotarResueltas,
	emptyState,
	filterByOrganization,
	firstDecidable,
	hasOrganizationTabs,
	itemsForTab,
	LIMITE_RESUELTAS,
	organizationTabs,
	requestCountLabel,
	type Tab,
	tabCounts,
} from "./requests-model";
import StatusBar from "./StatusBar.svelte";
import StatusSelect from "./StatusSelect.svelte";
import type { Surface } from "./sticky-bar";
import { SummaryStore } from "./summary-store.svelte";

let {
	list,
	decide,
	readDataset,
	currentUser,
	now = new Date(),
	surface = "background",
	class: className = "",
}: {
	/** Lee las solicitudes; una sola vez al montar y otra por «Reintentar» o «Actualizar la lista». */
	list: () => Promise<QueueItem[]>;
	decide: DecidePublicationRequest;
	/**
	 * Relee el dataset almacenado. Confirma una aprobación y, al abrir una fila, alimenta el resumen de su dataset.
	 */
	readDataset: (id: string) => Promise<CkanPackage>;
	/** Quién está mirando; su propia solicitud no es decidible por él. Default: la sesión. */
	currentUser?: string | null;
	/** Reloj inyectable: fija la antigüedad que muestra cada fila. */
	now?: Date;
	/** La superficie donde se monta la cola; el fondo de la barra pegada es el suyo. */
	surface?: Surface;
	class?: string;
} = $props();

const uid = $props.id();

const queue = new QueueState(
	(id, approve, comments) => decide(id, approve, comments),
	() => $currentUserStore?.name,
);
const summaries = new SummaryStore((id) => readDataset(id));

// La identidad de quien mira: la inyectada, o la de la sesión. Con `null` ninguna fila se bloquea.
const viewer = $derived(currentUser === undefined ? ($currentUserStore?.id ?? null) : currentUser);

let org = $state<string | null>(null);
let tab = $state<Tab>("pendientes");
let verTodas = $state(false);
/** Alto de la barra pegada (pestañas + «Mostrar», o la barra sola); 0 mientras no se pega. */
let altoBarra = $state(0);
/** Filas abiertas o cerradas a mano; sin entrada, manda la regla: sólo la primera decidible arranca abierta. */
let manual = $state<Record<string, boolean>>({});

const orgTabs = $derived(organizationTabs(queue.items));
const conPestanas = $derived(hasOrganizationTabs(orgTabs));
// Una organización que ya no está en la lista no filtra: la cola nunca queda vacía por un filtro huérfano.
const orgActiva = $derived(org !== null && orgTabs.some((t) => t.id === org) ? org : null);
const visibles = $derived(filterByOrganization(queue.items, orgActiva));
const counts = $derived(tabCounts(visibles));
const rows = $derived(itemsForTab(visibles, tab));
const firstOpen = $derived(firstDecidable(visibles, viewer)?.id ?? null);

// Las resueltas crecen sin parar: se acota la parte resuelta de la pestaña, no las pendientes.
const acotadas = $derived(acotarResueltas(rows, LIMITE_RESUELTAS));
const shown = $derived(verTodas ? rows : acotadas.shown);
// «N solicitudes»: las de la organización activa y el estado elegido, sin repetir el estado (ya lo dice «Mostrar»).
const totalFilas = $derived(requestCountLabel("todas", rows.length));
const empty = $derived(emptyState(tab, counts));
const hayResueltasDeMas = $derived(
	rows.filter((i) => i.status !== "pending").length > LIMITE_RESUELTAS,
);

const isOpen = (id: string) => manual[id] ?? id === firstOpen;

/** Pliega la fila y devuelve el foco a su cabecera, para que quien cierra desde el panel no lo pierda. */
async function cerrar(id: string) {
	manual[id] = false;
	await tick();
	document.getElementById(`${uid}-${id}-toggle`)?.focus();
}

const cargar = () => queue.load(list);

onMount(() => {
	void cargar();
});
</script>

{#snippet mostrar()}
	<StatusSelect {tab} {counts} ontab={(t) => (tab = t)} inBar />
{/snippet}

{#snippet conteo()}
	<p data-testid="conteo-solicitudes" class="flex items-baseline gap-2" aria-live="polite">
		<span class="font-heading text-2xl font-bold text-foreground">{totalFilas.number}</span>
		<span class="text-sm text-muted-foreground">{totalFilas.text}</span>
	</p>
{/snippet}

<div style:--barra-h="{altoBarra}px" class={className}>
	{#if queue.loading}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
			<LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
			Cargando solicitudes…
		</p>
	{:else if queue.error}
		<div
			role="alert"
			class="flex w-full flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
		>
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
			<span>No se pudieron cargar las solicitudes.</span>
			{#if queue.errorDetail}
				<span class="font-mono text-xs">{queue.errorDetail}</span>
			{/if}
			<Button variant="outline" size="sm" onclick={() => void cargar()}>
				<RefreshCw class="size-4" aria-hidden="true" />
				Reintentar
			</Button>
		</div>
	{:else if queue.items.length === 0}
		<div>
			<p class="text-sm text-foreground">{empty.title}</p>
			<p class="mt-1 text-xs text-muted-foreground">{empty.hint}</p>
		</div>
	{:else}
		<OrgTabs
			tabs={orgTabs}
			value={orgActiva}
			onchange={(o) => (org = o)}
			leading={conteo}
			trailing={mostrar}
			bind:barHeight={altoBarra}
			{surface}
		>
			<div class="flex flex-col gap-3">
				{#if !conPestanas}
					<StatusBar {tab} {counts} shown={rows.length} ontab={(t) => (tab = t)} bind:height={altoBarra} {surface} />
				{/if}

				{#if queue.announcement}
					<p role="status" class="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
						<CheckCircle2 class="size-4 shrink-0" aria-hidden="true" />
						{queue.announcement}
					</p>
				{/if}

				{#if rows.length === 0}
					<div>
						<p class="text-sm text-foreground">{empty.title}</p>
						<p class="mt-1 text-xs text-muted-foreground">{empty.hint}</p>
					</div>
				{:else}
					<ul class="flex flex-col gap-3">
						{#each shown as item (item.id)}
							<RequestRow
								{item}
								{viewer}
								{now}
								open={isOpen(item.id)}
								panelId={`${uid}-${item.id}`}
								{queue}
								{summaries}
								{readDataset}
								ontoggle={() => (manual[item.id] = !isOpen(item.id))}
								onclose={() => void cerrar(item.id)}
								onrefresh={() => void cargar()}
							/>
						{/each}
					</ul>
				{/if}

				{#if hayResueltasDeMas}
					<button
						type="button"
						aria-expanded={verTodas}
						onclick={() => (verTodas = !verTodas)}
						class="inline-flex min-h-11 cursor-pointer items-center self-start text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						{verTodas ? "Ver menos" : `Ver ${acotadas.hidden} más`}
					</button>
				{/if}
			</div>
		</OrgTabs>
	{/if}
</div>
