<script lang="ts">
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import FacetFilter from "$lib/components/search/FacetFilter.svelte";
import Pagination from "$lib/components/search/Pagination.svelte";
import SearchBar from "$lib/components/search/SearchBar.svelte";
import { env } from "$lib/env";
import { getMockSearchResult } from "$lib/mock/data";
import type { SearchResponse } from "$lib/types/api";
import type { CkanFacet, CkanPackage } from "$lib/types/ckan";
import { parseExtras } from "$lib/types/dataset";
import { buildFilterQuery } from "$lib/utils/ckan";
import { onMount } from "svelte";

// ─── State desde URL ──────────────────────────────────────────────
let query = $state($page.url.searchParams.get("q") ?? "");
let selectedOrgs = $state<string[]>($page.url.searchParams.get("org")?.split(",") ?? []);
let selectedFormats = $state<string[]>($page.url.searchParams.get("format")?.split(",") ?? []);
let selectedTags = $state<string[]>($page.url.searchParams.get("tags")?.split(",") ?? []);
let currentPage = $state(Number($page.url.searchParams.get("page")) || 1);
let sortBy = $state($page.url.searchParams.get("sort") ?? "metadata_modified desc");

// ─── Result state ─────────────────────────────────────────────────
let results = $state<CkanPackage[]>([]);
let total = $state(0);
let loading = $state(true);
let error = $state<string | null>(null);
let facets = $state<Record<string, CkanFacet>>({});

// ─── Router ready guard ────────────────────────────────────────────
let mounted = $state(false);

onMount(() => {
	mounted = true;
});

const pageSize = 20;
const totalPages = $derived(Math.ceil(total / pageSize));

// ─── Sincronizar URL ──────────────────────────────────────────────
function syncUrl() {
	const params = new URLSearchParams();
	if (query) params.set("q", query);
	if (selectedOrgs.length) params.set("org", selectedOrgs.join(","));
	if (selectedFormats.length) params.set("format", selectedFormats.join(","));
	if (selectedTags.length) params.set("tags", selectedTags.join(","));
	if (currentPage > 1) params.set("page", String(currentPage));
	if (sortBy !== "metadata_modified desc") params.set("sort", sortBy);

	const newUrl = `/search${params.toString() ? "?" + params.toString() : ""}`;
	replaceState(newUrl, $page.url);
}

// ─── Búsqueda en CKAN ─────────────────────────────────────────────
let abortController = $state<AbortController | null>(null);

async function doSearch() {
	loading = true;
	error = null;

	// Construir filter query
	const filterMap: Record<string, string[]> = {};
	if (selectedOrgs.length) filterMap["organization"] = selectedOrgs;
	if (selectedFormats.length) filterMap["res_format"] = selectedFormats;
	if (selectedTags.length) filterMap["tags"] = selectedTags;
	const fq = buildFilterQuery(filterMap);

	try {
		// CKAN_URL vacío = ruta relativa (proxy de Vite en dev)
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const datasetApi = createDatasetApi(client);

		const searchResult = await datasetApi.search({
			q: query || "*:*",
			fq,
			limit: pageSize,
			offset: (currentPage - 1) * pageSize,
			sort: sortBy,
			facet_field: ["organization", "tags", "res_format", "license_id"],
			facet_limit: 50,
		});

		results = searchResult.results;
		total = searchResult.count;
		facets = searchResult.search_facets;
	} catch (err) {
		// Si falló CKAN, intentar con datos mock como respaldo
		try {
			const mock = getMockSearchResult();
			results = mock.results;
			total = mock.count;
			facets = mock.search_facets;
		} catch {
			error = err instanceof Error ? err.message : "Error de búsqueda";
			results = [];
			total = 0;
			facets = {};
		}
	} finally {
		loading = false;
	}
}

// ─── Efecto: sincronizar + buscar ────────────────────────────────
$effect(() => {
	// Leer todos los reactivos para que el effect dependa de ellos
	void query;
	void selectedOrgs;
	void selectedFormats;
	void selectedTags;
	void currentPage;
	void sortBy;
	void mounted;

	// Recién después de onMount el router está listo para replaceState
	if (mounted) doSearch();
	if (mounted) syncUrl();
});

// ─── Handlers ─────────────────────────────────────────────────────
function onSearchChange(value: string) {
	query = value;
	currentPage = 1;
}

function toggleFilter(field: "org" | "format" | "tags", value: string) {
	currentPage = 1;
	if (field === "org") {
		selectedOrgs = selectedOrgs.includes(value)
			? selectedOrgs.filter((v) => v !== value)
			: [...selectedOrgs, value];
	} else if (field === "format") {
		selectedFormats = selectedFormats.includes(value)
			? selectedFormats.filter((v) => v !== value)
			: [...selectedFormats, value];
	} else {
		selectedTags = selectedTags.includes(value)
			? selectedTags.filter((v) => v !== value)
			: [...selectedTags, value];
	}
}

function clearAllFilters() {
	selectedOrgs = [];
	selectedFormats = [];
	selectedTags = [];
	currentPage = 1;
}

function goToPage(p: number) {
	currentPage = p;
	window.scrollTo({ top: 0, behavior: "smooth" });
}

const hasActiveFilters = $derived(
	selectedOrgs.length > 0 || selectedFormats.length > 0 || selectedTags.length > 0,
);
const activeFilterCount = $derived(
	selectedOrgs.length + selectedFormats.length + selectedTags.length,
);
</script>

