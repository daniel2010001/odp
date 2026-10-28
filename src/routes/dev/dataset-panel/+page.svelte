<!--
	Playground — el panel derecho de la ficha del dataset (S17 de `odd/tasks/prototype-presentation.md`, P1 y P2
	de `BACKLOG.md`; AGENTS.md regla 8).

	Duplica `/dataset/[id]` con datos fijos, para juzgarlo sin iniciar sesión. La columna lateral es la **real**
	(`DatasetSidebar`, la misma que monta la ficha); el hero y la columna principal son una copia de la ficha,
	porque el botón del enlace también cambia a la izquierda. Se comparan:
	- el orden de las tarjetas de la columna: el de hoy contra la propuesta;
	- la columna pegajosa de hoy contra una con su propio desplazamiento y un alto que sigue a la ventana;
	- el historial completo contra el plegado, que siempre muestra la última solicitud;
	- el botón del enlace junto al título de hoy contra el unificado: junto a la línea del título de cada
	  tarjeta, en las dos columnas, y visible al pasar por toda la tarjeta.

	El panel de arriba es liviano: sólo los casos. Los interruptores van en la sección que cambian. El estado
	vive en la URL con nombres fijos —`caso`, `orden`, `panel`, `historial`, `ancla`— para volver a un estado
	exacto.
-->
<script lang="ts">
import { Database, Pencil } from "@lucide/svelte";
import { get } from "svelte/store";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import type { PublicationRequest } from "$lib/api/publication";
import AnchorLink from "$lib/components/dataset/AnchorLink.svelte";
import DatasetSidebar from "$lib/components/dataset/DatasetSidebar.svelte";
import OverflowBadges, { type BadgeItem } from "$lib/components/dataset/OverflowBadges.svelte";
import type { PublicationDecisionResult } from "$lib/components/dataset/publication-decision";
import RequestPublicationControl from "$lib/components/dataset/RequestPublicationControl.svelte";
import ResourceCard from "$lib/components/dataset/ResourceCard.svelte";
import ResponsiveAction from "$lib/components/dataset/ResponsiveAction.svelte";
import { CURRENT_SIDEBAR_ORDER, type SidebarCard } from "$lib/components/dataset/sidebar";
import Breadcrumb, { type BreadcrumbItem } from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { CopyButton } from "$lib/components/ui/copy-button";
import { MetaGroup } from "$lib/components/ui/meta";
import { insigniaDeLaSolicitud } from "$lib/copy/publication";
import { technicalGroups } from "$lib/datasets/details";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { formatDate } from "$lib/utils/ckan";
import { SUMMARY_EXTRA_KEY } from "$lib/utils/dataset-summary";
import { renderMarkdown } from "$lib/utils/markdown";
import AsideInstrument from "./AsideInstrument.svelte";
import { PANEL_CASES, type PanelCase, SCENARIOS } from "./fixtures";
import PlaygroundToggle from "./PlaygroundToggle.svelte";

type Order = "actual" | "propuesta";
type Scroll = "hoy" | "propio";
type History = "completo" | "plegado";
type Anchor = "hoy" | "unificado";

/**
 * La propuesta: primero lo que le concierne a quien tiene algo que hacer (la solicitud), después lo que
 * responde «¿me sirve esto?» (Resumen) y de quién es (Organización), y recién entonces cómo citarlo; el
 * historial, el único que crece sin tope y el único que el visitante no ve, va al final.
 */
const PROPOSED_ORDER: readonly SidebarCard[] = [
	"request",
	"summary",
	"organization",
	"cite",
	"history",
];

const url = get(page).url;

function paramOr<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	const raw = url.searchParams.get(key);
	return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

let caso = $state<PanelCase>(paramOr("caso", PANEL_CASES, "todas"));
let orden = $state<Order>(paramOr("orden", ["actual", "propuesta"] as const, "actual"));
let panel = $state<Scroll>(paramOr("panel", ["hoy", "propio"] as const, "hoy"));
let historial = $state<History>(paramOr("historial", ["completo", "plegado"] as const, "completo"));
let ancla = $state<Anchor>(paramOr("ancla", ["hoy", "unificado"] as const, "hoy"));

const scenario = $derived(SCENARIOS[caso]);

// Lo que la ficha real cambia al pedir, retirar o decidir: acá vive en memoria y vuelve al caso al cambiarlo
// (un `$derived` escribible).
let dataset = $derived<CkanPackage>(scenario.dataset);
let solicitudVigente = $derived<PublicationRequest | null>(scenario.request);

let asideElement = $state<HTMLElement | undefined>();

