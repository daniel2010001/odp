<script lang="ts">
import {
	Check,
	FileText,
	Info,
	Link,
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
import { createResourceApi } from "$lib/api/resources";
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
import { safeExternalUrl, unsafeUrlReason } from "$lib/utils/external-url";
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

// ─── Enlaces externos ──────────────────────────────────────────────────
type LinkStatus = "pending" | "done" | "error";
interface LinkEntry {
	key: string;
	name: string;
	url: string;
	status: LinkStatus;
	error?: string;
}
let linkEntries = $state<LinkEntry[]>([]);
let linkName = $state("");
let linkUrl = $state("");
let linkError = $state<string | null>(null);
let linkSeq = 0;

// ─── Estado del submit ───────────────────────────────────────────────
let submitting = $state(false);
let submitError = $state<string | null>(null);
// Campos que el usuario ya tocó (perdieron el foco): antes de eso no se le muestran errores, para no
// regañarlo mientras todavía no escribió nada.
let touched = $state<Record<string, boolean>>({});
// Se pone en true al intentar enviar: ahí se muestran **todos** los errores, no sólo los tocados.
let submitted = $state(false);
let createdDataset = $state<CkanPackage | null>(null);
let uploadFinished = $state(false);

// ─── Validación ────────────────────────────────────────────────────────
// Los errores se **derivan** del formulario en vez de acumularse en handlers: así, al corregir un
// campo, su error desaparece solo. `fieldErrors` muestra sólo los campos tocados (o todos si ya se
// intentó enviar), y `allErrors` es el conjunto completo que usa el resumen y el foco.

/** Valores del formulario con el mismo shape que espera el schema. */
function formValues() {
	return {
		name: slug.trim(),
		title: title.trim(),
		notes: notes || undefined,
		owner_org: ownerOrg,
		private: visibility === "private",
		license_id: licenseId || undefined,
		tag_string: tagString || undefined,
		url: url || undefined,
		maintainer: maintainer || undefined,
		maintainer_email: maintainerEmail || undefined,
	};
}

const validation = $derived(datasetCreateSchema.safeParse(formValues()));

const allErrors = $derived(
	validation.success ? ({} as Record<string, string>) : mapZodErrors(validation.error.issues),
);

const fieldErrors = $derived.by(() => {
	if (submitted) return allErrors;
	const visible: Record<string, string> = {};
	for (const [field, message] of Object.entries(allErrors)) {
		if (touched[field]) visible[field] = message;
	}
	return visible;
});

/**
 * Orden de los campos en el formulario y el `id` de su control. Es el único lugar donde se relaciona
 * el nombre del campo en el schema con el DOM: antes la UI buscaba `fieldErrors.slug` mientras el
 * schema emitía `name`, así que el error del slug **nunca se mostraba**.
 */
const FIELD_CONTROLS: { field: string; id: string }[] = [
	{ field: "title", id: "title" },
	{ field: "name", id: "slug" },
	{ field: "notes", id: "notes" },
	{ field: "owner_org", id: "owner-org" },
	{ field: "license_id", id: "license" },
	{ field: "tag_string", id: "tags" },
	{ field: "url", id: "url" },
	{ field: "maintainer", id: "maintainer" },
	{ field: "maintainer_email", id: "maintainer-email" },
];

/** Errores en orden de formulario, para el resumen y el foco. */
const errorList = $derived(
	FIELD_CONTROLS.filter(({ field }) => fieldErrors[field]).map(({ field, id }) => ({
		id,
		message: fieldErrors[field],
	})),
);

function focusField(id: string) {
	document.getElementById(id)?.focus();
}

function focusFirstInvalid() {
	const first = FIELD_CONTROLS.find(({ field }) => allErrors[field]);
	if (first) focusField(first.id);
}

function markTouched(field: string) {
	touched[field] = true;
}
// Recursos que fallaron (archivos y enlaces) para el reporte de fallo
// parcial y la navegación: solo se navega al dataset cuando no queda ninguno.
// ─── Derivados ───────────────────────────────────────────────────────
// Recursos que fallaron (archivos y enlaces) para el reporte de fallo
// parcial y la navegación: solo se navega al dataset cuando no queda ninguno.
interface FailedResource {
	key: string;
	label: string;
	reason: string;
}
const failedResources = $derived<FailedResource[]>([
	...fileEntries
		.filter((entry) => entry.status === "error" || entry.status === "cancelled")
		.map((entry) => ({
			key: entry.key,
			label: entry.file.name,
			reason:
				entry.status === "cancelled"
					? "subida cancelada"
					: (entry.error ?? "No se pudo subir el archivo"),
		})),
	...linkEntries
		.filter((entry) => entry.status === "error")
		.map((entry) => ({
			key: entry.key,
			label: entry.name,
			reason: entry.error ?? "No se pudo crear el enlace",
		})),
]);

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

function addLink() {
	const name = linkName.trim();
	const urlValue = linkUrl.trim();
	linkError = null;

	if (!name) {
		linkError = "Escriba un nombre para el enlace.";
		return;
	}
	if (!urlValue) {
		linkError = "Escriba la URL del enlace.";
		return;
	}
	// Política única de enlaces externos (`$lib/utils/external-url`): sólo http/https. Los
	// esquemas como `javascript:` o `data:` se guardan como `url` del recurso y el portal los
	// renderiza como `href`. Se distingue «no parsea» de «esquema no permitido» para el mensaje.
	const safeUrl = safeExternalUrl(urlValue);
	if (!safeUrl) {
		linkError =
			unsafeUrlReason(urlValue) === "protocol"
				? "El enlace debe usar los protocolos http o https."
				: "La URL no es válida. Use una dirección completa (ej.: https://...).";
		return;
	}

	linkEntries = [
		...linkEntries,
		{ key: `link-${linkSeq++}`, name, url: safeUrl, status: "pending" },
	];
	linkName = "";
	linkUrl = "";
}

function removeLink(key: string) {
	linkEntries = linkEntries.filter((entry) => entry.key !== key);
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

	const data = validation.data;
	if (!validation.success || !data) {
		submitted = true;
		submitError = null;
		focusFirstInvalid();
		return;
	}

	submitError = null;
	uploadFinished = false;
	submitting = true;

	try {
		const payload = buildPackagePayload({
			title: data.title,
			name: data.name,
			owner_org: data.owner_org,
			private: data.private,
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

		await runUploads(pkg.id);
		await createLinkResources(pkg.id);

		if (failedResources.length === 0) {
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

async function createLinkResources(packageId: string) {
	const client = makeClient();
	const resourceApi = createResourceApi(client);

	for (const entry of linkEntries) {
		if (entry.status === "done") continue;
		entry.error = undefined;
		try {
			await resourceApi.create({
				package_id: packageId,
				name: entry.name,
				url: entry.url,
			});
			entry.status = "done";
		} catch (err) {
			entry.status = "error";
			entry.error = err instanceof Error ? err.message : "No se pudo crear el enlace";
		}
	}
}

async function retryFailedResources() {
	if (!createdDataset || submitting) return;
	submitting = true;
	uploadFinished = false;
	try {
		await runUploads(createdDataset.id);
		await createLinkResources(createdDataset.id);
		if (failedResources.length === 0) {
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
							onblur={() => markTouched("title")}
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
							onblur={() => markTouched("name")}
							aria-invalid={fieldErrors.name ? "true" : undefined}
							aria-describedby={fieldErrors.name ? "slug-hint slug-error" : "slug-hint"}
							class={inputClass}
						/>
						<p id="slug-hint" class="text-xs text-muted-foreground">
							Se genera automáticamente a partir del título. Puede editarlo.
						</p>
						{#if fieldErrors.name}
							<p id="slug-error" class="text-xs text-destructive">{fieldErrors.name}</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<label for="notes" class="text-sm font-medium text-foreground">Descripción</label>
						<textarea
							id="notes"
							rows={4}
							bind:value={notes}
							onblur={() => markTouched("notes")}
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
							onblur={() => markTouched("owner_org")}
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
							onblur={() => markTouched("tag_string")}
							aria-invalid={fieldErrors.tag_string ? "true" : undefined}
							aria-describedby={fieldErrors.tag_string ? "tags-hint tags-error" : "tags-hint"}
							class={inputClass}
						/>
						<p id="tags-hint" class="text-xs text-muted-foreground">
							Separe las etiquetas con comas (ej.: matrícula, estudiantes).
						</p>
						{#if fieldErrors.tag_string}
							<p id="tags-error" class="text-xs text-destructive">{fieldErrors.tag_string}</p>
						{/if}
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
						<input
							id="url"
							type="url"
							bind:value={url}
							onblur={() => markTouched("url")}
							aria-invalid={fieldErrors.url ? "true" : undefined}
							aria-describedby={fieldErrors.url ? "url-error" : undefined}
							class={inputClass}
						/>
						{#if fieldErrors.url}
							<p id="url-error" class="text-xs text-destructive">{fieldErrors.url}</p>
						{/if}
					</div>

					<div class="grid gap-5 sm:grid-cols-2">
						<div class="space-y-1.5">
							<label for="maintainer" class="text-sm font-medium text-foreground">
								Mantenedor
							</label>
							<input
								id="maintainer"
								type="text"
								bind:value={maintainer}
								onblur={() => markTouched("maintainer")}
								class={inputClass}
							/>
						</div>
						<div class="space-y-1.5">
							<label for="maintainer-email" class="text-sm font-medium text-foreground">
								Correo del mantenedor
							</label>
							<input
								id="maintainer-email"
								type="email"
								bind:value={maintainerEmail}
								onblur={() => markTouched("maintainer_email")}
								aria-invalid={fieldErrors.maintainer_email ? "true" : undefined}
								aria-describedby={fieldErrors.maintainer_email ? "maintainer-email-error" : undefined}
								class={inputClass}
							/>
							{#if fieldErrors.maintainer_email}
								<p id="maintainer-email-error" class="text-xs text-destructive">
									{fieldErrors.maintainer_email}
								</p>
							{/if}
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

				<!-- Enlaces externos -->
				<section class="space-y-5 rounded-xl border border-border bg-card p-6">
					<h2 class="font-heading text-lg font-semibold text-primary">Enlaces externos</h2>
					<p class="text-sm text-muted-foreground">
						Agregue recursos que no son archivos, como páginas o servicios, mediante una URL.
					</p>

					<div class="grid gap-5 sm:grid-cols-2">
						<div class="space-y-1.5">
							<label for="link-name" class="text-sm font-medium text-foreground">
								Nombre del enlace
							</label>
							<input
								id="link-name"
								type="text"
								bind:value={linkName}
								aria-invalid={linkError ? "true" : undefined}
								aria-describedby={linkError ? "link-error" : undefined}
								class={inputClass}
							/>
						</div>
						<div class="space-y-1.5">
							<label for="link-url" class="text-sm font-medium text-foreground">
								URL del enlace
							</label>
							<input
								id="link-url"
								type="url"
								bind:value={linkUrl}
								aria-invalid={linkError ? "true" : undefined}
								aria-describedby={linkError ? "link-error" : undefined}
								class={inputClass}
							/>
						</div>
					</div>

					{#if linkError}
						<p id="link-error" class="text-xs text-destructive" role="alert">{linkError}</p>
					{/if}

					<button
						type="button"
						onclick={addLink}
						disabled={submitting}
						class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
					>
						<Link class="size-4" aria-hidden="true" />
						Agregar enlace
					</button>

					{#if linkEntries.length > 0}
						<ul class="space-y-2" aria-label="Enlaces agregados">
							{#each linkEntries as entry (entry.key)}
								<li class="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
									<Link class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-foreground">{entry.name}</p>
										<p class="truncate text-xs text-muted-foreground">{entry.url}</p>
										{#if entry.status === "error"}
											<p class="break-words text-xs text-destructive">{entry.error}</p>
										{/if}
									</div>
									{#if entry.status === "pending" || entry.status === "error"}
										<button
											type="button"
											onclick={() => removeLink(entry.key)}
											aria-label={`Quitar el enlace ${entry.name}`}
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
				{#if submitted && errorList.length > 0}
					<div
						class="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
						role="alert"
						aria-live="assertive"
					>
						<p class="text-sm font-medium text-destructive">
							{errorList.length === 1
								? "Corrija 1 campo antes de publicar:"
								: `Corrija ${errorList.length} campos antes de publicar:`}
						</p>
						<ul class="mt-2 space-y-1">
							{#each errorList as error (error.id)}
								<li>
									<a
										href={`#${error.id}`}
										onclick={(event) => {
											event.preventDefault();
											focusField(error.id);
										}}
										class="text-xs text-destructive underline underline-offset-2 hover:no-underline"
									>
										{error.message}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

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

				{#if uploadFinished && failedResources.length > 0}
					<div
						class="rounded-xl border border-destructive/30 bg-destructive/5 p-6"
						role="alert"
					>
						<TriangleAlert class="size-5 text-destructive" aria-hidden="true" />
						<h2 class="mt-2 font-heading text-lg font-semibold text-destructive">
							El dataset se creó, pero algunos recursos no se pudieron adjuntar
						</h2>
						<ul class="mt-3 space-y-1 text-sm text-destructive">
							{#each failedResources as entry (entry.key)}
								<li class="break-words">{entry.label}: {entry.reason}</li>
							{/each}
						</ul>
						<div class="mt-4 flex flex-wrap gap-3">
							<button
								type="button"
								onclick={retryFailedResources}
								disabled={submitting}
								class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
							>
								<RotateCw class="size-4" aria-hidden="true" />
								Reintentar recursos fallidos
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
