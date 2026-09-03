<script lang="ts">
import { Building2, Database, FileText, Layers } from "lucide-svelte";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createOrganizationApi } from "$lib/api/organizations";
import OrganizationCard from "$lib/components/organizations/OrganizationCard.svelte";
import SearchBar from "$lib/components/search/SearchBar.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { getMockSearchResult, MOCK_DATASETS, MOCK_ORGS } from "$lib/mock/data";
import type { CkanOrganization } from "$lib/types/ckan";

let stats = $state({
	datasets: 0,
	organizations: 0,
	resources: 0,
	formats: 0,
	loading: true,
	error: null as string | null,
});

let orgs = $state<CkanOrganization[]>([]);

onMount(async () => {
	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const datasetApi = createDatasetApi(client);
		const searchResult = await datasetApi.search({ limit: 0 });
		stats.datasets = searchResult.count;

		try {
			const organizationApi = createOrganizationApi(client);
			const orgList = await organizationApi.list();
			orgs = orgList.filter((o) => o.state === "active").slice(0, 6);
		} catch {
			// Fallback: organizaciones mock si CKAN no responde
			orgs = MOCK_ORGS;
		}
	} catch {
		// Fallback: mock si CKAN no responde
		const mock = getMockSearchResult();
		stats.datasets = mock.count;
		orgs = MOCK_ORGS;
	}
	stats.organizations = orgs.length;
	// Recursos y formatos: derivados del catálogo de referencia (mock)
	stats.resources = MOCK_DATASETS.reduce((acc, ds) => acc + ds.resources.length, 0);
	stats.formats = new Set(MOCK_DATASETS.flatMap((ds) => ds.resources.map((r) => r.format))).size;
	stats.loading = false;
});

const platformStats = $derived([
	{
		value: stats.loading ? "…" : stats.datasets,
		label: "Datasets",
		icon: Database,
		description:
			"Conjuntos de datos académicos y administrativos publicados por la comunidad universitaria, listos para explorar, analizar y descargar.",
	},
	{
		value: stats.loading ? "…" : stats.organizations,
		label: "Organizaciones",
		icon: Building2,
		description:
			"Facultades, direcciones e institutos de la UMSS que publican y gestionan sus propios datos abiertos bajo principios FAIR.",
	},
	{
		value: stats.loading ? "…" : stats.resources,
		label: "Recursos",
		icon: FileText,
		description:
			"Archivos y enlaces individuales dentro de cada dataset: tablas, documentos, imágenes y más, listos para su reutilización.",
	},
	{
		value: stats.loading ? "…" : stats.formats,
		label: "Formatos",
		icon: Layers,
		description:
			"Los tipos de archivo disponibles en el catálogo — CSV, PDF, JSON e imágenes — para que reutilices los datos como necesites.",
	},
]);

function handleHeroSearch(query: string) {
	if (query.trim()) {
		goto(`/search?q=${encodeURIComponent(query)}`);
	}
}
</script>

<!-- Hero B (variante) -->
<section class="border-b border-border bg-gradient-to-b from-primary/25 via-primary/10 to-background">
	<div class="mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 lg:pb-24 lg:pt-24">
		<p class="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">
			Plataforma de Datos Abiertos · UMSS
		</p>
		<h1
			class="mt-4 font-heading text-4xl font-bold leading-[1.1] text-foreground sm:text-5xl lg:text-[52px]"
		>
			Datos abiertos para la comunidad universitaria
		</h1>
		<p class="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
			Explorá, analizá y reutilizá los conjuntos de datos académicos y administrativos de la
			Universidad Mayor de San Simón, publicados bajo principios FAIR.
		</p>

		<div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
			<a href="/search">
				<Button size="lg" class="h-[52px] px-8 text-base">Explorar Catálogo</Button>
			</a>
			<a href="/about">
				<Button variant="outline" size="lg" class="h-[52px] px-8 text-base">
					Más Información
				</Button>
			</a>
		</div>
	</div>
</section>