/**
 * Refleja el estado en la URL. El segundo argumento de `replaceState` es `page.state` y debe ser un
 * objeto plano (ver `src/routes/dev/error/+page.svelte`).
 */
function syncUrl(): void {
	const params = new URLSearchParams({ caso, orden, panel, historial, ancla });
	replaceState(`/dev/dataset-panel?${params.toString()}`, {});
}

// ─── Las acciones, sin catálogo ─────────────────────────────────
// Los controles reales reciben sus acciones inyectadas; acá responden con la fila que respondería el catálogo.
const solicitar = async (datasetId: string): Promise<PublicationRequest> => ({
	id: "req-nueva",
	dataset_id: datasetId,
	status: "pending",
	requested_by_name: "Ana Rojas",
	created_at: new Date().toISOString(),
});
const cancelar = async (requestId: string): Promise<PublicationRequest> => ({
	...(solicitudVigente ?? { id: requestId, dataset_id: dataset.id }),
	id: requestId,
	status: "cancelled",
});
const decidir = async (requestId: string, approve: boolean, comments?: string) => ({
	...(solicitudVigente ?? { id: requestId, dataset_id: dataset.id }),
	id: requestId,
	status: approve ? ("approved" as const) : ("rejected" as const),
	decision_comment: comments ?? null,
	comments: comments ?? null,
	approved_by_name: "Carlos Méndez",
	decidable_by_caller: false,
});
const readStoredDataset = async (): Promise<CkanPackage> => ({ ...dataset, private: false });
function reflejarDecision(respuesta: PublicationDecisionResult): void {
	solicitudVigente = respuesta;
	if (respuesta.status === "approved") dataset = { ...dataset, private: false };
}

// ─── Copia de la ficha: hero y columna principal ────────────────
const puedeEditarDataset = $derived(scenario.canEdit);
const publicacionEnElHero = $derived(
	dataset.private && puedeEditarDataset && solicitudVigente?.status !== "approved",
);
const description = $derived(dataset.notes?.trim() ? renderMarkdown(dataset.notes) : null);
const activeResources = $derived(
	dataset.resources?.filter((r) => r.state === "active" || !r.state) ?? [],
);
const visibleTags = $derived(dataset.tags?.slice(0, 5) ?? []);
const hiddenTagCount = $derived((dataset.tags?.length ?? 0) - 5);
const technical = $derived(technicalGroups(dataset));
const resumenEditorial = $derived(
	dataset.extras?.find((extra) => extra.key === SUMMARY_EXTRA_KEY)?.value?.trim() ?? "",
);
const shareUrl = $derived(`${$page.url.origin}/dataset/${dataset.name}`);
const searchHref = (key: "org" | "tags", value: string) =>
	`/search?${new URLSearchParams({ [key]: value })}`;

const breadcrumbItems = $derived.by((): BreadcrumbItem[] => [
	{ label: "Datasets", href: "/search", role: "Catálogo" },
	...(dataset.organization?.title
		? [
				{
					label: dataset.organization.title,
					href: `/organization/${encodeURIComponent(dataset.organization.name)}`,
					role: "Organización",
				},
			]
		: []),
	{ label: dataset.title || dataset.name, role: "Dataset" },
]);

const heroBadges = $derived.by((): BadgeItem[] => {
	const list: BadgeItem[] = [];
	const org = dataset.organization;
	if (org?.title) {
		list.push({
			id: "org",
			label: org.title,
			priority: 0,
			shrinks: true,
			tone: "border-primary/20 bg-primary/10 text-primary",
			linkable: true,
			href: searchHref("org", org.name),
			linkLabel: `Ver datasets de ${org.title} en el catálogo`,
		});
	}
	const solicitud = publicacionEnElHero ? null : insigniaDeLaSolicitud(solicitudVigente?.status);
	if (solicitud) list.push({ id: "solicitud", priority: 2, ...solicitud });
	if (dataset.private) {
		list.push({
			id: "privacidad",
			label: "Privado",
			priority: 1,
			tone: "border-destructive/20 bg-destructive/10 text-destructive",
		});
	}
	return list;
});

// «Unificado»: la tarjeta entera hace aparecer el botón del enlace.
const unified = $derived(ancla === "unificado");
const reveal = $derived(unified ? ("card" as const) : ("title" as const));

const instrumentVersion = $derived(`${caso}|${orden}|${historial}|${ancla}`);
</script>

<svelte:head>
	<title>Panel del dataset (playground) — UMSS</title>
</svelte:head>

