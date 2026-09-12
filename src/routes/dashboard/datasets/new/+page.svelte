<script lang="ts">
import {
	Check,
	FileText,
	Info,
	LoaderCircle,
	RotateCw,
	Trash2,
	TriangleAlert,
	Upload,
	X,
} from "lucide-svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createOrganizationApi } from "$lib/api/organizations";
import { UploadError, uploadResourceFile } from "$lib/api/upload";
import { env } from "$lib/env";
import { datasetCreateSchema } from "$lib/schemas/dataset";
import { auth, isAuthenticated } from "$lib/stores/auth";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";
import {
	buildPackagePayload,
	MAX_RESOURCE_BYTES,
	suggestSlug,
	validateResourceFile,
} from "$lib/utils/dataset-payload";
import { licenseLabel } from "$lib/utils/licenses";

// ─── Constantes ──────────────────────────────────────────────────────
const LIMIT_MB = MAX_RESOURCE_BYTES / 1024 / 1024;

// Lista de licencias CKAN más comunes. El select envía `license_id`; vacío =
// sin licencia (el campo opcional se omite del payload).
const LICENSE_IDS = [
	"cc-by",
	"cc-by-sa",
	"cc-by-nc",
	"cc-by-nc-sa",
	"cc-zero",
	"cc0-1.0",
	"odc-odbl",
	"odc-by",
	"pddl",
	"other-open",
	"other-at",
	"other-closed",
	"notspecified",
];

const inputClass =
	"h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// ─── Guard + organizaciones ─────────────────────────────────────────
let authed = $state(false);
let organizations = $state<CkanOrganization[]>([]);
let orgLoading = $state(true);
let orgError = $state<string | null>(null);

// ─── Metadatos del formulario ────────────────────────────────────────
let title = $state("");
let slug = $state("");
let slugEdited = $state(false);
let notes = $state("");
let ownerOrg = $state("");
let licenseId = $state("");
let tagString = $state("");
let visibility = $state<"private" | "public">("private");
let url = $state("");
let maintainer = $state("");
let maintainerEmail = $state("");

// ─── Archivos ────────────────────────────────────────────────────────
type FileStatus = "pending" | "uploading" | "done" | "error" | "cancelled";
interface FileEntry {
	key: string;
	file: File;
	status: FileStatus;
	progress: number;
	error?: string;
	controller: AbortController | null;
}
let fileEntries = $state<FileEntry[]>([]);
let rejectedFiles = $state<{ name: string; message: string }[]>([]);

// ─── Estado del submit ───────────────────────────────────────────────
let submitting = $state(false);
let fieldErrors = $state<Record<string, string>>({});
let submitError = $state<string | null>(null);
let createdDataset = $state<CkanPackage | null>(null);
let uploadFinished = $state(false);

// ─── Derivados ───────────────────────────────────────────────────────
const failedUploads = $derived(
	fileEntries.filter((entry) => entry.status === "error" || entry.status === "cancelled"),
);

// ─── Sugerencia de slug ──────────────────────────────────────────────
// Sigue al título mientras el usuario no lo haya editado a mano; una vez
// editado, se preserva aunque el título cambie después.
$effect(() => {
	if (!slugEdited) {
		slug = suggestSlug(title);
	}
});

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
	void loadOrganizations();
});

async function loadOrganizations() {
	orgLoading = true;
	orgError = null;
	try {
		const client = makeClient();
		const orgApi = createOrganizationApi(client);
		organizations = await orgApi.listForUser("create_dataset");
	} catch (err) {
		organizations = [];
		orgError = err instanceof Error ? err.message : "No se pudo cargar sus organizaciones.";
	} finally {
		orgLoading = false;
	}
}

// ─── Selector de archivos ────────────────────────────────────────────
function onFilesPicked(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const picked = Array.from(input.files ?? []);
	// Permite volver a elegir el mismo archivo en una próxima selección.
	input.value = "";

	const rejected: { name: string; message: string }[] = [];
	const accepted: FileEntry[] = [];

	for (const file of picked) {
		const result = validateResourceFile(file);
		if (!result.ok) {
			rejected.push({ name: file.name, message: result.message });
			continue;
		}
		accepted.push({
			key: `${file.name}-${file.size}-${file.lastModified}`,
			file,
			status: "pending",
			progress: 0,
			controller: null,
		});
	}

	rejectedFiles = [...rejectedFiles, ...rejected];
	fileEntries = [...fileEntries, ...accepted];
}

function removeFile(key: string) {
	fileEntries = fileEntries.filter((entry) => entry.key !== key);
}

