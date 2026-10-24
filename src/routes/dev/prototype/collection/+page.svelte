<!--
	Maqueta — Ficha de colección. PRD RF-21..RF-23; S4 y L3 de `odd/tasks/prototype-presentation.md`.

	Pantalla sin funcionamiento, con datos de ejemplo (`../collections/data.ts`). Muestra datasets de varias
	organizaciones y, en cada uno, «También en» con las otras colecciones que lo incluyen: el recorrido en los
	dos sentidos de L3 (`ds1 → cl1 → ds2 → cl2 → ds3`). `?c=<colección>` elige cuál se muestra; sin él, la
	«Rendición pública de cuentas 2025», que tiene una aprobación pendiente.

	Factibilidad en CKAN (S6): la colección es un `group` y sus datasets, `group_member` (nativos; medido:
	`ckan.auth.user_create_groups = true`). «También en» sale de los `groups` de cada dataset (nativo). La
	aprobación de cada organización dueña para publicarla (RF-23) **no es nativa**: es una extensión propia.
-->
<script lang="ts">
import {
	Building2,
	CircleCheck,
	Clock,
	Database,
	Globe,
	Library,
	Lock,
	Plus,
	Send,
	User,
} from "@lucide/svelte";
import { page } from "$app/stores";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
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

const collection = $derived(collectionBySlug($page.url.searchParams.get("c")));
const datasets = $derived(collection.datasets.map(datasetBySlug));
const orgs = $derived(ownerOrgs(collection));
const approvals = $derived(collection.approvals);
const approvedCount = $derived(
	approvals ? Object.values(approvals).filter((a) => a === "Aprobada").length : 0,
);

const linkClass =
	"rounded-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
</script>

<svelte:head>
	<title>{collection.name} — Colecciones — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
					{#if collection.visibility === "Pública"}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
						>
							<Globe class="size-3" aria-hidden="true" />
							Pública
						</span>
					{:else}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
						>
							<Lock class="size-3" aria-hidden="true" />
							Interna
						</span>
					{/if}
				</div>
			</div>
			<Button variant="outline">
				<Plus class="size-4" aria-hidden="true" />
				Agregar dataset
			</Button>
		</header>

		<div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
			<Card class="min-w-0 p-6 sm:p-8">
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

			<aside class="min-w-0 space-y-6">
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
			</aside>
		</div>
	</div>
</div>
