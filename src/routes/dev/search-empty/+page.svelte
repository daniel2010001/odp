<!--
	Playground del vacío del buscador — superficie sólo para desarrollo (`/dev/search-empty`).

	El problema medido: cuando una búsqueda no devuelve nada, el contenido propio de la página son **192 px**
	(el bloque «Sin resultados») dentro de una página de 1310 px en 1280×800, así que queda un hueco antes
	del pie. La propuesta del autor es **agregar contenido** al vacío —datasets recomendados, organizaciones—
	y comparó con lo que hacen Amazon, YouTube o Google.

	La hoja muestra el vacío de hoy y **cuatro formas de llenarlo**, en el mismo ancho de contenido que la
	página real. Los `DatasetCard` y los `OrganizationCard` son los **componentes reales** con las fixtures
	del repo; el bloque del vacío es una **copia** rotulada del que vive en `search/+page.svelte`, y los chips
	de la opción D también. Lo que se apruebe se promueve y esta hoja se borra.
-->
<script lang="ts">
import OrganizationCard from "$lib/components/organizations/OrganizationCard.svelte";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import { MOCK_DATASETS, MOCK_ORGS } from "$lib/mock/data";

const recientes = MOCK_DATASETS.slice(0, 3);
const orgs = MOCK_ORGS.slice(0, 3);
// Sugerencias: lo que hoy el catálogo tiene de sobra. En la promoción saldrían de las facetas que el
// buscador ya trae, no de una lista escrita a mano.
const SUGERENCIAS = ["CSV", "PDF", "salud", "educación", "movilidad", "encuestas"];
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

<div class="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
	<header class="space-y-2">
		<h1 class="font-heading text-2xl font-bold text-primary">El vacío del buscador</h1>
		<p class="max-w-3xl text-sm leading-relaxed text-muted-foreground">
			El bloque del vacío mide <strong>192 px</strong> en una página de <strong>1310</strong> (1280×800):
			eso es el hueco. Abajo, cuatro formas de llenarlo. Los cards son los componentes reales.
		</p>
	</header>

	<section class="space-y-3">
		<h2 class="text-xs font-bold uppercase tracking-[0.14em] text-destructive">Hoy</h2>
		<p class="text-sm text-muted-foreground">Sólo el aviso. Es lo que hoy deja el hueco.</p>
		{@render vacio()}
	</section>

	<section class="space-y-3">
		<h2 class="text-xs font-bold uppercase tracking-[0.14em] text-destructive">
			A · Mientras tanto, lo más reciente
		</h2>
		<p class="text-sm text-muted-foreground">
			Tres datasets publicados recientemente. Reusa la card real; necesita una consulta más al API.
		</p>
		<div class="space-y-4">
			{@render vacio()}
			<div class="space-y-4">
				<h3 class="font-heading text-lg font-semibold text-primary">Mientras tanto, lo más reciente</h3>
				{#each recientes as dataset (dataset.id)}
					<DatasetCard {dataset} />
				{/each}
			</div>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xs font-bold uppercase tracking-[0.14em] text-destructive">
			B · Explorar por organización
		</h2>
		<p class="text-sm text-muted-foreground">
			El bloque de organizaciones del home, con las mismas cards.
		</p>
		<div class="space-y-6">
			{@render vacio()}
			<div class="space-y-4">
				<h3 class="font-heading text-lg font-semibold text-primary">Explorar por organización</h3>
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each orgs as org (org.id)}
						<OrganizationCard
							{org}
							count={org.package_count ?? 0}
							href={`/organization/${encodeURIComponent(org.name)}`}
						/>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xs font-bold uppercase tracking-[0.14em] text-destructive">C · A + B</h2>
		<p class="text-sm text-muted-foreground">
			Los dos bloques: es lo más parecido a lo que hacen las plataformas que citaste, que ante un vacío
			ofrecen una salida.
		</p>
		<div class="space-y-6">
			{@render vacio()}
			<div class="space-y-4">
				<h3 class="font-heading text-lg font-semibold text-primary">Mientras tanto, lo más reciente</h3>
				{#each recientes as dataset (dataset.id)}
					<DatasetCard {dataset} />
				{/each}
			</div>
			<div class="space-y-4">
				<h3 class="font-heading text-lg font-semibold text-primary">Explorar por organización</h3>
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each orgs as org (org.id)}
						<OrganizationCard
							{org}
							count={org.package_count ?? 0}
							href={`/organization/${encodeURIComponent(org.name)}`}
						/>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="text-xs font-bold uppercase tracking-[0.14em] text-destructive">
			D · Búsquedas sugeridas
		</h2>
		<p class="text-sm text-muted-foreground">
			Chips con lo que el catálogo tiene de sobra, que llevan a un buscador ya filtrado. La más barata: no
			necesita cards ni consulta nueva. <em>Copia</em>: en la promoción saldrían de las facetas existentes.
		</p>
		<div class="space-y-4">
			{@render vacio()}
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
		</div>
	</section>
</div>
