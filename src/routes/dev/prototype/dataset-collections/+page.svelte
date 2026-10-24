<!--
	Maqueta — Colecciones de un dataset: extracto de la ficha del dataset (`src/routes/dataset/[id]`) con la
	sección «Aparece en las colecciones». PRD RF-22; S4 y L3 de `odd/tasks/prototype-presentation.md`.

	Pantalla sin funcionamiento, con datos de ejemplo (`../collections/data.ts`). Es el sentido inverso de la
	ficha de colección: desde un dataset se llega a las colecciones que lo incluyen, y de ahí a otros
	datasets. `?d=<dataset>` elige cuál; sin él, el informe de gestión de la FCyT, que está en dos colecciones
	curadas por organizaciones distintas y se publicó una sola vez.

	Copia el contenedor, el hero y el estilo de tarjetas de la ficha real; sólo el encabezado y esta sección.

	Factibilidad en CKAN (S6): las colecciones de un dataset son sus `groups` (nativo, viene en
	`package_show`). La visibilidad «Interna» de una colección no es nativa (ver la ficha de colección).
-->
<script lang="ts">
import { Building2, Database, Globe, Library, Lock, User } from "@lucide/svelte";
import { page } from "$app/stores";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import {
	collectionHref,
	collectionsOf,
	curatorLabel,
	DATASETS,
	datasetBySlug,
	ORGS,
} from "../collections/data";

const slug = $derived($page.url.searchParams.get("d"));
const dataset = $derived(
	DATASETS.some((d) => d.slug === slug) ? datasetBySlug(slug as string) : DATASETS[0],
);
const org = $derived(ORGS[dataset.org]);
const collections = $derived(collectionsOf(dataset.slug));
</script>

<svelte:head>
	<title>{dataset.title} — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="border-b border-border bg-card">
		<div class="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
			<Breadcrumb
				items={[
					{ label: "Catálogo", href: "/search", role: "Catálogo" },
					{ label: org.title, href: "/organizations", role: "Organización" },
					{ label: dataset.title, role: "Dataset" },
				]}
				icon={Database}
			/>
		</div>
	</div>

	<section class="border-b border-border bg-card">
		<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<h1 class="font-heading text-3xl leading-tight font-bold text-foreground sm:text-4xl">
				{dataset.title}
			</h1>
			<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
				<span>Actualizado {dataset.updated}</span>
			</div>
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground"
				>
					<Building2 class="size-3.5 text-primary" aria-hidden="true" />
					{org.title}
				</span>
				{#each dataset.formats as format (format)}
					<span
						class="rounded-full border border-border bg-muted/50 px-3 py-1 font-mono text-xs text-muted-foreground"
						>{format}</span
					>
				{/each}
			</div>
		</div>
	</section>

	<section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
			<div class="min-w-0 space-y-6">
				<Card class="p-6 sm:p-8" data-testid="dataset-collections">
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">Colecciones</p>
					<h2 class="mt-1 font-heading text-xl font-bold text-primary">
						Aparece en las colecciones
						<span class="font-normal text-muted-foreground">({collections.length})</span>
					</h2>
					<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
						Este dataset se publica una sola vez, en {org.title}. Las colecciones lo referencian sin
						copiarlo: siempre muestran esta misma versión.
					</p>

					{#if collections.length === 0}
						<p class="mt-4 text-sm text-muted-foreground">Este dataset todavía no está en ninguna colección.</p>
					{:else}
						<ul class="mt-4 space-y-2">
							{#each collections as collection (collection.slug)}
								<li>
									<a
										href={collectionHref(collection.slug)}
										class="group flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors duration-200 hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										data-testid="dataset-collection"
									>
										<Library class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
										<span class="min-w-0 flex-1">
											<span class="block font-medium text-primary group-hover:underline">
												{collection.name}
											</span>
											<span
												class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
											>
												<span class="inline-flex items-center gap-1.5">
													{#if collection.curator.kind === "org"}
														<Building2 class="size-3.5" aria-hidden="true" />
													{:else}
														<User class="size-3.5" aria-hidden="true" />
													{/if}
													Curada por
													<span class="text-foreground" data-testid="collection-curator"
														>{curatorLabel(collection.curator)}</span
													>
												</span>
												<span>{collection.datasets.length} datasets</span>
											</span>
										</span>
										{#if collection.visibility === "Pública"}
											<span
												class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
											>
												<Globe class="size-3" aria-hidden="true" />
												Pública
											</span>
										{:else}
											<span
												class="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
											>
												<Lock class="size-3" aria-hidden="true" />
												Interna
											</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</Card>
			</div>
		</div>
	</section>
</div>
