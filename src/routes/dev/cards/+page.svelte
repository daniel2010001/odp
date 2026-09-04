<script lang="ts">
import { onMount } from "svelte";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import DatasetCardMockup from "$lib/components/search/DatasetCardMockup.svelte";
import { env } from "$lib/env";
import { getMockSearchResult } from "$lib/mock/data";
import type { CkanPackage } from "$lib/types/ckan";

let datasets = $state<CkanPackage[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);

onMount(async () => {
	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const datasetApi = createDatasetApi(client);
		const result = await datasetApi.search({ limit: 6 });
		datasets = result.results;
	} catch (err) {
		try {
			const mock = getMockSearchResult();
			datasets = mock.results.slice(0, 6);
		} catch {
			error = err instanceof Error ? err.message : "Error al cargar datasets";
		}
	} finally {
		loading = false;
	}
});
</script>

<svelte:head>
	<title>Comparación de cards — Datos UMSS</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
	<div class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
		<p class="font-semibold">Vista temporal de comparación de cards (no forma parte del producto).</p>
		<p class="mt-1">
			Cada dataset se muestra dos veces con los mismos datos: la card actual a la izquierda y la
			implementación del mockup OpenPencil a la derecha.
		</p>
	</div>

	{#if error}
		<p class="mt-6 text-sm text-destructive">{error}</p>
	{:else if loading}
		<p class="mt-6 text-sm text-muted-foreground">Cargando datasets...</p>
	{:else}
		<div class="mt-8 space-y-12">
			{#each datasets as dataset (dataset.id)}
				<div>
					<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{dataset.title || dataset.name}
					</p>
					<div class="grid gap-8 lg:grid-cols-2">
						<div>
							<p class="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
								Actual — DatasetCard
							</p>
							<DatasetCard {dataset} />
						</div>
						<div>
							<p class="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-destructive">
								Mockup OpenPencil — DatasetCardMockup
							</p>
							<DatasetCardMockup {dataset} />
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
