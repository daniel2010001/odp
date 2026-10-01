<script lang="ts">
import { ChevronDown, SlidersHorizontal, X } from "@lucide/svelte";
import { tick, untrack } from "svelte";
import { afterNavigate, replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createOrganizationApi } from "$lib/api/organizations";
import OrganizationCard from "$lib/components/organizations/OrganizationCard.svelte";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import FacetFilter from "$lib/components/search/FacetFilter.svelte";
import Pagination from "$lib/components/search/Pagination.svelte";
import SearchBar from "$lib/components/search/SearchBar.svelte";
import { env } from "$lib/env";
import { getMockSearchResult, MOCK_ORGS } from "$lib/mock/data";
import type { CkanFacet, CkanOrganization, CkanPackage } from "$lib/types/ckan";
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

// Referencia al panel de filtros. Sirve para devolver el foco a un chip restante
// cuando el chip que tenía el foco desaparece del DOM al quitar su filtro.
let panelEl = $state<HTMLElement>();

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
		// Solo en dev se respalda con datos mock; en prod se muestra un error
		// explícito y nunca se muestran datos falsos.
		if (import.meta.env.DEV) {
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
		} else {
			error = "No se pudo conectar con el catálogo de datos. Intente nuevamente más tarde.";
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
		// En dev se usa el conteo mock; en prod el total queda en 0 sin datos falsos.
		catalogTotal = import.meta.env.DEV ? getMockSearchResult().count : 0;
	} finally {
		catalogTotalLoading = false;
	}
}

// ─── Contenido del estado vacío (lazy) ───────────────────────────
// Cuando la búsqueda no devuelve nada, el aviso solo deja un hueco: debajo se ofrecen tres salidas
// para seguir navegando. Se cargan **sólo** si el vacío llegó a mostrarse: en el camino normal (con
// resultados) no se dispara ninguna llamada extra.
let recentDatasets = $state<CkanPackage[]>([]);
let topOrganizations = $state<CkanOrganization[]>([]);
// Facetas del **catálogo entero**, para los chips: la búsqueda no sirve como fuente porque con cero
// resultados vienen vacías.
let catalogFacets = $state<Record<string, CkanFacet>>({});
// Guarda de carga: no es `$state` a propósito (no se pinta). Hacerla reactiva re-dispararía el
// mismo effect que protege. Vuelve a `false` cuando reaparecen resultados.
let emptyAssistLoaded = false;

// Los tres más frecuentes de cada faceta, como enlaces a una búsqueda filtrada por ese valor.
// **La fuente es el catálogo, no la búsqueda**: con cero resultados CKAN devuelve `search_facets`
// vacío —es el propio comentario de más abajo—, así que leerlos de la búsqueda dejaba el bloque
// invisible justo en el único caso en que existe. Salen de la llamada perezosa de «lo más reciente»,
// que ya recorre todo el catálogo. Si una faceta falta se muestra la otra; sin ninguna, no hay bloque.
const suggestionChips = $derived.by(() => {
	const chips: { label: string; href: string }[] = [];
	const seen = new Set<string>();

	const take = (facet: CkanFacet | undefined, param: "format" | "tags") => {
		const items = [...(facet?.items ?? [])].sort((a, b) => b.count - a.count).slice(0, 3);
		for (const item of items) {
			if (!item.name) continue;
			const href = `/search?${param}=${encodeURIComponent(item.name)}`;
			if (seen.has(href)) continue;
			seen.add(href);
			chips.push({ label: item.display_name || item.name, href });
		}
	};

	take(catalogFacets.res_format, "format");
	take(catalogFacets.tags, "tags");
	return chips;
});

/** Las tres organizaciones con más datasets, de mayor a menor. */
function topByPackageCount(orgs: CkanOrganization[]): CkanOrganization[] {
	return [...orgs].sort((a, b) => (b.package_count ?? 0) - (a.package_count ?? 0)).slice(0, 3);
}

