<script lang="ts">
import {
	BarChart3,
	ChartColumn,
	ChartLine,
	ChartPie,
	Check,
	ChevronDown,
	Pencil,
	Table,
	Trash2,
} from "@lucide/svelte";
import { Dialog, Select, Tabs } from "bits-ui";
import { type Snippet, tick } from "svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import type { ChartApi, ChartView } from "$lib/api/charts";
import { describeFailure } from "$lib/api/failure";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import PreviewWindow from "../PreviewWindow.svelte";
import { chartWindowId, type PreviewView, resolveHash, shareLink } from "../preview-views";
import ChartViewBody from "./ChartViewBody.svelte";
import EmbedChartDialog from "./EmbedChartDialog.svelte";

// Los gráficos de un recurso en su página (S1): el visitante los ve; quien puede editar, además, crea, edita y
// elimina. La configuración la guardó quien publica y la agregación la hace el servidor: acá sólo se lista, se
// dibuja y se pregunta antes de borrar.
//
// `canEdit` sólo decide qué se **ofrece**: el servidor exige `resource_update` de todos modos.
//
// La página del recurso es una barra de pestañas con línea: «Tabla» (la vista previa, que vive fuera de este
// componente y llega en `table`) y una pestaña por gráfico. «Crear gráfico» no está acá: lo ofrece el encabezado
// del recurso. Con 0 gráficos no hay barra (una sola pestaña no elige nada): la tabla va sola y, debajo, el
// aviso de que no hay gráficos, que a quien edita lo invita a crear el primero.
//
// Cada vista vive en una «ventana» (`PreviewWindow`) con su id: `#tabla` (la pone quien pasa `table`) y
// `#grafico-<id de la vista>`. Un enlace con ese fragmento abre su pestaña y baja hasta ella; elegir una pestaña
// escribe su id en la URL (`replaceState`, sin historial). Bajo 32 rem de contenedor (`@lg`) las pestañas son un
// desplegable «Vista». El contenedor `#vista-previa` lo pone la página.
let {
	resourceId,
	datasetId,
	api,
	canEdit,
	table,
}: {
	resourceId: string;
	datasetId: string;
	api: Pick<ChartApi, "listViews" | "data" | "deleteView">;
	canEdit: boolean;
	table?: Snippet;
} = $props();

type ListState =
	| { status: "loading" }
	| { status: "failed"; message: string }
	| { status: "ready"; views: ChartView[] };

let list = $state<ListState>({ status: "loading" });
let requestSeq = 0;

async function load() {
	const seq = ++requestSeq;
	list = { status: "loading" };
	try {
		const views = await api.listViews(resourceId);
		if (seq !== requestSeq) return;
		list = { status: "ready", views };
	} catch (err) {
		if (seq !== requestSeq) return;
		list = { status: "failed", message: describeFailure(err, "resource", "unknown").message };
	}
}

$effect(() => {
	void resourceId;
	load();
});

const basePath = $derived(`/dataset/${datasetId}/resource/${resourceId}/charts`);
const viewTitle = (view: ChartView) => view.title.trim() || "Gráfico sin título";

// ─── Eliminar, con confirmación ──────────────────────────────────
let pendingDelete = $state<ChartView | null>(null);
let deleting = $state(false);
let deleteError = $state<string | null>(null);
const dialogOpen = $derived(pendingDelete !== null);

function askToDelete(view: ChartView) {
	deleteError = null;
	pendingDelete = view;
}

function closeDialog() {
	if (deleting) return;
	pendingDelete = null;
	deleteError = null;
}

async function confirmDelete() {
	const view = pendingDelete;
	if (!view || deleting) return;
	deleting = true;
	deleteError = null;
	try {
		await api.deleteView(view.id);
		pendingDelete = null;
		await load();
	} catch (err) {
		deleteError = describeFailure(err, "resource", "unknown").message;
	} finally {
		deleting = false;
	}
}

let activeTab = $state("table");
// Si la pestaña activa era un gráfico que ya no existe (se eliminó), se vuelve a la tabla.
$effect(() => {
	if (
		list.status === "ready" &&
		activeTab !== "table" &&
		!list.views.some((v) => v.id === activeTab)
	) {
		activeTab = "table";
	}
});

