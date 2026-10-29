<!--
	Playground — la barra de resultados del buscador (S24 de `odd/tasks/prototype-presentation.md`; AGENTS.md
	regla 8). El autor, textual: «eso de pasar de ocupar ambas columnas a solo una y mostrar el input del
	buscador».

	Duplica `/search` sobre el catálogo vivo (con el respaldo de desarrollo si CKAN no responde): el hero, la barra,
	la columna de filtros y las tarjetas son los de la página real. Se recortó lo que no toca la barra —el contenido
	del vacío, los saltos con `#id` y el aterrizaje al cambiar de página—. Se comparan:
	- «como hoy»: la barra de la página real. El fondo se recorta a la columna al pegarse (250 ms) y el campo
	  crece en la barra cuando el del hero sale de la vista, que es **otro** momento del desplazamiento.
	- «animada»: un solo momento. Al pegarse, la barra pasa de las dos columnas a la de resultados y en el mismo
	  movimiento (320 ms) entra el campo compacto: aparece y baja medio rem en un hueco que la barra ya tenía
	  reservado, así nada de la barra ni de los resultados se corre. Al volver arriba, todo se deshace. Si el
	  foco estaba en el campo compacto cuando se esconde, pasa al del hero sin desplazar la página.
	Con movimiento reducido, los dos cambian de estado sin transición.

	El panel (fijo, abajo a la derecha) es liviano: los casos y el instrumento —estado de la barra, ancho visible
	y la posición del desplazamiento en la que cambió—. El interruptor de la barra va en su sección, encima de
	ella. El estado vive en la URL: `barra` (`hoy` | `animada`) y la búsqueda (`q`).
-->
<script lang="ts">
import { ChevronDown, SlidersHorizontal, X } from "@lucide/svelte";
import { onMount, tick, untrack } from "svelte";
import { afterNavigate, replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { describeFailure } from "$lib/api/failure";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import FacetFilter from "$lib/components/search/FacetFilter.svelte";
import Pagination from "$lib/components/search/Pagination.svelte";
import SearchBar from "$lib/components/search/SearchBar.svelte";
import { env } from "$lib/env";
import { getMockSearchResult } from "$lib/mock/data";
import type { CkanFacet, CkanPackage } from "$lib/types/ckan";
import { buildFilterQuery } from "$lib/utils/ckan";
import { mapLicenseItems } from "$lib/utils/licenses";
import PlaygroundToggle from "./PlaygroundToggle.svelte";

type Variante = "hoy" | "animada";

const VARIANTES: { value: Variante; label: string }[] = [
	{ value: "hoy", label: "Como hoy" },
	{ value: "animada", label: "Animada" },
];

const CASOS = [
	{ id: "matricula", label: "Con resultados («matrícula»)", q: "matrícula" },
	{ id: "catalogo", label: "Catálogo entero", q: "" },
] as const;

// ─── State desde URL ──────────────────────────────────────────────
const barraParam = $page.url.searchParams.get("barra");
let variante = $state<Variante>(barraParam === "animada" ? "animada" : "hoy");
let query = $state($page.url.searchParams.get("q") ?? "");
let selectedOrgs = $state<string[]>($page.url.searchParams.get("org")?.split(",") ?? []);
let selectedFormats = $state<string[]>($page.url.searchParams.get("format")?.split(",") ?? []);
let selectedTags = $state<string[]>($page.url.searchParams.get("tags")?.split(",") ?? []);
let selectedLicenses = $state<string[]>($page.url.searchParams.get("license")?.split(",") ?? []);
let currentPage = $state(Number($page.url.searchParams.get("page")) || 1);
let sortChoice = $state<string | null>($page.url.searchParams.get("sort"));
const defaultSort = $derived(query.trim() ? "score desc" : "metadata_modified desc");
const sortBy = $derived(sortChoice ?? defaultSort);

// ─── Result state ─────────────────────────────────────────────────
let results = $state<CkanPackage[]>([]);
let total = $state(0);
let loading = $state(true);
let error = $state<string | null>(null);
let facets = $state<Record<string, CkanFacet>>({});

let catalogTotal = $state(0);
let catalogTotalLoading = $state(true);

let mobileFiltersOpen = $state(false);
let altoBarra = $state(0);

// ─── Los pegados: copia de la página real, con la variante de la barra ──────────────────────────────
// La geometría es la de `/search` (ver su script): el fondo nace de borde a borde y, al pegarse, se recorta a
// la columna con `clip-path`; el contador se corre sobre las facetas en reposo con `transform`. Lo único que
// cambia la variante es **cuándo** entra el campo compacto y **cómo**, y la duración del movimiento.
const SOMBRA_PX = 8;
const DURACION_HOY = 250;
const DURACION_ANIMADA = 320;
const CURVA_BARRA = "cubic-bezier(0.22, 1, 0.36, 1)";
let enColumna = $state(false); // ≥ 1024px
let ventanaAncha = $state(false); // ≥ 640px
let reducido = $state(false); // prefers-reduced-motion
let pegada = $state(false);
let heroFuera = $state(false);

let barraEl = $state<HTMLElement>();
let fondoEl = $state<HTMLElement>();
let columnaEl = $state<HTMLElement>();
let heroEl = $state<HTMLElement>();
let campoEl = $state<HTMLElement>();

const animada = $derived(variante === "animada");
const duracion = $derived(animada ? DURACION_ANIMADA : DURACION_HOY);
// «Como hoy» espera a que el campo del hero salga de la vista; «animada» lo ata al momento en que la barra
// se pega, para que las dos cosas se vean como un solo movimiento.
const buscadorEnBarra = $derived(ventanaAncha && (animada ? pegada : heroFuera));
const compacta = $derived(enColumna && pegada);
const transicionBarra = $derived(reducido ? "none" : `clip-path ${duracion}ms ${CURVA_BARRA}`);
const transicionContador = $derived(reducido ? "none" : `transform ${duracion}ms ${CURVA_BARRA}`);
const transicionCampo = $derived(
	reducido
		? "none"
		: `opacity ${duracion}ms ${CURVA_BARRA}, transform ${duracion}ms ${CURVA_BARRA}`,
);

// ─── Instrumento ──────────────────────────────────────────────────
let anchoVisible = $state(0);
let scrollActual = $state(0);
let cambioEn = $state<number | null>(null);
// La posición exacta en la que la barra se pega: mientras no lo está, el desplazamiento más lo que le falta.
let umbral = $state<number | null>(null);
let campoEn = $state<number | null>(null);

/** Ancho que se ve del fondo: su caja menos lo que recorta `clip-path` en este cuadro (también a mitad de la transición). */
function medirAncho() {
	if (!fondoEl) return;
	const caja = fondoEl.getBoundingClientRect().width;
	const recorte = getComputedStyle(fondoEl).clipPath.match(/inset\(([^)]*)\)/);
	const [, derecha = 0, , izquierda = derecha] = (recorte?.[1] ?? "0")
		.split(/\s+/)
		.map((v) => Number.parseFloat(v) || 0);
	anchoVisible = Math.round(Math.max(caja - derecha - izquierda, 0));
}