async function loadEmptyAssist() {
	// `fallo` habilita el reintento: el latch de arriba existe para no repetir la carga en cada tecla,
	// no para convertir un fallo transitorio en permanente (`R3-EMPTY-ASSIST-NO-RETRY` de
	// `review-f6b3cb06831d7e11`). Se apaga sólo si algo falló; que un bloque venga vacío es legítimo.
	let fallo = false;
	const sinDatos = () => {
		recentDatasets = import.meta.env.DEV ? getMockSearchResult().results.slice(0, 3) : [];
		catalogFacets = import.meta.env.DEV ? (getMockSearchResult().search_facets ?? {}) : {};
		topOrganizations = import.meta.env.DEV ? topByPackageCount(MOCK_ORGS) : [];
	};

	// La creación del cliente también puede tirar: va adentro, o el `void` de arriba deja una promesa
	// rechazada sin dueño (`R3-CLIENT-CREATION-UNCAUGHT`).
	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });

		// Cada bloque falla por su cuenta: que las organizaciones no carguen no debe tumbar «lo más
		// reciente» (y al revés). Fuera de DEV no se fabrican datos: el bloque se queda sin pintar.
		try {
			const datasetApi = createDatasetApi(client);
			const result = await datasetApi.search({
				q: "*:*",
				sort: "metadata_modified desc",
				limit: 3,
				// Mismas facetas que pide la búsqueda, pero sobre todo el catálogo: alimentan los chips.
				facet_field: ["res_format", "tags"],
				facet_limit: 10,
			});
			recentDatasets = result.results;
			catalogFacets = result.search_facets ?? {};
		} catch {
			fallo = true;
			recentDatasets = import.meta.env.DEV ? getMockSearchResult().results.slice(0, 3) : [];
		}

		try {
			const organizationApi = createOrganizationApi(client);
			topOrganizations = topByPackageCount(await organizationApi.list());
		} catch {
			fallo = true;
			topOrganizations = import.meta.env.DEV ? topByPackageCount(MOCK_ORGS) : [];
		}
	} catch {
		fallo = true;
		sinDatos();
	}

	if (fallo) emptyAssistLoaded = false;
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

