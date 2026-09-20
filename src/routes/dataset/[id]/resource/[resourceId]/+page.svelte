<script lang="ts">
import {
	ArrowLeft,
	ChartBar,
	Check,
	Copy,
	Download,
	ExternalLink,
	FileText,
	Link2,
	Map as MapIcon,
	Table,
} from "@lucide/svelte";
import { get } from "svelte/store";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createDatastoreApi } from "$lib/api/datastore";
import {
	type AccessContext,
	classifyFailure,
	describeFailure,
	type FailurePresentation,
	failureActions,
	isDefinitive,
} from "$lib/api/failure";
import { createResourceApi } from "$lib/api/resources";
import ResourcePreview from "$lib/components/resource/ResourcePreview.svelte";
import type { BreadcrumbItem } from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { getMockDatasetById, getMockResourceById } from "$lib/mock/data";
import { loginUrl } from "$lib/session";
import { resolveUnauthorized, type UnauthorizedResolution } from "$lib/session-guard";
import { auth } from "$lib/stores/auth";
import type { CkanExtra, CkanPackage, CkanResource } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { copyToClipboard } from "$lib/utils/citation";
import { formatDate, formatSize } from "$lib/utils/ckan";
import { safeExternalUrl } from "$lib/utils/external-url";

// Cliente del DataStore para la vista previa de CSV (RF-31).
const datastoreApi = createDatastoreApi(createCkanClient({ baseUrl: env.CKAN_URL }));

/** Fallo del catálogo con el contexto de sesión que le da sentido al texto. */
type ResourceFailure = {
	presentation: FailurePresentation;
	access: AccessContext;
};

// ─── State ───────────────────────────────────────────────────────
let resource = $state<CkanResource | null>(null);
let dataset = $state<CkanPackage | null>(null);
let loading = $state(true);
let failure = $state<ResourceFailure | null>(null);

// Una URL incompleta es un estado propio, no un fallo del catálogo: reintentar no puede arreglar
// una dirección mal formada, así que se ofrece sólo el enlace de vuelta y la página no afirma nada
// sobre el catálogo que no haya medido. Modelarla como `failure` sería inventar un diagnóstico.
let invalidParams = $state(false);

// El camino único de expulsión ya limpió la sesión y navegó: no se renderiza nada más ni se
// vuelve a navegar.
let expelled = $state(false);

let endpointCopied = $state(false);
let copiedLink = $state(false);

// Vistas simuladas de la previsualización (RF-30: PDF/imagen/TXT/JSON; RF-31: tabla CSV).
const previewViews = [
	{ id: "tabla", label: "Tabla", icon: Table },
	{ id: "grafico", label: "Gráfico", icon: ChartBar },
	{ id: "mapa", label: "Mapa", icon: MapIcon },
];
let previewView = $state("tabla");
let hashCopied = $state(false);

// ─── Params from URL ─────────────────────────────────────────────
const datasetId = $derived($page.params.id);
const resourceId = $derived($page.params.resourceId);

// ─── Data fetching ───────────────────────────────────────────────
async function loadData() {
	if (!datasetId || !resourceId) {
		// URL incompleta: estado propio, no un fallo del catálogo (ver el comentario de `invalidParams`).
		invalidParams = true;
		failure = null;
		resource = null;
		dataset = null;
		loading = false;
		return;
	}

	invalidParams = false;
	expelled = false;
	loading = true;
	failure = null;
	resource = null;
	dataset = null;

	const token = get(auth).token;
	// El cliente lleva el token de la sesión. Sin él, `resource_show` de un recurso de un dataset
	// privado responde 403 incluso para su propio dueño.
	const client = createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token });
	const resourceApi = createResourceApi(client);
	const datasetApi = createDatasetApi(client);

	// `allSettled` a propósito: una falla del dataset no debe vaciar un recurso que sí cargó, ni al
	// revés. El recurso manda; el dataset sólo alimenta el breadcrumb.
	const [resourceResult, datasetResult] = await Promise.allSettled([
		resourceApi.show(resourceId),
		datasetApi.show(datasetId),
	]);

	if (resourceResult.status === "fulfilled") {
		resource = resourceResult.value;
	} else {
		const err = resourceResult.reason;
		// Sólo se sondea ante un 403 con token. Sin token el espectador es anónimo, y sondear
		// `user_show {}` respondería 404 (medido), etiquetándolo como una sesión muerta que no es.
		let access: AccessContext = "anonymous";
		if (classifyFailure(err) === "unauthorized" && token) {
			let resolution: UnauthorizedResolution = "inconclusive";
			try {
				resolution = await resolveUnauthorized(client, err, token, $page.url.pathname);
			} catch {
				// Una navegación que falla no expulsa: ante la duda, la sesión queda intacta.
				resolution = "inconclusive";
			}
			if (resolution === "expelled") {
				// El camino único ya limpió la sesión y navegó: acá termina la carga.
				expelled = true;
				loading = false;
				return;
			}
			access = resolution === "alive" ? "session-alive" : "unknown";
		}

		const presentation = describeFailure(err, "resource", access);

		if (!presentation.definitive && import.meta.env.DEV) {
			// Sólo una no-respuesta se enmascara con datos mock. Un 403/404 es la respuesta final del
			// catálogo y enmascararlo es el defecto que este slice corrige.
			const mockResource = getMockResourceById(resourceId);
			if (mockResource) {
				resource = mockResource;
			} else {
				failure = { presentation, access };
			}
		} else {
			failure = { presentation, access };
		}
	}

	// El dataset alimenta el breadcrumb: una respuesta definitiva no se enmascara y el breadcrumb
	// simplemente degrada; sólo una no-respuesta puede caer al mock en DEV.
	if (datasetResult.status === "fulfilled") {
		dataset = datasetResult.value;
	} else {
		dataset =
			!isDefinitive(classifyFailure(datasetResult.reason)) && import.meta.env.DEV
				? (getMockDatasetById(datasetId) ?? null)
				: null;
	}

	loading = false;
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