<!-- Sobre la plataforma — comparación de layouts -->
<section class="bg-background">
	<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-20 lg:py-20">
		<div class="mx-auto max-w-3xl text-center">
			<p class="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">Plataforma</p>
			<h2 class="mt-3 font-heading text-3xl font-bold leading-[1.2] text-primary lg:text-4xl">
				Sobre la plataforma
			</h2>
			<p class="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
				Datos académicos y administrativos publicados bajo principios FAIR (localizables,
				accesibles, interoperables y reutilizables), con búsqueda facetada, previsualización y
				descarga en múltiples formatos.
			</p>
		</div>

		<!-- Opción A: 4 columnas (4x1) -->
		<p class="mt-14 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
			Opción A — 4 columnas
		</p>
		<div class="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
			{#each platformStats as stat (stat.label)}
				<Card class="flex flex-col items-center bg-muted/50 p-8 text-center">
					<div class="mb-5 inline-flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<stat.icon class="size-7" aria-hidden="true" />
					</div>
					<p class="font-heading text-5xl font-bold text-primary">{stat.value}</p>
					<p class="mt-3 text-base font-semibold text-foreground">{stat.label}</p>
					<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{stat.description}</p>
				</Card>
			{/each}
		</div>

		<!-- Opción B: 2x2 -->
		<p class="mt-16 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
			Opción B — 2 × 2
		</p>
		<div class="mt-6 grid gap-6 sm:grid-cols-2">
			{#each platformStats as stat (stat.label)}
				<Card class="flex flex-col items-center bg-muted/50 p-8 text-center">
					<div class="mb-5 inline-flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<stat.icon class="size-7" aria-hidden="true" />
					</div>
					<p class="font-heading text-5xl font-bold text-primary">{stat.value}</p>
					<p class="mt-3 text-base font-semibold text-foreground">{stat.label}</p>
					<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{stat.description}</p>
				</Card>
			{/each}
		</div>

		<!-- Opción C: 1x4 (apilada horizontal) -->
		<p class="mt-16 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
			Opción C — 1 × 4 (apilada)
		</p>
		<div class="mt-6 grid gap-4">
			{#each platformStats as stat (stat.label)}
				<Card class="flex items-center gap-6 bg-muted/50 p-6">
					<div class="inline-flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<stat.icon class="size-7" aria-hidden="true" />
					</div>
					<div class="flex-1">
						<div class="flex flex-wrap items-baseline gap-x-3">
							<p class="font-heading text-4xl font-bold text-primary">{stat.value}</p>
							<p class="text-base font-semibold text-foreground">{stat.label}</p>
						</div>
						<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{stat.description}</p>
					</div>
				</Card>
			{/each}
		</div>
	</div>
</section>

<!-- Buscar -->
<section class="bg-background">
	<div class="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-20">
		<div class="mx-auto max-w-3xl text-center">
			<p class="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">
				Empezá a explorar
			</p>
			<h2 class="mt-3 font-heading text-3xl font-bold leading-[1.2] text-primary lg:text-4xl">
				Los datos de la UMSS están a un clic
			</h2>
			<p class="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
				Accedé al catálogo público, conocé las organizaciones y descargá los conjuntos de datos en
				múltiples formatos para tus investigaciones y proyectos.
			</p>

			<div class="mx-auto mt-8 max-w-2xl">
				<SearchBar
					value=""
					placeholder="Buscar datasets, organizaciones, temas..."
					class="[&_input]:h-14 [&_input]:rounded-xl [&_input]:bg-card [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_input]:shadow-lg [&_input]:focus-visible:ring-primary [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-offset-2 [&_input]:focus-visible:ring-offset-background"
					onsubmit={handleHeroSearch}
				/>
			</div>
		</div>
	</div>
</section>

<!-- Por organización -->
<section id="organizaciones" class="bg-background">
	<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-20 lg:py-20">
		<div class="text-center">
			<p class="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">
				Organizaciones
			</p>
			<h2 class="mt-3 font-heading text-3xl font-bold leading-[1.2] text-primary lg:text-4xl">
				Datos por organización
			</h2>
			<p class="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
				Explorá los conjuntos de datos publicados por las facultades, direcciones e institutos de
				la Universidad Mayor de San Simón.
			</p>
		</div>

		<div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#if orgs.length}
				{#each orgs as org (org.id)}
					<OrganizationCard
						org={org}
						count={org.package_count ?? 0}
						href={`/search?org=${encodeURIComponent(org.name)}`}
					/>
				{/each}
			{:else}
				<p class="col-span-full text-center text-sm text-muted-foreground">
					Cargando organizaciones...
				</p>
			{/if}
		</div>
	</div>
</section>
