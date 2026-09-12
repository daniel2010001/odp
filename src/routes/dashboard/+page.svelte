<script lang="ts">
import {
	ArrowRight,
	Building2,
	Database,
	Inbox,
	LoaderCircle,
	Plus,
	RotateCw,
	ShieldCheck,
	TriangleAlert,
} from "lucide-svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createOrganizationApi } from "$lib/api/organizations";
import { env } from "$lib/env";
import { auth, currentUser, isAuthenticated, isSuperAdmin } from "$lib/stores/auth";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";

// ─── Estado ──────────────────────────────────────────────────────────
let authed = $state(false);
let datasets = $state<CkanPackage[]>([]);
let datasetsLoading = $state(true);
let datasetsError = $state<string | null>(null);
let organizations = $state<CkanOrganization[]>([]);
let orgsLoading = $state(true);
let orgsError = $state<string | null>(null);

// ─── Cliente CKAN autenticado ────────────────────────────────────────
function makeClient() {
	return createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token });
}

// ─── Guard de auth + carga inicial ───────────────────────────────────
onMount(() => {
	if (!get(isAuthenticated)) {
		void goto("/auth/login");
		return;
	}
	authed = true;
	void loadDatasets();
	void loadOrganizations();
});

async function loadDatasets() {
	datasetsLoading = true;
	datasetsError = null;
	try {
		const client = makeClient();
		const datasetApi = createDatasetApi(client);
		datasets = await datasetApi.currentUser();
	} catch (err) {
		datasets = [];
		datasetsError = err instanceof Error ? err.message : "No se pudo cargar sus datasets.";
	} finally {
		datasetsLoading = false;
	}
}

async function loadOrganizations() {
	orgsLoading = true;
	orgsError = null;
	try {
		const client = makeClient();
		const orgApi = createOrganizationApi(client);
		organizations = await orgApi.listForUser();
	} catch (err) {
		organizations = [];
		orgsError = err instanceof Error ? err.message : "No se pudo cargar sus organizaciones.";
	} finally {
		orgsLoading = false;
	}
}
</script>

<svelte:head>
	<title>Panel — UMSS</title>
</svelte:head>

{#if authed}
	<div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">
				¡Hola, {$currentUser?.display_name || $currentUser?.name}!
			</h1>
			{#if $isSuperAdmin}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30"
				>
					<ShieldCheck class="size-3.5" aria-hidden="true" />
					Administrador
				</span>
			{/if}
		</div>

		<p class="mt-3 text-muted-foreground">
			Este es su panel personal. Desde aquí podrá gestionar los datasets de su
			organización.
		</p>

		<!-- CTA al wizard de publicación -->
		<a
			href="/dashboard/datasets/new"
			class="group mt-8 flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-6 shadow-sm transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<span
				class="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
			>
				<Plus class="size-5" aria-hidden="true" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block font-heading text-lg font-semibold text-primary">
					Publicar dataset
				</span>
				<span class="mt-1 block text-sm text-muted-foreground">
					Cree un nuevo dataset y suba sus recursos desde el asistente de publicación.
				</span>
			</span>
			<ArrowRight
				class="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
				aria-hidden="true"
			/>
		</a>

		<!-- Mis datasets -->
		<section class="mt-10" aria-labelledby="datasets-heading">
			<h2 id="datasets-heading" class="font-heading text-xl font-semibold text-primary">
				Mis datasets
			</h2>

			{#if datasetsLoading}
				<div
					class="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground"
					role="status"
					aria-live="polite"
				>
					<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
					Cargando datasets...
				</div>
			{:else if datasetsError}
				<div
					class="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
					role="alert"
				>
					<TriangleAlert class="mx-auto size-6 text-destructive" aria-hidden="true" />
					<p class="mt-2 text-sm font-medium text-destructive">
						No se pudo cargar sus datasets.
					</p>
					<p class="mt-1 break-words text-xs text-muted-foreground">{datasetsError}</p>
					<button
						type="button"
						onclick={loadDatasets}
						class="mt-4 inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<RotateCw class="size-4" aria-hidden="true" />
						Reintentar
					</button>
				</div>
			{:else if datasets.length === 0}
				<div class="mt-4 rounded-xl border border-border bg-card p-8 text-center">
					<Inbox class="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
					<p class="mt-2 text-sm font-medium text-foreground">Publique su primer dataset</p>
					<p class="mt-1 text-xs text-muted-foreground">
						Aún no tiene datasets que pueda editar. Use el asistente para crear el primero.
					</p>
				</div>
			{:else}
				<ul class="mt-4 space-y-2">
					{#each datasets as dataset (dataset.id)}
						<li>
							<a
								href={`/dataset/${dataset.name}`}
								class="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Database
									class="size-4 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
								<span
									class="min-w-0 break-words text-sm font-medium text-foreground group-hover:text-primary"
								>
									{dataset.title}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Mis organizaciones -->
		<section class="mt-10" aria-labelledby="organizations-heading">
			<h2 id="organizations-heading" class="font-heading text-xl font-semibold text-primary">
				Mis organizaciones
			</h2>

			{#if orgsLoading}
				<div
					class="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground"
					role="status"
					aria-live="polite"
				>
					<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
					Cargando organizaciones...
				</div>
			{:else if orgsError}
				<div
					class="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
					role="alert"
				>
					<TriangleAlert class="mx-auto size-6 text-destructive" aria-hidden="true" />
					<p class="mt-2 text-sm font-medium text-destructive">
						No se pudo cargar sus organizaciones.
					</p>
					<p class="mt-1 break-words text-xs text-muted-foreground">{orgsError}</p>
					<button
						type="button"
						onclick={loadOrganizations}
						class="mt-4 inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<RotateCw class="size-4" aria-hidden="true" />
						Reintentar
					</button>
				</div>
			{:else if organizations.length === 0}
				<div class="mt-4 rounded-xl border border-border bg-card p-8 text-center">
					<Inbox class="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
					<p class="mt-2 text-sm font-medium text-foreground">
						Aún no pertenece a ninguna organización
					</p>
					<p class="mt-1 text-xs text-muted-foreground">
						Solicite a un administrador que lo agregue a una organización para publicar
						datasets.
					</p>
				</div>
			{:else}
				<ul class="mt-4 space-y-2">
					{#each organizations as organization (organization.id)}
						<li>
							<a
								href={`/organization/${organization.name}`}
								class="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Building2
									class="size-4 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
								<span
									class="min-w-0 break-words text-sm font-medium text-foreground group-hover:text-primary"
								>
									{organization.title}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
{/if}
