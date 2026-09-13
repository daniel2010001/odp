<script lang="ts">
import {
	Building2,
	Check,
	ExternalLink,
	FileText,
	Info,
	Link,
	LoaderCircle,
	Lock,
	Pencil,
	RotateCw,
	Trash2,
	TriangleAlert,
	Upload,
	X,
} from "@lucide/svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createLicenseApi } from "$lib/api/licenses";
import { createOrganizationApi } from "$lib/api/organizations";
import { createResourceApi } from "$lib/api/resources";
import { UploadError, uploadResourceFile } from "$lib/api/upload";
import TagsInput from "$lib/components/form/TagsInput.svelte";
import MarkdownEditor from "$lib/components/markdown/MarkdownEditor.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import {
	datasetCreateSchema,
	licenseIdError,
	MAX_MAINTAINER_LENGTH,
	MAX_NOTES_LENGTH,
	MAX_SUMMARY_LENGTH,
	MAX_TITLE_LENGTH,
	MAX_URL_LENGTH,
} from "$lib/schemas/dataset";
import { auth, isAuthenticated } from "$lib/stores/auth";
import type { CkanLicense, CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import {
	buildPackagePayload,
	MAX_RESOURCE_BYTES,
	suggestSlug,
	validateResourceFile,
} from "$lib/utils/dataset-payload";
import { safeExternalUrl, unsafeUrlReason } from "$lib/utils/external-url";
import { curatedLicenseLabel } from "$lib/utils/licenses";

// ─── Constantes ──────────────────────────────────────────────────────
const LIMIT_MB = MAX_RESOURCE_BYTES / 1024 / 1024;

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
let summary = $state("");
let notes = $state("");
let ownerOrg = $state("");
let licenseId = $state("");
let tags = $state<string[]>([]);
let tagSugerencias = $state<string[]>([]);
let url = $state("");
let maintainer = $state("");
let maintainerEmail = $state("");

// ─── Licencias (cargadas desde CKAN) ─────────────────────────────────
let licenses = $state<CkanLicense[]>([]);
let licensesLoading = $state(true);
let licensesError = $state<string | null>(null);

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
		summary: summary.trim() || undefined,
		notes: notes || undefined,
		owner_org: ownerOrg,
		private: true,
		license_id: licenseId || undefined,
		tag_string: tags.join(", ") || undefined,
		url: url || undefined,
		maintainer: maintainer || undefined,
		maintainer_email: maintainerEmail || undefined,
	};
}

const validation = $derived(datasetCreateSchema.safeParse(formValues()));

// Ids de licencia que CKAN devolvió en `license_list`: la única lista válida para contrastar.
const idsOfrecidos = $derived(licenses.map((license) => license.id));

const allErrors = $derived.by(() => {
	const errors = validation.success
		? ({} as Record<string, string>)
		: mapZodErrors(validation.error.issues);
	// CKAN no valida `license_id` (verificado): se contrasta contra la lista cargada. Si la carga
	// falló no hay nada ofrecido, así que se omite la comprobación (la licencia es opcional).
	if (!licensesError) {
		const licenseErr = licenseIdError(licenseId || undefined, idsOfrecidos);
		if (licenseErr) errors.license_id = licenseErr;
	}
	return errors;
});

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
	{ field: "summary", id: "summary" },
	{ field: "notes", id: "notes" },
	{ field: "owner_org", id: "owner-org" },
	{ field: "license_id", id: "license" },
	{ field: "tag_string", id: "tag_string" },
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

/**
 * Estado del contador «X/Y»: **neutro** hasta el 80% del tope, **aviso** desde ahí y **error** al
 * pasarse. Los topes son de UX del portal, no de CKAN (ver `$lib/schemas/dataset`).
 */
function estadoContador(valor: string, max: number): "neutro" | "aviso" | "error" {
	if (valor.length > max) return "error";
	if (valor.length >= max * 0.8) return "aviso";
	return "neutro";
}

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
	void loadLicenses();
	void loadTagSuggestions();
});

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

// ─── Derivados de la ficha (resumen lateral) ─────────────────────────
const singleOrg = $derived(organizations.length === 1 ? organizations[0] : null);
const orgDisplayTitle = $derived(
	singleOrg ? singleOrg.title : (organizations.find((org) => org.name === ownerOrg)?.title ?? ""),
);