// ─── Validación y submit ─────────────────────────────────────────────
function mapZodErrors(
	issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of issues) {
		const field = String(issue.path[0] ?? "");
		if (field && !errors[field]) errors[field] = issue.message;
	}
	return errors;
}

function describeCreateError(err: unknown, name: string): string {
	const message = err instanceof Error ? err.message : "Error desconocido";
	if (/already in use|url/i.test(message)) {
		return `El slug «${name}» ya está en uso. Elija otro slug e intente nuevamente.`;
	}
	return `No se pudo crear el dataset: ${message}`;
}

async function handleSubmit() {
	if (submitting) return;

	const result = datasetCreateSchema.safeParse({
		name: slug.trim(),
		title: title.trim(),
		notes: notes || undefined,
		owner_org: ownerOrg,
		private: visibility === "private",
		license_id: licenseId || undefined,
		tag_string: tagString || undefined,
	});

	if (!result.success) {
		fieldErrors = mapZodErrors(result.error.issues);
		submitError = null;
		return;
	}

	fieldErrors = {};
	submitError = null;
	uploadFinished = false;
	submitting = true;

	try {
		const payload = buildPackagePayload({
			title,
			name: slug,
			owner_org: ownerOrg,
			private: visibility === "private",
			notes,
			license_id: licenseId,
			tag_string: tagString,
			url,
			maintainer,
			maintainer_email: maintainerEmail,
		});

		const client = makeClient();
		const datasetApi = createDatasetApi(client);
		const pkg = await datasetApi.create(payload);
		createdDataset = pkg;

		await runUploads(pkg.id);

		if (failedUploads.length === 0) {
			void goto(`/dataset/${pkg.name}`);
		} else {
			uploadFinished = true;
		}
	} catch (err) {
		submitError = describeCreateError(err, slug.trim());
	} finally {
		submitting = false;
	}
}

async function runUploads(packageId: string) {
	const token = get(auth).token;
	if (!token) return;

	for (const entry of fileEntries) {
		if (entry.status === "done") continue;
		entry.status = "uploading";
		entry.progress = 0;
		entry.error = undefined;
		const controller = new AbortController();
		entry.controller = controller;
		try {
			await uploadResourceFile({
				packageId,
				file: entry.file,
				filename: entry.file.name,
				token,
				onProgress: (percent) => {
					entry.progress = percent;
				},
				signal: controller.signal,
			});
			entry.status = "done";
			entry.progress = 100;
		} catch (err) {
			if (err instanceof UploadError && err.code === "aborted") {
				entry.status = "cancelled";
			} else {
				entry.status = "error";
				entry.error = err instanceof Error ? err.message : "No se pudo subir el archivo";
			}
		} finally {
			entry.controller = null;
		}
	}
}

async function retryFailedUploads() {
	if (!createdDataset || submitting) return;
	submitting = true;
	uploadFinished = false;
	try {
		await runUploads(createdDataset.id);
		if (failedUploads.length === 0) {
			void goto(`/dataset/${createdDataset.name}`);
		} else {
			uploadFinished = true;
		}
	} finally {
		submitting = false;
	}
}

function cancelUpload(key: string) {
	fileEntries.find((entry) => entry.key === key)?.controller?.abort();
}
</script>

<svelte:head>
	<title>Publicar dataset — UMSS</title>
</svelte:head>