<svelte:head>
	<title>
		{query ? `${query} — ` : ''}Catálogo de Datos — UMSS
	</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-semibold text-primary sm:text-3xl">
			Catálogo de Datos
		</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Explorá los datasets disponibles en la plataforma
		</p>
	</div>

	<!-- Search bar -->
	<SearchBar
		value={query}
		onchange={onSearchChange}
		class="mb-6"
	/>

	<!-- Active filters -->
	{#if hasActiveFilters}
		<div class="mb-4 flex flex-wrap items-center gap-2">
			<span class="text-sm font-medium text-muted-foreground">Filtros activos:</span>

			{#each selectedOrgs as org}
				<button
					onclick={() => toggleFilter('org', org)}
					class="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20 transition-all duration-200 hover:bg-accent/80"
				>
					{org}
					<span class="ml-1">&times;</span>
				</button>
			{/each}
			{#each selectedFormats as format}
				<button
					onclick={() => toggleFilter('format', format)}
					class="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20 transition-all duration-200 hover:bg-accent/80"
				>
					{format}
					<span class="ml-1">&times;</span>
				</button>
			{/each}
			{#each selectedTags as tag}
				<button
					onclick={() => toggleFilter('tags', tag)}
					class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border transition-all duration-200 hover:bg-border"
				>
					{tag}
					<span class="ml-1">&times;</span>
				</button>
			{/each}

			<button
				onclick={clearAllFilters}
				class="text-xs font-medium text-muted-foreground underline underline-offset-2 transition-colors duration-200 hover:text-primary"
			>
				Limpiar todos
			</button>
		</div>
	{/if}

	<div class="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
		<!-- Sidebar: Facets -->
		<aside class="mb-6 lg:mb-0">
			<div class="space-y-6 rounded-xl border border-border bg-card p-4 shadow-sm">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-primary">Filtros</h2>
					{#if hasActiveFilters}
						<button
							onclick={clearAllFilters}
							class="text-xs font-medium text-muted-foreground underline underline-offset-2 transition-colors duration-200 hover:text-primary"
						>
							({activeFilterCount})
						</button>
					{/if}
				</div>

				{#if facets.organization}
					<FacetFilter
						title="Organización"
						items={facets.organization.items}
						selected={selectedOrgs}
						onselect={(v) => toggleFilter('org', v)}
					/>
				{/if}

				{#if facets.res_format}
					<FacetFilter
						title="Formato"
						items={facets.res_format.items}
						selected={selectedFormats}
						onselect={(v) => toggleFilter('format', v)}
					/>
				{/if}

				{#if facets.tags}
					<FacetFilter
						title="Etiquetas"
						items={facets.tags.items}
						selected={selectedTags}
						onselect={(v) => toggleFilter('tags', v)}
					/>
				{/if}

				{#if facets.license_id}
					<FacetFilter
						title="Licencia"
						items={facets.license_id.items}
						selected={[]}
						onselect={() => {}}
					/>
				{/if}
			</div>
		</aside>

		<!-- Results -->
		<div class="min-w-0">
			<!-- Results header -->
			<div class="mb-4 flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					{#if loading}
						Buscando...
					{:else}
						{total} resultado{total !== 1 ? 's' : ''}
						{#if query}
							para <span class="font-medium text-primary">"{query}"</span>
						{/if}
					{/if}
				</p>

				<select
					value={sortBy}
					onchange={(e) => {
						sortBy = (e.target as HTMLSelectElement).value;
						currentPage = 1;
					}}
					class="h-9 rounded-lg border border-border bg-background px-3 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<option value="metadata_modified desc">Más recientes</option>
					<option value="metadata_modified asc">Más antiguos</option>
					<option value="title_string asc">A-Z</option>
					<option value="title_string desc">Z-A</option>
					<option value="score desc">Relevancia</option>
				</select>
			</div>

			<!-- Error -->
			{#if error}
				<div class="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
					<p class="font-medium text-destructive">Error al buscar</p>
					<p class="mt-1 text-sm text-muted-foreground">{error}</p>
				</div>
			{/if}

			<!-- Loading skeleton -->
			{#if loading}
				<div class="space-y-4">
					{#each Array(3) as _}
						<div class="animate-pulse rounded-xl border border-border bg-card p-5">
							<div class="mb-3 h-5 w-3/4 rounded bg-muted"></div>
							<div class="mb-2 h-4 w-full rounded bg-muted"></div>
							<div class="mb-4 h-4 w-1/2 rounded bg-muted"></div>
							<div class="flex gap-2">
								<div class="h-5 w-14 rounded bg-muted"></div>
								<div class="h-5 w-14 rounded bg-muted"></div>
							</div>
						</div>
					{/each}
				</div>

			<!-- Empty state -->
			{:else if !loading && total === 0 && !error}
				<div class="rounded-xl border border-border bg-card p-12 text-center">
					<p class="text-lg font-medium text-primary">Sin resultados</p>
					<p class="mt-2 text-sm text-muted-foreground">
						{query
							? `No encontramos datasets para "${query}". Probá con otros términos o limpiá los filtros.`
							: 'No hay datasets disponibles en este momento.'}
					</p>
					{#if query || hasActiveFilters}
						<button
							onclick={() => {
								query = '';
								clearAllFilters();
							}}
							class="mt-4 text-sm font-medium text-primary hover:underline"
						>
							Limpiar búsqueda y filtros
						</button>
					{/if}
				</div>

			<!-- Results list -->
			{:else}
				<div class="space-y-4">
					{#each results as dataset (dataset.id)}
						<DatasetCard {dataset} />
					{/each}
				</div>

				<!-- Pagination -->
				<div class="mt-8">
					<Pagination
						current={currentPage}
						total={totalPages}
						onchange={goToPage}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>
