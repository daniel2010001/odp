<!--
	Maqueta — Colecciones de un dataset: extracto de la ficha del dataset (`src/routes/dataset/[id]`) con la
	sección «Aparece en las colecciones». PRD RF-22; S4 y L3 de `odd/tasks/prototype-presentation.md`.

	Pantalla sin funcionamiento, con datos de ejemplo (`../collections/data.ts`). Es el sentido inverso de la
	ficha de colección: desde un dataset se llega a las colecciones que lo incluyen, y de ahí a otros
	datasets. `?d=<dataset>` elige cuál; sin él, el informe de gestión de la FCyT, que está en dos colecciones
	curadas por organizaciones distintas y se publicó una sola vez.

	Copia el contenedor, el hero y el estilo de tarjetas de la ficha real; sólo el encabezado y esta sección.

	`?como=visitante` (por defecto) o `?como=rectorado` eligen quién mira, con la franja de revisión de arriba
	(fuera del área de producto): la sección sólo lista las colecciones que esa persona puede ver (Q10). Un
	visitante sin sesión ve las públicas; un miembro del Rectorado, además, las internas y las privadas del
	Rectorado.

	Factibilidad en CKAN (S6): las colecciones de un dataset son sus `groups` (nativo, viene en
	`package_show`). Las visibilidades «Interna» y «Privada» de una colección no son nativas (ver la ficha
	de colección).
-->
<script lang="ts">
import { Building2, Database } from "@lucide/svelte";
import { page } from "$app/stores";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import DatasetCollections from "../collections/DatasetCollections.svelte";
import {
	canSee,
	collectionsOf,
	DATASETS,
	datasetBySlug,
	ORGS,
	type Viewer,
} from "../collections/data";

type ViewerKey = "visitante" | "rectorado";

const VIEWERS: { value: ViewerKey; label: string; viewer: Viewer; note: string }[] = [
	{
		value: "visitante",
		label: "Visitante sin sesión",
		viewer: { kind: "visitor" },
		note: "Lo que ve un visitante sin sesión: sólo las colecciones públicas.",
	},
	{
		value: "rectorado",
		label: "Miembro del Rectorado",
		viewer: { kind: "member", org: "rectorado" },
		note: "Lo que ve un miembro del Rectorado: además, las internas y las privadas del Rectorado.",
	},
];

const slug = $derived($page.url.searchParams.get("d"));
const dataset = $derived(
	DATASETS.some((d) => d.slug === slug) ? datasetBySlug(slug as string) : DATASETS[0],
);
const org = $derived(ORGS[dataset.org]);
const current = $derived(
	VIEWERS.find((v) => v.value === $page.url.searchParams.get("como")) ?? VIEWERS[0],
);
const collections = $derived(collectionsOf(dataset.slug).filter((c) => canSee(c, current.viewer)));

const viewerHref = (next: ViewerKey) =>
	`/dev/prototype/dataset-collections?d=${dataset.slug}&como=${next}`;
</script>

<svelte:head>
	<title>{dataset.title} — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<!-- ─── Franja de revisión (DEV, fuera del producto) ──────────────── -->
	<div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
		<section
			data-testid="review-strip"
			aria-label="Revisión de la maqueta"
			class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed border-border bg-muted/50 px-4 py-3"
		>
			<nav class="flex flex-wrap items-center gap-2" aria-label="Quién mira">
				<span class="text-xs font-medium text-muted-foreground">Quién mira</span>
				{#each VIEWERS as option (option.value)}
					<a
						href={viewerHref(option.value)}
						aria-current={current.value === option.value ? "page" : undefined}
						data-testid="viewer-{option.value}"
						class="cursor-pointer rounded-lg border border-input px-3 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {current.value ===
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
				<DatasetCollections {collections} orgTitle={org.title} />
			</div>
		</div>
	</section>
</div>