// ─── Efecto: contenido del vacío, sólo mientras el vacío se muestra ──
// Depende de `results`/`total`/`loading`/`error` para no ejecutarse en el camino normal. La guarda
// impide repetir la carga en cada tecla o cambio de página mientras el vacío siga en pantalla.
$effect(() => {
	void results;
	void total;
	void error;
	void loading;
	void routerReady;

	if (results.length !== 0 || total !== 0) {
		emptyAssistLoaded = false;
		return;
	}

	if (!routerReady || loading || error) return;
	if (emptyAssistLoaded) return;
	emptyAssistLoaded = true;
	void loadEmptyAssist();
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

async function onRemoveAppliedFilter(field: "org" | "format" | "tags" | "license", value: string) {
	// Mismo handler que usa la faceta correspondiente: no se duplica la lógica de selección.
	toggleFilter(field, value);
	// El chip que tenía el foco se va con el filtro. Tras el re-render lo movemos al primer
	// chip restante del panel; si el panel entero desapareció (no había facetas y era el último
	// filtro), al buscador, que siempre está. Así el foco nunca cae a <body>.
	await tick();
	const nextChip = panelEl?.querySelector<HTMLButtonElement>("[data-applied-filter]");
	if (nextChip) {
		nextChip.focus();
		return;
	}
	document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
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

// Un solo valor para «hay facetas que mostrar»: con cero resultados CKAN devuelve facetas
// vacías, y sin facetas el panel de filtros queda como un marco con su título y nada dentro.
// Las cuatro guardas por faceta siguen siendo por faceta; esto decide el panel completo.
const hasFacets = $derived(
	(facets.organization?.items?.length ?? 0) > 0 ||
		(facets.res_format?.items?.length ?? 0) > 0 ||
		(facets.tags?.items?.length ?? 0) > 0 ||
		(facets.license_id?.items?.length ?? 0) > 0,
);

// El panel de filtros se muestra si hay facetas O si el usuario tiene filtros aplicados. Con
// cero resultados CKAN devuelve facetas vacías, pero los filtros aplicados siguen ahí: el panel
// debe volver para poder quitarlos de a uno. Con facetas, todo se comporta como antes.
const showFilterPanel = $derived(hasFacets || hasActiveFilters);

// Filtros aplicados agrupados por faceta, con los mismos títulos que los `FacetFilter`. Es la
// lista que el panel muestra cuando no hay facetas disponibles: son los filtros del usuario, no
// opciones para elegir.
const activeFilterGroups = $derived(
	[
		{ field: "org" as const, title: "Organización", values: selectedOrgs },
		{ field: "format" as const, title: "Formato", values: selectedFormats },
		{ field: "tags" as const, title: "Etiquetas", values: selectedTags },
		{ field: "license" as const, title: "Licencia", values: selectedLicenses },
	].filter((group) => group.values.length > 0),
);

// Los filtros sólo se mencionan cuando el usuario los tiene aplicados: sin ellos la invitación
// a «limpiar los filtros» no tendría a qué referirse (y el panel ni siquiera está visible).
const emptyStateMessage = $derived.by(() => {
	if (!query) {
		return hasActiveFilters
			? "No hay datasets disponibles con los filtros aplicados. Limpie los filtros para ver todo el catálogo."
			: "No hay datasets disponibles en este momento.";
	}
	return hasActiveFilters
		? `No encontramos datasets para "${query}". Pruebe con otros términos o limpie los filtros.`
		: `No encontramos datasets para "${query}". Pruebe con otros términos.`;
});
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
			Explore los datasets abiertos de la UMSS
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
				placeholder="Busque por organización, etiquetas, formato..."
				submitLabel="Buscar"
				class="[&_input]:h-14 [&_input]:rounded-xl [&_input]:border-0 [&_input]:bg-card [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_input]:shadow-lg [&_input]:focus-visible:ring-primary [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-offset-2 [&_input]:focus-visible:ring-offset-background"
				onsubmit={onSearchSubmit}
				onclear={onSearchClear}
			/>
		</div>
	</div>
</section>

<!-- ResultsBar: sticky debajo del encabezado global —su alto sale del token `--header-h`— más su
     borde inferior de 1px -->
<section
	class="sticky top-[calc(var(--header-h)+1px)] z-20 border-b border-border bg-background/95 backdrop-blur transition-[top] duration-200 ease-out"
>
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
	<div class={showFilterPanel ? 'lg:grid lg:grid-cols-[280px_1fr] lg:gap-8' : ''}>
		<!-- Sidebar: Facets o filtros aplicados. Se renderiza si hay facetas o si el usuario tiene
		     filtros aplicados (con cero resultados CKAN devuelve facetas vacías, pero sus filtros
		     siguen activos). Sin panel no queda un hueco de 280px: el área de resultados ocupa todo
		     el ancho. -->
		{#if showFilterPanel}
		<aside
			bind:this={panelEl}
			class="mb-6 lg:mb-0 lg:self-start lg:sticky lg:top-40 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto"
		>
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
					{#if hasFacets}
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
					{:else}
						<!-- Decisión: cuando no hay facetas disponibles el panel muestra los filtros QUE EL
						     USUARIO APLICÓ, no opciones para elegir. Por eso el bloque va encabezado con
						     «Filtros aplicados» y agrupado con los mismos títulos que las facetas
						     (Organización, Formato, Etiquetas, Licencia). Cada filtro es un chip-botón cuyo
						     nombre accesible dice qué quita, y usa el mismo `toggleFilter` que su faceta: no
						     se duplica la lógica de selección. -->
						<div class="space-y-3">
							<p class="text-xs leading-relaxed text-muted-foreground">
								Filtros aplicados. Quítelos para ampliar los resultados.
							</p>
							{#each activeFilterGroups as group (group.field)}
								<div>
									<p
										class="text-[11px] font-bold uppercase tracking-[0.14em] text-primary"
									>
										{group.title}
									</p>
									<div class="mt-1.5 flex flex-wrap gap-2">
										{#each group.values as value (value)}
											<button
												type="button"
												data-applied-filter
												onclick={() => onRemoveAppliedFilter(group.field, value)}
												aria-label={`Quitar filtro ${group.title}: ${value}`}
												class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/30 transition-all duration-200 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
											>
												<span class="max-w-[12rem] truncate">{value}</span>
												<X class="size-3 shrink-0" aria-hidden="true" />
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</aside>
		{/if}

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

			<!-- Empty state: el aviso y, debajo, tres salidas para seguir navegando -->
			{:else if total === 0 && !error}
				<div class="space-y-8">
					<div
						class="flex min-h-[24rem] flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center"
					>
						<p class="font-heading text-xl font-semibold text-primary">Sin resultados</p>
						<p class="mt-2 text-sm text-muted-foreground">
							{emptyStateMessage}
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

					<!-- 1. «Pruebe con»: los formatos y etiquetas más frecuentes, ya filtrados -->
					{#if suggestionChips.length}
						<div class="space-y-3">
							<h3 class="font-heading text-lg font-semibold text-primary">
								Pruebe con
							</h3>
							<div class="flex flex-wrap gap-2">
								{#each suggestionChips as chip (chip.href)}
									<a
										href={chip.href}
										class="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground transition-colors duration-200 hover:bg-accent"
									>
										{chip.label}
									</a>
								{/each}
							</div>
						</div>
					{/if}

					<!-- 2. «Mientras tanto, lo más reciente»: sin filtros, a propósito -->
					{#if recentDatasets.length}
						<div class="space-y-4">
							<h3 class="font-heading text-lg font-semibold text-primary">
								Mientras tanto, lo más reciente
							</h3>
							{#each recentDatasets as dataset (dataset.id)}
								<DatasetCard {dataset} />
							{/each}
						</div>
					{/if}

					<!-- 3. «Explorar por organización»: las tres con más datasets -->
					{#if topOrganizations.length}
						<div class="space-y-4">
							<h3 class="font-heading text-lg font-semibold text-primary">
								Explorar por organización
							</h3>
							<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{#each topOrganizations as org (org.id)}
									<OrganizationCard
										org={org}
										count={org.package_count ?? 0}
										href={`/organization/${encodeURIComponent(org.name)}`}
									/>
								{/each}
							</div>
						</div>
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
