<!--
	Maqueta — Ficha de colección. PRD RF-21..RF-23 y RF-39; S4, S10 y L3 de `odd/tasks/prototype-presentation.md`.

	Pantalla sin funcionamiento, con datos de ejemplo (`../collections/data.ts`). Muestra la descripción en
	markdown de la colección y sus datasets de varias organizaciones y, en cada uno, «También en» con las otras
	colecciones que lo incluyen: el recorrido en los dos sentidos de L3 (`ds1 → cl1 → ds2 → cl2 → ds3`).
	`?c=<colección>` elige cuál se muestra; sin él, la «Rendición pública de cuentas 2025», que tiene una
	aprobación pendiente.

	`?vista=publica` (por defecto) o `?vista=curador` eligen entre las dos vistas que S10 pide comparar, con
	la franja de revisión de arriba (fuera del área de producto). La **pública** es lo que ve cualquier
	visitante de una colección publicada: una tarjeta de información, sin el avance de las aprobaciones. La
	**del curador** es lo que ven el curador y los administradores de las organizaciones dueñas mientras la
	colección no es pública: el bloque «Publicación» con la aprobación por organización. Si se pide la vista
	pública de una colección que todavía no se publicó, se muestra como se verá una vez publicada (lo dice la
	franja, no el producto).

	Factibilidad en CKAN (S6): la colección es un `group` y sus datasets, `group_member` (nativos; medido:
	`ckan.auth.user_create_groups = true`). La descripción en markdown es el `description` del `group`
	(nativo), renderizada con `renderMarkdown` como la de un dataset. «También en» sale de los `groups` de
	cada dataset (nativo). La aprobación de cada organización dueña para publicarla (RF-23) **no es nativa**:
	es una extensión propia, y también lo es ocultar la colección mientras no se publica (un `group` de CKAN
	es siempre público; ver Q10 en `design-system/datos-umss/preguntas-abiertas.md`).
-->
<script lang="ts">
import {
	Building2,
	CalendarClock,
	CalendarPlus,
	CircleCheck,
	Clock,
	Database,
	Globe,
	Library,
	Lock,
	Plus,
	Scale,
	Send,
	User,
} from "@lucide/svelte";
import { page } from "$app/stores";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { renderMarkdown } from "$lib/utils/markdown";
import {
	collectionBySlug,
	collectionHref,
	collectionsOf,
	curatorLabel,
	datasetBySlug,
	datasetHref,
	ORGS,
	ownerOrgs,
} from "../collections/data";

type View = "publica" | "curador";

const VIEWS: { value: View; label: string }[] = [
	{ value: "publica", label: "Pública" },
	{ value: "curador", label: "Del curador (privada)" },
];

const collection = $derived(collectionBySlug($page.url.searchParams.get("c")));
const view = $derived<View>(
	$page.url.searchParams.get("vista") === "curador" ? "curador" : "publica",
);
const published = $derived(collection.visibility === "Pública");
// La descripción es markdown (RF-39), con el mismo render seguro que la de un dataset.
const description = $derived(renderMarkdown(collection.markdown));
const datasets = $derived(collection.datasets.map(datasetBySlug));
const orgs = $derived(ownerOrgs(collection));
const approvals = $derived(collection.approvals);
const approvedCount = $derived(
	approvals ? Object.values(approvals).filter((a) => a === "Aprobada").length : 0,
);

const viewHref = (next: View) => `${collectionHref(collection.slug)}&vista=${next}`;

const linkClass =
	"rounded-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
</script>

<svelte:head>
	<title>{collection.name} — Colecciones — UMSS</title>
