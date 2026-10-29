<!--
	Maqueta — Colecciones. PRD RF-21..RF-23; S12 de `odd/tasks/prototype-presentation.md` (Q18).

	Pantalla sin funcionamiento, con datos de ejemplo (`./data.ts`): las colecciones reúnen datasets de
	varias organizaciones sin copiarlos. Cualquier usuario con sesión puede crear una (RF-21), así que el
	curador es una persona o una organización.

	`?vista=publica` (por defecto) o `?vista=panel` eligen entre las dos pantallas que Q18 separa, con la franja
	de revisión de arriba (fuera del área de producto). La **pública** es la lista del menú principal: sólo las
	colecciones públicas, sin filtro de visibilidad y sin «Nueva colección» (un visitante sin sesión no puede
	crear una). La **del panel** es «Mis colecciones» de una persona fija, miembro de tres organizaciones
	(`PANEL_VIEWER`): las que cura a título personal y las que curan sus organizaciones, con el filtro de
	visibilidad y «Nueva colección». «Colecciones que cura» en la ficha de cada organización, la tercera ubicación
	de Q18, no está en esta maqueta.

	S22: las dos filtran por quien cura con las pestañas de organización de «Solicitudes»: el mismo `OverflowTabs`,
	con los mismos parámetros que `OrgTabs` (pestañas desde 611 px de contenedor, desplegable debajo, «Más (n)»
	para las que no caben, barra pegada bajo el encabezado) y su modelo (`TODAS_LAS_ORGANIZACIONES`,
	`hasOrganizationTabs`). No se monta `OrgTabs` tal cual porque su insignia se nombra «N pendientes»: acá cuenta
	colecciones. «Todas» · «Personales» (una sola etiqueta en las dos vistas, L26) · una por organización —en el panel, una por cada organización de quien
	mira—, cada una con su conteo. En el panel reemplazan al desplegable «Curadas por…», que no escalaba a varias
	organizaciones; el filtro de visibilidad queda a la derecha de la fila, como «Mostrar» en «Solicitudes».

	Factibilidad en CKAN (S6): una colección es un `group` y su contenido, `group_member` (nativos; medido:
	`ckan.auth.user_create_groups = true`, cualquier usuario puede crearlas hoy). Las visibilidades «Interna» y
	«Privada» (Q10) y la aprobación por organización para publicarla (RF-23) **no son nativas**: un `group` de
	CKAN es siempre público; serían una extensión propia.
-->
<script lang="ts">
import {
	Building2,
	ChevronDown,
	Database,
	FolderPlus,
	Library,
	Search,
	User,
} from "@lucide/svelte";
import { Tabs } from "bits-ui";
import { page } from "$app/stores";
import {
	hasOrganizationTabs,
	TODAS_LAS_ORGANIZACIONES,
} from "$lib/components/requests/requests-model";
import { surfaceClass } from "$lib/components/requests/sticky-bar";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import OverflowTabs from "$lib/components/ui/tabs/OverflowTabs.svelte";
import {
	FIELD_CHEVRON_CLASS,
	FIELD_CLASS,
	FORMS,
	type OverflowItem,
} from "$lib/components/ui/tabs/overflow-tabs";
import { cn } from "$lib/utils";
import {
	COLLECTIONS,
	canSee,
	collectionHref,
	collectionsCountLabel,
	curatedBy,
	curatorLabel,
	curatorTabs,
	inCuratorTab,
	ownerOrgs,
	PANEL_VIEWER,
	type Visibility,
} from "./data";
import VisibilityBadge from "./VisibilityBadge.svelte";

type View = "publica" | "panel";

const VIEWS: { value: View; label: string; note: string }[] = [
	{
		value: "publica",
		label: "Menú principal",
		note: "La lista del menú principal: sólo las colecciones públicas, como la ve cualquier visitante.",
	},
	{
		value: "panel",
		label: "Panel",
		note: `«Mis colecciones» en el panel de ${PANEL_VIEWER.name}, miembro de la Dirección de Investigación, la FCyT y el Rectorado: las que cura a título personal y las de sus organizaciones.`,
	},
];