<!-- ─── Panel de control (global) ─────────────────────────────────── -->
<div class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
	<section
		data-testid="control-panel"
		aria-label="Panel del playground"
		class="rounded-xl border border-dashed border-border bg-muted/50 p-4 sm:p-5"
	>
		<h2 class="text-sm font-semibold text-foreground">Casos</h2>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each PANEL_CASES as id (id)}
				<button
					type="button"
					data-testid={`preset-${id}`}
					aria-pressed={caso === id}
					onclick={() => {
						caso = id;
						syncUrl();
					}}
					class="cursor-pointer rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {caso ===
					id
						? 'bg-primary text-primary-foreground'
						: 'bg-background text-foreground hover:bg-accent'}"
				>
					{SCENARIOS[id].label}
				</button>
			{/each}
		</div>
		<p class="mt-2 text-xs text-muted-foreground">{scenario.note}</p>
	</section>
</div>

<!-- ─── Área de producto: copia de la ficha ───────────────────────── -->
<div data-testid="dataset-page" class="mt-6">
	<div class="border-y border-border bg-card">
		<div class="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
			<Breadcrumb items={breadcrumbItems} icon={Database} />
		</div>
	</div>

	<!-- Hero -->
	<section class="border-b border-border bg-card">
		<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<div class="flex items-start gap-3 font-heading text-3xl leading-tight sm:text-4xl">
				<div class="flex h-[1lh] shrink-0 items-center">
					<CopyButton
						text={shareUrl}
						label="Copiar enlace del dataset"
						copiedLabel="Enlace copiado"
						icon="link"
					/>
				</div>
				<h1 class="min-w-0 font-bold text-foreground">{dataset.title || dataset.name}</h1>
			</div>
			{#if resumenEditorial}
				<p class="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
					{resumenEditorial}
				</p>
			{/if}
			<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
				<span>Actualizado {formatDate(dataset.metadata_modified)}</span>
			</div>
			<div class="@container mt-4 space-y-3">
				<div class="flex flex-nowrap items-center gap-3">
					<div class="min-w-0 flex-1 basis-[10rem]">
						<OverflowBadges badges={heroBadges} />
					</div>
					{#if puedeEditarDataset}
						<div class="flex shrink-0 items-center">
							<ResponsiveAction
								icon={Pencil}
								label="Editar"
								href={`/dev/dataset-panel?caso=${caso}`}
								collapseBelow="32rem"
							/>
						</div>
					{/if}
				</div>
				{#if publicacionEnElHero}
					<RequestPublicationControl
						dataset={{ id: dataset.id, private: dataset.private }}
						canRequest={puedeEditarDataset}
						currentRequest={solicitudVigente}
						request={solicitar}
						cancel={cancelar}
						apariencia="accion"
						onrequested={(reportada) => (solicitudVigente = reportada)}
						oncancelled={(reportada) => (solicitudVigente = reportada)}
					/>
				{/if}
			</div>
		</div>
	</section>

	<!-- Body: two-column layout -->
	<section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		<!-- Interruptores de cada columna, sobre la columna que cambian -->
		<div class="mb-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
			<div
				class="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3"
				data-testid="anchor-toggles"
			>
				<PlaygroundToggle
					label="Botón del enlace"
					testid="toggle-ancla"
					options={[
						{ value: "hoy", label: "Como hoy" },
						{ value: "unificado", label: "Unificado" },
					]}
					value={ancla}
					onchange={(next) => {
						ancla = next;
						syncUrl();
					}}
				/>
				<p class="text-xs text-muted-foreground">
					{unified
						? "Unificado: en las dos columnas el botón va junto a la línea del título y aparece al pasar por cualquier parte de la tarjeta, o al enfocar algo dentro de ella."
						: "Como hoy: a la izquierda el botón va junto al segundo título; a la derecha, junto al único. Aparece sólo al pasar por el título."}
				</p>
			</div>
			<div
				class="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3"
				data-testid="aside-toggles"
			>
				<PlaygroundToggle
					label="Orden"
					testid="toggle-orden"
					options={[
						{ value: "actual", label: "Actual" },
						{ value: "propuesta", label: "Propuesta" },
					]}
					value={orden}
					onchange={(next) => {
						orden = next;
						syncUrl();
					}}
				/>
				<PlaygroundToggle
					label="Panel"
					testid="toggle-panel"
					options={[
						{ value: "hoy", label: "Como hoy" },
						{ value: "propio", label: "Scroll propio" },
					]}
					value={panel}
					onchange={(next) => {
						panel = next;
						syncUrl();
					}}
				/>
				<PlaygroundToggle
					label="Historial"
					testid="toggle-historial"
					options={[
						{ value: "completo", label: "Completo" },
						{ value: "plegado", label: "Plegado" },
					]}
					value={historial}
					onchange={(next) => {
						historial = next;
						syncUrl();
					}}
				/>
				<p class="text-xs text-muted-foreground">
					{orden === "propuesta"
						? "Propuesta: la solicitud para quien tiene algo que hacer, Resumen y Organización para decidir si le sirve, Citar como cuando ya lo va a usar, y el historial —el único que crece y que el visitante no ve— al final."
						: "Actual: el orden de la ficha hoy (solicitud, Citar como, Resumen, historial, Organización)."}
				</p>
				<AsideInstrument
					element={asideElement}
					scroll={panel === "propio" ? "own" : "page"}
					version={instrumentVersion}
				/>
			</div>
		</div>

		<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
			<!-- Main column -->
			<div class="min-w-0 space-y-6">
				<Card class={cn("p-6 sm:p-8", unified && "group/tarjeta")}>
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">Descripción</p>
					<h2 class="mt-1 font-heading text-xl font-bold text-primary">Sobre este dataset</h2>
					{#if description}
						<div class="markdown-body mt-3 text-sm leading-relaxed text-muted-foreground">
							{@html description}
						</div>
					{:else}
						<p class="mt-3 text-sm italic text-muted-foreground">Sin descripción</p>
					{/if}
					{#if dataset.tags && dataset.tags.length > 0}
						<div class="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-4">
							{#each visibleTags as tag (tag.id)}
								{@const label = tag.display_name || tag.name}
								<a
									href={searchHref("tags", tag.name)}
									aria-label={`Ver datasets con la etiqueta ${label} en el catálogo`}
									class="relative inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									#{label}
								</a>
							{/each}
							{#if hiddenTagCount > 0}
								<span class="inline-flex items-center rounded-full px-3 py-1 text-xs text-muted-foreground">
									+{hiddenTagCount} más
								</span>
							{/if}
						</div>
					{/if}
				</Card>

				<!-- Resources -->
				<Card
					id="resources"
					class={cn(
						"scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] p-6 sm:p-8",
						unified && "group/tarjeta",
					)}
				>
					{#if unified}
						<div class="group/ancla flex h-4 items-center gap-2">
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">Recursos</p>
							<AnchorLink id="resources" title="Recursos" {reveal} />
						</div>
						<h2 class="mt-1 font-heading text-xl font-bold text-primary">
							Archivos disponibles
							<span class="font-normal text-muted-foreground">({activeResources.length})</span>
						</h2>
					{:else}
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">Recursos</p>
						<div class="group/ancla mt-1 flex items-center gap-2">
							<h2 class="font-heading text-xl font-bold text-primary">
								Archivos disponibles
								<span class="font-normal text-muted-foreground">({activeResources.length})</span>
							</h2>
							<AnchorLink id="resources" title="Recursos" />
						</div>
					{/if}
					<div class="mt-4 space-y-2">
						{#each activeResources as resource (resource.id)}
							<ResourceCard {resource} datasetSlug={dataset.name} />
						{/each}
					</div>
				</Card>

				<!-- Información técnica -->
				<Card
					id="technical-info"
					class={cn(
						"scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] p-6 sm:p-8",
						unified && "group/tarjeta",
					)}
				>
					{#if unified}
						<div class="group/ancla flex h-4 items-center gap-2">
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">
								Información técnica
							</p>
							<AnchorLink id="technical-info" title="Información técnica" {reveal} />
						</div>
						<h2 class="mt-1 font-heading text-xl font-bold text-primary">Ficha completa</h2>
					{:else}
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">
							Información técnica
						</p>
						<div class="group/ancla mt-1 flex items-center gap-2">
							<h2 class="font-heading text-xl font-bold text-primary">Ficha completa</h2>
							<AnchorLink id="technical-info" title="Información técnica" />
						</div>
					{/if}
					<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
						Todos los datos que el catálogo registra de este dataset.
					</p>
					<div class="mt-4 space-y-8">
						{#each technical as group (group.id)}
							<MetaGroup {...group} />
						{/each}
					</div>
				</Card>
			</div>

			<!-- Sidebar: la real -->
			<DatasetSidebar
				bind:element={asideElement}
				{dataset}
				{solicitudVigente}
				pendingRequestCount={solicitudVigente?.status === "pending" ? 1 : 0}
				puedeDecidirSolicitud={scenario.canDecide}
				{decidir}
				{readStoredDataset}
				{reflejarDecision}
				historialDeSolicitudes={scenario.history}
				order={orden === "propuesta" ? PROPOSED_ORDER : CURRENT_SIDEBAR_ORDER}
				scroll={panel === "propio" ? "own" : "page"}
				{reveal}
				historyLimit={historial === "plegado" ? 1 : undefined}
			/>
		</div>
	</section>
</div>