function medirPegados() {
	scrollActual = Math.round(window.scrollY);
	const encabezado = document.querySelector("[data-site-header]")?.getBoundingClientRect();
	if (!encabezado || !barraEl) return;
	const barra = barraEl.getBoundingClientRect();
	pegada = barra.top <= encabezado.bottom + 0.5;
	// El umbral se toma contra el encabezado ya achicado (`--header-h-min` + su borde): el alto real cambia en el
	// tope y a mitad de su propia transición.
	if (!pegada) {
		const raiz = getComputedStyle(document.documentElement);
		const bajo = Number.parseFloat(raiz.getPropertyValue("--header-h-min")) || 0;
		const rem = Number.parseFloat(raiz.fontSize) || 16;
		umbral = Math.round(window.scrollY + barra.top - (bajo * rem + 1));
	}
	heroFuera = heroEl ? heroEl.getBoundingClientRect().bottom < encabezado.bottom : false;
	if (columnaEl) {
		const columna = columnaEl.getBoundingClientRect();
		const ventana = document.documentElement.clientWidth;
		const izquierda = Math.max(Math.round(columna.left), 0);
		barraEl.style.setProperty("--bleed-l", `${izquierda}px`);
		const derecha = Math.max(Math.round(ventana - columna.right), 0);
		barraEl.style.setProperty("--bleed-r", `${derecha}px`);
		barraEl.style.setProperty("--cover-l", `${Math.max(izquierda - SOMBRA_PX, 0)}px`);
		barraEl.style.setProperty("--cover-r", `${Math.max(derecha - SOMBRA_PX, 0)}px`);
		const lateral = panelEl?.getBoundingClientRect();
		barraEl.style.setProperty(
			"--shift",
			`${lateral ? Math.max(Math.round(columna.left - lateral.left), 0) : 0}px`,
		);
	}
	// Después de que el recorte del nuevo estado llegue al DOM.
	tick().then(medirAncho);
}

