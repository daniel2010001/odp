<!--
	Playground — página de organizaciones (S9 de `odd/tasks/prototype-presentation.md`, AGENTS.md regla 8).

	Duplica `/organizations` con datos fijos para comparar la cuadrícula **actual** (con la tarjeta real)
	contra la **propuesta**: (1) buscador y filtro por tipo con la cantidad de cada uno, (2) grupos por
	tipo con un encabezado cada uno, (3) la jerarquía en la tarjeta y (4) la sigla y la fecha de la
	última actualización.

	El panel de arriba es liviano: sólo los presets de caso, la vista (global) y la nota de factibilidad.
	Los interruptores de grupos, jerarquía y campos van en la sección de resultados, junto a lo que
	cambian. Todo el estado vive en la URL con nombres fijos —`caso`, `vista`, `grupos`, `jerarquia`,
	`campos`, `q`, `tipo`— para abrir la hoja ya posicionada y volver a un estado exacto.
-->
<script lang="ts">
import { Search, SearchX, X } from "@lucide/svelte";
import { get } from "svelte/store";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import OrganizationCard from "$lib/components/organizations/OrganizationCard.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import {
	dependentsOf,
	groupByType,
	type MockOrg,
	matchesQuery,
	ORG_CASES,
	ORG_TYPES,
	type OrgCase,
	type OrgType,
	orgsForCase,
	sortByTitle,
	toCkan,
	typeCounts,
} from "./orgs";
import PlaygroundToggle from "./PlaygroundToggle.svelte";
import ProposedOrganizationCard from "./ProposedOrganizationCard.svelte";

type View = "actual" | "propuesta";
type YesNo = "si" | "no";

interface Preset {
	id: string;
	label: string;
	orgCase: OrgCase;
	query: string;
	/** Fuerza la vista: el buscador sólo existe en la propuesta. */
	view?: View;
}

const PRESETS: Preset[] = [
	{ id: "actual", label: "Catálogo actual (5)", orgCase: "actual", query: "" },
	{
		id: "completa",
		label: `Universidad completa (${orgsForCase("completa").length})`,
		orgCase: "completa",
		query: "",
	},
	{
		id: "sin-resultados",
		label: "Búsqueda sin resultados",
		orgCase: "completa",
		query: "astronomía",
		view: "propuesta",
	},
	{ id: "sin-datos", label: "Una organización sin datasets", orgCase: "sin-datos", query: "" },
];

const FEASIBILITY: { element: string; status: string; detail: string }[] = [
	{
		element: "Cantidad de datasets y fecha de actualización",
		status: "Nativo",
		detail: "CKAN ya los entrega por organización.",
	},
	{
		element: "Tipo y sigla",
		status: "Implementable",
		detail: "Campos propios de la organización (extras); hoy no existen.",
	},
	{
		element: "Jerarquía (unidades dependientes)",
		status: "Implementable",
		detail: "Requiere la extensión ckanext-hierarchy (Q6).",
	},
	{
		element: "Buscador, filtro y grupos",
		status: "Implementable",
		detail: "Se arman en el portal sobre el tipo y el nombre.",
	},
];

const url = get(page).url;

function paramOr<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	const raw = url.searchParams.get(key);
	return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

const YES_NO: readonly YesNo[] = ["si", "no"];
const TYPE_IDS = ORG_TYPES.map((type) => type.id);

let orgCase = $state<OrgCase>(paramOr("caso", ORG_CASES, "completa"));
let view = $state<View>(paramOr("vista", ["actual", "propuesta"] as const, "propuesta"));
let grouped = $state(paramOr("grupos", YES_NO, "si") === "si");
let hierarchy = $state(paramOr("jerarquia", YES_NO, "si") === "si");
let fields = $state(paramOr("campos", YES_NO, "si") === "si");
let query = $state(url.searchParams.get("q") ?? "");
let typeFilter = $state<OrgType | "todas">(paramOr("tipo", [...TYPE_IDS, "todas"], "todas"));

const all = $derived(orgsForCase(orgCase));
const byQuery = $derived(all.filter((org) => matchesQuery(org, query)));
const visible = $derived(
	typeFilter === "todas" ? byQuery : byQuery.filter((org) => org.type === typeFilter),
);
const counts = $derived(typeCounts(byQuery, all));
const groups = $derived(groupByType(visible));

function parentOf(org: MockOrg): MockOrg | undefined {
	return org.parent ? all.find((candidate) => candidate.name === org.parent) : undefined;
}

/**
 * Refleja el estado en la URL. El segundo argumento de `replaceState` es `page.state` y debe ser un
 * objeto plano (ver `src/routes/dev/error/+page.svelte`).
 */
function syncUrl(): void {
	const params = new URLSearchParams({
		caso: orgCase,
		vista: view,
		grupos: grouped ? "si" : "no",
		jerarquia: hierarchy ? "si" : "no",
		campos: fields ? "si" : "no",
	});
	if (query) params.set("q", query);
	if (typeFilter !== "todas") params.set("tipo", typeFilter);
	replaceState(`/dev/organizations?${params.toString()}`, {});
}