const selectedLicense = $derived(licenses.find((license) => license.id === licenseId) ?? null);
const safeLicenseUrl = $derived(selectedLicense ? safeExternalUrl(selectedLicense.url) : null);

interface FichaResource {
	key: string;
	tipo: "archivo" | "enlace";
	nombre: string;
}
const fichaResources = $derived<FichaResource[]>([
	...fileEntries.map((entry) => ({
		key: entry.key,
		tipo: "archivo" as const,
		nombre: entry.file.name,
	})),
	...linkEntries.map((entry) => ({
		key: entry.key,
		tipo: "enlace" as const,
		nombre: entry.name,
	})),
]);

const recomendados = $derived([
	{ label: "Recursos", ok: fileEntries.length + linkEntries.length > 0 },
	{ label: "Licencia", ok: licenseId !== "" },
	{ label: "Etiquetas", ok: tags.length > 0 },
]);
const recomendadosOk = $derived(recomendados.filter((c) => c.ok).length);
const recomendadosPendientes = $derived(recomendados.filter((c) => !c.ok));
const hayTitulo = $derived(title.trim().length > 0);
</script>

<svelte:head>
	<title>Publicar dataset — UMSS</title>
</svelte:head>

{#snippet contador(valor: string, max: number, id: string)}
	{@const estado = estadoContador(valor, max)}
	<span
		id={id}
		aria-live="polite"
		class={cn(
			"shrink-0 text-[11px] font-normal tabular-nums",
			estado === "error"
				? "font-semibold text-destructive"
				: estado === "aviso"
					? "text-destructive/70"
					: "text-muted-foreground",
		)}
	>
		{valor.length}/{max}
	</span>
{/snippet}

{#if authed}
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
				class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
				style="--label-offset: 0.5rem"
			>
				<div class="min-w-0 space-y-6">
					<!-- Metadatos básicos -->
					<section class="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
						<h2 class="font-heading text-lg font-semibold text-primary">Metadatos básicos</h2>

						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<label
									for="title"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									Título <span class="text-destructive" aria-hidden="true">*</span>
								</label>
								{@render contador(title, MAX_TITLE_LENGTH, "title-count")}
							</div>
							<input
								id="title"
								type="text"
								bind:value={title}
								onblur={() => markTouched("title")}
								aria-invalid={fieldErrors.title ? "true" : undefined}
								aria-describedby="title-count title-error"
								class={inputClass}
							/>
							{#if fieldErrors.title}
								<p id="title-error" class="pl-[var(--label-offset)] text-xs text-destructive">
									{fieldErrors.title}
								</p>
							{/if}
						</div>

						<div
							class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
						>
							<span class="block pl-[var(--label-offset)] text-sm font-medium text-foreground">
								Slug <span class="text-destructive" aria-hidden="true">*</span>
							</span>
							{#if slugEdited}
								<div class="flex gap-2">
									<input
										id="slug"
										aria-label="Slug"
										type="text"
										bind:value={slug}
										onblur={() => markTouched("name")}
										aria-invalid={fieldErrors.name ? "true" : undefined}
										aria-describedby={fieldErrors.name ? "slug-hint slug-error" : "slug-hint"}
										class={inputClass}
									/>
									<button
										type="button"
										onclick={() => (slugEdited = false)}
										class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<Lock class="size-4" aria-hidden="true" />
										Bloquear
									</button>
								</div>
							{:else}
								<div
									class="flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2"
								>
									<span class="truncate font-mono text-sm text-foreground">{slug}</span>
									<button
										type="button"
										onclick={() => (slugEdited = true)}
										class="inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<Pencil class="size-3.5" aria-hidden="true" />
										Editar
									</button>
								</div>
							{/if}
							<p id="slug-hint" class="text-xs text-muted-foreground">
								Se genera automáticamente a partir del título. Desbloquéelo sólo si necesita
								cambiarlo.
							</p>
							{#if fieldErrors.name}
								<p id="slug-error" class="text-xs text-destructive">{fieldErrors.name}</p>
							{/if}
						</div>

						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<label
									for="summary"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									Resumen
								</label>
								{@render contador(summary, MAX_SUMMARY_LENGTH, "summary-count")}
							</div>
							<input
								id="summary"
								type="text"
								bind:value={summary}
								aria-describedby="summary-count summary-help summary-error"
								placeholder="Una línea para las tarjetas del catálogo"
								class={inputClass}
								aria-invalid={fieldErrors.summary ? "true" : undefined}
								onblur={() => markTouched("summary")}
							/>
							{#if fieldErrors.summary}
								<p id="summary-error" class="pl-[var(--label-offset)] text-xs text-destructive">
									{fieldErrors.summary}
								</p>
							{/if}
							<p id="summary-help" class="pl-[var(--label-offset)] text-xs text-muted-foreground">
								Lo que se ve en las tarjetas del buscador. Si lo deja vacío, se usa un extracto de la
								descripción.
							</p>
						</div>

						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<label
									for="notes"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									Descripción
								</label>
								{@render contador(notes, MAX_NOTES_LENGTH, "notes-count")}
							</div>
							<MarkdownEditor
								id="notes"
								bind:value={notes}
								describedby="notes-count notes-error"
								invalid={Boolean(fieldErrors.notes)}
								onblur={() => markTouched("notes")}
								rows={4}
								placeholder="¿Qué contiene el dataset y para qué sirve?"
								class="{inputClass} h-auto"
							/>
							{#if fieldErrors.notes}
								<p id="notes-error" class="pl-[var(--label-offset)] text-xs text-destructive">
									{fieldErrors.notes}
								</p>
							{/if}
						</div>
					</section>

					<!-- Organización -->
					<section class="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
						<h2 class="font-heading text-lg font-semibold text-primary">Organización</h2>

						<div
							class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
						>
							{#if organizations.length === 1}
								<span class="block pl-[var(--label-offset)] text-sm font-medium text-foreground">
									Organización <span class="text-destructive" aria-hidden="true">*</span>
								</span>
								<div
									class="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2"
								>
									<Building2 class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span class="truncate text-sm text-foreground">{organizations[0].title}</span>
									<span
										class="ml-auto shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
									>
										Automática
									</span>
								</div>
								<p class="text-xs text-muted-foreground">
									Se asignó automáticamente: su cuenta pertenece a una sola organización. La
									visibilidad del dataset la definirá el flujo de publicación.
								</p>
							{:else}
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
								<p class="text-xs text-muted-foreground">
									Pertenece a más de una organización: elija dónde publicar. La visibilidad del
									dataset la definirá el flujo de publicación.
								</p>
							{/if}
						</div>
					</section>

					<!-- Metadatos adicionales -->
					<section class="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
						<div>
							<h2 class="font-heading text-lg font-semibold text-primary">Metadatos adicionales</h2>
							<p class="mt-1 text-sm text-muted-foreground">
								Etiquetas, licencia, sitio web del dataset y datos de contacto. Todos opcionales.
							</p>
						</div>

						<div class="space-y-5">
							<div
								class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
							>
								<label for="tag_string" class="text-sm font-medium text-foreground">
									Etiquetas
								</label>
								<TagsInput
									bind:value={tags}
									suggestions={tagSugerencias}
									id="tag_string"
									describedby="tags-help"
									invalid={Boolean(fieldErrors.tag_string)}
									placeholder="Busque o escriba una etiqueta…"
								/>
								{#if fieldErrors.tag_string}
									<p id="tags-error" class="text-xs text-destructive">{fieldErrors.tag_string}</p>
								{/if}
								<p id="tags-help" class="text-xs text-muted-foreground">
									Escriba para buscar entre las etiquetas existentes. Si no existe, se crea al
									agregarla.
								</p>
							</div>

							<div
								class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
							>
								<label for="license" class="text-sm font-medium text-foreground">Licencia</label>
								<select
									id="license"
									bind:value={licenseId}
									disabled={licensesLoading || licensesError !== null}
									aria-invalid={fieldErrors.license_id ? "true" : undefined}
									aria-describedby="license-help license-error"
									class={inputClass}
								>
									<option value="">Sin especificar</option>
									{#each licenses as license (license.id)}
										<option value={license.id}>{curatedLicenseLabel(license.id) ?? license.title}</option>
									{/each}
								</select>
								{#if licensesLoading}
									<p class="text-xs text-muted-foreground">Cargando licencias...</p>
								{:else if licensesError}
									<p class="text-xs text-destructive" role="alert">
										No se pudo cargar la lista de licencias. La licencia es opcional: puede publicar
										el dataset sin declarar una.
									</p>
								{/if}
								<div class="rounded-lg border border-border bg-muted/30 p-3" id="license-help">
									{#if selectedLicense}
										<p class="text-xs leading-relaxed text-muted-foreground">
											{selectedLicense.title}
											{#if selectedLicense.od_conformance}
												<span class="text-muted-foreground/70">
													· {selectedLicense.od_conformance}
												</span>
											{/if}
										</p>
										{#if safeLicenseUrl}
											<a
												href={safeLicenseUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2"
											>
												Ver los términos completos de la licencia
												<ExternalLink class="size-3" aria-hidden="true" />
											</a>
										{/if}
									{:else}
										<p class="text-xs leading-relaxed text-muted-foreground">
											El dataset no declara una licencia de uso.
										</p>
									{/if}
								</div>
								{#if fieldErrors.license_id}
									<p id="license-error" class="text-xs text-destructive">
										{fieldErrors.license_id}
									</p>
								{/if}
							</div>

							<div class="space-y-1.5">
								<div class="flex items-baseline justify-between gap-2">
									<label
										for="url"
										class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
									>
										Sitio web del dataset
									</label>
									{@render contador(url, MAX_URL_LENGTH, "url-count")}
								</div>
								<input
									id="url"
									type="url"
									bind:value={url}
									aria-describedby="url-count url-help url-error"
									placeholder="https://…"
									class={inputClass}
									aria-invalid={fieldErrors.url ? "true" : undefined}
									onblur={() => markTouched("url")}
								/>
								{#if fieldErrors.url}
									<p id="url-error" class="pl-[var(--label-offset)] text-xs text-destructive">
										{fieldErrors.url}
									</p>
								{/if}
								<p id="url-help" class="pl-[var(--label-offset)] text-xs text-muted-foreground">
									La página propia del dataset: el sitio de la unidad que lo publica. No es la URL de
									descarga de un recurso.
								</p>
							</div>

							<div class="grid gap-5 sm:grid-cols-2">
								<div class="space-y-1.5">
									<div class="flex items-baseline justify-between gap-2">
										<label
											for="maintainer"
											class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
										>
											Responsable
										</label>
										{@render contador(maintainer, MAX_MAINTAINER_LENGTH, "maintainer-count")}
									</div>
									<input
										id="maintainer"
										type="text"
										bind:value={maintainer}
										aria-describedby="maintainer-count maintainer-error"
										placeholder="Unidad de Datos"
										class={inputClass}
										aria-invalid={fieldErrors.maintainer ? "true" : undefined}
										onblur={() => markTouched("maintainer")}
									/>
									{#if fieldErrors.maintainer}
										<p
											id="maintainer-error"
											class="pl-[var(--label-offset)] text-xs text-destructive"
										>
											{fieldErrors.maintainer}
										</p>
									{/if}
								</div>
								<div
									class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
								>
									<label for="maintainer-email" class="text-sm font-medium text-foreground">
										Correo del responsable
									</label>
									<input
										id="maintainer-email"
										type="email"
										bind:value={maintainerEmail}
										placeholder="datos@umss.edu"
										class={inputClass}
										aria-invalid={fieldErrors.maintainer_email ? "true" : undefined}
										aria-describedby="maintainer-email-error"
										onblur={() => markTouched("maintainer_email")}
									/>
									{#if fieldErrors.maintainer_email}
										<p
											id="maintainer-email-error"
											class="pl-[var(--label-offset)] text-xs text-destructive"
										>
											{fieldErrors.maintainer_email}
										</p>
									{/if}
								</div>
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

					<!-- Fallo parcial: recursos que no se pudieron adjuntar -->
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
				</div>

				<aside class="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
					<!-- Ficha de publicación -->
					<Card class="overflow-hidden">
						<div
							class="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5"
						>
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">Resumen</p>
							{#if hayTitulo}
								<span
									class="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
								>
									{recomendadosOk}/{recomendados.length}
								</span>
							{/if}
						</div>

						<div class="space-y-4 p-4">
							<div>
								{#if hayTitulo}
									<h3 class="font-heading text-lg leading-tight font-semibold text-primary">
										{title}
									</h3>
									<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											class="h-full rounded-full bg-primary transition-[width] duration-300"
											style={`width: ${(recomendadosOk / recomendados.length) * 100}%`}
										></div>
									</div>
									<p class="mt-1 text-[11px] text-muted-foreground">
										{recomendadosOk} de {recomendados.length} datos recomendados
									</p>
								{:else}
									<p class="text-sm text-muted-foreground">Todavía no escribió un título.</p>
								{/if}
							</div>

							<ul class="space-y-2 text-sm">
								<li class="flex items-center gap-2">
									<Building2 class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span class="truncate">{orgDisplayTitle}</span>
								</li>
								<li class="flex items-center gap-2">
									<Lock class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
									<span>Privado</span>
									<span class="group relative inline-flex">
										<button
											type="button"
											aria-describedby="privacidad-ayuda"
											class="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<Info class="size-3.5" aria-hidden="true" />
											<span class="sr-only">Por qué el dataset es privado</span>
										</button>
										<span
											id="privacidad-ayuda"
											role="tooltip"
											class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-2 text-[11px] leading-relaxed text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
										>
											Todos los datasets se crean como <strong class="font-semibold">privados</strong
											>: el flujo de publicación es el que decide cuándo pasan a ser públicos.
										</span>
									</span>
								</li>
							</ul>

							<div class="rounded-lg border border-border bg-muted/30 p-3">
								<p class="text-xs font-semibold text-foreground">
									{fichaResources.length}
									{fichaResources.length === 1 ? "recurso" : "recursos"}
								</p>
								{#if fichaResources.length > 0}
									<ul class="mt-1.5 space-y-1">
										{#each fichaResources.slice(0, 3) as r (r.key)}
											<li class="flex items-center gap-1.5 text-xs text-muted-foreground">
												{#if r.tipo === "archivo"}
													<FileText class="size-3 shrink-0" aria-hidden="true" />
												{:else}
													<Link class="size-3 shrink-0" aria-hidden="true" />
												{/if}
												<span class="truncate">{r.nombre}</span>
											</li>
										{/each}
									</ul>
									{#if fichaResources.length > 3}
										<p class="mt-1 text-[11px] text-muted-foreground">
											+{fichaResources.length - 3} más
										</p>
									{/if}
								{:else}
									<p class="mt-1 text-[11px] text-muted-foreground">
										Puede publicar sin recursos y agregarlos después.
									</p>
								{/if}
							</div>

							{#if recomendadosPendientes.length > 0}
								<div class="rounded-lg border border-border bg-muted/40 p-3">
									<p class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
										<TriangleAlert class="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
										Faltan datos recomendados
									</p>
									<p class="mt-0.5 text-[11px] text-muted-foreground">
										Son opcionales: no bloquean la publicación.
									</p>
									<ul class="mt-1.5 flex flex-wrap gap-1.5">
										{#each recomendadosPendientes as campo (campo.label)}
											<li
												class="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
											>
												{campo.label}
											</li>
										{/each}
									</ul>
								</div>
							{:else}
								<p class="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
									<Check class="size-3.5" aria-hidden="true" />
									Todos los datos recomendados están completos
								</p>
							{/if}
						</div>
					</Card>

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

					<div class="space-y-2">
						<button
							type="submit"
							disabled={submitting}
							aria-busy={submitting ? "true" : undefined}
							class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
						>
							{#if submitting}
								<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
								Publicando...
							{:else}
								<Upload class="size-4" aria-hidden="true" />
								Publicar dataset
							{/if}
						</button>
						<a
							href="/dashboard"
							class="block rounded-lg border border-input bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							Cancelar
						</a>
						<p class="text-center text-xs text-muted-foreground">
							Podrá editarlo después de publicarlo.
						</p>
					</div>
				</aside>
			</form>
		{/if}
	</div>
{/if}
