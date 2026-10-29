<!--
	Organizaciones (S25 de `odd/tasks/prototype-presentation.md`; propuesta aprobada en S9 y S19).

	Buscador y filtro por tipo con la cantidad de cada uno, en una barra que se pega bajo el encabezado; las
	organizaciones agrupadas por tipo, con el título de cada grupo pegado bajo la barra. Se traen **todas**,
	sin paginar (Q12). El tipo se deduce del título (Q11); la sigla y la jerarquía aparecen sólo si el dato
	existe (Q13, Q6). La búsqueda y el tipo viven en la URL (`q`, `tipo`).
-->
<script lang="ts">
import { Search, SearchX, X } from "@lucide/svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createOrganizationApi, type ListedOrganization } from "$lib/api/organizations";
import OrganizationDirectoryCard from "$lib/components/organizations/OrganizationDirectoryCard.svelte";
import { ORG_TYPES, type OrgType } from "$lib/components/organizations/org-type";
import Button from "$lib/components/ui/button/button.svelte";
import { env } from "$lib/env";
import { getMockOrgs } from "$lib/mock/data";
import {
	type DirectoryOrg,
	dependentsOf,
	groupByType,
	matchesQuery,
	parentOf,
	toDirectoryOrg,
	typeCounts,
} from "./directory";

type TypeFilter = OrgType | "todas";

const TYPE_IDS: readonly string[] = ORG_TYPES.map((type) => type.id);
const url = get(page).url;
const initialType = url.searchParams.get("tipo");

