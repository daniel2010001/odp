<script lang="ts">
import { onMount } from "svelte";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import DatasetCardMockup from "$lib/components/search/DatasetCardMockup.svelte";
import DatasetCardV2 from "$lib/components/search/DatasetCardV2.svelte";
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
		const result = await datasetApi.search({ limit: 4 });
		datasets = result.results;
	} catch (err) {
		try {
			const mock = getMockSearchResult();
			datasets = mock.results.slice(0, 4);
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

<section class="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
	<div
		class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
	>
		<p class="font-semibold">Vista temporal de comparación de cards (no forma parte del producto).</p>
		<p class="mt-1">
			Cada dataset se muestra en tres variantes apiladas con el mismo ancho: actual, v2 (fusión) y
			mockup OpenPencil — así se comparan los footers en igualdad de condiciones.
		</p>
	</div>

	{#if error}
		<p class="mt-6 text-sm text-destructive">{error}</p>
	{:else if loading}
		<p class="mt-6 text-sm text-muted-foreground">Cargando datasets...</p>
	{:else}
		<div class="mt-8 space-y-14">
			{#each datasets as dataset (dataset.id)}
				<div>
					<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{dataset.title || dataset.name}
					</p>
					<div class="space-y-6">
						<div>
							<p class="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
								1 · Actual — DatasetCard
							</p>
							<DatasetCard {dataset} />
						</div>
						<div>
							<p class="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-destructive">
								2 · Fusión propuesta — DatasetCardV2
							</p>
							<DatasetCardV2 {dataset} />
						</div>
						<div>
							<p class="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
								3 · Mockup OpenPencil — DatasetCardMockup
							</p>
							<DatasetCardMockup {dataset} />
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
