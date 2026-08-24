<script lang="ts">
import { ArrowLeft, Database } from "lucide-svelte";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createOrganizationApi } from "$lib/api/organizations";
import OrganizationLogo from "$lib/components/organizations/OrganizationLogo.svelte";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import { env } from "$lib/env";
import { getMockDatasetsByOrg, getMockOrgById } from "$lib/mock/data";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";

// ─── State ───────────────────────────────────────────────────────
let org = $state<CkanOrganization | null>(null);
let datasets = $state<CkanPackage[]>([]);
let loading = $state(true);
let notFound = $state(false);
let error = $state<string | null>(null);

// ─── ID (slug o id) desde la URL ────────────────────────────────
const orgId = $derived($page.params.id);

// ─── Data fetching ───────────────────────────────────────────────
async function loadOrg() {
	if (!orgId) {
		error = "ID de organización no especificado";
		loading = false;
		return;
	}

	loading = true;
	error = null;
	notFound = false;
	org = null;
	datasets = [];

	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const orgApi = createOrganizationApi(client);
		const datasetApi = createDatasetApi(client);

		// 1. Resolver organización: CKAN → mock fallback
		let resolvedOrg: CkanOrganization | undefined;
		try {
			resolvedOrg = await orgApi.show(orgId);
		} catch {
			resolvedOrg = getMockOrgById(orgId);
		}

		if (!resolvedOrg) {
			notFound = true;
			return;
		}

		org = resolvedOrg;

		// 2. Datasets: CKAN → mock fallback (usa el slug canónico)
		try {
			const result = await datasetApi.byOrganization(resolvedOrg.name);
			datasets = result.results;
		} catch {
			datasets = getMockDatasetsByOrg(orgId);
		}
	} catch (err) {
		error = err instanceof Error ? err.message : "Error al cargar la organización";
	} finally {
		loading = false;
	}
}

// ─── Effect: load on mount / on param change ─────────────────────
$effect(() => {
	void orgId;
	loadOrg();
});

// ─── Derived ─────────────────────────────────────────────────────
const title = $derived(org ? org.title || org.name : "");
const description = $derived(
	org?.description ? org.description.replace(/<[^>]*>/g, "").trim() : null,
);
const datasetCount = $derived(datasets.length);
</script>

<svelte:head>
	<title>
		{org ? `${title} — UMSS` : "Cargando... — UMSS"}
	</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Back link -->
	<a
		href="/organizations"
		class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="size-4" />
		Volver a organizaciones
	</a>

	<!-- Loading skeleton -->
	{#if loading}
		<div class="animate-pulse space-y-6">
			<div class="flex items-start gap-4">
				<div class="size-12 rounded-lg bg-muted"></div>
				<div class="flex-1 space-y-2">
					<div class="h-8 w-3/4 rounded-lg bg-muted"></div>
					<div class="h-1 w-16 rounded-full bg-muted"></div>
					<div class="h-4 w-full rounded bg-muted"></div>
					<div class="h-4 w-5/6 rounded bg-muted"></div>
				</div>
			</div>
			<div class="space-y-3">
				<div class="h-16 rounded-lg bg-muted"></div>
				<div class="h-16 rounded-lg bg-muted"></div>
				<div class="h-16 rounded-lg bg-muted"></div>
			</div>
		</div>

	<!-- Not found -->
	{:else if notFound}
		<div class="rounded-xl border border-border bg-card p-12 text-center">
			<p class="text-lg font-medium text-primary">Organización no encontrada</p>
			<p class="mt-2 text-sm text-muted-foreground">
				No encontramos una organización con el identificador "{orgId}".
			</p>
			<div class="mt-6 flex items-center justify-center gap-3">
				<a
					href="/organizations"
					class="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
				>
					<ArrowLeft class="size-4" />
					Ver organizaciones
				</a>
				<button
					onclick={() => loadOrg()}
					class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Reintentar
				</button>
			</div>
		</div>

	<!-- Error -->
	{:else if error && !org}
		<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center">
			<p class="text-lg font-medium text-destructive">Error al cargar la organización</p>
			<p class="mt-2 text-sm text-muted-foreground">{error}</p>
			<div class="mt-6 flex items-center justify-center gap-3">
				<a
					href="/organizations"
					class="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
				>
					<ArrowLeft class="size-4" />
					Volver a organizaciones
				</a>
				<button
					onclick={() => loadOrg()}
					class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Reintentar
				</button>
			</div>
		</div>

	<!-- Org content -->
	{:else if org}
		<!-- Header -->
		<div class="mb-8 flex items-start gap-4">
			<OrganizationLogo imageUrl={org.image_url} name={title} />

			<div class="min-w-0 flex-1">
				<h1 class="font-heading text-3xl font-bold text-foreground sm:text-4xl">
					{title}
				</h1>
				<div class="mt-3 h-1 w-16 rounded-full bg-primary/30"></div>

				{#if description}
					<p class="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
				{/if}

				<div class="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
					<Database class="size-3.5" />
					<span>{datasetCount} dataset{datasetCount === 1 ? "" : "s"}</span>
				</div>
			</div>
		</div>

		<!-- Datasets -->
		<div>
			<h2 class="mb-3 font-heading text-lg font-semibold text-foreground">
				Datasets
				{#if datasetCount > 0}
					<span class="font-normal text-muted-foreground">({datasetCount})</span>
				{/if}
			</h2>

			{#if datasetCount === 0}
				<p class="text-sm text-muted-foreground">
					Esta organización no tiene datasets publicados.
				</p>
			{:else}
				<div class="space-y-4">
					{#each datasets as dataset (dataset.id)}
						<DatasetCard {dataset} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
