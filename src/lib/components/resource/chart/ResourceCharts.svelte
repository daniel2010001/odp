<script lang="ts">
import { BarChart3, Pencil, Plus, Table, Trash2 } from "@lucide/svelte";
import { Dialog, Tabs } from "bits-ui";
import type { Snippet } from "svelte";
import type { ChartApi, ChartView } from "$lib/api/charts";
import { describeFailure } from "$lib/api/failure";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import CreateChartLink from "../views/CreateChartLink.svelte";
import type { ChartsLayout, CreatePlacement, TabStyle } from "../views/types";
import ChartViewBody from "./ChartViewBody.svelte";
import EmbedChartDialog from "./EmbedChartDialog.svelte";

// Los gráficos de un recurso en su página (S1): el visitante los ve; quien puede editar, además, crea, edita y
// elimina. La configuración la guardó quien publica y la agregación la hace el servidor: acá sólo se lista, se
// dibuja y se pregunta antes de borrar.
//
// `canEdit` sólo decide qué se **ofrece**: el servidor exige `resource_update` de todos modos.
//
// `layout`, `tabStyle`, `createPlacement` y `table` son variantes en revisión (`/dev/resource-views`); sus valores por
// defecto son la página de hoy. Con `layout="tabs"` la primera pestaña muestra `table` (la vista previa, que
// vive fuera de este componente) y cada gráfico tiene la suya. `tabStyle` elige cómo se dibujan: `underline` (barra
// con línea, la tabla y los gráficos en tarjetas propias) o `segmented` (el diseño anterior a `ce8670a`: control
// segmentado con íconos en la banda de una sola tarjeta; en ese caso `table` es sólo el contenido de la tabla).
let {
	resourceId,
	datasetId,
	api,
	canEdit,
	layout = "stacked",
	tabStyle = "underline",
	createPlacement = "heading",
	table,
}: {
	resourceId: string;
	datasetId: string;
	api: Pick<ChartApi, "listViews" | "data" | "deleteView">;
	canEdit: boolean;
	layout?: ChartsLayout;
	tabStyle?: TabStyle;
	createPlacement?: CreatePlacement;
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

const tabbed = $derived(layout === "tabs");
// Cada lugar sólo existe donde tiene sentido: sin pestañas, el final de la barra no existe y cae al
// encabezado; con pestañas no hay encabezado y cae al final de la barra.
const place = $derived<CreatePlacement>(
	createPlacement === "tabs" && !tabbed
		? "heading"
		: createPlacement === "heading" && tabbed
			? "tabs"
			: createPlacement,
);
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

const tabItems = $derived([
	{ id: "table", title: "Tabla", icon: Table },
	...(list.status === "ready"
		? list.views.map((v) => ({ id: v.id, title: viewTitle(v), icon: BarChart3 }))
		: []),
]);
const segmented = $derived(tabStyle === "segmented");

const actionClass =
	"inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";
</script>

{#snippet chartCard(view: ChartView)}
	<Card class="space-y-4 p-5 sm:p-6">
		{@render chartBody(view)}
	</Card>
{/snippet}

{#snippet chartBody(view: ChartView)}
	<div class="space-y-4">
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
{/snippet}

{#snippet addCard()}
	<a
		href="{basePath}/new"
		class="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/50 px-5 py-6 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
	>
		<Plus class="size-4" aria-hidden="true" />
		Crear gráfico
	</a>
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
	{:else if list.views.length === 0}
		<Card class="flex flex-col items-center gap-2 px-5 py-10 text-center">
			<BarChart3 class="size-6 text-muted-foreground" aria-hidden="true" />
			<p class="font-heading text-base font-bold text-foreground">Este recurso todavía no tiene gráficos</p>
			<p class="max-w-md text-sm leading-relaxed text-muted-foreground">
				{canEdit
					? "Cree el primero para que quienes visitan el recurso vean sus datos de un vistazo."
					: "Cuando quien publica el recurso configure uno, aparecerá aquí."}
			</p>
		</Card>
	{/if}
{/snippet}

<section aria-labelledby="resource-charts-heading" class="space-y-4">
	{#if tabbed}
		<h2 id="resource-charts-heading" class="sr-only">Vista previa y gráficos del recurso</h2>
		<Tabs.Root bind:value={activeTab}>
			{#if segmented}
				<Card class="overflow-hidden border-primary/20">
					<div
						class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3"
					>
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">
							{activeTab === "table" ? "Vista previa" : "Gráfico"}
						</p>
						<div class="flex flex-wrap items-center gap-3">
							<Tabs.List
								class="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background p-0.5"
								aria-label="Vistas del recurso"
							>
								{#each tabItems as tab (tab.id)}
									{@const Icon = tab.icon}
									<Tabs.Trigger
										value={tab.id}
										class="inline-flex max-w-56 cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground motion-reduce:transition-none"
									>
										<Icon class="size-3.5 shrink-0" aria-hidden="true" />
										<span class="truncate">{tab.title}</span>
									</Tabs.Trigger>
								{/each}
							</Tabs.List>
							{#if canEdit && place === "tabs"}
								<CreateChartLink href="{basePath}/new" compact />
							{/if}
						</div>
					</div>
					<Tabs.Content value="table">
						{@render table?.()}
					</Tabs.Content>
					{#if list.status === "ready"}
						{#each list.views as view (view.id)}
							<Tabs.Content value={view.id} class="p-5 sm:p-6">
								{@render chartBody(view)}
							</Tabs.Content>
						{/each}
					{/if}
				</Card>
			{:else}
				<!-- El botón queda centrado en la barra, con holgura sobre la línea: la barra mide lo que la pestaña
				     (h-12) y el botón (h-9) deja 6 px arriba y abajo; nunca toca el borde. -->
				<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border">
					<Tabs.List class="-mb-px flex flex-wrap gap-1" aria-label="Vistas del recurso">
						{#each tabItems as tab (tab.id)}
							<Tabs.Trigger
								value={tab.id}
								class="inline-flex h-12 cursor-pointer items-center border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary motion-reduce:transition-none"
							>
								{tab.title}
							</Tabs.Trigger>
						{/each}
					</Tabs.List>
					{#if canEdit && place === "tabs"}
						<div class="py-1.5">
							<CreateChartLink href="{basePath}/new" compact />
						</div>
					{/if}
				</div>
				<Tabs.Content value="table" class="pt-4">
					{@render table?.()}
				</Tabs.Content>
				{#if list.status === "ready"}
					{#each list.views as view (view.id)}
						<Tabs.Content value={view.id} class="pt-4">
							{@render chartCard(view)}
						</Tabs.Content>
					{/each}
				{/if}
			{/if}
		</Tabs.Root>
		{#if list.status !== "ready" || list.views.length === 0}
			{@render states()}
		{/if}
	{:else}
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">Gráficos</p>
				<h2 id="resource-charts-heading" class="mt-1 font-heading text-xl font-bold text-primary">
					Gráficos del recurso
				</h2>
			</div>
			{#if canEdit && place === "heading"}
				<CreateChartLink href="{basePath}/new" />
			{/if}
		</div>

		{@render states()}
		{#if list.status === "ready" && list.views.length > 0}
			<div class="space-y-6">
				{#each list.views as view (view.id)}
					{@render chartCard(view)}
				{/each}
			</div>
		{/if}
	{/if}
	{#if canEdit && place === "card" && list.status === "ready"}
		{@render addCard()}
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
