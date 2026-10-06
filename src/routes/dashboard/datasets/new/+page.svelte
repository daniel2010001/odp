<script lang="ts">
import { Info, LoaderCircle, RotateCw, TriangleAlert } from "@lucide/svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createLicenseApi } from "$lib/api/licenses";
import { createOrganizationApi } from "$lib/api/organizations";
import { createResourceApi } from "$lib/api/resources";
import { createSessionApi } from "$lib/api/session";
import { UploadError, uploadResourceFile } from "$lib/api/upload";
import DatasetForm, {
	nombreEfectivo,
	type RecursoEntry,
} from "$lib/components/datasets/DatasetForm.svelte";
import { env } from "$lib/env";
import type { DatasetCreateInput } from "$lib/schemas/dataset";
import { endInvalidSession } from "$lib/session-guard";
import { auth, isAuthenticated } from "$lib/stores/auth";
import type { CkanLicense, CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { buildPackagePayload } from "$lib/utils/dataset-payload";

// ─── Guard + organizaciones ─────────────────────────────────────────
let authed = $state(false);
let organizations = $state<CkanOrganization[]>([]);
let orgLoading = $state(true);
let orgError = $state<string | null>(null);

// ─── Licencias (cargadas desde CKAN) ─────────────────────────────────
let licenses = $state<CkanLicense[]>([]);
let licensesLoading = $state(true);
let licensesError = $state<string | null>(null);

// ─── Etiquetas sugeridas ─────────────────────────────────────────────
let tagSugerencias = $state<string[]>([]);

// ─── Modelo del formulario ───────────────────────────────────────────
// El formulario es el dueño de los campos y del listado de recursos. La página conserva lo que es
// suyo: la organización elegida (la resuelve al cargarlas), los recursos (los sube) y el estado del
// envío.
let ownerOrg = $state("");
let recursos = $state<RecursoEntry[]>([]);

// ─── Estado del submit ───────────────────────────────────────────────
let submitting = $state(false);
let submitError = $state<string | null>(null);
let createdDataset = $state<CkanPackage | null>(null);
let uploadFinished = $state(false);

// Controllers de subida por entrada: la cancelación necesita un AbortController por recurso.
// No es reactivo (sólo se lee/escribe en los handlers de subida y cancelación).
const uploadControllers = new Map<string, AbortController>();

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
	void iniciarAsistente();
});

// La sonda corre **antes** de las cargas. Medido (2026-09-20): `organization_list_for_user` con
// `create_dataset` responde `200 []` igual para una sesión muerta que para un editor vivo sin
// organizaciones. Sin la sonda, el asistente leería ese `[]` como «no tiene organización» y
// diagnosticaría un permiso inexistente a quien sólo perdió la sesión.
async function iniciarAsistente() {
	// El token se lee **una sola vez** y sólo se reescribe si existe: `login("", …)` persistiría una
	// sesión vacía que el guard de `/auth/login` no puede distinguir de una real.
	const token = get(auth).token;
	const check = await createSessionApi(makeClient()).check();

	if (check.state === "dead") {
		// Sesión caída: se limpia y se vuelve al login sin cargar nada; el `[]` de organizaciones nunca
		// llega a leerse como un diagnóstico de permiso.
		await endInvalidSession("/dashboard/datasets/new");
		return;
	}

	if (check.state === "alive" && token) {
		// El llamador que devolvió la sonda **es** la identidad: se refresca el store con él para que
		// la sesión guardada no sobreviva obsoleta.
		auth.login(token, check.user);
	}

	// `inconclusive` (5xx, timeout, red): un hipo de CKAN no expulsa a nadie autenticado. Se carga
	// con la sesión guardada, sin limpiarla ni navegar.
	void loadOrganizations();
	void loadLicenses();
	void loadTagSuggestions();
}