const view = $derived<View>($page.url.searchParams.get("vista") === "panel" ? "panel" : "publica");
const current = $derived(VIEWS.find((v) => v.value === view) ?? VIEWS[0]);
const all = $derived(
	view === "panel"
		? COLLECTIONS.filter((c) => curatedBy(c, PANEL_VIEWER))
		: COLLECTIONS.filter((c) => canSee(c, { kind: "visitor" })),
);

// Las pestañas de organización (S22). En el panel, una por cada organización de quien mira, aunque no cure
// ninguna; en el menú principal, las que curan alguna pública.
const tabs = $derived(
	curatorTabs(all, {
		todas: TODAS_LAS_ORGANIZACIONES,
		personales: "Personales",
		orgs: view === "panel" ? PANEL_VIEWER.orgs : undefined,
	}),
);
const tabItems = $derived<OverflowItem[]>(
	tabs.map((t) => ({ id: t.id, label: t.label, count: t.count })),
);
// La misma regla que «Solicitudes»: sólo hay pestañas si filtran algo («Todas» y al menos dos más).
const withTabs = $derived(
	hasOrganizationTabs(tabs.map((t) => ({ id: t.id, label: t.label, pending: t.count }))),
);
let tab = $state(TODAS_LAS_ORGANIZACIONES);
const activeTab = $derived(tabs.some((t) => t.id === tab) ? tab : TODAS_LAS_ORGANIZACIONES);

const VISIBILITIES: Visibility[] = ["Privada", "Interna", "Pública"];
let visibility = $state<Visibility | "">("");

const collections = $derived(
	inCuratorTab(all, activeTab).filter((c) => !visibility || c.visibility === visibility),
);
// Desde el panel, quien cura abre la ficha en la vista del curador.
const cardHref = (slug: string) =>
	view === "panel" ? `${collectionHref(slug)}&vista=curador` : collectionHref(slug);

const form = FORMS["611px"];
const inputClass =
	"h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
</script>

<svelte:head>
	<title>{view === "panel" ? "Mis colecciones — Panel" : "Colecciones"} — UMSS</title>
</svelte:head>