{#if authed}
	<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
		<header class="mb-8">
			<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">Publicar dataset</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Complete los metadatos y adjunte los recursos. Los archivos se suben directamente a
				CKAN, sin pasar por el servidor del portal.
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
					Necesita rol de editor en una organización para publicar datasets.
				</p>
				<p class="mt-1 text-xs text-muted-foreground">
					Solicite a un administrador que le asigne permisos de editor o administrador en una
					organización.
				</p>
			</div>
		{:else}
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void handleSubmit();
				}}
				novalidate
				class="space-y-8"
			>
				<!-- Metadatos básicos -->
				<section class="space-y-5 rounded-xl border border-border bg-card p-6">
					<h2 class="font-heading text-lg font-semibold text-primary">Metadatos básicos</h2>

					<div class="space-y-1.5">
						<label for="title" class="text-sm font-medium text-foreground">
							Título <span class="text-destructive" aria-hidden="true">*</span>
						</label>
						<input
							id="title"
							type="text"
							bind:value={title}
							aria-invalid={fieldErrors.title ? "true" : undefined}
							aria-describedby={fieldErrors.title ? "title-error" : undefined}
							class={inputClass}
						/>
						{#if fieldErrors.title}
							<p id="title-error" class="text-xs text-destructive">{fieldErrors.title}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<label for="slug" class="text-sm font-medium text-foreground">
							Slug <span class="text-destructive" aria-hidden="true">*</span>
						</label>
						<input
							id="slug"
							type="text"
							value={slug}
							oninput={(event) => {
								slug = (event.currentTarget as HTMLInputElement).value;
								slugEdited = true;
							}}
							aria-invalid={fieldErrors.slug ? "true" : undefined}
							aria-describedby={fieldErrors.slug ? "slug-hint slug-error" : "slug-hint"}
							class={inputClass}
						/>
						<p id="slug-hint" class="text-xs text-muted-foreground">
							Se genera automáticamente a partir del título. Puede editarlo.
						</p>
						{#if fieldErrors.slug}
							<p id="slug-error" class="text-xs text-destructive">{fieldErrors.slug}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<label for="notes" class="text-sm font-medium text-foreground">Descripción</label>
						<textarea
							id="notes"
							rows={4}
							bind:value={notes}
							aria-invalid={fieldErrors.notes ? "true" : undefined}
							aria-describedby={fieldErrors.notes ? "notes-error" : undefined}
							class="{inputClass} h-auto"
						></textarea>
						{#if fieldErrors.notes}
							<p id="notes-error" class="text-xs text-destructive">{fieldErrors.notes}</p>
						{/if}
					</div>
				</section>

				<!-- Organización y licencia -->
				<section class="space-y-5 rounded-xl border border-border bg-card p-6">
					<h2 class="font-heading text-lg font-semibold text-primary">Organización y licencia</h2>

					<div class="space-y-1.5">
						<label for="owner-org" class="text-sm font-medium text-foreground">
							Organización <span class="text-destructive" aria-hidden="true">*</span>
						</label>
						<select
							id="owner-org"
							bind:value={ownerOrg}
							aria-invalid={fieldErrors.owner_org ? "true" : undefined}
							aria-describedby={fieldErrors.owner_org ? "owner-org-error" : undefined}
							class={inputClass}
						>
							<option value="">Seleccione una organización</option>
							{#each organizations as org (org.id)}
								<option value={org.name}>{org.title}</option>
							{/each}
						</select>
						{#if fieldErrors.owner_org}
							<p id="owner-org-error" class="text-xs text-destructive">
								{fieldErrors.owner_org}
							</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<label for="license" class="text-sm font-medium text-foreground">Licencia</label>
						<select id="license" bind:value={licenseId} class={inputClass}>
							<option value="">Sin especificar</option>
							{#each LICENSE_IDS as id (id)}
								<option value={id}>{licenseLabel(id)}</option>
							{/each}
						</select>
					</div>
				</section>

				<!-- Etiquetas y visibilidad -->
				<section class="space-y-5 rounded-xl border border-border bg-card p-6">
					<h2 class="font-heading text-lg font-semibold text-primary">Etiquetas y visibilidad</h2>

					<div class="space-y-1.5">
						<label for="tags" class="text-sm font-medium text-foreground">Etiquetas</label>
						<input
							id="tags"
							type="text"
							bind:value={tagString}
							aria-describedby="tags-hint"
							class={inputClass}
						/>
						<p id="tags-hint" class="text-xs text-muted-foreground">
							Separe las etiquetas con comas (ej.: matrícula, estudiantes).
						</p>
					</div>

					<fieldset class="space-y-1.5">
						<legend class="text-sm font-medium text-foreground">Visibilidad</legend>
						<div class="flex flex-wrap items-center gap-4">
							<label class="flex items-center gap-2 text-sm text-muted-foreground">
								<input
									type="radio"
									name="visibility"
									value="private"
									bind:group={visibility}
									class="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								/>
								Privada
							</label>
							<label class="flex items-center gap-2 text-sm text-muted-foreground">
								<input
									type="radio"
									name="visibility"
									value="public"
									bind:group={visibility}
									class="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								/>
								Pública
							</label>
						</div>
						<p class="text-xs text-muted-foreground">
							Un dataset privado solo es visible para la organización dueña.
						</p>
					</fieldset>
				</section>

				<!-- Enlaces y contacto -->
				<section class="space-y-5 rounded-xl border border-border bg-card p-6">
					<h2 class="font-heading text-lg font-semibold text-primary">Enlaces y contacto</h2>

					<div class="space-y-1.5">
						<label for="url" class="text-sm font-medium text-foreground">
							Página de destino (URL)
						</label>
						<input id="url" type="url" bind:value={url} class={inputClass} />
					</div>

					<div class="grid gap-5 sm:grid-cols-2">
						<div class="space-y-1.5">
							<label for="maintainer" class="text-sm font-medium text-foreground">
								Mantenedor
							</label>
							<input id="maintainer" type="text" bind:value={maintainer} class={inputClass} />
						</div>
						<div class="space-y-1.5">
							<label for="maintainer-email" class="text-sm font-medium text-foreground">
								Correo del mantenedor
							</label>
							<input
								id="maintainer-email"
								type="email"
								bind:value={maintainerEmail}
								class={inputClass}
							/>
						</div>
					</div>
				</section>

				<!-- Archivos -->
				<section class="space-y-5 rounded-xl border border-border bg-card p-6">
					<h2 class="font-heading text-lg font-semibold text-primary">Archivos</h2>

					<div class="space-y-1.5">
						<label for="files" class="text-sm font-medium text-foreground">Archivos</label>
						<input
							id="files"
							type="file"
							multiple
							onchange={onFilesPicked}
							class="block w-full min-w-0 text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
						/>
						<p id="files-hint" class="text-xs text-muted-foreground">
							Hasta {LIMIT_MB} MB por archivo. Puede elegir varios.
						</p>
					</div>

					{#if rejectedFiles.length > 0}
						<div
							class="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
							role="alert"
						>
							<p class="text-sm font-medium text-destructive">
								Algunos archivos superan el límite y no se agregaron:
							</p>
							<ul class="mt-2 space-y-1 text-xs text-destructive">
								{#each rejectedFiles as rejected (rejected.name)}
									<li class="break-words">{rejected.message}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if fileEntries.length > 0}
						<ul class="space-y-2" aria-label="Archivos seleccionados">
							{#each fileEntries as entry (entry.key)}
								<li class="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
									<FileText class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-foreground">{entry.file.name}</p>
										{#if entry.status === "uploading"}
											<p class="text-xs text-muted-foreground">{entry.progress}%</p>
										{:else if entry.status === "error"}
											<p class="break-words text-xs text-destructive">{entry.error}</p>
										{:else if entry.status === "cancelled"}
											<p class="text-xs text-muted-foreground">Subida cancelada</p>
										{/if}
									</div>
									{#if entry.status === "uploading"}
										<button
											type="button"
											onclick={() => cancelUpload(entry.key)}
											aria-label={`Cancelar la subida de ${entry.file.name}`}
											class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<X class="size-4" aria-hidden="true" />
										</button>
									{:else if entry.status === "pending" || entry.status === "error" || entry.status === "cancelled"}
										<button
											type="button"
											onclick={() => removeFile(entry.key)}
											aria-label={`Quitar ${entry.file.name}`}
											class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<Trash2 class="size-4" aria-hidden="true" />
										</button>
									{:else}
										<Check class="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<!-- Errores y envío -->
				{#if submitError}
					<div
						class="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
						role="alert"
						aria-live="assertive"
					>
						<p class="text-sm text-destructive">{submitError}</p>
					</div>
				{/if}

				<button
					type="submit"
					disabled={submitting}
					aria-busy={submitting ? "true" : undefined}
					class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
				>
					{#if submitting}
						<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
						Publicando...
					{:else}
						<Upload class="size-4" aria-hidden="true" />
						Publicar dataset
					{/if}
				</button>

				{#if uploadFinished && failedUploads.length > 0}
					<div
						class="rounded-xl border border-destructive/30 bg-destructive/5 p-6"
						role="alert"
					>
						<TriangleAlert class="size-5 text-destructive" aria-hidden="true" />
						<h2 class="mt-2 font-heading text-lg font-semibold text-destructive">
							El dataset se creó, pero algunos archivos no se subieron
						</h2>
						<ul class="mt-3 space-y-1 text-sm text-destructive">
							{#each failedUploads as entry (entry.key)}
								<li class="break-words">
									{entry.file.name}: {entry.status === "cancelled"
										? "subida cancelada"
										: (entry.error ?? "No se pudo subir el archivo")}
								</li>
							{/each}
						</ul>
						<div class="mt-4 flex flex-wrap gap-3">
							<button
								type="button"
								onclick={retryFailedUploads}
								disabled={submitting}
								class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
							>
								<RotateCw class="size-4" aria-hidden="true" />
								Reintentar archivos fallidos
							</button>
							{#if createdDataset}
								<a
									href={`/dataset/${createdDataset.name}`}
									class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
								>
									Ver dataset
								</a>
							{/if}
						</div>
					</div>
				{/if}
			</form>
		{/if}
	</div>
{/if}