async function loadOrganizations() {
	orgLoading = true;
	orgError = null;
	try {
		const client = makeClient();
		const orgApi = createOrganizationApi(client);
		organizations = await orgApi.listForUser("create_dataset");
		// Una sola organización: se selecciona sola y se muestra de solo lectura.
		if (organizations.length === 1) {
			ownerOrg = organizations[0].name;
		}
	} catch (err) {
		organizations = [];
		orgError = err instanceof Error ? err.message : "No se pudo cargar sus organizaciones.";
	} finally {
		orgLoading = false;
	}
}

// ─── Licencias y sugerencias de etiquetas ────────────────────────────
async function loadLicenses() {
	licensesLoading = true;
	licensesError = null;
	try {
		const client = makeClient();
		const licenseApi = createLicenseApi(client);
		licenses = await licenseApi.list();
	} catch (err) {
		licenses = [];
		licensesError = err instanceof Error ? err.message : "No se pudo cargar la lista de licencias.";
	} finally {
		licensesLoading = false;
	}
}

async function loadTagSuggestions() {
	const client = makeClient();
	const datasetApi = createDatasetApi(client);
	tagSugerencias = await datasetApi.tagSuggestions();
}

// ─── Recursos: subida y reintento (orquestación de la página) ─────────
/** ¿Quedó algún recurso sin adjuntar? Se navega al dataset sólo cuando no queda ninguno. */
function hasFailedResources(): boolean {
	return recursos.some((entry) => entry.estado === "error" || entry.estado === "cancelado");
}

function describeCreateError(err: unknown, name: string): string {
	const message = err instanceof Error ? err.message : "Error desconocido";
	// Sólo el mensaje que CKAN emite para un nombre ya tomado es un conflicto de slug: lo produce
	// `package_name_validator` (`ckan/logic/validators.py:408-427`). Antes el patrón incluía `url` suelto y
	// marcaba como conflicto cualquier error que nombrara una URL —el de un recurso, por ejemplo—, así que
	// al usuario se le pedía cambiar el slug cuando el problema estaba en otro campo.
	if (/that url is already in use/i.test(message)) {
		return `El slug «${name}» ya está en uso. Elija otro slug e intente nuevamente.`;
	}
	if (import.meta.env.DEV) {
		// El texto crudo del servidor no entra a la oración visible; queda acá, sólo en desarrollo.
		console.error("No se pudo crear el dataset:", err);
	}
	return "No se pudo crear el dataset. Intente nuevamente más tarde.";
}

// ─── Submit: crear el paquete y luego subir los recursos ─────────────
// El formulario ya validó y normalizó: acá empieza la orquestación.
async function handleSubmit(data: DatasetCreateInput) {
	submitError = null;
	uploadFinished = false;
	submitting = true;

	try {
		const payload = buildPackagePayload({
			title: data.title,
			name: data.name,
			owner_org: data.owner_org,
			private: data.private,
			summary: data.summary,
			notes: data.notes,
			license_id: data.license_id,
			tag_string: data.tag_string,
			url: data.url,
			maintainer: data.maintainer,
			maintainer_email: data.maintainer_email,
		});

		const client = makeClient();
		const datasetApi = createDatasetApi(client);
		const pkg = await datasetApi.create(payload);
		createdDataset = pkg;

		await runResources(pkg.id);

		if (!hasFailedResources()) {
			void goto(`/dataset/${pkg.name}`);
		} else {
			uploadFinished = true;
		}
	} catch (err) {
		submitError = describeCreateError(err, data.name);
	} finally {
		submitting = false;
	}
}

async function runResources(packageId: string) {
	for (const entry of recursos) {
		if (entry.estado === "listo") continue;
		if (entry.tipo === "archivo") {
			await uploadEntry(packageId, entry);
		} else {
			await createLinkEntry(packageId, entry);
		}
	}
}