function applyPreset(preset: Preset): void {
	orgCase = preset.orgCase;
	query = preset.query;
	typeFilter = "todas";
	if (preset.view) view = preset.view;
	syncUrl();
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
	<title>Organizaciones (playground) — UMSS</title>
</svelte:head>

<!-- ─── Panel de control (global) ─────────────────────────────────── -->
<div class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
	<section
		data-testid="control-panel"
		aria-label="Panel del playground"
		class="rounded-xl border border-dashed border-border bg-muted/50 p-4 sm:p-5"
	>
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto]">
			<div>
				<h2 class="text-sm font-semibold text-foreground">Casos</h2>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each PRESETS as preset (preset.id)}
						<button
							type="button"
							data-testid={`preset-${preset.id}`}
							onclick={() => applyPreset(preset)}
							class="cursor-pointer rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{preset.label}
						</button>
					{/each}
				</div>
			</div>
			<div>
				<h2 class="text-sm font-semibold text-foreground">Página</h2>
				<div class="mt-2">
					<PlaygroundToggle
						label="Vista"
						testid="toggle-vista"
						options={[
							{ value: "actual", label: "Cuadrícula actual" },
							{ value: "propuesta", label: "Propuesta" },
						]}
						value={view}
						onchange={(next) => {
							view = next;
							syncUrl();
						}}
					/>
				</div>
			</div>
		</div>

		<details class="mt-4 text-xs text-muted-foreground">
			<summary
				class="cursor-pointer rounded-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				Factibilidad en CKAN (S6)
			</summary>
			<ul class="mt-2 space-y-1">
				{#each FEASIBILITY as row (row.element)}
					<li>
						<span class="font-medium text-foreground">{row.element}:</span>
						<span class="font-semibold text-primary">{row.status}.</span>
						{row.detail}
					</li>
				{/each}
			</ul>
		</details>
	</section>
</div>

<!-- ─── Área de producto ──────────────────────────────────────────── -->
<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" data-testid="org-page">
	<div class="mb-8">
		<h1 class="font-heading text-2xl font-semibold text-primary sm:text-3xl">Organizaciones</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Explore las organizaciones que publican datasets en la plataforma
		</p>
	</div>

	{#if view === "actual"}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="org-current-grid">
			{#each all as org (org.name)}
				<OrganizationCard org={toCkan(org)} count={org.count} />
			{/each}
		</div>
	{:else}
		<div data-testid="org-proposed">
			<!-- (1) Buscador y filtro por tipo -->
			<div class="flex flex-col gap-4">
				<label class="relative block max-w-xl">
					<span class="sr-only">Buscar organizaciones</span>
					<Search
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="search"
						class={inputClass}
						placeholder="Buscar por nombre o sigla"
						bind:value={query}
						oninput={syncUrl}
					/>
				</label>

				<div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
					{#each [{ id: "todas" as const, label: "Todas", count: byQuery.length }, ...counts.map( (entry) => ({ id: entry.type.id, label: entry.type.label, count: entry.count }), )] as chip (chip.id)}
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

			<!-- Interruptores de esta sección -->
			<div
				class="mt-6 flex flex-wrap gap-x-6 gap-y-3 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3"
				data-testid="section-toggles"
			>
				<PlaygroundToggle
					label="Agrupar por tipo"
					testid="toggle-grupos"
					options={[
						{ value: "si", label: "Sí" },
						{ value: "no", label: "No" },
					]}
					value={grouped ? "si" : "no"}
					onchange={(next) => {
						grouped = next === "si";
						syncUrl();
					}}
				/>
				<PlaygroundToggle
					label="Jerarquía"
					testid="toggle-jerarquia"
					options={[
						{ value: "si", label: "Sí" },
						{ value: "no", label: "No" },
					]}
					value={hierarchy ? "si" : "no"}
					onchange={(next) => {
						hierarchy = next === "si";
						syncUrl();
					}}
				/>
				<PlaygroundToggle
					label="Sigla y fecha"
					testid="toggle-campos"
					options={[
						{ value: "si", label: "Sí" },
						{ value: "no", label: "No" },
					]}
					value={fields ? "si" : "no"}
					onchange={(next) => {
						fields = next === "si";
						syncUrl();
					}}
				/>
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
						Revise la ortografía, pruebe con la sigla (por ejemplo, «FCyT») o quite el filtro por
						tipo.
					</p>
					<Button variant="outline" class="mt-6 cursor-pointer" onclick={clearSearch}>
						<X class="size-4" aria-hidden="true" />
						Limpiar búsqueda y filtros
					</Button>
				</div>
			{:else if grouped}
				<!-- (2) Un encabezado por tipo -->
				<div class="mt-4 space-y-10">
					{#each groups as group (group.type.id)}
						<section aria-labelledby={`group-${group.type.id}`} data-testid={`org-group-${group.type.id}`}>
							<h2
								id={`group-${group.type.id}`}
								class="flex items-baseline gap-2 border-b border-border pb-2 font-heading text-xl font-semibold text-primary"
							>
								{group.type.plural}
								<span class="font-sans text-sm font-normal text-muted-foreground">{group.orgs.length}</span>
							</h2>
							<div class="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{#each group.orgs as org (org.name)}
									<ProposedOrganizationCard
										{org}
										dependents={dependentsOf(org, all)}
										parent={parentOf(org)}
										{hierarchy}
										{fields}
									/>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{:else}
				<div class="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="org-flat-grid">
					{#each sortByTitle(visible) as org (org.name)}
						<ProposedOrganizationCard
							{org}
							dependents={dependentsOf(org, all)}
							parent={parentOf(org)}
							{hierarchy}
							{fields}
						/>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