// ─── Estado ──────────────────────────────────────────────────────
let items = $state<DirectoryOrg[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let query = $state(url.searchParams.get("q") ?? "");
let typeFilter = $state<TypeFilter>(
	initialType !== null && TYPE_IDS.includes(initialType) ? (initialType as OrgType) : "todas",
);
/** Alto medido de la barra pegada: de él sale el tope de los títulos de grupo (`--org-bar-h`). */
let barHeight = $state(0);

const byQuery = $derived(items.filter((item) => matchesQuery(item, query)));
const visible = $derived(
	typeFilter === "todas" ? byQuery : byQuery.filter((item) => item.type === typeFilter),
);
const chips = $derived([
	{ id: "todas" as TypeFilter, label: "Todas", count: byQuery.length },
	...typeCounts(byQuery, items).map((entry) => ({
		id: entry.type.id as TypeFilter,
		label: entry.type.label,
		count: entry.count,
	})),
]);
const groups = $derived(groupByType(visible));

// ─── Cargar organizaciones (catálogo → datos de ejemplo en desarrollo) ──
async function loadOrgs() {
	loading = true;
	error = null;
	items = [];

	try {
		const orgApi = createOrganizationApi(createCkanClient({ baseUrl: env.CKAN_URL }));
		const updatesPromise = orgApi.lastUpdates();

		let orgs: ListedOrganization[];
		try {
			orgs = await orgApi.listAll();
		} catch {
			if (import.meta.env.DEV) {
				orgs = getMockOrgs();
			} else {
				throw new Error("No se pudo conectar con el catálogo de datos.");
			}
		}

		const updates = await updatesPromise;
		items = orgs.map((org) => toDirectoryOrg(org, updates));
	} catch (err) {
		error = err instanceof Error ? err.message : "Error al cargar las organizaciones";
	} finally {
		loading = false;
	}
}

onMount(() => {
	loadOrgs();
});

/**
 * Refleja la búsqueda y el tipo en la URL, para poder compartir el listado ya filtrado. El segundo
 * argumento de `replaceState` es `page.state` y debe ser un objeto plano.
 */
function syncUrl(): void {
	const params = new URLSearchParams();
	if (query) params.set("q", query);
	if (typeFilter !== "todas") params.set("tipo", typeFilter);
	const search = params.toString();
	replaceState(search ? `/organizations?${search}` : "/organizations", {});
}

function clearSearch(): void {
	query = "";
	typeFilter = "todas";
	syncUrl();
}

const inputClass =
	"h-10 w-full rounded-lg border border-border bg-background px-3 pl-9 text-sm text-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
</script>

<svelte:head>
	<title>Organizaciones — UMSS</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-8">
		<h1 class="font-heading text-2xl font-semibold text-primary sm:text-3xl">Organizaciones</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Explore las organizaciones que publican datasets en la plataforma
		</p>
	</div>

	{#if loading}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
				<div class="animate-pulse rounded-xl border border-border bg-card p-4">
					<div class="flex items-start gap-4">
						<div class="size-12 rounded-lg bg-muted"></div>
						<div class="flex-1 space-y-2">
							<div class="h-5 w-3/4 rounded bg-muted"></div>
							<div class="h-4 w-full rounded bg-muted"></div>
							<div class="h-4 w-1/2 rounded bg-muted"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center">
			<p class="text-lg font-medium text-destructive">Error al cargar las organizaciones</p>
			<p class="mt-2 text-sm text-muted-foreground">{error}</p>
			<button
				onclick={() => loadOrgs()}
				class="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Reintentar
			</button>
		</div>
	{:else if items.length === 0}
		<div class="rounded-xl border border-border bg-card p-12 text-center">
			<p class="text-lg font-medium text-primary">No hay organizaciones disponibles</p>
			<p class="mt-2 text-sm text-muted-foreground">
				Vuelva más tarde para ver las organizaciones que publican datos.
			</p>
		</div>
	{:else}
		<div data-testid="org-directory" style:--org-bar-h="{barHeight}px">
			<!-- Buscador y filtro por tipo, pegados bajo el encabezado (S19): el tope sale de `--header-h`
			     más su borde de 1px, y el aire común `--sticky-air` va como relleno *dentro* del fondo opaco,
			     para que las tarjetas no asomen por el hueco. El relleno existe también sin pegar, así que
			     pegarse no mueve nada. Los márgenes negativos estiran el fondo sobre el relleno del contenedor
			     y tapan la sombra de las tarjetas. El `top` sigue al encabezado cuando se achica, con la misma
			     transición que él; `prefers-reduced-motion` la apaga. -->
			<div
				data-testid="org-sticky-bar"
				bind:clientHeight={barHeight}
				class="sticky top-[calc(var(--header-h)+1px)] z-20 -mx-4 flex flex-col gap-4 bg-background px-4 pt-[var(--sticky-air)] pb-[var(--sticky-air)] transition-[top] duration-200 ease-out motion-reduce:transition-none sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
			>
				<label class="relative block max-w-xl">
					<span class="sr-only">Buscar organizaciones</span>
					<Search
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="search"
						class={inputClass}
						placeholder="Buscar por nombre"
						bind:value={query}
						oninput={syncUrl}
					/>
				</label>

				<div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
					{#each chips as chip (chip.id)}
						<button
							type="button"
							aria-pressed={typeFilter === chip.id}
							disabled={chip.count === 0 && typeFilter !== chip.id}
							onclick={() => {
								typeFilter = chip.id;
								syncUrl();
							}}
							class="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 {typeFilter ===
							chip.id
								? 'border-primary bg-primary text-primary-foreground'
								: 'border-border bg-background text-foreground hover:bg-accent'}"
						>
							{chip.label}
							<span
								class="rounded-full px-1.5 text-xs tabular-nums {typeFilter === chip.id
									? 'bg-primary-foreground/20'
									: 'bg-muted text-muted-foreground'}">{chip.count}</span
							>
						</button>
					{/each}
				</div>
			</div>

			<p class="mt-6 text-sm text-muted-foreground" aria-live="polite">
				{visible.length}
				{visible.length === 1 ? "organización" : "organizaciones"}
			</p>

			{#if visible.length === 0}
				<div
					class="mt-4 rounded-xl border border-border bg-card p-12 text-center"
					data-testid="org-empty"
				>
					<SearchX class="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
					<p class="mt-4 text-lg font-medium text-primary">No encontramos organizaciones</p>
					<p class="mt-2 text-sm text-muted-foreground">
						Revise la ortografía, pruebe con otra palabra del nombre o quite el filtro por tipo.
					</p>
					<Button variant="outline" class="mt-6 cursor-pointer" onclick={clearSearch}>
						<X class="size-4" aria-hidden="true" />
						Limpiar búsqueda y filtros
					</Button>
				</div>
			{:else}
				<!-- Un encabezado por tipo. El título se pega justo debajo de la barra mientras su grupo está a la
				     vista (el `<section>` lo contiene). `z-[15]`: por encima de los enlaces de jerarquía de las
				     tarjetas (`relative z-10`) y por debajo de la barra (`z-20`). -->
				<div class="mt-4 space-y-10">
					{#each groups as group (group.type.id)}
						<section
							aria-labelledby={`group-${group.type.id}`}
							data-testid={`org-group-${group.type.id}`}
						>
							<h2
								id={`group-${group.type.id}`}
								class="sticky top-[calc(var(--header-h)+1px+var(--org-bar-h,0px))] z-[15] flex items-baseline gap-2 border-b border-border bg-background pb-2 font-heading text-xl font-semibold text-primary transition-[top] duration-200 ease-out motion-reduce:transition-none"
							>
								{group.type.plural}
								<span class="font-sans text-sm font-normal text-muted-foreground"
									>{group.items.length}</span
								>
							</h2>
							<div class="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{#each group.items as item (item.org.id)}
									<OrganizationDirectoryCard
										org={item.org}
										count={item.count}
										updated={item.updated}
										acronym={item.acronym}
										parent={parentOf(item, items)}
										dependents={dependentsOf(item, items)}
									/>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