async function uploadEntry(packageId: string, entry: RecursoEntry) {
	const token = get(auth).token;
	if (!token || !entry.file) return;
	entry.estado = "subiendo";
	entry.progreso = 0;
	entry.error = undefined;
	const controller = new AbortController();
	uploadControllers.set(entry.key, controller);
	try {
		await uploadResourceFile({
			packageId,
			file: entry.file,
			filename: entry.file.name,
			name: nombreEfectivo(entry),
			description: entry.descripcion.trim() || undefined,
			token,
			onProgress: (percent) => {
				entry.progreso = percent;
				// Al llegar al 100 % los bytes ya se enviaron, pero CKAN todavía valida
				// y guarda: es el tramo «procesando».
				if (percent >= 100) entry.estado = "procesando";
			},
			signal: controller.signal,
		});
		entry.estado = "listo";
		entry.progreso = 100;
	} catch (err) {
		if (err instanceof UploadError && err.code === "aborted") {
			entry.estado = "cancelado";
		} else {
			entry.estado = "error";
			entry.error = err instanceof Error ? err.message : "No se pudo subir el archivo";
		}
	} finally {
		uploadControllers.delete(entry.key);
	}
}

async function createLinkEntry(packageId: string, entry: RecursoEntry) {
	if (!entry.url) return;
	const client = makeClient();
	const resourceApi = createResourceApi(client);
	const descripcion = entry.descripcion.trim();
	entry.estado = "procesando";
	entry.error = undefined;
	try {
		await resourceApi.create({
			package_id: packageId,
			name: nombreEfectivo(entry),
			url: entry.url,
			...(descripcion ? { description: descripcion } : {}),
		});
		entry.estado = "listo";
	} catch (err) {
		entry.estado = "error";
		entry.error = err instanceof Error ? err.message : "No se pudo crear el enlace";
	}
}

async function retryFailedResources() {
	if (!createdDataset || submitting) return;
	submitting = true;
	uploadFinished = false;
	try {
		await runResources(createdDataset.id);
		if (!hasFailedResources()) {
			void goto(`/dataset/${createdDataset.name}`);
		} else {
			uploadFinished = true;
		}
	} finally {
		submitting = false;
	}
}

function cancelUpload(key: string) {
	uploadControllers.get(key)?.abort();
}

function handleCancel() {
	void goto("/dashboard");
}
</script>

<svelte:head>
	<title>Crear dataset — UMSS</title>
</svelte:head>

{#if authed}
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		<header class="mb-8">
			<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">Crear dataset</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Complete los metadatos y adjunte los recursos. Los archivos se suben directamente al
				servicio de datos, sin pasar por el servidor del portal.
			</p>
		</header>

		{#if orgLoading}
			<div
				class="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground"
				role="status"
				aria-live="polite"
			>
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
				Cargando organizaciones...
			</div>
		{:else if orgError}
			<div
				class="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
				role="alert"
			>
				<TriangleAlert class="mx-auto size-6 text-destructive" aria-hidden="true" />
				<p class="mt-2 text-sm font-medium text-destructive">
					No se pudo cargar sus organizaciones.
				</p>
				<p class="mt-1 break-words text-xs text-muted-foreground">{orgError}</p>
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
			<div class="rounded-xl border border-border bg-card p-8 text-center">
				<Info class="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
				<p class="mt-2 text-sm font-medium text-foreground">
					Necesita rol de editor en una organización para crear datasets.
				</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Solicite a un administrador que le asigne permisos de editor o administrador en una
					organización.
				</p>
			</div>
		{:else}
			<DatasetForm
				mode="create"
				{organizations}
				{licenses}
				{licensesLoading}
				{licensesError}
				tagSuggestions={tagSugerencias}
				bind:resources={recursos}
				bind:ownerOrg
				{submitting}
				bind:submitError
				{uploadFinished}
				{createdDataset}
				onsubmit={handleSubmit}
				oncancel={handleCancel}
				onretry={retryFailedResources}
				oncancelupload={cancelUpload}
			/>
		{/if}
	</div>
{/if}