{#snippet visibilityFilter()}
	<!-- Como «Mostrar» de «Solicitudes» (`StatusSelect`): el mismo campo que el desplegable de organización. -->
	<label class="flex items-center gap-2 text-xs font-medium text-muted-foreground @max-[18rem]:w-full">
		<span class={cn("sr-only @max-[18rem]:not-sr-only", form.wideLabel)} aria-hidden="true">Visibilidad:</span>
		<span class="relative min-w-0 flex-1">
			<select
				aria-label="Visibilidad"
				bind:value={visibility}
				class={cn(FIELD_CLASS, "w-full appearance-none", form.wideFieldH)}
			>
				<option value="">Todas las visibilidades</option>
				{#each VISIBILITIES as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
			<ChevronDown class={FIELD_CHEVRON_CLASS} aria-hidden="true" />
		</span>
	</label>
{/snippet}

{#snippet list()}
	<ul class="grid gap-4 md:grid-cols-2" data-testid="collections-list">
		{#each collections as collection (collection.slug)}
			{@const orgs = ownerOrgs(collection)}
			<li>
				<a
					href={cardHref(collection.slug)}
					class="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<Card
						class="flex h-full flex-col p-6 transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-accent/30"
					>
						<div class="flex items-start justify-between gap-3">
							<h2 class="font-heading text-xl font-bold text-primary group-hover:underline">
								{collection.name}
							</h2>
							<VisibilityBadge visibility={collection.visibility} />
						</div>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
							{collection.description}
						</p>
						<p class="mt-4 flex items-center gap-1.5 text-sm text-foreground">
							{#if collection.curator.kind === "org"}
								<Building2 class="size-4 shrink-0 text-primary" aria-hidden="true" />
							{:else}
								<User class="size-4 shrink-0 text-primary" aria-hidden="true" />
							{/if}
							<span class="text-muted-foreground">Curada por</span>
							<span class="min-w-0 truncate font-medium">{curatorLabel(collection.curator)}</span>
						</p>
						<div
							class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-sm text-muted-foreground"
						>
							<span class="inline-flex items-center gap-1.5" data-testid="collection-counts">
								<Database class="size-4" aria-hidden="true" />
								{collection.datasets.length} datasets de {orgs.length} organizaciones
							</span>
							<ul class="flex flex-wrap gap-1.5">
								{#each orgs as org (org.name)}
									<li
										class="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-semibold text-foreground"
										title={org.title}
									>
										{org.acronym}
									</li>
								{/each}
							</ul>
						</div>
					</Card>
				</a>
			</li>
		{/each}
	</ul>
	{#if collections.length === 0}
		<p class="text-sm text-muted-foreground">No hay colecciones con esta visibilidad en esta pestaña.</p>
	{/if}
{/snippet}

<div class="min-h-screen bg-background font-sans text-foreground">
	<!-- ─── Franja de revisión (DEV, fuera del producto) ──────────────── -->
	<div class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
		<section
			data-testid="review-strip"
			aria-label="Revisión de la maqueta"
			class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed border-border bg-muted/50 px-4 py-3"
		>
			<nav class="flex flex-wrap items-center gap-2" aria-label="Vista">
				<span class="text-xs font-medium text-muted-foreground">Vista</span>
				{#each VIEWS as option (option.value)}
					<a
						href="/dev/prototype/collections?vista={option.value}"
						aria-current={view === option.value ? "page" : undefined}
						data-testid="view-{option.value}"
						class="cursor-pointer rounded-lg border border-input px-3 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {view ===
						option.value
							? 'bg-primary text-primary-foreground'
							: 'bg-background text-foreground hover:bg-accent'}"
					>
						{option.label}
					</a>
				{/each}
			</nav>
			<p class="text-xs text-muted-foreground" data-testid="review-note">{current.note}</p>
		</section>
	</div>

	<!-- ─── Área de producto ──────────────────────────────────────────── -->
	<div class="mx-auto max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">
		{#if view === "panel"}
			<Breadcrumb
				items={[{ label: "Panel", href: "/dashboard" }, { label: "Mis colecciones" }]}
				icon={Library}
			/>

			<header class="mt-5 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">Mis colecciones</h1>
					<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
						Las colecciones que usted cura y las de sus organizaciones. Una colección privada sólo
						la ve quien la cura; si la cura una organización, sus miembros.
					</p>
				</div>
				<Button>
					<FolderPlus class="size-4" aria-hidden="true" />
					Nueva colección
				</Button>
			</header>
		{:else}
			<Breadcrumb items={[{ label: "Inicio", href: "/" }, { label: "Colecciones" }]} icon={Library} />

			<header class="mt-5">
				<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">Colecciones</h1>
				<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Datasets de distintas organizaciones reunidos en un solo lugar, sin copiarlos: cada
					dataset se publica una vez, en su organización, y una colección sólo lo referencia.
				</p>
			</header>
		{/if}

		<Card class="mt-6 p-5">
			<div class="flex flex-wrap items-center gap-3">
				<label class="relative min-w-0 flex-1 basis-64">
					<span class="sr-only">Buscar colecciones</span>
					<Search
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input class="{inputClass} pl-9" placeholder="Buscar por nombre, descripción o curador" />
				</label>
			</div>
		</Card>

		<div class="mt-6">
			{#if withTabs}
				<OverflowTabs
					items={tabItems}
					value={activeTab}
					onchange={(id) => (tab = id)}
					label="Organización"
					mobileBelow="611px"
					countLabel={collectionsCountLabel}
					class={surfaceClass("background")}
					barTestId="barra-pestanas"
					trailing={view === "panel" ? visibilityFilter : undefined}
				>
					{#each tabs as t (t.id)}
						<Tabs.Content value={t.id} class="pt-4">
							{#if activeTab === t.id}{@render list()}{/if}
						</Tabs.Content>
					{/each}
				</OverflowTabs>
			{:else}
				{@render list()}
			{/if}
		</div>
	</div>
</div>
