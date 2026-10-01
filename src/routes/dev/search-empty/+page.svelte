<!--
	Playground del vacío del buscador — superficie sólo para desarrollo (`/dev/search-empty`).

	El problema medido: cuando una búsqueda no devuelve nada, el contenido propio de la página son **192 px**
	(el bloque «Sin resultados») dentro de una página de 1310 px en 1280×800, así que queda un hueco antes
	del pie. La propuesta del autor es **agregar contenido** al vacío, comparando con Amazon/YouTube/Google.

	Se ve **en acción**: abajo hay presets de caso (Hoy, A, B, C, D) y, además, **un interruptor por bloque**
	para combinar lo que entra. Los `DatasetCard` y los `OrganizationCard` son los **componentes reales** con
	las fixtures del repo; el bloque del vacío y los chips son **copias** del código de la página. Lo que se
	apruebe se promueve a `src/routes/search/+page.svelte` y esta hoja se borra (regla 8 de `AGENTS.md`).
-->
<script lang="ts">
import OrganizationCard from "$lib/components/organizations/OrganizationCard.svelte";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import { MOCK_DATASETS, MOCK_ORGS } from "$lib/mock/data";
import { cn } from "$lib/utils";

const recientes = MOCK_DATASETS.slice(0, 3);
const orgs = MOCK_ORGS.slice(0, 3);
// Sugerencias: lo que el catálogo tiene de sobra. En la promoción saldrían de las facetas que el
// buscador ya trae, no de una lista escrita a mano.
const SUGERENCIAS = ["CSV", "PDF", "salud", "educación", "movilidad", "encuestas"];

type Bloques = { recientes: boolean; orgs: boolean; sugerencias: boolean };
let activos = $state<Bloques>({ recientes: false, orgs: false, sugerencias: false });

const CASOS: { id: string; label: string; set: Bloques }[] = [
	{
		id: "hoy",
		label: "Hoy — sin contenido",
		set: { recientes: false, orgs: false, sugerencias: false },
	},
	{
		id: "a",
		label: "A · lo más reciente",
		set: { recientes: true, orgs: false, sugerencias: false },
	},
	{
		id: "b",
		label: "B · organizaciones",
		set: { recientes: false, orgs: true, sugerencias: false },
	},
	{ id: "c", label: "C · A + B", set: { recientes: true, orgs: true, sugerencias: false } },
	{
		id: "d",
		label: "D · búsquedas sugeridas",
		set: { recientes: false, orgs: false, sugerencias: true },
	},
	{ id: "todo", label: "Todo junto", set: { recientes: true, orgs: true, sugerencias: true } },
];

const igual = (a: Bloques, b: Bloques) =>
	a.recientes === b.recientes && a.orgs === b.orgs && a.sugerencias === b.sugerencias;
const casoActivo = $derived(CASOS.find((c) => igual(c.set, activos))?.id ?? null);
const algoActivo = $derived(activos.recientes || activos.orgs || activos.sugerencias);

const BLOQUES: { key: keyof Bloques; label: string }[] = [
	{ key: "recientes", label: "Lo más reciente" },
	{ key: "orgs", label: "Organizaciones" },
	{ key: "sugerencias", label: "Búsquedas sugeridas" },
];
</script>

{#snippet vacio()}
	<!-- Copia del estado vacío de `src/routes/search/+page.svelte` (el original es inline en la página). -->
	<div class="rounded-xl border border-border bg-card p-12 text-center">
		<p class="font-heading text-xl font-semibold text-primary">Sin resultados</p>
		<p class="mt-2 text-sm text-muted-foreground">
			No encontramos datasets para «test». Pruebe con otros términos.
		</p>
		<button type="button" class="mt-4 text-sm font-medium text-primary hover:underline">
			Limpiar búsqueda y filtros
		</button>
	</div>
{/snippet}

{#snippet bloqueRecientes()}
	<div class="space-y-4">
		<h3 class="font-heading text-lg font-semibold text-primary">Mientras tanto, lo más reciente</h3>
		{#each recientes as dataset (dataset.id)}
			<DatasetCard {dataset} />
		{/each}
	</div>
{/snippet}

{#snippet bloqueOrgs()}
	<div class="space-y-4">
		<h3 class="font-heading text-lg font-semibold text-primary">Explorar por organización</h3>
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each orgs as org (org.id)}
				<OrganizationCard {org} count={org.package_count ?? 0} href={`/organization/${encodeURIComponent(org.name)}`} />
			{/each}
		</div>
	</div>
{/snippet}

{#snippet bloqueSugerencias()}
	<div class="space-y-3">
		<h3 class="font-heading text-lg font-semibold text-primary">Pruebe con</h3>
		<div class="flex flex-wrap gap-2">
			{#each SUGERENCIAS as s (s)}
				<span
					class="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground transition-colors hover:bg-accent"
				>
					{s}
				</span>
			{/each}
		</div>
	</div>
{/snippet}

<div class="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
	<header class="space-y-2">
		<h1 class="font-heading text-2xl font-bold text-primary">El vacío del buscador</h1>
		<p class="max-w-3xl text-sm leading-relaxed text-muted-foreground">
			El bloque del vacío mide <strong>192 px</strong> en una página de <strong>1310</strong> (1280×800):
			eso es el hueco. Elija un caso o combine los bloques abajo y mire cómo queda la página.
		</p>
	</header>

	<!-- Control de previsualización: dev-chrome, no UI de producto. -->
	<div class="rounded-xl border border-dashed border-border bg-muted/40 p-4">
		<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
			Control del playground (no es UI de producto)
		</p>

		<div role="group" aria-label="Caso simulado" class="mt-3 flex flex-wrap gap-2">
			{#each CASOS as caso (caso.id)}
				<button
					type="button"
					aria-pressed={casoActivo === caso.id}
					onclick={() => (activos = { ...caso.set })}
					class={cn(
						"inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
						casoActivo === caso.id
							? "border-primary bg-primary text-primary-foreground"
							: "border-input bg-background text-foreground hover:bg-accent",
					)}
				>
					{caso.label}
				</button>
			{/each}
		</div>

		<div role="group" aria-label="Bloques que entran" class="mt-3 flex flex-wrap items-center gap-2">
			{#each BLOQUES as bloque (bloque.key)}
				<button
					type="button"
					aria-label={`Bloque: ${bloque.label}`}
					aria-pressed={activos[bloque.key]}
					onclick={() => (activos = { ...activos, [bloque.key]: !activos[bloque.key] })}
					class={cn(
						"inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-3 text-xs font-medium transition-colors",
						activos[bloque.key]
							? "border-primary bg-primary/10 text-primary"
							: "border-border bg-background text-muted-foreground hover:bg-accent",
					)}
				>
					{activos[bloque.key] ? "✓" : "+"}
					{bloque.label}
				</button>
			{/each}
			<span class="text-xs text-muted-foreground">
				{casoActivo ? `caso: ${CASOS.find((c) => c.id === casoActivo)?.label}` : "combinación propia"}
			</span>
		</div>
	</div>

	<!-- Previsualización: el área de resultados de la página real, con el vacío y los bloques elegidos. -->
	<div class="space-y-6">
		{@render vacio()}
		{#if activos.recientes}{@render bloqueRecientes()}{/if}
		{#if activos.orgs}{@render bloqueOrgs()}{/if}
		{#if activos.sugerencias}{@render bloqueSugerencias()}{/if}
		{#if !algoActivo}
			<p class="text-center text-xs text-muted-foreground">
				Sin bloques activos: así queda hoy, y el hueco antes del pie es lo que se ve pobre.
			</p>
		{/if}
	</div>
</div>
