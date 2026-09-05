<script lang="ts">
import { ChevronDown, SlidersHorizontal, X } from "lucide-svelte";
import { untrack } from "svelte";
import { afterNavigate, replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import FacetFilter from "$lib/components/search/FacetFilter.svelte";
import Pagination from "$lib/components/search/Pagination.svelte";
import SearchBar from "$lib/components/search/SearchBar.svelte";
import { env } from "$lib/env";
import { getMockSearchResult } from "$lib/mock/data";
import type { CkanFacet, CkanPackage } from "$lib/types/ckan";
import { buildFilterQuery } from "$lib/utils/ckan";
import { mapLicenseItems } from "$lib/utils/licenses";

// ─── State desde URL ──────────────────────────────────────────────
let query = $state($page.url.searchParams.get("q") ?? "");
let selectedOrgs = $state<string[]>($page.url.searchParams.get("org")?.split(",") ?? []);
let selectedFormats = $state<string[]>($page.url.searchParams.get("format")?.split(",") ?? []);
let selectedTags = $state<string[]>($page.url.searchParams.get("tags")?.split(",") ?? []);
let selectedLicenses = $state<string[]>($page.url.searchParams.get("license")?.split(",") ?? []);
let currentPage = $state(Number($page.url.searchParams.get("page")) || 1);
let sortBy = $state($page.url.searchParams.get("sort") ?? "metadata_modified desc");

// ─── Result state ─────────────────────────────────────────────────
let results = $state<CkanPackage[]>([]);
let total = $state(0);
let loading = $state(true);
let error = $state<string | null>(null);
let facets = $state<Record<string, CkanFacet>>({});

// Total del catálogo completo (sin filtros). Se carga una vez y queda fijo:
// la descripción del hero NO debe cambiar cuando el usuario filtra/busca.
let catalogTotal = $state(0);
let catalogTotalLoading = $state(true);

// ─── UI: colapso de filtros en móvil ──────────────────────────────
let mobileFiltersOpen = $state(false);

// ─── Router ready guard ────────────────────────────────────────────
// `replaceState` de $app/navigation solo puede llamarse después de que el
// router de SvelteKit esté inicializado. onMount NO garantiza eso (corre
// antes) y llamar replaceState temprano lanza "before router is initialized"
// y rompe el $effect. `afterNavigate` corre recién cuando el router navegó.
let routerReady = $state(false);

afterNavigate(() => {
	routerReady = true;
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
	if (selectedLicenses.length) params.set("license", selectedLicenses.join(","));
	if (currentPage > 1) params.set("page", String(currentPage));
	if (sortBy !== "metadata_modified desc") params.set("sort", sortBy);

	const newUrl = `/search${params.toString() ? "?" + params.toString() : ""}`;
	// Segundo argumento = page.state (shallow routing), NO la URL: un objeto
	// URL no es serializable y replaceState lanza "could not be cloned".
	// Se lee con `untrack` para que $page.state no sea dependencia reactiva
	// de los $effect que llaman syncUrl (si no, replaceState → cambia $page →
	// re-dispara el effect → loop infinito).
	replaceState(
		newUrl,
		untrack(() => $page.state),
	);
}

// ─── Búsqueda en CKAN ─────────────────────────────────────────────
async function doSearch() {
	loading = true;
	error = null;

	// Construir filter query
	const filterMap: Record<string, string[]> = {};
	if (selectedOrgs.length) filterMap["organization"] = selectedOrgs;
	if (selectedFormats.length) filterMap["res_format"] = selectedFormats;
	if (selectedTags.length) filterMap["tags"] = selectedTags;
	if (selectedLicenses.length) filterMap["license_id"] = selectedLicenses;
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

// ─── Cargar total del catálogo (fijo, sin filtros) ───────────────
// Usa limit: 0 para traer solo el conteo real del catálogo completo,
// independiente de la búsqueda/filtros activos. Almacenado en
// `catalogTotal` para que la descripción del hero sea estable.
async function loadCatalogTotal() {
	catalogTotalLoading = true;
	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const datasetApi = createDatasetApi(client);
		const result = await datasetApi.search({ q: "*:*", limit: 0 });
		catalogTotal = result.count;
	} catch {
		// Fallback: conteo mock si CKAN no responde
		catalogTotal = getMockSearchResult().count;
	} finally {
		catalogTotalLoading = false;
	}
}

// ─── Efecto: buscar cuando cambia el estado ───────────────────────
$effect(() => {
	// Leer todos los reactivos para que el effect dependa de ellos
	void query;
	void selectedOrgs;
	void selectedFormats;
	void selectedTags;
	void selectedLicenses;
	void currentPage;
	void sortBy;
	void routerReady;

	// Recién con el router listo (afterNavigate) ejecutamos la búsqueda.
	if (routerReady) doSearch();
});

// ─── Efecto: cargar el total del catálogo una sola vez ───────────
// No depende de query/filtros: corre cuando el router está listo y nunca
// se re-dispara al filtrar (a diferencia del effect de búsqueda).
$effect(() => {
	void routerReady;

	if (routerReady) loadCatalogTotal();
});

// ─── Efecto: sincronizar URL ──────────────────────────────────────
// Separado del effect de búsqueda a propósito: replaceState necesita el
// router inicializado; si por cualquier motivo este effect fallara, nunca
// debe tumbar la búsqueda ni viceversa.
$effect(() => {
	void query;
	void selectedOrgs;
	void selectedFormats;
	void selectedTags;
	void selectedLicenses;
	void currentPage;
	void sortBy;
	void routerReady;

	if (routerReady) syncUrl();
});

// ─── Handlers ─────────────────────────────────────────────────────
function onSearchSubmit(value: string) {
	query = value;
	currentPage = 1;
}

function onSearchClear() {
	query = "";
	currentPage = 1;
}

function toggleFilter(field: "org" | "format" | "tags" | "license", value: string) {
	currentPage = 1;
	if (field === "org") {
		selectedOrgs = selectedOrgs.includes(value)
			? selectedOrgs.filter((v) => v !== value)
			: [...selectedOrgs, value];
	} else if (field === "format") {
		selectedFormats = selectedFormats.includes(value)
			? selectedFormats.filter((v) => v !== value)
			: [...selectedFormats, value];
	} else if (field === "license") {
		selectedLicenses = selectedLicenses.includes(value)
			? selectedLicenses.filter((v) => v !== value)
			: [...selectedLicenses, value];
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
	selectedLicenses = [];
	currentPage = 1;
}

function goToPage(p: number) {
	currentPage = p;
	window.scrollTo({ top: 0, behavior: "smooth" });
}

const hasActiveFilters = $derived(
	selectedOrgs.length > 0 ||
		selectedFormats.length > 0 ||
		selectedTags.length > 0 ||
		selectedLicenses.length > 0,
);
const activeFilterCount = $derived(
	selectedOrgs.length + selectedFormats.length + selectedTags.length + selectedLicenses.length,
);
</script>

<svelte:head>
	<title>
		{query ? `${query} — ` : ''}Catálogo de Datos — UMSS
	</title>
</svelte:head>

<!-- Hero -->
<section class="border-b border-border bg-gradient-to-b from-primary/25 via-primary/10 to-background">
	<div class="mx-auto max-w-7xl px-4 pb-16 pt-16 text-center sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
		<p class="text-[13px] font-bold uppercase tracking-[0.2em] text-destructive">
			Catálogo de Datos
		</p>
		<h1
			class="mx-auto mt-4 max-w-3xl font-heading text-4xl font-bold leading-[1.1] text-foreground sm:text-5xl lg:text-[52px]"
		>
			Explorá los datasets abiertos de la UMSS
		</h1>
		<p class="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
			La Universidad Mayor de San Simón publica
			<span class="font-semibold text-foreground">
				{catalogTotalLoading ? '…' : catalogTotal.toLocaleString('es-BO')}
			</span>
			datasets académicos y administrativos desde sus facultades, departamentos e institutos,
			bajo principios FAIR.
		</p>

		<div class="mx-auto mt-8 w-full max-w-[720px]">
			<SearchBar
				value={query}
				placeholder="Buscá por organización, etiquetas, formato..."
				submitLabel="Buscar"
				class="[&_input]:h-14 [&_input]:rounded-xl [&_input]:border-0 [&_input]:bg-card [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_input]:shadow-lg [&_input]:focus-visible:ring-primary [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-offset-2 [&_input]:focus-visible:ring-offset-background"
				onsubmit={onSearchSubmit}
				onclear={onSearchClear}
			/>
		</div>
	</div>
</section>

<!-- ResultsBar: sticky debajo del header global (80px nav + 1px borde) -->
<section class="sticky top-[81px] z-20 border-b border-border bg-background/95 backdrop-blur">
	<div
		class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6 lg:px-8"
	>
		<p class="flex items-baseline gap-2">
			{#if loading}
				<span class="text-sm text-muted-foreground">Buscando...</span>
			{:else}
				<span class="font-heading text-2xl font-bold text-foreground">{total.toLocaleString('es-BO')}</span>
				<span class="text-sm text-muted-foreground">
					{#if query}
						resultado{total !== 1 ? 's' : ''} para <span class="font-medium text-foreground">"{query}"</span>
					{:else}
						datasets encontrados
					{/if}
				</span>
			{/if}
		</p>

		<label class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
			<span class="hidden sm:inline">Ordenar:</span>
			<select
				value={sortBy}
				onchange={(e) => {
					sortBy = (e.target as HTMLSelectElement).value;
					currentPage = 1;
				}}
				class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
			>
				<option value="metadata_modified desc">Más recientes</option>
				<option value="metadata_modified asc">Más antiguos</option>
				<option value="title_string asc">A-Z</option>
				<option value="title_string desc">Z-A</option>
				<option value="score desc">Relevancia</option>
			</select>
		</label>
	</div>
</section>

<!-- Active filters -->
{#if hasActiveFilters}
	<div class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-medium text-muted-foreground">Filtros activos:</span>

			{#each selectedOrgs as org}
				<button
					onclick={() => toggleFilter('org', org)}
					class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/30 transition-all duration-200 hover:bg-primary/20"
				>
					{org}
					<X class="size-3" aria-hidden="true" />
				</button>
			{/each}
			{#each selectedFormats as format}
				<button
					onclick={() => toggleFilter('format', format)}
					class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/30 transition-all duration-200 hover:bg-primary/20"
				>
					{format}
					<X class="size-3" aria-hidden="true" />
				</button>
			{/each}
			{#each selectedTags as tag}
				<button
					onclick={() => toggleFilter('tags', tag)}
					class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/30 transition-all duration-200 hover:bg-primary/20"
				>
					{tag}
					<X class="size-3" aria-hidden="true" />
				</button>
			{/each}
			{#each selectedLicenses as license}
				<button
					onclick={() => toggleFilter('license', license)}
					class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/30 transition-all duration-200 hover:bg-primary/20"
				>
					{license}
					<X class="size-3" aria-hidden="true" />
				</button>
			{/each}

			<button
				onclick={clearAllFilters}
				class="text-xs font-medium text-muted-foreground underline underline-offset-2 transition-colors duration-200 hover:text-primary"
			>
				Limpiar todos
			</button>
		</div>
	</div>
{/if}

<!-- Body -->
<div class="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
	<div class="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
		<!-- Sidebar: Facets -->
		<aside class="mb-6 lg:mb-0">
			<!-- Toggle móvil: solo visible debajo de md (768px). En tablet/desktop
			     (md+) el panel queda siempre desplegado. -->
			<button
				type="button"
				onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}
				aria-expanded={mobileFiltersOpen}
				class="mb-4 flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors duration-200 hover:bg-accent md:hidden"
			>
				<span class="flex items-center gap-2 text-sm font-semibold text-foreground">
					<SlidersHorizontal class="size-4 text-primary" aria-hidden="true" />
					Filtros
					{#if activeFilterCount > 0}
						<span
							class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
						>
							{activeFilterCount}
						</span>
					{/if}
				</span>
				<ChevronDown
					class="size-4 text-muted-foreground transition-transform duration-200 {mobileFiltersOpen
						? 'rotate-180'
						: ''}"
					aria-hidden="true"
				/>
			</button>

			<div
				class="rounded-xl border border-border bg-card p-6 shadow-sm transition-opacity duration-200 {mobileFiltersOpen
					? 'block'
					: 'hidden'} md:block {loading ? 'opacity-60' : ''}"
			>
				<div class="flex items-baseline justify-between gap-2 border-b border-border pb-3">
					<h2 class="text-sm font-bold uppercase tracking-[0.14em] text-destructive">
						Filtros
					</h2>
					<div class="flex items-center gap-3">
						{#if loading}
							<span
								class="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
							>
								<span
									class="size-2 animate-pulse rounded-full bg-primary"
									aria-hidden="true"
								></span>
								Actualizando…
							</span>
						{/if}
						{#if hasActiveFilters}
							<button
								onclick={clearAllFilters}
								class="text-xs font-semibold text-destructive underline underline-offset-2 transition-colors duration-200 hover:text-destructive/80"
							>
								Limpiar ({activeFilterCount})
							</button>
						{/if}
					</div>
				</div>

				<div class="space-y-5 pt-3">
					{#if facets.organization?.items?.length}
						<FacetFilter
							title="Organización"
							items={facets.organization.items}
							selected={selectedOrgs}
							onselect={(v) => toggleFilter('org', v)}
						/>
					{/if}

					{#if facets.res_format?.items?.length}
						<FacetFilter
							title="Formato"
							items={facets.res_format.items}
							selected={selectedFormats}
							onselect={(v) => toggleFilter('format', v)}
						/>
					{/if}

					{#if facets.tags?.items?.length}
						<FacetFilter
							title="Etiquetas"
							items={facets.tags.items}
							selected={selectedTags}
							onselect={(v) => toggleFilter('tags', v)}
						/>
					{/if}

					{#if facets.license_id?.items?.length}
						<FacetFilter
							title="Licencia"
							items={mapLicenseItems(facets.license_id.items)}
							selected={selectedLicenses}
							onselect={(v) => toggleFilter('license', v)}
						/>
					{/if}
				</div>
			</div>
		</aside>

		<!-- Results -->
		<div class="min-w-0">
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
						<div class="animate-pulse rounded-xl border border-border bg-card p-6">
							<div class="mb-2 h-4 w-24 rounded bg-muted"></div>
							<div class="mb-2 h-5 w-3/4 rounded bg-muted"></div>
							<div class="mb-2 h-4 w-full rounded bg-muted"></div>
							<div class="mb-3 h-4 w-1/2 rounded bg-muted"></div>
							<div class="flex gap-2">
								<div class="h-4 w-12 rounded bg-muted"></div>
								<div class="h-4 w-12 rounded bg-muted"></div>
							</div>
						</div>
					{/each}
				</div>

			<!-- Empty state -->
			{:else if total === 0 && !error}
				<div class="rounded-xl border border-border bg-card p-12 text-center">
					<p class="font-heading text-xl font-semibold text-primary">Sin resultados</p>
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
