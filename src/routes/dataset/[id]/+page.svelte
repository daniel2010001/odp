<script lang="ts">
import {
	ArrowLeft,
	Building2,
	Calendar,
	Check,
	ChevronRight,
	Clock,
	Copy,
	Link2,
	Shield,
	User,
} from "lucide-svelte";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import ResourceCard from "$lib/components/dataset/ResourceCard.svelte";
import OrganizationLogo from "$lib/components/organizations/OrganizationLogo.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { getMockDatasetById } from "$lib/mock/data";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { copyToClipboard, formatCitationAPA, formatCitationBibTeX } from "$lib/utils/citation";
import { formatDate } from "$lib/utils/ckan";

// ─── State ───────────────────────────────────────────────────────
let dataset = $state<CkanPackage | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);
let citationFormat = $state<"apa" | "bibtex">("apa");
let copied = $state(false);
let copiedLink = $state(false);

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
const description = $derived(dataset?.notes ? dataset.notes.replace(/<[^>]*>/g, "").trim() : null);

const activeResources = $derived(
	dataset?.resources?.filter((r) => r.state === "active" || !r.state) ?? [],
);

const visibleTags = $derived(dataset?.tags?.slice(0, 5) ?? []);
const hiddenTagCount = $derived((dataset?.tags?.length ?? 0) - 5);

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

// ─── Breadcrumb ─────────────────────────────────────────────────
const breadcrumbItems = $derived.by(() => {
	const items: { label: string; href?: string }[] = [{ label: "Catálogo", href: "/search" }];
	if (dataset?.organization?.title) {
		items.push({
			label: dataset.organization.title,
			href: `/search?org=${dataset.organization.name}`,
		});
	}
	if (dataset?.title || dataset?.name) {
		items.push({ label: dataset.title || dataset.name });
	}
	return items;
});

// ─── Hero badges ────────────────────────────────────────────────
const visibilityLabel = $derived(dataset?.private ? "Privado" : "Público");

const stateLabel = $derived.by(() => {
	switch (dataset?.state) {
		case "active":
			return "Activo";
		case "draft":
			return "Borrador";
		case "deleted":
			return "Eliminado";
		default:
			return null;
	}
});

const orgHref = $derived(
	dataset?.organization?.name ? `/search?org=${dataset.organization.name}` : null,
);

// ─── Technical metadata table ───────────────────────────────────
const generalMetaRows = $derived.by(() => {
	if (!dataset) return [];
	const rows: { label: string; value: string; mono?: boolean }[] = [
		{ label: "Slug", value: dataset.name, mono: true },
		{ label: "ID", value: dataset.id, mono: true },
		{ label: "Visibilidad", value: visibilityLabel },
	];
	if (stateLabel) rows.push({ label: "Estado", value: stateLabel });
	return rows;
});

// ─── Citation ───────────────────────────────────────────────────
const citationText = $derived(
	citationFormat === "apa" && dataset
		? formatCitationAPA(dataset)
		: dataset
			? formatCitationBibTeX(dataset)
			: "",
);

