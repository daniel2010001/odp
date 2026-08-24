<script lang="ts">
import { onMount } from "svelte";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi, type DatasetApi } from "$lib/api/datasets";
import { createOrganizationApi } from "$lib/api/organizations";
import OrganizationCard from "$lib/components/organizations/OrganizationCard.svelte";
import { env } from "$lib/env";
import { getMockOrgs } from "$lib/mock/data";
import type { CkanOrganization } from "$lib/types/ckan";

type OrgItem = { org: CkanOrganization; count: number };

// ─── State ───────────────────────────────────────────────────────
let items = $state<OrgItem[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);

// ─── Resolver count: package_count ?? derivado desde datasets ─────
async function resolveCount(datasetApi: DatasetApi, org: CkanOrganization): Promise<number> {
	if (org.package_count !== undefined) return org.package_count;
	try {
		const { count } = await datasetApi.byOrganization(org.name, { limit: 0 });
		return count;
	} catch {
		return 0;
	}
}

// ─── Cargar organizaciones (CKAN → mock fallback) ────────────────
async function loadOrgs() {
	loading = true;
	error = null;
	items = [];

	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const orgApi = createOrganizationApi(client);
		const datasetApi = createDatasetApi(client);

		let orgs: CkanOrganization[];
		try {
			orgs = await orgApi.list();
		} catch {
			orgs = getMockOrgs();
		}

		items = await Promise.all(
			orgs.map(async (org) => ({ org, count: await resolveCount(datasetApi, org) })),
		);
	} catch (err) {
		error = err instanceof Error ? err.message : "Error al cargar las organizaciones";
	} finally {
		loading = false;
	}
}

onMount(() => {
	loadOrgs();
});
</script>

<svelte:head>
	<title>Organizaciones — UMSS</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="font-heading text-2xl font-semibold text-primary sm:text-3xl">
			Organizaciones
		</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Explorá las organizaciones que publican datasets en la plataforma
		</p>
	</div>

	<!-- Loading skeleton -->
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

	<!-- Error -->
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

	<!-- Empty -->
	{:else if items.length === 0}
		<div class="rounded-xl border border-border bg-card p-12 text-center">
			<p class="text-lg font-medium text-primary">No hay organizaciones disponibles</p>
			<p class="mt-2 text-sm text-muted-foreground">
				Volvé más tarde para ver las organizaciones que publican datos.
			</p>
		</div>

	<!-- Grid -->
	{:else}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each items as { org, count } (org.id)}
				<OrganizationCard {org} {count} />
			{/each}
		</div>
	{/if}
</div>