// Los íconos de las pestañas son una prueba del autor (L49): se quitan borrando este mapa y el `<Icon>` del
// disparador de la pestaña.
const CHART_ICONS = { bar: ChartColumn, line: ChartLine, pie: ChartPie } as const;
const chartIcon = (view: ChartView) =>
	CHART_ICONS[view.config.chart_type as keyof typeof CHART_ICONS] ?? BarChart3;

// La barra existe sólo cuando hay algo que elegir: la tabla y al menos un gráfico.
const views = $derived(list.status === "ready" ? list.views : []);
const tabbed = $derived(views.length > 0);

// ─── Ventanas: ids, enlaces y pestaña ⇄ fragmento ────────────────
const windows = $derived<PreviewView[]>([
	{ key: "table", id: "tabla", kind: "table", label: "Tabla" },
	...views.map((v) => ({
		key: v.id,
		id: chartWindowId(v.id),
		kind: "chart" as const,
		label: viewTitle(v),
	})),
]);
const linkOf = (id: string) => shareLink($page.url.toString(), id);

// Alto de la barra de pestañas + 16 px de aire: los descuentan el alto de cada vista y el `scroll-margin`.
let barH = $state(48);
const tabsH = $derived(tabbed ? barH + 16 : 0);

function scrollToId(id: string) {
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	document
		.getElementById(id)
		?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
}

// El último fragmento que el efecto VIO en `$page`: sólo actúa sobre uno distinto (un enlace, atrás/adelante) y
// espera a conocer los gráficos, porque un `#grafico-…` no se resuelve antes. Compara contra lo visto y no contra
// lo que `choose` escribió: `replaceState` vuelve a emitir `$page` (con la URL anterior, aún sin el fragmento
// nuevo) y eso reaplicaba el fragmento del enlace sobre la pestaña que la persona acababa de elegir.
let seenHash = "";
$effect(() => {
	const hash = $page.url.hash;
	if (list.status !== "ready" || hash === seenHash) return;
	seenHash = hash;
	const target = resolveHash(hash, windows).view;
	if (!target) return;
	activeTab = target.key;
	tick().then(() => scrollToId(target.id));
});

function choose(key: string) {
	const view = windows.find((v) => v.key === key);
	if (!view) return;
	activeTab = key;
	const url = new URL($page.url);
	url.hash = view.id;
	replaceState(url, {});
}
const activeLabel = $derived(windows.find((v) => v.key === activeTab)?.label ?? "");

const triggerClass =
	"inline-flex h-12 cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary motion-reduce:transition-none";

const actionClass =
	"inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";
</script>