// ─── Derived: estado de error ────────────────────────────────
// Las acciones se deciden en `failureActions` para que la página no vuelva a derivar la regla.
const actions = $derived(
	failure ? failureActions(failure.presentation, failure.access) : { retry: false, signIn: false },
);

const errorTitle = $derived(
	invalidParams ? "Parámetros de navegación inválidos" : (failure?.presentation.title ?? ""),
);

const errorMessage = $derived(
	invalidParams
		? "La dirección no contiene un dataset y un recurso válidos."
		: (failure?.presentation.message ?? ""),
);

const pageTitle = $derived.by(() => {
	if (resource) return `${resource.name} — UMSS`;
	if (loading) return "Cargando... — UMSS";
	if (failure) return `${failure.presentation.title} — UMSS`;
	if (invalidParams) return "Parámetros de navegación inválidos — UMSS";
	return "Recurso — UMSS";
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
	// CKAN no expone un campo `filename` nativo: se deriva del último segmento de la URL.
	const urlPath = (resource.url ?? "").split("?")[0].split("#")[0];
	const filename = urlPath.split("/").filter(Boolean).pop() ?? null;
	const fields: { label: string; value: string | null | undefined; raw: unknown }[] = [
		{ label: "Nombre del archivo", value: filename, raw: filename },
		{ label: "Formato", value: resource.format, raw: resource.format },
		{ label: "Tamaño", value: formatSize(resource.size), raw: resource.size },
		{ label: "Tipo MIME", value: resource.mimetype, raw: resource.mimetype },
		{ label: "Tipo de recurso", value: resource.resource_type, raw: resource.resource_type },
		{ label: "Creado", value: formatDate(resource.created), raw: resource.created },
		{ label: "Hash", value: resource.hash, raw: resource.hash },
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

// `docs_url` es un extra de CKAN: puede llegar con cualquier esquema si el recurso se creó
// por la API o por la UI nativa de CKAN. Se sanea antes de renderizarlo como `href`.
const docsUrl = $derived(safeExternalUrl(apiExtras.find((e) => e.key === "docs_url")?.value));

// `resource.url` también viene de CKAN y se renderiza como `href`: el saneo en el borde de
// salida es lo que impide un `javascript:` almacenado (XSS almacenado).
const downloadUrl = $derived(safeExternalUrl(resource?.url));

// ─── Actions ────────────────────────────────────────────────────
async function handleCopyEndpoint() {
	const ok = await copyToClipboard(apiEndpoint);
	if (ok) {
		endpointCopied = true;
		setTimeout(() => {
			endpointCopied = false;
		}, 2000);
	}
}
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

async function handleCopyResourceLink() {
	if (!dataset?.name || !resource?.id) return;
	const url = `${window.location.origin}/dataset/${dataset.name}/resource/${resource.id}`;
	const ok = await copyToClipboard(url);
	if (ok) {
		copiedLink = true;
		setTimeout(() => {
			copiedLink = false;
		}, 2000);
	}
}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div>
	<!-- Breadcrumb bar -->
	{#if !loading && !expelled}
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
			<div class="space-y-6">
				<div class="h-[420px] rounded-xl border border-border bg-card"></div>
				<div class="h-64 rounded-xl border border-border bg-card"></div>
				<div class="h-56 rounded-xl border border-border bg-card"></div>
			</div>
		</div>

	<!-- Expulsión: el guard ya limpió la sesión y navegó, no queda nada que renderizar -->
	{:else if expelled}

	<!-- Error / 404 state -->
	{:else if invalidParams || failure}
		<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
			<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
				<p class="text-lg font-medium text-destructive">{errorTitle}</p>
				<p class="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
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
					{#if actions.signIn}
						<a
							href={loginUrl($page.url.pathname)}
							class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							Iniciar sesión
						</a>
					{/if}
					{#if actions.retry}
						<button
							onclick={() => loadData()}
							class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							Reintentar
						</button>
					{/if}
				</div>
			</div>
		</div>

	<!-- Resource content -->
	{:else if resource}
		<!-- Resource header -->
		<section class="border-b border-border bg-card">
			<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<!-- Title + copy link -->
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={handleCopyResourceLink}
						aria-label="Copiar enlace del recurso"
						title="Copiar enlace"
						class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						{#if copiedLink}
							<Check class="size-4 text-emerald-600" />
						{:else}
							<Link2 class="size-4" />
						{/if}
					</button>
					<h1 class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
						{resource.name || "Recurso"}
					</h1>
				</div>

				<!-- Subtitle: updated -->
				{#if resource.last_modified}
					<div class="mt-3 text-sm text-muted-foreground">
						Actualizado {formatDate(resource.last_modified)}
					</div>
				{/if}


				<!-- Badges row -->
				<div class="mt-4 flex flex-wrap items-center gap-2">
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

				<!-- Description -->
				{#if resource.description}
					<p class="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
						{resource.description}
					</p>
				{/if}

				<!-- Download action -->
				{#if downloadUrl}
					<a
						href={downloadUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-5 inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90"
					>
						<Download class="size-4" />
						Descargar recurso
					</a>
				{/if}
			</div>
		</section>

		<!-- Preview + metadata content -->
		<section class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
			<Card class="overflow-hidden border-primary/20">
				<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">Vista previa</p>
					<div class="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
						{#each previewViews as view (view.id)}
							{@const Icon = view.icon}
							<button
								type="button"
								onclick={() => (previewView = view.id)}
								class={cn(
									"inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors",
									previewView === view.id
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<Icon class="size-3.5" />
								{view.label}
							</button>
						{/each}
					</div>
				</div>
				{#if previewView === "tabla"}
					<ResourcePreview resource={resource} datastore={datastoreApi} />
				{:else}
					<div class="flex min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
						<div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
							{#if previewView === "grafico"}
								<ChartBar class="size-8 text-primary" />
							{:else}
								<MapIcon class="size-8 text-primary" />
							{/if}
						</div>
						<p class="font-heading text-xl font-bold text-foreground">
							{previewView === "grafico" ? "Gráfico" : "Mapa"}
						</p>
						<p class="max-w-md text-sm leading-relaxed text-muted-foreground">
							Vista simulada. En la versión real, cada vista renderiza su propio contenido según los datos
							del recurso.
						</p>
					</div>
				{/if}
			</Card>

		<!-- API content -->
		{#if resource.resource_type === "api"}
			<div>
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">API · Endpoint</p>
					<h2 class="mt-1 font-heading text-xl font-bold text-primary">Acceso por API</h2>
					<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
						Use estos endpoints para acceder programáticamente a los datos del recurso.
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
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">
							Ejemplo de consulta · curl
						</p>
						<p class="mt-1 text-sm text-muted-foreground">Obtenga los metadatos del recurso.</p>
						<div class="mt-3 overflow-x-auto rounded-lg bg-foreground p-4">
							<pre class="font-mono text-xs leading-relaxed text-background"><code>{curlCommand}</code></pre>
						</div>
						{#if exampleResponse}
							<p class="mt-4 text-xs font-medium uppercase tracking-wider text-destructive">Respuesta</p>
							<div class="mt-1 overflow-x-auto rounded-lg bg-foreground p-4">
								<pre class="font-mono text-xs leading-relaxed text-background"><code>{exampleResponse}</code></pre>
							</div>
						{/if}
					</Card>
				</div>
			</div>
		{/if}

		<!-- Metadata content -->
			<Card class="p-6 sm:p-8">
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">
					Metadatos · Información técnica
				</p>
				<h2 class="mt-1 font-heading text-xl font-bold text-primary">Sobre este recurso</h2>
				<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Detalles técnicos del archivo: formato, tamaño, tipo MIME y otros metadatos.
				</p>

				{#if fieldList.length > 0}
					<div class="mt-4 overflow-hidden rounded-lg border border-border">
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
									{#if field.label === "Hash"}
										<div class="flex items-center justify-between gap-2">
											<code class="break-all font-mono text-foreground">{field.value}</code>
											<button
												type="button"
												onclick={handleCopyHash}
												aria-label="Copiar hash"
												title="Copiar hash al portapapeles"
												class="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
											>
												{#if hashCopied}
													<Check class="size-3.5 text-emerald-600" />
												{:else}
													<Copy class="size-3.5" />
												{/if}
											</button>
										</div>
									{:else}
										<span class="break-all font-medium text-foreground">{field.value}</span>
									{/if}
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
					</div>
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
			</Card>
		</section>
	{/if}
</div>

