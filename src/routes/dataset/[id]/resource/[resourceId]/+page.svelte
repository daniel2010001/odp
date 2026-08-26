<script lang="ts">
import { ArrowLeft, Check, Copy, Download, ExternalLink, FileText, Layers } from "lucide-svelte";
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
import { cn } from "$lib/utils";
import { copyToClipboard } from "$lib/utils/citation";
import { formatDate, formatSize } from "$lib/utils/ckan";

// ─── State ───────────────────────────────────────────────────────
let resource = $state<CkanResource | null>(null);
let dataset = $state<CkanPackage | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);
let hashCopied = $state(false);
let endpointCopied = $state(false);

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

// ─── Derived: badges ────────────────────────────────────────────
const formatLabel = $derived(resource?.format?.trim().toUpperCase() ?? null);

const stateLabel = $derived.by(() => {
	switch (resource?.state) {
		case "active":
			return "Activo";
		case "deleted":
			return "Eliminado";
		default:
			return null;
	}
});

// ─── Derived: field list ───────────────────────────────────────
// Render every resource_show field that has a non-empty value.
// name/description/url/state/last_modified are rendered elsewhere.
const fieldList = $derived.by(() => {
	if (!resource) return [];
	const fields: { label: string; value: string | null | undefined; raw: unknown }[] = [
		{ label: "Formato", value: resource.format, raw: resource.format },
		{ label: "Tamaño", value: formatSize(resource.size), raw: resource.size },
		{ label: "Tipo MIME", value: resource.mimetype, raw: resource.mimetype },
		{ label: "Tipo de recurso", value: resource.resource_type, raw: resource.resource_type },
		{ label: "Creado", value: formatDate(resource.created), raw: resource.created },
		{ label: "Hash", value: resource.hash, raw: resource.hash },
	];
	return fields.filter((f) => f.raw !== undefined && f.raw !== null && f.raw !== "");
});

// Sidebar muestra los campos esenciales; la tabla de metadatos el listado completo.
const sidebarFields = $derived(
	fieldList.filter((f) => ["Formato", "Tamaño", "Tipo MIME", "Creado", "Hash"].includes(f.label)),
);

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

// Extras de API no contemplados en las cards (p.ej. api_key, datastore_active)
const apiExtraRows = $derived(
	apiExtras.filter(
		(e) => !["api_base_url", "docs_url", "example_request", "example_response"].includes(e.key),
	),
);

const apiBaseUrl = $derived(
	(apiExtras.find((e) => e.key === "api_base_url")?.value ?? env.CKAN_URL ?? "").replace(/\/$/, ""),
);

const apiEndpoint = $derived(
	resource ? `${apiBaseUrl}/api/3/action/resource_show?id=${resource.id}` : "",
);

const curlCommand = $derived.by(() => {
	if (!resource) return "";
	const extraRequest = apiExtras.find((e) => e.key === "example_request")?.value;
	if (extraRequest) return extraRequest;
	return [
		`curl -X POST ${apiBaseUrl}/api/3/action/resource_show \\`,
		`  -H "Content-Type: application/json" \\`,
		`  -d '{"id": "${resource.id}"}'`,
	].join("\n");
});

const exampleResponse = $derived(
	apiExtras.find((e) => e.key === "example_response")?.value ?? null,
);

const docsUrl = $derived(apiExtras.find((e) => e.key === "docs_url")?.value ?? null);

// ─── Actions ────────────────────────────────────────────────────
async function handleCopyHash() {
	if (!resource?.hash) return;
	const ok = await copyToClipboard(resource.hash);
	if (ok) {
		hashCopied = true;
		setTimeout(() => {
			hashCopied = false;
		}, 2000);
	}
}

async function handleCopyEndpoint() {
	const ok = await copyToClipboard(apiEndpoint);
	if (ok) {
		endpointCopied = true;
		setTimeout(() => {
			endpointCopied = false;
		}, 2000);
	}
}
</script>

<svelte:head>
	<title>
		{resource ? `${resource.name} — UMSS` : loading ? "Cargando... — UMSS" : "Recurso no encontrado — UMSS"}
	</title>
</svelte:head>