{#snippet chartCard(view: ChartView)}
	<PreviewWindow id={chartWindowId(view.id)} label={viewTitle(view)} link={linkOf(chartWindowId(view.id))}>
	<div class="space-y-4 p-5 sm:p-6">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<h3 class="font-heading text-lg font-bold text-foreground">{viewTitle(view)}</h3>
				{#if view.description.trim()}
					<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
						{view.description}
					</p>
				{/if}
			</div>
			<div class="flex shrink-0 flex-wrap gap-2">
				<!-- Insertar es una lectura: lo ve cualquier visitante, no sólo quien edita. -->
				<EmbedChartDialog view={{ id: view.id, title: viewTitle(view) }} />
				{#if canEdit}
					<a
						href="{basePath}/{view.id}/edit"
						aria-label="Editar el gráfico «{viewTitle(view)}»"
						class={actionClass}
					>
						<Pencil class="size-4" aria-hidden="true" />
						Editar
					</a>
					<button
						type="button"
						aria-label="Eliminar el gráfico «{viewTitle(view)}»"
						onclick={() => askToDelete(view)}
						class="{actionClass} cursor-pointer text-destructive hover:text-destructive"
					>
						<Trash2 class="size-4" aria-hidden="true" />
						Eliminar
					</button>
				{/if}
			</div>
		</div>
		<ChartViewBody {view} {api} />
	</div>
	</PreviewWindow>
{/snippet}

{#snippet states()}
	{#if list.status === "loading"}
		<Card class="p-5">
			<div class="h-48 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" role="status">
				<span class="sr-only">Cargando los gráficos…</span>
			</div>
		</Card>
	{:else if list.status === "failed"}
		<Card class="space-y-3 border-destructive/40 p-5" role="alert">
			<div>
				<p class="text-sm font-medium text-foreground">No se pudieron cargar los gráficos</p>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{list.message}</p>
			</div>
			<Button type="button" variant="outline" size="sm" onclick={load}>Intentar nuevamente</Button>
		</Card>
	{/if}
	<!-- Sin vistas no se dibuja nada (S8 de odd/tasks/demo-honest-data.md): un aviso de «todavía no tiene gráficos»
	     daba la impresión de que ahí debía ir un gráfico. Quien edita tiene «Crear gráfico» en el hero. -->
{/snippet}

<section aria-labelledby="resource-charts-heading" class="space-y-4">
	<h2 id="resource-charts-heading" class="sr-only">Vista previa y gráficos del recurso</h2>
	{#if tabbed}
		<div style="--tabs-h: {tabsH}px">
			<Tabs.Root value={activeTab} onValueChange={choose}>
				<div bind:clientHeight={barH} class="border-b border-border">
					<Tabs.List class="-mb-px hidden flex-wrap gap-1 @lg:flex" aria-label="Vistas del recurso">
						{#each windows as view (view.key)}
							{#if view.kind === "table"}
								<Tabs.Trigger value="table" class={triggerClass}>
									<Table class="size-4 shrink-0" aria-hidden="true" />
									Tabla
								</Tabs.Trigger>
							{:else}
								{@const Icon = chartIcon(views.find((v) => v.id === view.key) as ChartView)}
								<Tabs.Trigger value={view.key} class="{triggerClass} max-w-64">
									<Icon class="size-4 shrink-0" aria-hidden="true" />
									<span class="truncate">{view.label}</span>
								</Tabs.Trigger>
							{/if}
						{/each}
					</Tabs.List>
					<!-- Bajo 32 rem de contenedor las pestañas no caben en una línea: pasan a un desplegable. -->
					<div class="flex h-12 items-center @lg:hidden">
						<Select.Root
							type="single"
							value={activeTab}
							onValueChange={choose}
							items={windows.map((v) => ({ value: v.key, label: v.label }))}
						>
							<Select.Trigger
								aria-label="Vista"
								class="flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
							>
								<span class="truncate">{activeLabel}</span>
								<ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							</Select.Trigger>
							<Select.Portal>
								<Select.Content
									sideOffset={4}
									class="z-50 max-h-72 min-w-[var(--bits-select-anchor-width)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
								>
									<Select.Viewport>
										{#each windows as view (view.key)}
											<Select.Item
												value={view.key}
												label={view.label}
												class="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground motion-reduce:transition-none"
											>
												{#snippet children({ selected })}
													<span class="truncate">{view.label}</span>
													{#if selected}<Check class="size-4 shrink-0 text-primary" aria-hidden="true" />{/if}
												{/snippet}
											</Select.Item>
										{/each}
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
					</div>
				</div>
				<Tabs.Content value="table" class="pt-4">
					{@render table?.()}
				</Tabs.Content>
				{#each views as view (view.id)}
					<Tabs.Content value={view.id} class="pt-4">
						<!-- Sólo la pestaña activa dibuja su ventana: así hay un solo id de vista en el documento. -->
						{#if view.id === activeTab}
							{@render chartCard(view)}
						{/if}
					</Tabs.Content>
				{/each}
			</Tabs.Root>
		</div>
	{:else}
		{@render table?.()}
		{@render states()}
	{/if}
</section>

<Dialog.Root
	open={dialogOpen}
	onOpenChange={(open) => {
		if (!open) closeDialog();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-foreground/40" />
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border border-border bg-card p-6 shadow-lg focus-visible:outline-none"
		>
			<div class="space-y-2">
				<Dialog.Title class="font-heading text-lg font-bold text-foreground">
					Eliminar el gráfico
				</Dialog.Title>
				<Dialog.Description class="text-sm leading-relaxed text-muted-foreground">
					Se eliminará el gráfico «{pendingDelete ? viewTitle(pendingDelete) : ""}». Los datos del
					recurso no cambian. Esta acción no se puede deshacer.
				</Dialog.Description>
			</div>
			{#if deleteError}
				<p class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground" role="alert">
					{deleteError}
				</p>
			{/if}
			<div class="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="outline" disabled={deleting} onclick={closeDialog}>
					Cancelar
				</Button>
				<Button type="button" variant="destructive" disabled={deleting} onclick={confirmDelete}>
					{deleting ? "Eliminando…" : "Eliminar"}
				</Button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
