<script lang="ts">
import { ArrowLeft, Download, ExternalLink, FileText } from "lucide-svelte";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createResourceApi } from "$lib/api/resources";
import type { BreadcrumbItem } from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { getMockDatasetById, getMockResourceById } from "$lib/mock/data";
import type { CkanExtra, CkanPackage, CkanResource } from "$lib/types/ckan";
import { formatDate, formatSize } from "$lib/utils/ckan";

// ─── State ───────────────────────────────────────────────────────
let resource = $state<CkanResource | null>(null);
let dataset = $state<CkanPackage | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);

// ─── Params from URL ─────────────────────────────────────────────
const datasetId = $derived($page.params.id);
const resourceId = $derived($page.params.resourceId);

// ─── Data fetching ───────────────────────────────────────────────
async function loadData() {
	if (!datasetId || !resourceId) {
		error = "Parámetros de navegación inválidos";
		loading = false;
		return;
	}

	loading = true;
	error = null;

	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL });
		const resourceApi = createResourceApi(client);
		const datasetApi = createDatasetApi(client);

		const [resourceResult, datasetResult] = await Promise.allSettled([
			resourceApi.show(resourceId),
			datasetApi.show(datasetId),
		]);

		if (resourceResult.status === "fulfilled") {
			resource = resourceResult.value;
		} else {
			// Fallback a mock data
			const mockResource = getMockResourceById(resourceId);
			if (mockResource) {
				resource = mockResource;
			} else {
				throw new Error("Recurso no encontrado");
			}
		}

		if (datasetResult.status === "fulfilled") {
			dataset = datasetResult.value;
		} else {
			const mockDataset = getMockDatasetById(datasetId);
			if (mockDataset) dataset = mockDataset;
		}
	} catch (err) {
		error = err instanceof Error ? err.message : "Error al cargar el recurso";
		resource = null;
	} finally {
		loading = false;
	}
}

// ─── Effect: load on mount ──────────────────────────────────────
$effect(() => {
	void datasetId;
	void resourceId;
	loadData();
});

// ─── Derived: breadcrumbs ──────────────────────────────────────
const breadcrumbItems = $derived.by((): BreadcrumbItem[] => {
	const items: BreadcrumbItem[] = [{ label: "Datasets", href: "/search" }];
	if (dataset?.organization?.title) {
		items.push({ label: dataset.organization.title });
	}
	if (dataset?.title || dataset?.name) {
		items.push({
			label: dataset.title || dataset.name,
			href: `/dataset/${datasetId}`,
		});
	}
	if (resource?.name) {
		items.push({ label: resource.name });
	}
	return items;
});

// ─── Derived: field list ───────────────────────────────────────
// Solo se muestran los metadatos con valor. Se omiten campos redundantes
// con el resto de la vista (nombre -> título, descripción -> su sección,
// url -> botón de descarga, hash -> sin valor útil) y las fechas, que se
// muestran debajo del título.
const fieldList = $derived.by(() => {
	if (!resource) return [];
	const fields: { label: string; value: string | null | undefined; raw: unknown }[] = [
		{ label: "Formato", value: resource.format, raw: resource.format },
		{ label: "Tamaño", value: formatSize(resource.size), raw: resource.size },
		{ label: "Tipo de recurso", value: resource.resource_type, raw: resource.resource_type },
		{ label: "Creado", value: formatDate(resource.created), raw: resource.created },
	];
	return fields.filter((f) => f.raw !== undefined && f.raw !== null && f.raw !== "");
});

// ─── Derived: API extras ───────────────────────────────────────
const apiExtras = $derived.by((): CkanExtra[] => {
	if (!resource?.extras) return [];
	const apiKeys = ["api_base_url", "docs_url", "example_request", "example_response"];
	return resource.extras.filter((e) => apiKeys.includes(e.key));
});

const hasApiExtras = $derived(apiExtras.length > 0);

const apiExtraLabel = (key: string): string => {
	const labels: Record<string, string> = {
		api_base_url: "Endpoint base",
		docs_url: "Documentación",
		example_request: "Ejemplo de solicitud",
		example_response: "Ejemplo de respuesta",
	};
	return labels[key] ?? key;
};
</script>

