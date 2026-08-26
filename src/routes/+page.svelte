<script lang="ts">
import { BarChart3, Eye, Search, Terminal, Upload, Users } from "lucide-svelte";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import SearchBar from "$lib/components/search/SearchBar.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { getMockSearchResult, MOCK_ORGS } from "$lib/mock/data";

let stats = $state({
	datasets: 0,
	organizations: 0,
	loading: true,
	error: null as string | null,
});

onMount(async () => {
	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const datasetApi = createDatasetApi(client);
		const searchResult = await datasetApi.search({ limit: 0 });
		stats.datasets = searchResult.count;
	} catch {
		// Fallback: mock si CKAN no responde
		const mock = getMockSearchResult();
		stats.datasets = mock.count;
	}
	stats.organizations = MOCK_ORGS.length;
	stats.loading = false;
});

function handleHeroSearch(query: string) {
	if (query.trim()) {
		goto(`/search?q=${encodeURIComponent(query)}`);
	}
}
</script>

<!-- Hero Section -->
<section class="bg-gradient-to-br from-primary to-primary/90">
	<div class="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
		<h1
			class="font-heading text-4xl font-semibold text-white sm:text-5xl lg:text-6xl"
		>
			Datos Abiertos UMSS
		</h1>
		<p class="mx-auto mt-4 max-w-2xl text-lg text-white/80">
			Plataforma de Datos Abiertos de la Universidad Mayor de San Simón
		</p>

		<!-- Search bar in hero -->
		<div class="mx-auto mt-8 max-w-2xl">
			<SearchBar
				value=""
				placeholder="Buscar datasets, organizaciones, temas..."
				class="[&_input]:h-14 [&_input]:rounded-xl [&_input]:border-0 [&_input]:bg-white [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_input]:shadow-lg [&_input]:focus-visible:ring-primary [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-offset-2 [&_input]:focus-visible:ring-offset-primary"
				onchange={handleHeroSearch}
				onsubmit={handleHeroSearch}
			/>
		</div>

		<div class="mt-8 flex justify-center gap-4">
			<a href="/search">
				<Button
					variant="default"
					size="lg"
					class="bg-secondary text-white hover:bg-secondary/90"
				>
					Explorar Catálogo
				</Button>
			</a>
			<a href="/about">
				<Button
					variant="outline"
					size="lg"
					class="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
				>
					Más Información
				</Button>
			</a>
		</div>
	</div>
</section>

<!-- Stats -->
<section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
	{#if stats.loading}
		<p class="text-center text-muted-foreground">Conectando con CKAN...</p>
	{:else if stats.error}
		<Card>
			<div class="p-6 text-center">
				<p class="font-semibold text-destructive">No se pudo conectar con CKAN.</p>
				<p class="mt-1 text-sm text-muted-foreground">{stats.error}</p>
				<p class="mt-2 text-sm text-muted-foreground">
					Configurá
					<code class="rounded bg-muted px-1">VITE_CKAN_URL</code>
					en tu archivo
					<code class="rounded bg-muted px-1">.env</code>.
				</p>
			</div>
		</Card>
	{:else}
		<div class="grid gap-6 sm:grid-cols-3">
			<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="p-6 text-center">
					<p class="text-3xl font-bold text-primary">{stats.datasets}</p>
					<p class="mt-1 text-sm text-muted-foreground">Datasets disponibles</p>
				</div>
			</Card>
			<a href="/organizations" class="block">
				<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
					<div class="p-6 text-center">
						<p class="text-3xl font-bold text-primary">{stats.organizations}</p>
						<p class="mt-1 text-sm text-muted-foreground">Organizaciones</p>
					</div>
				</Card>
			</a>
			<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="p-6 text-center">
					<p class="text-3xl font-bold text-primary">—</p>
					<p class="mt-1 text-sm text-muted-foreground">Recursos indexados</p>
				</div>
			</Card>
		</div>
	{/if}
</section>

<!-- Features -->
<section class="border-t bg-muted/50">
	<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
		<h2 class="text-center text-2xl font-semibold text-primary">
			¿Qué podés hacer?
		</h2>

		<div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="p-6">
					<div class="mb-3 inline-flex rounded-lg bg-accent p-2.5 text-accent-foreground">
						<Search class="size-5" />
					</div>
					<h3 class="font-semibold text-accent-foreground">Buscar y descubrir</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Navegá el catálogo con búsqueda facetada por organización, etiquetas, formato y más.
					</p>
				</div>
			</Card>
			<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="p-6">
					<div class="mb-3 inline-flex rounded-lg bg-accent p-2.5 text-accent-foreground">
						<Eye class="size-5" />
					</div>
					<h3 class="font-semibold text-accent-foreground">Visualizar datos</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Previsualizá CSV, PDF, imágenes y JSON directamente en el navegador.
					</p>
				</div>
			</Card>
			<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="p-6">
					<div class="mb-3 inline-flex rounded-lg bg-accent p-2.5 text-accent-foreground">
						<BarChart3 class="size-5" />
					</div>
					<h3 class="font-semibold text-accent-foreground">Analizar CSV</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Cargá archivos CSV y generá gráficos interactivos de barras, líneas y más.
					</p>
				</div>
			</Card>
			<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="p-6">
					<div class="mb-3 inline-flex rounded-lg bg-accent p-2.5 text-accent-foreground">
						<Users class="size-5" />
					</div>
					<h3 class="font-semibold text-accent-foreground">Colaborar</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Trabajá en equipos, creá colecciones transversales y gestioná permisos.
					</p>
				</div>
			</Card>
			<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="p-6">
					<div class="mb-3 inline-flex rounded-lg bg-accent p-2.5 text-accent-foreground">
						<Upload class="size-5" />
					</div>
					<h3 class="font-semibold text-accent-foreground">Publicar</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Flujo de aprobación de borrador a publicación con control de visibilidad.
					</p>
				</div>
			</Card>
			<Card class="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
				<div class="p-6">
					<div class="mb-3 inline-flex rounded-lg bg-accent p-2.5 text-accent-foreground">
						<Terminal class="size-5" />
					</div>
					<h3 class="font-semibold text-accent-foreground">API pública</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						Accedé a los datasets públicos mediante API REST con API Key.
					</p>
				</div>
			</Card>
		</div>
	</div>
</section>