async function handleCopyCitation() {
	if (!citationText) return;
	const ok = await copyToClipboard(citationText);
	if (ok) {
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
}

// Copia el enlace canónico del dataset (usa el slug, no el id interno).
function buildShareUrl(): string {
	if (!dataset) return "";
	return `${window.location.origin}/dataset/${dataset.name}`;
}

async function handleCopyLink() {
	const url = buildShareUrl();
	if (!url) return;
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
	<title>
		{dataset ? `${dataset.title || dataset.name} — UMSS` : "Cargando... — UMSS"}
	</title>
</svelte:head>

<div>
	<!-- Breadcrumb bar -->
	{#if !loading}
		<div class="border-b border-border bg-card">
			<div class="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
				<nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-1.5 text-sm">
					<a
						href="/search"
						class="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
					>
						<ArrowLeft class="size-4" />
						Catálogo
					</a>
					{#each breadcrumbItems.slice(1) as item}
						<ChevronRight class="size-3.5 text-muted-foreground" aria-hidden="true" />
						{#if item.href}
							<a
								href={item.href}
								class="text-muted-foreground transition-colors hover:text-foreground"
							>
								{item.label}
							</a>
						{:else}
							<span class="font-medium text-foreground">{item.label}</span>
						{/if}
					{/each}
				</nav>
			</div>
		</div>
	{/if}

	<!-- Loading skeleton -->
	{#if loading}
		<div class="mx-auto max-w-7xl animate-pulse space-y-6 px-4 py-10 sm:px-6 lg:px-8">
			<div class="flex gap-2">
				<div class="h-7 w-40 rounded-md bg-muted"></div>
				<div class="h-7 w-24 rounded-md bg-muted"></div>
				<div class="h-7 w-20 rounded-md bg-muted"></div>
			</div>
			<div class="h-12 w-3/4 rounded-lg bg-muted"></div>
			<div class="h-4 w-1/3 rounded bg-muted"></div>
			<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
				<div class="space-y-6">
					<div class="h-40 rounded-xl border border-border bg-card"></div>
					<div class="h-56 rounded-xl border border-border bg-card"></div>
					<div class="h-48 rounded-xl border border-border bg-card"></div>
				</div>
				<div class="space-y-6">
					<div class="h-44 rounded-xl border border-border bg-card"></div>
					<div class="h-64 rounded-xl border border-border bg-card"></div>
				</div>
			</div>
		</div>

	<!-- Error state -->
	{:else if error && !dataset}
		<div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
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
		</div>

	<!-- Dataset content -->
	{:else if dataset}
		<!-- Hero -->
		<section class="border-b border-border bg-card">
			<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<!-- Title + copy link -->
				<div class="flex items-center gap-3">
					<button
						type="button"
						onclick={handleCopyLink}
						aria-label="Copiar enlace del dataset"
						title="Copiar enlace"
						class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						{#if copiedLink}
							<Check class="size-4 text-emerald-600" />
						{:else}
							<Link2 class="size-4" />
						{/if}
					</button>
					<h1
						class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl"
					>
						{dataset.title || dataset.name}
					</h1>
				</div>

				<!-- Subtitle: updated -->
				<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
					<span>Actualizado {formatDate(dataset.metadata_modified)}</span>
				</div>

				<!-- Badges row -->
				<div class="mt-4 flex flex-wrap items-center gap-2">
					{#if dataset.organization?.title}
						{#if orgHref}
							<a
								href={orgHref}
								class="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
							>
								<Building2 class="size-3.5" />
								{dataset.organization.title}
							</a>
						{:else}
							<span
								class="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
							>
								<Building2 class="size-3.5" />
								{dataset.organization.title}
							</span>
						{/if}
					{/if}

					{#if stateLabel}
						<span
							class={cn(
								"inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
								dataset.state === "active"
									? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
									: "border-destructive/20 bg-destructive/10 text-destructive",
							)}
						>
							<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
							{stateLabel}
						</span>
					{/if}

					<span
						class={cn(
							"inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
							dataset.private
								? "border-destructive/20 bg-destructive/10 text-destructive"
								: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
						)}
					>
						{visibilityLabel}
					</span>
				</div>
			</div>
		</section>

		<!-- Body: two-column layout -->
		<section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
				<!-- Main column -->
				<div class="min-w-0 space-y-6">
					<!-- Description + tags -->
					<Card class="p-6 sm:p-8">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">Descripción</p>
						<h2 class="mt-1 font-heading text-xl font-bold text-primary">Sobre este dataset</h2>
						{#if description}
							<p class="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
						{:else}
							<p class="mt-3 text-sm italic text-muted-foreground">Sin descripción</p>
						{/if}

						{#if dataset.tags && dataset.tags.length > 0}
							<div class="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-4">
								{#each visibleTags as tag}
									<span
										class="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
									>
										#{tag.display_name || tag.name}
									</span>
								{/each}
								{#if hiddenTagCount > 0}
									<span class="inline-flex items-center rounded-full px-3 py-1 text-xs text-muted-foreground">
										+{hiddenTagCount} más
									</span>
								{/if}
							</div>
						{/if}
					</Card>

					<!-- Resources -->
					<Card class="p-6 sm:p-8">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">Recursos</p>
						<h2 class="mt-1 font-heading text-xl font-bold text-primary">
							Archivos disponibles
							{#if activeResources.length > 0}
								<span class="font-normal text-muted-foreground">({activeResources.length})</span>
							{/if}
						</h2>
						<div class="mt-4 space-y-2">
							{#if activeResources.length === 0}
								<p class="text-sm text-muted-foreground">
									Este dataset no tiene recursos disponibles.
								</p>
							{:else}
								{#each activeResources as resource (resource.id)}
									<ResourceCard {resource} datasetSlug={dataset.name} />
								{/each}
							{/if}
						</div>
					</Card>

					<!-- Technical info -->
					<Card class="p-6 sm:p-8">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">Detalles</p>
						<h2 class="mt-1 font-heading text-xl font-bold text-primary">
							Información técnica del dataset
						</h2>
						<div class="mt-4 overflow-hidden rounded-lg border border-border">
							<div
								class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 bg-muted/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground"
							>
								<span>Campo</span>
								<span>Valor</span>
							</div>
							<div class="divide-y divide-border/60">
								{#each generalMetaRows as row}
									<div
										class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 px-4 py-3 text-sm"
									>
										<span class="text-muted-foreground">{row.label}</span>
										{#if row.mono}
											<code class="break-all font-mono text-foreground">{row.value}</code>
										{:else}
											<span class="break-all font-medium text-foreground">{row.value}</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</Card>
				</div>

				<!-- Sidebar -->
				<aside class="min-w-0 space-y-6">
					<!-- Cite card -->
					<Card class="p-5">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">Citar como</p>
						<div class="mt-3 flex items-center gap-2">
							<button
								type="button"
								onclick={() => (citationFormat = "apa")}
								class={cn(
									"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
									citationFormat === "apa"
										? "bg-primary text-primary-foreground"
										: "border border-border bg-background text-muted-foreground hover:bg-accent",
								)}
							>
								APA
							</button>
							<button
								type="button"
								onclick={() => (citationFormat = "bibtex")}
								class={cn(
									"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
									citationFormat === "bibtex"
										? "bg-primary text-primary-foreground"
										: "border border-border bg-background text-muted-foreground hover:bg-accent",
								)}
							>
								BibTeX
							</button>
							<div class="flex-1"></div>
							<button
								type="button"
								onclick={handleCopyCitation}
								aria-label="Copiar cita"
								title="Copiar al portapapeles"
								class="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								{#if copied}
									<Check class="size-4 text-emerald-600" />
								{:else}
									<Copy class="size-4" />
								{/if}
							</button>
						</div>
						<p class="mt-3 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
							{citationText}
						</p>
					</Card>

					<!-- Metadata card -->
					{#if metadataItems.length > 0}
						<Card class="p-5">
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">Metadatos</p>
							<div class="mt-3 divide-y divide-border/60">
								{#each metadataItems as item}
									<div class="flex items-start justify-between gap-3 py-2.5">
										<span class="flex items-center gap-2 text-xs text-muted-foreground">
											<item.icon class="size-3.5 shrink-0" />
											{item.label}
										</span>
										<span class="text-right text-xs font-semibold text-foreground">
											{item.value}
										</span>
									</div>
								{/each}
							</div>
						</Card>
					{/if}

					<!-- Organization card -->
					{#if dataset.organization?.title}
						<Card class="p-5">
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">Organización</p>
							<div class="mt-3 flex items-start gap-3">
								<OrganizationLogo
									imageUrl={dataset.organization.image_url}
									name={dataset.organization.title}
								/>
								<div class="min-w-0 flex-1">
									<p class="font-heading text-sm font-bold text-foreground">
										{dataset.organization.title}
									</p>
									{#if dataset.organization.description}
										<p class="mt-1 line-clamp-3 text-xs text-muted-foreground">
											{dataset.organization.description}
										</p>
									{/if}
								</div>
							</div>
							{#if orgHref}
								<a
									href={orgHref}
									class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline"
								>
									Ver datasets de {dataset.organization.title}
								</a>
							{/if}
						</Card>
					{/if}

				</aside>
			</div>
		</section>
	{/if}
</div>