<svelte:head>
	<title>
		{resource ? `${resource.name} — UMSS` : loading ? "Cargando... — UMSS" : "Recurso no encontrado — UMSS"}
	</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Breadcrumb -->
	{#if !loading}
		<div class="mb-6">
			<Breadcrumb items={breadcrumbItems} />
		</div>
	{/if}

	<!-- Loading skeleton -->
	{#if loading}
		<div class="animate-pulse space-y-6">
			<div class="h-5 w-3/4 rounded bg-muted"></div>
			<div class="h-8 w-1/2 rounded-lg bg-muted"></div>
			<div class="space-y-2">
				<div class="h-4 w-full rounded bg-muted"></div>
				<div class="h-4 w-5/6 rounded bg-muted"></div>
				<div class="h-4 w-4/6 rounded bg-muted"></div>
			</div>
			<div class="space-y-2">
				<div class="h-8 rounded bg-muted"></div>
				<div class="h-8 rounded bg-muted"></div>
				<div class="h-8 rounded bg-muted"></div>
			</div>
			<div class="h-32 rounded-xl bg-muted"></div>
		</div>

	<!-- Error / 404 state -->
	{:else if error && !resource}
		<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
			<p class="text-lg font-medium text-destructive">Recurso no encontrado</p>
			<p class="mt-2 text-sm text-muted-foreground">{error}</p>
			<div class="mt-6 flex items-center justify-center gap-3">
				{#if datasetId}
					<a
						href={`/dataset/${datasetId}`}
						class="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
					>
						<ArrowLeft class="size-4" />
						Volver al dataset
					</a>
				{:else}
					<a
						href="/search"
						class="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
					>
						<ArrowLeft class="size-4" />
						Volver al catálogo
					</a>
				{/if}
			</div>
		</div>

	<!-- Resource content -->
	{:else if resource}
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center gap-3">
				<h1 class="font-heading text-3xl font-bold text-foreground sm:text-4xl">
					{resource.name || "Recurso"}
				</h1>
				{#if resource.state}
					<span
						class="rounded-full px-2.5 py-0.5 text-xs font-medium {resource.state === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/15 text-destructive'}"
					>
						{resource.state === "active" ? "Activo" : "Eliminado"}
					</span>
				{/if}
			</div>
			<div class="mt-3 h-1 w-16 rounded-full bg-primary/30"></div>
			{#if resource.last_modified}
				<div class="mt-3 text-sm text-muted-foreground">
					Actualizado el {formatDate(resource.last_modified)}
				</div>
			{/if}
		</div>

		<!-- Description -->
		{#if resource.description}
			<div class="mb-8">
				<h2 class="mb-3 font-heading text-lg font-semibold text-foreground">Descripción</h2>
				<p class="text-sm leading-relaxed text-muted-foreground">{resource.description}</p>
			</div>
		{/if}

		<!-- Field list -->
		{#if fieldList.length > 0}
			<div class="mb-8">
				<h2 class="mb-3 font-heading text-lg font-semibold text-foreground">Metadatos</h2>
				<Card>
					<div class="divide-y divide-border/50 p-4">
						{#each fieldList as field}
							<div class="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
								<span class="text-sm text-muted-foreground">{field.label}</span>
								<span class="text-sm font-medium text-foreground">
									{field.value}
								</span>
							</div>
						{/each}
					</div>
				</Card>
			</div>
		{/if}

		<!-- API metadata section -->
		{#if hasApiExtras}
			<div class="mb-8">
				<h2 class="mb-3 font-heading text-lg font-semibold text-foreground">API</h2>
				<Card>
					<div class="divide-y divide-border/50 p-4">
						{#each apiExtras as extra}
							<div class="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-start sm:justify-between">
								<span class="text-sm text-muted-foreground">{apiExtraLabel(extra.key)}</span>
								<span class="max-w-full break-all text-sm font-medium text-foreground">
									{#if extra.key === "docs_url" && extra.value}
										<a
											href={extra.value}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1 text-primary hover:underline"
										>
											{extra.value}
											<ExternalLink class="size-3.5" />
										</a>
									{:else}
										{extra.value}
									{/if}
								</span>
							</div>
						{/each}
					</div>
				</Card>
			</div>
		{/if}

		<!-- Download action -->
		{#if resource.url}
			<div class="mb-8">
				<a
					href={resource.url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
				>
					<Download class="size-4" />
					Descargar recurso
				</a>
			</div>
		{/if}

		<!-- Preview placeholder -->
		<div class="mb-8">
			<h2 class="mb-3 font-heading text-lg font-semibold text-foreground">Vista previa</h2>
			<div class="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
				<FileText class="mx-auto size-8 text-muted-foreground" />
				<p class="mt-2 text-sm font-medium text-muted-foreground">Próximamente</p>
				<p class="text-xs text-muted-foreground">
					La vista previa de datos estará disponible en una próxima versión.
				</p>
			</div>
		</div>

		<!-- Footer info -->
		<div class="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
			<p class="text-xs text-muted-foreground">
				ID: <code class="font-mono">{resource.id}</code>
				{#if resource.package_id}
					<span class="mx-2">·</span>
					Dataset: <code class="font-mono">{resource.package_id}</code>
				{/if}
				{#if resource.position !== undefined}
					<span class="mx-2">·</span>
					Posición: <code class="font-mono">{resource.position}</code>
					{/if}
			</p>
		</div>
	{/if}
</div>