</svelte:head>

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
						href={viewHref(option.value)}
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
			<p class="text-xs text-muted-foreground" data-testid="review-note">
				{#if view === "publica" && !published}
					Esta colección todavía no es pública: se muestra como se verá una vez publicada.
				{:else if view === "publica"}
					Lo que ve cualquier visitante de la colección publicada.
				{:else}
					Lo que ven el curador y los administradores de las organizaciones dueñas.
				{/if}
			</p>
		</section>
	</div>

	<!-- ─── Área de producto ──────────────────────────────────────────── -->
	<div class="mx-auto max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">
		<Breadcrumb
			items={[
				{ label: "Inicio", href: "/" },
				{ label: "Colecciones", href: "/dev/prototype/collections" },
				{ label: collection.name },
			]}
			icon={Library}
		/>

		<header class="mt-5 flex flex-wrap items-end justify-between gap-4">
			<div class="min-w-0">
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">Colección</p>
				<h1 class="mt-1 font-heading text-3xl font-bold text-primary sm:text-4xl">
					{collection.name}
				</h1>
				<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					{collection.description}
				</p>
				<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
					<span class="inline-flex items-center gap-1.5">
						{#if collection.curator.kind === "org"}
							<Building2 class="size-4 text-primary" aria-hidden="true" />
						{:else}
							<User class="size-4 text-primary" aria-hidden="true" />
						{/if}
						<span class="text-muted-foreground">Curada por</span>
						<span class="font-medium">{curatorLabel(collection.curator)}</span>
					</span>
					{#if view === "publica" || published}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
							data-testid="visibility-badge"
						>
							<Globe class="size-3" aria-hidden="true" />
							Pública
						</span>
					{:else}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
							data-testid="visibility-badge"
						>
							<Lock class="size-3" aria-hidden="true" />
							Todavía no es pública
						</span>
					{/if}
				</div>
			</div>
			{#if view === "curador"}
				<Button variant="outline">
					<Plus class="size-4" aria-hidden="true" />
					Agregar dataset
				</Button>
			{/if}
		</header>

		<div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
			<div class="min-w-0 space-y-6">
				<Card class="p-6 sm:p-8" data-testid="collection-description">
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">Descripción</p>
					<h2 class="mt-1 font-heading text-xl font-bold text-primary">Sobre esta colección</h2>
					<div class="markdown-body mt-3 text-sm leading-relaxed text-muted-foreground">
						{@html description}
					</div>
				</Card>

				<Card class="p-6 sm:p-8">
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">Contenido</p>
					<h2 class="mt-1 font-heading text-xl font-bold text-primary">
						Datasets
						<span class="font-normal text-muted-foreground">({datasets.length})</span>
					</h2>
					<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
						{datasets.length} datasets de {orgs.length} organizaciones. Cada uno se publica una sola vez, en su
						organización; esta colección lo referencia.
					</p>

					<ul class="mt-4 divide-y divide-border" data-testid="collection-datasets">
						{#each datasets as dataset (dataset.slug)}
							{@const others = collectionsOf(dataset.slug, collection.slug)}
							<li class="py-4" data-testid="collection-dataset">
								<div class="flex items-start gap-3">
									<Database class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
									<div class="min-w-0 flex-1">
										<a href={datasetHref(dataset.slug)} class="{linkClass} text-base">{dataset.title}</a>
										<p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
											<span class="inline-flex items-center gap-1.5">
												<Building2 class="size-3.5" aria-hidden="true" />
												<span data-testid="dataset-org">{ORGS[dataset.org].title}</span>
											</span>
											<span>Actualizado {dataset.updated}</span>
										</p>
										<ul class="mt-2 flex flex-wrap gap-1.5" aria-label="Formatos">
											{#each dataset.formats as format (format)}
												<li
													class="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground"
												>
													{format}
												</li>
											{/each}
										</ul>
										<p class="mt-2 text-sm" data-testid="also-in">
											{#if others.length > 0}
												<span class="text-muted-foreground">También en:</span>
												{#each others as other, i (other.slug)}
													<a href={collectionHref(other.slug)} class={linkClass}>{other.name}</a
													>{#if i < others.length - 1}<span class="text-muted-foreground">, </span>{/if}
												{/each}
											{:else}
												<span class="text-muted-foreground">Sólo en esta colección.</span>
											{/if}
										</p>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				</Card>
			</div>

			<aside class="min-w-0 space-y-6">
				{#if view === "publica"}
					<Card class="p-6 sm:p-8" data-testid="collection-info">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">Información</p>
						<h2 class="mt-1 font-heading text-xl font-bold text-primary">Sobre la colección</h2>
						<dl class="mt-4 space-y-3">
							<div class="flex items-start gap-3">
								{#if collection.curator.kind === "org"}
									<Building2 class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
								{:else}
									<User class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
								{/if}
								<div class="min-w-0">
									<dt class="text-xs text-muted-foreground">Curada por</dt>
									<dd class="text-sm font-semibold leading-snug text-foreground">
										{curatorLabel(collection.curator)}
									</dd>
								</div>
							</div>
							<div class="flex items-start gap-3">
								<CalendarPlus class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
								<div class="min-w-0">
									<dt class="text-xs text-muted-foreground">Creada</dt>
									<dd class="text-sm font-semibold leading-snug text-foreground">{collection.created}</dd>
								</div>
							</div>
							<div class="flex items-start gap-3">
								<CalendarClock class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
								<div class="min-w-0">
									<dt class="text-xs text-muted-foreground">Última actualización</dt>
									<dd class="text-sm font-semibold leading-snug text-foreground">{collection.updated}</dd>
								</div>
							</div>
							<div class="flex items-start gap-3">
								<Database class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
								<div class="min-w-0">
									<dt class="text-xs text-muted-foreground">Datasets</dt>
									<dd class="text-sm font-semibold leading-snug text-foreground">{datasets.length}</dd>
								</div>
							</div>
							<div class="flex items-start gap-3">
								<Building2 class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
								<div class="min-w-0">
									<dt class="text-xs text-muted-foreground">Organizaciones</dt>
									<dd class="text-sm font-semibold leading-snug text-foreground">{orgs.length}</dd>
									<dd class="mt-1 text-xs leading-relaxed text-muted-foreground">
										{orgs.map((org) => org.title).join(" · ")}
									</dd>
								</div>
							</div>
						</dl>
						<p
							class="mt-5 flex items-start gap-2 rounded-lg bg-accent/60 p-3 text-xs leading-relaxed text-accent-foreground"
						>
							<Scale class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
							Cada dataset conserva su licencia y se publica en su organización dueña.
						</p>
					</Card>
				{:else}
					<Card class="p-6 sm:p-8" data-testid="publication-status">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">Publicación</p>
						<h2 class="mt-1 font-heading text-xl font-bold text-primary">Aprobación de las organizaciones</h2>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
							Para que la colección sea pública, el administrador de cada organización dueña de sus datasets
							la aprueba.
						</p>

						{#if approvals}
							<p class="mt-4 text-sm font-medium text-foreground" data-testid="approval-summary">
								{approvedCount} de {orgs.length} organizaciones aprobaron
							</p>
							<div
								class="mt-2 h-2 overflow-hidden rounded-full bg-muted"
								role="progressbar"
								aria-label="Aprobaciones"
								aria-valuemin={0}
								aria-valuemax={orgs.length}
								aria-valuenow={approvedCount}
							>
								<div class="h-full rounded-full bg-primary" style:width="{(approvedCount / orgs.length) * 100}%"></div>
							</div>
							<ul class="mt-4 space-y-3">
								{#each orgs as org (org.name)}
									{@const state = approvals[org.name] ?? "Pendiente"}
									<li class="flex items-start justify-between gap-3 text-sm" data-testid="approval-{org.name}">
										<span class="min-w-0">
											<span class="block font-medium text-foreground">{org.title}</span>
											<span class="text-xs text-muted-foreground">Administrador de {org.acronym}</span>
										</span>
										{#if state === "Aprobada"}
											<span
												class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
											>
												<CircleCheck class="size-3" aria-hidden="true" />
												Aprobada
											</span>
										{:else}
											<span
												class="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
											>
												<Clock class="size-3" aria-hidden="true" />
												Pendiente
											</span>
										{/if}
									</li>
								{/each}
							</ul>
							{#if approvedCount === orgs.length}
								<p class="mt-4 rounded-lg bg-accent/60 p-3 text-xs leading-relaxed text-accent-foreground">
									Todas las organizaciones aprobaron: la colección es pública.
								</p>
							{:else}
								<p class="mt-4 rounded-lg bg-accent/60 p-3 text-xs leading-relaxed text-accent-foreground">
									La colección se publica cuando aprueben todas. Mientras tanto, sólo la ven los usuarios con
									sesión.
								</p>
							{/if}
						{:else}
							<p class="mt-4 text-sm text-foreground">
								Esta colección es interna y todavía no se pidió su publicación.
							</p>
							<Button class="mt-4 w-full">
								<Send class="size-4" aria-hidden="true" />
								Solicitar publicación
							</Button>
						{/if}
					</Card>
				{/if}
			</aside>
		</div>
	</div>
</div>