// Dónde cambió: se anota la posición del desplazamiento en cada cambio de estado de la barra (no en el del
// montaje), y el ancho se vuelve a medir cuando la transición termina.
let primeraMedida = true;
$effect(() => {
	void compacta;
	if (primeraMedida) {
		primeraMedida = false;
		return;
	}
	cambioEn = Math.round(window.scrollY);
	const espera = setTimeout(medirAncho, untrack(() => duracion) + 50);
	return () => clearTimeout(espera);
});

$effect(() => {
	if (!buscadorEnBarra) return;
	untrack(() => (campoEn = Math.round(window.scrollY)));
});

// Foco: si el campo compacto se esconde con el foco adentro, el foco pasa al del hero, sin desplazar.
$effect(() => {
	if (buscadorEnBarra || !animada) return;
	untrack(() => {
		if (campoEl?.contains(document.activeElement)) {
			heroEl
				?.querySelector<HTMLInputElement>('input[type="search"]')
				?.focus({ preventScroll: true });
		}
	});
});

onMount(() => {
	const consultas = [
		["(min-width: 1024px)", (v: boolean) => (enColumna = v)],
		["(min-width: 640px)", (v: boolean) => (ventanaAncha = v)],
		["(prefers-reduced-motion: reduce)", (v: boolean) => (reducido = v)],
	] as const;
	const bajas = consultas.map(([consulta, aplicar]) => {
		const mq = matchMedia(consulta);
		aplicar(mq.matches);
		const alCambiar = () => {
			aplicar(mq.matches);
			medirPegados();
		};
		mq.addEventListener("change", alCambiar);
		return () => mq.removeEventListener("change", alCambiar);
	});
	medirPegados();
	return () => {
		for (const baja of bajas) baja();
	};
});

$effect(() => {
	void altoBarra;
	void enColumna;
	void showFilterPanel;
	void loading;
	void total;
	tick().then(medirPegados);
});

let panelEl = $state<HTMLElement>();

let routerReady = $state(false);

afterNavigate(() => {
	routerReady = true;
});

const pageSize = 20;
const totalPages = $derived(Math.ceil(total / pageSize));

// ─── Sincronizar URL ──────────────────────────────────────────────
function syncUrl() {
	const params = new URLSearchParams();
	params.set("barra", variante);
	if (query) params.set("q", query);
	if (selectedOrgs.length) params.set("org", selectedOrgs.join(","));
	if (selectedFormats.length) params.set("format", selectedFormats.join(","));
	if (selectedTags.length) params.set("tags", selectedTags.join(","));
	if (selectedLicenses.length) params.set("license", selectedLicenses.join(","));
	if (currentPage > 1) params.set("page", String(currentPage));
	if (sortChoice !== null && sortChoice !== defaultSort) params.set("sort", sortChoice);
	replaceState(
		`/dev/search-bar?${params.toString()}`,
		untrack(() => $page.state),
	);
}

// ─── Búsqueda en CKAN ─────────────────────────────────────────────
async function doSearch() {
	loading = true;
	error = null;

	const filterMap: Record<string, string[]> = {};
	if (selectedOrgs.length) filterMap.organization = selectedOrgs;
	if (selectedFormats.length) filterMap.res_format = selectedFormats;
	if (selectedTags.length) filterMap.tags = selectedTags;
	if (selectedLicenses.length) filterMap.license_id = selectedLicenses;
	const fq = buildFilterQuery(filterMap);

	try {
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
		// Respaldo de desarrollo: el playground sólo existe en desarrollo.
		try {
			const mock = getMockSearchResult();
			results = mock.results;
			total = mock.count;
			facets = mock.search_facets;
		} catch {
			error = describeFailure(err, "dataset", "unknown").message;
			results = [];
			total = 0;
			facets = {};
		}
	} finally {
		loading = false;
	}
}

async function loadCatalogTotal() {
	catalogTotalLoading = true;
	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const datasetApi = createDatasetApi(client);
		const result = await datasetApi.search({ q: "*:*", limit: 0 });
		catalogTotal = result.count;
	} catch {
		catalogTotal = getMockSearchResult().count;
	} finally {
		catalogTotalLoading = false;
	}
}

