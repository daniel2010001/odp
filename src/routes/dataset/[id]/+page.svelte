<script lang="ts">
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import ResourceCard from "$lib/components/dataset/ResourceCard.svelte";
import { env } from "$lib/env";
import { getMockDatasetById } from "$lib/mock/data";
import type { CkanPackage } from "$lib/types/ckan";
import { formatDate } from "$lib/utils/ckan";
import { ArrowLeft, Building2, Calendar, Clock, Tag, User, Shield } from "lucide-svelte";

// ─── State ───────────────────────────────────────────────────────
let dataset = $state<CkanPackage | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);

// ─── ID from URL ────────────────────────────────────────────────
const datasetId = $derived($page.params.id);

// ─── Data fetching ───────────────────────────────────────────────
async function loadDataset() {
	if (!datasetId) {
		error = "ID de dataset no especificado";
		loading = false;
		return;
	}

	loading = true;
	error = null;

	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const datasetApi = createDatasetApi(client);
		dataset = await datasetApi.show(datasetId);
	} catch (err) {
		// Fallback a mock data
		const mock = getMockDatasetById(datasetId);
		if (mock) {
			dataset = mock;
		} else {
			error = err instanceof Error ? err.message : "Error al cargar el dataset";
			dataset = null;
		}
	} finally {
		loading = false;
	}
}

// ─── Effect: load on mount ───────────────────────────────────────
$effect(() => {
	void datasetId;
	loadDataset();
});

// ─── Derived ─────────────────────────────────────────────────────
const description = $derived(
	dataset?.notes ? dataset.notes.replace(/<[^>]*>/g, "").trim() : null,
);

const activeResources = $derived(
	dataset?.resources?.filter((r) => r.state === "active" || !r.state) ?? [],
);

const metadataItems = $derived.by(() => {
	if (!dataset) return [];
	const items: { icon: typeof Calendar; label: string; value: string }[] = [];

	items.push({
		icon: Calendar,
		label: "Creado",
		value: formatDate(dataset.metadata_created),
	});
	items.push({
		icon: Clock,
		label: "Modificado",
		value: formatDate(dataset.metadata_modified),
	});

	if (dataset.license_title) {
		items.push({ icon: Shield, label: "Licencia", value: dataset.license_title });
	} else if (dataset.license_id) {
		items.push({ icon: Shield, label: "Licencia", value: dataset.license_id });
	}

	if (dataset.author) {
		items.push({ icon: User, label: "Autor", value: dataset.author });
	}
	if (dataset.maintainer) {
		items.push({ icon: User, label: "Mantenedor", value: dataset.maintainer });
	}

	return items;
});
</script>

<svelte:head>
	<title>
		{dataset ? `${dataset.title || dataset.name} — UMSS` : "Cargando... — UMSS"}
	</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Back link -->
	<a
		href="/search"
		class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="size-4" />
		Volver al catálogo
	</a>

	<!-- Loading skeleton -->
	{#if loading}
		<div class="animate-pulse space-y-6">
			<div class="h-8 w-3/4 rounded-lg bg-muted"></div>
			<div class="flex gap-2">
				<div class="h-5 w-32 rounded-full bg-muted"></div>
				<div class="h-5 w-20 rounded-full bg-muted"></div>
			</div>
			<div class="space-y-2">
				<div class="h-4 w-full rounded bg-muted"></div>
				<div class="h-4 w-5/6 rounded bg-muted"></div>
				<div class="h-4 w-4/6 rounded bg-muted"></div>
			</div>
			<div class="h-32 rounded-lg bg-muted"></div>
			<div class="space-y-3">
				<div class="h-16 rounded-lg bg-muted"></div>
				<div class="h-16 rounded-lg bg-muted"></div>
				<div class="h-16 rounded-lg bg-muted"></div>
			</div>
		</div>

	<!-- Error state -->
	{:else if error && !dataset}
		<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
			<p class="text-lg font-medium text-destructive">Error al cargar el dataset</p>
			<p class="mt-2 text-sm text-muted-foreground">{error}</p>
			<div class="mt-6 flex items-center justify-center gap-3">
				<a
					href="/search"
					class="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
				>
					<ArrowLeft class="size-4" />
					Volver al catálogo
				</a>
				<button
					onclick={() => loadDataset()}
					class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Reintentar
				</button>
			</div>
		</div>

	<!-- Dataset content -->
	{:else if dataset}
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-start gap-3">
				<h1 class="text-2xl font-bold text-foreground sm:text-3xl">
					{dataset.title || dataset.name}
				</h1>
				{#if dataset.private}
					<span
						class="mt-1.5 shrink-0 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800"
					>
						Privado
					</span>
				{/if}
			</div>

			<!-- Organization badge -->
			{#if dataset.organization}
				<div class="mt-3 flex items-center gap-2">
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
					>
						<Building2 class="size-4" />
						{dataset.organization.title}
					</span>
				</div>
			{/if}
		</div>

		<!-- Description -->
		{#if description}
			<div class="mb-8">
				<h2 class="mb-2 text-sm font-semibold text-foreground">Descripción</h2>
				<p class="text-sm leading-relaxed text-muted-foreground">{description}</p>
			</div>
		{/if}

		<!-- Metadata grid -->
		{#if metadataItems.length > 0}
			<div class="mb-8">
				<h2 class="mb-3 text-sm font-semibold text-foreground">Metadatos</h2>
				<div class="grid gap-2 sm:grid-cols-2">
					{#each metadataItems as item}
						<div class="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5">
							<item.icon class="size-4 shrink-0 text-muted-foreground" />
							<div class="min-w-0">
								<p class="text-xs text-muted-foreground">{item.label}</p>
								<p class="truncate text-sm font-medium text-foreground">{item.value}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Tags -->
		{#if dataset.tags && dataset.tags.length > 0}
			<div class="mb-8">
				<h2 class="mb-3 text-sm font-semibold text-foreground">Etiquetas</h2>
				<div class="flex flex-wrap gap-2">
					{#each dataset.tags as tag}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
						>
							<Tag class="size-3" />
							{tag.display_name || tag.name}
						</span>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Resources -->
		<div class="mb-8">
			<h2 class="mb-3 text-sm font-semibold text-foreground">
				Recursos
				{#if activeResources.length > 0}
					<span class="font-normal text-muted-foreground">({activeResources.length})</span>
				{/if}
			</h2>

			{#if activeResources.length === 0}
				<p class="text-sm text-muted-foreground">Este dataset no tiene recursos disponibles.</p>
			{:else}
				<div class="space-y-2">
					{#each activeResources as resource (resource.id)}
						<ResourceCard {resource} />
					{/each}
				</div>
			{/if}
		</div>

		<!-- Dataset ID info -->
		<div class="rounded-lg border bg-muted/30 px-4 py-3">
			<p class="text-xs text-muted-foreground">
				ID del dataset: <code class="font-mono">{dataset.id}</code>
				<span class="mx-2">·</span>
				Slug: <code class="font-mono">{dataset.name}</code>
			</p>
		</div>
	{/if}
</div>