<div>
	<!-- Breadcrumb bar -->
	{#if !loading}
		<div class="border-b border-border bg-card">
			<div class="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
				<Breadcrumb items={breadcrumbItems} />
			</div>
		</div>
	{/if}

	<!-- Loading skeleton -->
	{#if loading}
		<div class="mx-auto max-w-7xl animate-pulse space-y-6 px-4 py-10 sm:px-6 lg:px-8">
			<div class="flex gap-2">
				<div class="h-7 w-28 rounded-md bg-muted"></div>
				<div class="h-7 w-20 rounded-md bg-muted"></div>
				<div class="h-7 w-32 rounded-md bg-muted"></div>
			</div>
			<div class="h-11 w-2/3 rounded-lg bg-muted"></div>
			<div class="h-4 w-1/3 rounded bg-muted"></div>
			<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div class="space-y-6">
					<div class="h-[420px] rounded-xl border border-border bg-card"></div>
					<div class="h-64 rounded-xl border border-border bg-card"></div>
					<div class="h-56 rounded-xl border border-border bg-card"></div>
				</div>
				<div class="space-y-6">
					<div class="h-64 rounded-xl border border-border bg-card"></div>
					<div class="h-20 rounded-xl border border-border bg-card"></div>
				</div>
			</div>
		</div>

	<!-- Error / 404 state -->
	{:else if error && !resource}
		<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
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
		</div>

	<!-- Resource content -->
	{:else if resource}
		<!-- Resource header -->
		<section class="border-b border-border bg-card">
			<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<!-- Badges row -->
				<div class="flex flex-wrap items-center gap-2">
					{#if formatLabel}
						<span
							class="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
						>
							<FileText class="size-3.5" />
							{formatLabel}
						</span>
					{/if}

					{#if stateLabel}
						<span
							class={cn(
								"inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
								resource.state === "active"
									? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
									: "border-destructive/20 bg-destructive/10 text-destructive",
							)}
						>
							<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
							{stateLabel}
						</span>
					{/if}

					{#if resource.mimetype}
						<span
							class="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground"
						>
							{resource.mimetype}
						</span>
					{/if}
				</div>

				<!-- Title -->
				<h1 class="mt-5 font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
					{resource.name || "Recurso"}
				</h1>

				<!-- Subtitle: updated -->
				{#if resource.last_modified}
					<div class="mt-3 text-sm text-muted-foreground">
						Actualizado el {formatDate(resource.last_modified)}
					</div>
				{/if}

				<!-- Description -->
				{#if resource.description}
					<p class="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
						{resource.description}
					</p>
				{/if}
			</div>
		</section>

		<!-- Preview content -->
		<section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
				<!-- Main: preview panel -->
				<div class="min-w-0">
					<Card class="overflow-hidden border-primary/20">
						<div class="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
							<p class="text-xs font-bold uppercase tracking-wider text-primary">Vista previa</p>
							<span
								class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground"
							>
								<Layers class="size-3.5" />
								Tabla
							</span>
						</div>
						<div class="flex min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
							<div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
								<FileText class="size-8 text-primary" />
							</div>
							<p class="font-heading text-xl font-bold text-foreground">Próximamente</p>
							<p class="max-w-md text-sm leading-relaxed text-muted-foreground">
								La vista previa de datos estará disponible en una próxima versión.
								{#if resource.format?.toLowerCase() === "csv"}
									Este recurso CSV podrá explorarse como tabla y gráficos.
								{/if}
							</p>
						</div>
					</Card>
				</div>

				<!-- Sidebar -->
				<aside class="min-w-0 space-y-6">
					<!-- Core info card -->
					{#if sidebarFields.length > 0}
						<Card class="p-5">
							<p class="text-xs font-bold uppercase tracking-wider text-primary">Información</p>
							<div class="mt-3 divide-y divide-border/60">
								{#each sidebarFields as field}
									<div class="flex items-start justify-between gap-3 py-2.5">
										<span class="text-xs text-muted-foreground">{field.label}</span>
										<span class="break-all text-right text-xs font-semibold text-foreground">
											{field.value}
										</span>
									</div>
								{/each}
							</div>
						</Card>
					{/if}

					<!-- Hash card -->
					{#if resource.hash}
						<Card class="p-5">
							<div class="flex items-center justify-between">
								<p class="text-xs font-bold uppercase tracking-wider text-primary">Hash</p>
								<button
									type="button"
									onclick={handleCopyHash}
									aria-label="Copiar hash"
									title="Copiar hash al portapapeles"
									class="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								>
									{#if hashCopied}
										<Check class="size-3.5 text-emerald-600" />
									{:else}
										<Copy class="size-3.5" />
									{/if}
								</button>
							</div>
							<code class="mt-3 block break-all font-mono text-xs text-foreground">
								{resource.hash}
							</code>
						</Card>
					{/if}

					<!-- Download action -->
					{#if resource.url}
						<a
							href={resource.url}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90"
						>
							<Download class="size-4" />
							Descargar recurso
						</a>
					{/if}
				</aside>
			</div>
		</section>

		<!-- API content -->
		<section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div>
				<p class="text-xs font-bold uppercase tracking-wider text-primary">API · Endpoint</p>
				<h2 class="mt-1 font-heading text-2xl font-bold text-foreground">Accedé por API</h2>
				<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Usá estos endpoints para acceder programáticamente a los datos del recurso.
				</p>
			</div>

			<div class="mt-4 space-y-4">
				<!-- Endpoint card -->
				<Card class="p-5">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<p class="text-sm font-semibold text-foreground">Endpoint</p>
						<button
							type="button"
							onclick={handleCopyEndpoint}
							class="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
						>
							{#if endpointCopied}
								<Check class="size-3.5 text-emerald-600" />
								Copiado
							{:else}
								<Copy class="size-3.5" />
								Copiar URL
							{/if}
						</button>
					</div>
					<div class="mt-3 overflow-x-auto rounded-lg bg-foreground px-4 py-3">
						<code class="break-all font-mono text-xs text-background">{apiEndpoint}</code>
					</div>
					{#if docsUrl}
						<a
							href={docsUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline"
						>
							<ExternalLink class="size-3.5" />
							Ver documentación de la API
						</a>
					{/if}
					{#if apiExtraRows.length > 0}
						<div class="mt-4 divide-y divide-border/60 border-t border-border/60">
							{#each apiExtraRows as extra}
								<div class="flex items-start justify-between gap-3 py-2.5">
									<span class="text-xs text-muted-foreground">{apiExtraLabel(extra.key)}</span>
									<span class="break-all text-right text-xs font-medium text-foreground">
										{extra.value}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</Card>

				<!-- Curl card -->
				<Card class="p-5">
					<p class="text-xs font-bold uppercase tracking-wider text-primary">
						Ejemplo de consulta · curl
					</p>
					<p class="mt-1 text-sm text-muted-foreground">Obtené los metadatos del recurso.</p>
					<div class="mt-3 overflow-x-auto rounded-lg bg-foreground p-4">
						<pre class="font-mono text-xs leading-relaxed text-background"><code>{curlCommand}</code></pre>
					</div>
					{#if exampleResponse}
						<p class="mt-4 text-xs font-bold uppercase tracking-wider text-primary">Respuesta</p>
						<div class="mt-1 overflow-x-auto rounded-lg bg-foreground p-4">
							<pre class="font-mono text-xs leading-relaxed text-background"><code>{exampleResponse}</code></pre>
						</div>
					{/if}
				</Card>
			</div>
		</section>

		<!-- Metadata content -->
		<section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div>
				<p class="text-xs font-bold uppercase tracking-wider text-primary">
					Metadatos · Información técnica
				</p>
				<h2 class="mt-1 font-heading text-2xl font-bold text-foreground">Sobre este recurso</h2>
				<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Detalles técnicos del archivo: formato, tamaño, tipo MIME y otros metadatos.
				</p>
			</div>

			{#if fieldList.length > 0}
				<Card class="mt-4 overflow-hidden">
					<div
						class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 bg-muted/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground"
					>
						<span>Campo</span>
						<span>Valor</span>
					</div>
					<div class="divide-y divide-border/60">
						{#each fieldList as field}
							<div
								class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 px-4 py-3 text-sm"
							>
								<span class="text-muted-foreground">{field.label}</span>
								<span class="break-all font-medium text-foreground">{field.value}</span>
							</div>
						{/each}
						{#if resource.last_modified}
							<div
								class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 px-4 py-3 text-sm"
							>
								<span class="text-muted-foreground">Modificado</span>
								<span class="break-all font-medium text-foreground">
									{formatDate(resource.last_modified)}
								</span>
							</div>
						{/if}
					</div>
				</Card>
			{/if}

			<!-- Footer info -->
			<div class="mt-6 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
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
		</section>
	{/if}
</div>