$effect(() => {
	void query;
	void selectedOrgs;
	void selectedFormats;
	void selectedTags;
	void selectedLicenses;
	void currentPage;
	void sortBy;
	void routerReady;

	if (routerReady) doSearch();
});

$effect(() => {
	void routerReady;

	if (routerReady) loadCatalogTotal();
});

$effect(() => {
	void variante;
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

function elegirCaso(q: string) {
	query = q;
	currentPage = 1;
	clearAllFilters();
	window.scrollTo({ top: 0, behavior: "instant" });
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

const hasFacets = $derived(
	(facets.organization?.items?.length ?? 0) > 0 ||
		(facets.res_format?.items?.length ?? 0) > 0 ||
		(facets.tags?.items?.length ?? 0) > 0 ||
		(facets.license_id?.items?.length ?? 0) > 0,
);
const showFilterPanel = $derived(hasFacets || hasActiveFilters);

const activeFilters = $derived([
	...selectedOrgs.map((value) => ({ field: "org" as const, value })),
	...selectedFormats.map((value) => ({ field: "format" as const, value })),
	...selectedTags.map((value) => ({ field: "tags" as const, value })),
	...selectedLicenses.map((value) => ({ field: "license" as const, value })),
]);
</script>

<svelte:window onscroll={medirPegados} onresize={medirPegados} />

<svelte:head>
	<title>Playground: barra del buscador — UMSS</title>
</svelte:head>

<!-- Hero: el de la página real -->
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

		<div bind:this={heroEl} data-hero-search class="mx-auto mt-8 w-full max-w-[720px]">
			<SearchBar
				value={query}
				shortcut={!buscadorEnBarra}
				placeholder="Busque por organización, etiquetas, formato..."
				submitLabel="Buscar"
				class="[&_input]:h-14 [&_input]:rounded-xl [&_input]:border-0 [&_input]:bg-card [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_input]:shadow-lg [&_input]:focus-visible:ring-primary [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-offset-2 [&_input]:focus-visible:ring-offset-background"
				onsubmit={onSearchSubmit}
				onclear={onSearchClear}
			/>
		</div>
	</div>
</section>

<!-- El interruptor de la barra, en su sección: encima de ella -->
<div class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
	<div
		class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3"
		data-testid="section-toggles"
	>
		<PlaygroundToggle
			label="Barra:"
			options={VARIANTES}
			value={variante}
			onchange={(v) => (variante = v)}
			testid="toggle-barra"
		/>
		<p class="text-xs text-muted-foreground">
			Desplace la página hasta que la barra se pegue bajo el encabezado, y vuelva arriba.
		</p>
	</div>
</div>

{#snippet barraResultados()}
	<section
		bind:this={barraEl}
		bind:clientHeight={altoBarra}
		data-results-bar
		data-variant={variante}
		data-state={compacta ? 'compacta' : 'expandida'}
		class="pointer-events-none sticky top-[calc(var(--header-h)+1px)] z-20 transition-[top] duration-200 ease-out motion-reduce:transition-none"
	>
		<div
			bind:this={fondoEl}
			aria-hidden="true"
			data-bar-bg
			class="absolute inset-y-0 bg-background {enColumna ? '' : 'inset-x-0'}"
			style:left={enColumna ? 'calc(-1 * var(--bleed-l, 0px))' : undefined}
			style:right={enColumna ? 'calc(-1 * var(--bleed-r, 0px))' : undefined}
			style:clip-path={compacta ? 'inset(0 var(--cover-r, 0px) 0 var(--cover-l, 0px))' : 'inset(0 0 0 0)'}
			style:transition={transicionBarra}
		></div>
		<div
			aria-hidden="true"
			data-bar-line
			class="absolute bottom-0 h-px bg-border {enColumna ? '' : 'inset-x-0'}"
			style:left={enColumna ? 'calc(-1 * var(--bleed-l, 0px))' : undefined}
			style:right={enColumna ? 'calc(-1 * var(--bleed-r, 0px))' : undefined}
			style:clip-path={compacta ? 'inset(0 var(--bleed-r, 0px) 0 var(--bleed-l, 0px))' : 'inset(0 0 0 0)'}
			style:transition={transicionBarra}
		></div>
		<div class="relative {enColumna ? '' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'}">
			<div
				class="pointer-events-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
			>
				<p
					class="flex items-baseline gap-2"
					style:transform={enColumna && !pegada ? 'translateX(calc(-1 * var(--shift, 0px)))' : 'none'}
					style:transition={transicionContador}
				>
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

				<!-- «Como hoy»: el de la página real (crece de 0 al ancho del campo). «Animada»: el hueco está siempre
				     reservado y el campo sólo cambia de opacidad y de `transform`, así la barra no se reacomoda. -->
				{#if animada}
					<div
						bind:this={campoEl}
						data-bar-search
						class="-m-1.5 min-w-0 max-w-md flex-1 p-1.5 max-sm:hidden {buscadorEnBarra
							? ''
							: 'pointer-events-none'}"
						style:opacity={buscadorEnBarra ? '1' : '0'}
						style:transform={buscadorEnBarra ? 'none' : 'translateY(-0.5rem)'}
						style:transition={transicionCampo}
						inert={!buscadorEnBarra}
					>
						<SearchBar
							value={query}
							shortcut={buscadorEnBarra}
							placeholder="Buscar datasets..."
							class="[&_input]:h-11 [&_input]:rounded-lg"
							onsubmit={onSearchSubmit}
							onclear={onSearchClear}
						/>
					</div>
				{:else}
					<div
						bind:this={campoEl}
						data-bar-search
						class="-m-1.5 min-w-0 overflow-hidden p-1.5 transition-[max-width,opacity] duration-200 ease-out max-sm:hidden motion-reduce:transition-none {buscadorEnBarra
							? 'max-w-md flex-1 opacity-100'
							: 'max-w-0 opacity-0'}"
						inert={!buscadorEnBarra}
					>
						<SearchBar
							value={query}
							shortcut={buscadorEnBarra}
							placeholder="Buscar datasets..."
							class="[&_input]:h-11 [&_input]:rounded-lg"
							onsubmit={onSearchSubmit}
							onclear={onSearchClear}
						/>
					</div>
				{/if}

				<label class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<span class="hidden sm:inline">Ordenar:</span>
					<select
						value={sortBy}
						onchange={(e) => {
							sortChoice = (e.target as HTMLSelectElement).value;
							currentPage = 1;
						}}
						class="h-11 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						<option value="score desc">Relevancia</option>
						<option value="metadata_modified desc">Más recientes</option>
						<option value="metadata_modified asc">Más antiguos</option>
						<option value="title_string asc">A-Z</option>
						<option value="title_string desc">Z-A</option>
					</select>
				</label>
			</div>
		</div>
	</section>
{/snippet}

{#snippet filtrosActivos()}
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-sm font-medium text-muted-foreground">Filtros activos:</span>
		{#each activeFilters as filtro (`${filtro.field}:${filtro.value}`)}
			<button
				onclick={() => toggleFilter(filtro.field, filtro.value)}
				class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/30 transition-all duration-200 hover:bg-primary/20"
			>
				{filtro.value}
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
{/snippet}

{#if !enColumna}
	{@render barraResultados()}
	{#if hasActiveFilters}
		<div class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
			{@render filtrosActivos()}
		</div>
	{/if}
{/if}

<!-- Body: el de la página real -->
<div
	class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 {enColumna ? 'pt-0' : 'pt-8'}"
	style:--bar-h="{altoBarra}px"
>
	<div class={showFilterPanel ? 'lg:grid lg:grid-cols-[280px_1fr] lg:gap-8' : ''}>
		{#if showFilterPanel}
			<aside
				bind:this={panelEl}
				class="mb-6 lg:mb-0 lg:mt-[calc(var(--bar-h)+2rem)] lg:self-start lg:sticky lg:top-[calc(var(--header-h)+1px+var(--sticky-air))] lg:z-[21] lg:h-[calc(100dvh-var(--header-h-min)-1px-2*var(--sticky-air))] lg:transition-[top,height] lg:duration-200 lg:ease-out motion-reduce:lg:transition-none"
			>
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
							<span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
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
					class="rounded-xl border border-border bg-card p-6 shadow-sm transition-opacity duration-200 lg:h-full lg:overflow-y-auto {mobileFiltersOpen
						? 'block'
						: 'hidden'} md:block {loading ? 'opacity-60' : ''}"
				>
					<div class="flex items-baseline justify-between gap-2 border-b border-border pb-3">
						<h2 class="text-sm font-bold uppercase tracking-[0.14em] text-destructive">Filtros</h2>
						{#if hasActiveFilters}
							<button
								onclick={clearAllFilters}
								class="text-xs font-semibold text-destructive underline underline-offset-2 transition-colors duration-200 hover:text-destructive/80"
							>
								Limpiar ({activeFilterCount})
							</button>
						{/if}
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
		{/if}

		<div
			bind:this={columnaEl}
			data-results-column
			class="min-w-0 {showFilterPanel
				? 'lg:min-h-[calc(2*(var(--bar-h)+2rem)+100dvh-var(--header-h-min)-1px-2*var(--sticky-air))]'
				: ''}"
		>
			{#if enColumna}
				{@render barraResultados()}
				{#if hasActiveFilters}
					<div class="pt-8">
						{@render filtrosActivos()}
					</div>
				{/if}
			{/if}
			<div class={enColumna ? (hasActiveFilters ? 'pt-4' : 'pt-8') : ''}>
				{#if error}
					<div class="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
						<p class="font-medium text-destructive">Error al buscar</p>
						<p class="mt-1 text-sm text-muted-foreground">{error}</p>
					</div>
				{/if}

				{#if loading}
					<div class="space-y-4">
						{#each Array(3) as _}
							<div class="animate-pulse rounded-xl border border-border bg-card p-6">
								<div class="mb-2 h-4 w-24 rounded bg-muted"></div>
								<div class="mb-2 h-5 w-3/4 rounded bg-muted"></div>
								<div class="mb-2 h-4 w-full rounded bg-muted"></div>
							</div>
						{/each}
					</div>
				{:else if total === 0 && !error}
					<div
						class="flex min-h-[24rem] flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center"
					>
						<h2 class="font-heading text-xl font-semibold text-primary">Sin resultados</h2>
						<p class="mt-2 text-sm text-muted-foreground">
							No encontramos datasets. Pruebe con otros términos.
						</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each results as dataset (dataset.id)}
							<DatasetCard {dataset} />
						{/each}
					</div>
					<div class="mt-8">
						<Pagination current={currentPage} total={totalPages} onchange={goToPage} />
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Panel del playground: fijo, para ver el instrumento mientras se desplaza. Sólo lo global: casos y medición. -->
<section
	data-testid="control-panel"
	aria-label="Panel del playground"
	class="fixed bottom-4 right-4 z-40 w-72 rounded-xl border border-dashed border-border bg-card/95 p-4 text-xs shadow-lg"
>
	<p class="font-semibold text-foreground">Casos</p>
	<div class="mt-2 flex flex-wrap gap-2">
		{#each CASOS as caso (caso.id)}
			<button
				type="button"
				data-testid={`caso-${caso.id}`}
				aria-pressed={query === caso.q}
				onclick={() => elegirCaso(caso.q)}
				class="cursor-pointer rounded-lg border border-input px-2.5 py-1 font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {query ===
				caso.q
					? 'bg-primary text-primary-foreground'
					: 'bg-background text-foreground hover:bg-accent'}"
			>
				{caso.label}
			</button>
		{/each}
	</div>

	<dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono" data-testid="instrumento">
		<dt class="text-muted-foreground">Barra</dt>
		<dd data-testid="instrumento-estado" class="text-foreground">
			{compacta ? 'compacta' : 'expandida'}
		</dd>
		<dt class="text-muted-foreground">Ancho visible</dt>
		<dd data-testid="instrumento-ancho" class="text-foreground">{anchoVisible} px</dd>
		<dt class="text-muted-foreground">Campo en la barra</dt>
		<dd data-testid="instrumento-campo" class="text-foreground">{buscadorEnBarra ? 'sí' : 'no'}</dd>
		<dt class="text-muted-foreground">Se pega en</dt>
		<dd data-testid="instrumento-umbral" class="text-foreground">
			{umbral === null ? '—' : `scrollY ${umbral} px`}
		</dd>
		<dt class="text-muted-foreground">Cambió en</dt>
		<dd data-testid="instrumento-cambio" class="text-foreground">
			{cambioEn === null ? '—' : `scrollY ${cambioEn} px`}
		</dd>
		<dt class="text-muted-foreground">Campo desde</dt>
		<dd data-testid="instrumento-campo-desde" class="text-foreground">
			{campoEn === null ? '—' : `scrollY ${campoEn} px`}
		</dd>
		<dt class="text-muted-foreground">scrollY</dt>
		<dd class="text-foreground">{scrollActual} px</dd>
		<dt class="text-muted-foreground">Movimiento</dt>
		<dd class="text-foreground">{reducido ? 'reducido (sin transición)' : `${duracion} ms`}</dd>
	</dl>
</section>
