<!--
	Hoja de revisión del módulo de edición y borrado de datasets — `/dev/dataset-edit`.

	Decide, antes de aprobar el módulo `2026-10-02-dataset-edit-and-delete`:
	  1. El formulario en modo edición, prellenado, con los **mismos campos, orden, etiquetas, ayudas
	     y mensajes de validación** del asistente de creación.
	  2. El payload **parcial** que una edición envía, frente a lo que deliberadamente no envía.
	  3. Los puntos de entrada («Editar» / «Eliminar») en la página del dataset, en tres estados de
	     permiso.
	  4. La confirmación del borrado lógico con sus tres verdades.
	  5. El flujo de reemplazo de archivo en sus tres estados (hash distinto, mismos bytes, sin hash).
	  6. La nota de que la visibilidad no se edita acá.

	─── Qué es real y qué es copia ─────────────────────────────────────
	Real (se importa y se ejecuta el código del repo):
	  · `$lib/components/form/TagsInput.svelte` y `$lib/components/markdown/MarkdownEditor.svelte`.
	  · `Card` y `Button` de la librería de UI.
	  · `datasetCreateSchema`, `licenseIdError` y las constantes `MAX_*` de `$lib/schemas/dataset`:
	    los mensajes de validación son los que rige el asistente, no una copia.
	  · `buildPackagePayload` (el builder real, en su forma de creación) para contrastar payloads.
	  · `SHOWCASE_DATASET` y `MOCK_ORGS` de `$lib/mock/data` como dataset prellenado.
	Copia (marcada abajo donde aparece):
	  · El layout del formulario y la sección «Recursos»: son el markup del asistente
	    (`src/routes/dashboard/datasets/new/+page.svelte`) antes de extraerlo a `DatasetForm`.
	  · El selector de licencia (él vive inline en el asistente) y la lista de licencias ofrecidas
	    (en el asistente llega de `license_list` de CKAN).
	  · El panel del payload parcial: el builder mode-aware (`buildPackagePayload(input, "edit")`)
	    todavía no existe; acá se dibuja el contrato del diseño.
	  · La página del dataset, la confirmación de borrado y el flujo de reemplazo: propuestas.
	No hay `{@html}` propio. El JSON de la hoja es dev-chrome, no UI de producto.

	Esta hoja se borra al promover: lo que se apruebe va al formulario y a la página reales.
-->
<script lang="ts">
import {
	Check,
	FileText,
	Info,
	Link,
	Lock,
	Pencil,
	ShieldAlert,
	Trash2,
	TriangleAlert,
	Unlock,
	Upload,
} from "@lucide/svelte";
import TagsInput from "$lib/components/form/TagsInput.svelte";
import MarkdownEditor from "$lib/components/markdown/MarkdownEditor.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { SHOWCASE_DATASET } from "$lib/mock/data";
import {
	datasetCreateSchema,
	licenseIdError,
	MAX_MAINTAINER_LENGTH,
	MAX_NOTES_LENGTH,
	MAX_SUMMARY_LENGTH,
	MAX_TITLE_LENGTH,
	MAX_URL_LENGTH,
} from "$lib/schemas/dataset";
import { cn } from "$lib/utils";
import { buildPackagePayload } from "$lib/utils/dataset-payload";
import { SUMMARY_EXTRA_KEY } from "$lib/utils/dataset-summary";
import { curatedLicenseLabel } from "$lib/utils/licenses";

// ─── Constantes de presentación (copiadas del asistente) ────────────
const inputClass =
	"h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// ─── Dataset de partida ─────────────────────────────────────────────
const DATASET = SHOWCASE_DATASET;

// La fixture no trae el extra `summary` (RF-40) que guarda el resumen corto del portal. Para que
// el panel del payload parcial muestre también ese campo opcional con valor, se completa acá: es
// el único valor ilustrativo del prellenado.
const RESUMEN_INICIAL =
	"Datos abiertos de movilidad urbana del área metropolitana de Cochabamba. Cobertura 2019–2025, actualización trimestral.";

// ─── Licencias ofrecidas (copia: en el asistente llegan de `license_list`) ──
const LICENCIAS = [
	"cc-by",
	"cc-by-sa",
	"cc-by-nd",
	"cc-by-nc-nd",
	"cc-zero",
	"odbl",
	"odc-odbl",
	"odc-by",
	"odc-pddl",
	"other-open",
	"other-at",
	"other-closed",
	"other",
].map((id) => ({ id, label: curatedLicenseLabel(id) ?? id }));

const TAG_SUGERENCIAS = DATASET.tags.map((tag) => tag.name);

// ─── Formulario en modo edición ─────────────────────────────────────
let title = $state(DATASET.title);
let slug = $state(DATASET.name);
let slugUnlocked = $state(false);
let summary = $state(RESUMEN_INICIAL);
let notes = $state(DATASET.notes ?? "");
let ownerOrg = $state(DATASET.organization?.name ?? "");
let licenseId = $state(DATASET.license_id ?? "");
let tags = $state<string[]>(DATASET.tags.map((tag) => tag.name));
let url = $state("");
let maintainer = $state(DATASET.maintainer ?? "");
let maintainerEmail = $state("");

let touched = $state<Record<string, boolean>>({});
let submitted = $state(false);

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

const idsOfrecidos = $derived(LICENCIAS.map((license) => license.id));

const allErrors = $derived.by(() => {
	const errors = validation.success
		? ({} as Record<string, string>)
		: mapZodErrors(validation.error.issues);
	const licenseErr = licenseIdError(licenseId || undefined, idsOfrecidos);
	if (licenseErr) errors.license_id = licenseErr;
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

const FIELD_CONTROLS: { field: string; id: string }[] = [
	{ field: "title", id: "edit-title" },
	{ field: "name", id: "edit-slug" },
	{ field: "summary", id: "edit-summary" },
	{ field: "notes", id: "edit-notes" },
	{ field: "owner_org", id: "edit-owner-org" },
	{ field: "tag_string", id: "edit-tag_string" },
	{ field: "license_id", id: "edit-license" },
	{ field: "url", id: "edit-url" },
	{ field: "maintainer", id: "edit-maintainer" },
	{ field: "maintainer_email", id: "edit-maintainer-email" },
];

const errorList = $derived(
	FIELD_CONTROLS.filter(({ field }) => fieldErrors[field]).map(({ field, id }) => ({
		id,
		message: fieldErrors[field],
	})),
);

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

function markTouched(field: string) {
	touched[field] = true;
}

function focusField(id: string) {
	document.getElementById(id)?.focus();
}

function focusFirstInvalid() {
	const first = FIELD_CONTROLS.find(({ field }) => allErrors[field]);
	if (first) focusField(first.id);
}

function handleSubmit() {
	if (!validation.success) {
		submitted = true;
		focusFirstInvalid();
		return;
	}
	// En el producto esto llamaría a `datasetApi.patch` con el payload parcial. Acá no se envía
	// nada: la hoja sólo muestra lo que la edición enviaría.
}

/** Estado del contador «X/Y»: neutro hasta el 80 %, aviso desde ahí y error al pasarse. */
function estadoContador(valor: string, max: number): "neutro" | "aviso" | "error" {
	if (valor.length > max) return "error";
	if (valor.length >= max * 0.8) return "aviso";
	return "neutro";
}

// ─── Payload parcial (copia del contrato de diseño) ─────────────────
// El builder mode-aware todavía no existe. Esto dibuja lo que el diseño promete que una edición
// envía: sólo los campos que el formulario gobierna, omitiendo los opcionales vacíos.
const payloadParcial = $derived.by((): Record<string, string> => {
	const payload: Record<string, string> = {
		title: title.trim(),
		name: slug.trim(),
		owner_org: ownerOrg,
	};
	if (summary.trim()) payload.summary_extra = summary.trim();
	if (notes.trim()) payload.notes = notes.trim();
	if (licenseId) payload.license_id = licenseId;
	if (tags.length > 0) payload.tag_string = tags.join(", ");
	if (url.trim()) payload.url = url.trim();
	if (maintainer.trim()) payload.maintainer = maintainer.trim();
	if (maintainerEmail.trim()) payload.maintainer_email = maintainerEmail.trim();
	return payload;
});

// El payload de creación **real** (el mismo builder que usa hoy el asistente), para contrastar.
const payloadCreacion = $derived(
	buildPackagePayload({
		title: title.trim(),
		name: slug.trim(),
		owner_org: ownerOrg,
		private: true,
		summary: summary.trim() || undefined,
		notes: notes || undefined,
		license_id: licenseId || undefined,
		tag_string: tags.join(", ") || undefined,
		url: url || undefined,
		maintainer: maintainer || undefined,
		maintainer_email: maintainerEmail || undefined,
	}),
);

// Extras del dataset que el portal no gobierna: deben sobrevivir a la edición (spec: «Fields the
// portal does not own survive an edit»). La actualización NO parcial de CKAN los borraría.
const extrasNoGestionados = DATASET.extras.filter((extra) => extra.key !== SUMMARY_EXTRA_KEY);

const camposNoEnviados: { field: string; reason: string }[] = [
	{
		field: "private",
		reason: "La visibilidad va por el flujo de publicación, no por esta edición.",
	},
	{ field: "state", reason: "La edición no escribe estado; sólo el borrado lógico lo toca." },
	{
		field: "resources",
		reason:
			"Parchar la lista la reemplazaría entera. Cada recurso se escribe de a uno con resource_patch.",
	},
	{ field: "id", reason: "Identificador interno de CKAN." },
	{ field: "groups", reason: "No lo gobierna este formulario." },
	{ field: "tags", reason: "El formulario envía tag_string; CKAN deriva el arreglo." },
	{ field: "author", reason: "Campo que el formulario de esta versión no edita." },
	{ field: "license_title", reason: "Lo deriva CKAN del license_id." },
	{ field: "metadata_created", reason: "Lo escribe CKAN." },
	{ field: "metadata_modified", reason: "Lo escribe CKAN." },
	{ field: "creator_user_id", reason: "Lo escribe CKAN." },
];

// ─── Control del playground (dev-chrome) ────────────────────────────
type PermState = "puede-editar" | "no-puede-editar" | "permiso-fallo";
type DeleteVariant = "confirmacion-estandar" | "nombra-slug";
type FileState = "distinto" | "mismos-bytes" | "sin-hash";

let permState = $state<PermState>("puede-editar");
let deleteVariant = $state<DeleteVariant>("confirmacion-estandar");
let fileState = $state<FileState>("distinto");

const PERM_OPCIONES: { id: PermState; label: string; intent: string }[] = [
	{
		id: "puede-editar",
		label: "Puede editar",
		intent:
			"CKAN respondió que su rol en la organización permite update_dataset: se muestran «Editar» y «Eliminar».",
	},
	{
		id: "no-puede-editar",
		label: "No puede editar",
		intent:
			"CKAN respondió que su rol no permite update_dataset: no se muestra ninguna acción. El silencio es la respuesta, y no se dispara ninguna petición destinada a fallar.",
	},
	{
		id: "permiso-fallo",
		label: "El permiso falló",
		intent:
			"La consulta de permiso no se pudo responder (red, 5xx, timeout): no se muestra ninguna acción y la página dice que no pudo verificarse, sin afirmar que usted no tiene permiso.",
	},
];
const permIntent = $derived(PERM_OPCIONES.find((opcion) => opcion.id === permState)?.intent ?? "");

const DELETE_OPCIONES: { id: DeleteVariant; label: string; intent: string }[] = [
	{
		id: "confirmacion-estandar",
		label: "Confirmación tal como se leería",
		intent: "Las tres verdades sin nombrar el slug en la tercera.",
	},
	{
		id: "nombra-slug",
		label: "Variante que nombra el slug",
		intent:
			"La misma confirmación, pero la tercera verdad nombra el slug concreto que queda tomado.",
	},
];
const deleteIntent = $derived(
	DELETE_OPCIONES.find((opcion) => opcion.id === deleteVariant)?.intent ?? "",
);

const FILE_OPCIONES: { id: FileState; label: string; intent: string }[] = [
	{
		id: "distinto",
		label: "Un archivo distinto",
		intent:
			"El hash del archivo elegido no coincide con el registrado: se ofrece el reemplazo y el motivo es obligatorio.",
	},
	{
		id: "mismos-bytes",
		label: "Los mismos bytes",
		intent:
			"El hash coincide con el registrado: se rechaza el reemplazo y se dice que el archivo es idéntico. No se emite ninguna escritura.",
	},
	{
		id: "sin-hash",
		label: "Sin hash registrado",
		intent:
			"El recurso no tiene hash: se dice «sin hash registrado» y nunca que el archivo no cambió.",
	},
];
const fileIntent = $derived(FILE_OPCIONES.find((opcion) => opcion.id === fileState)?.intent ?? "");

// Recurso en edición para el flujo de reemplazo. `res-showcase-1` es un CSV con hash registrado;
// el recurso «sin hash» es el ejemplo que el spec describe (un recurso anterior a este cambio):
// la fixture siempre trae hash, así que acá se dibuja el estado, no se toma de los datos.
const RECURSO_HASH_ACTUAL = "sha256-a1b2c3d4e5f6";
const RECURSO_HASH_NUEVO = "sha256-9f3c1e77b0a4";
</script>

<svelte:head>
	<title>Hoja de revisión — Editar y eliminar datasets — UMSS</title>
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

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
		<header>
			<h1 class="font-heading text-3xl font-bold text-primary">
				Editar y eliminar datasets — hoja de revisión
			</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Propuesta del módulo <code class="font-mono text-xs"
					>2026-10-02-dataset-edit-and-delete</code
				>. Lo que se apruebe acá se promueve al formulario y a la página reales; esta hoja se
				borra.
			</p>
		</header>

		<p
			class="flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>
				Página sólo para desarrollo. En producción responde 404. Los campos y los mensajes de
				validación son <strong class="font-semibold">reales</strong> (salen del schema del
				asistente); el layout, el payload parcial y las tres pantallas de propuesta son
				<strong class="font-semibold">copia declarada</strong>.
			</span>
		</p>

		<!-- ─── Panel de control (dev-chrome) ──────────────────────────── -->
		<section class="space-y-4 rounded-xl border border-dashed border-border bg-muted/40 p-4">
			<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				Control de la hoja (no es UI de producto)
			</p>

			<div>
				<p class="text-xs font-medium text-foreground">Estado del permiso</p>
				<div role="group" aria-label="Estado del permiso" class="mt-2 flex flex-wrap gap-2">
					{#each PERM_OPCIONES as opcion (opcion.id)}
						<button
							type="button"
							aria-pressed={permState === opcion.id}
							onclick={() => (permState = opcion.id)}
							class={cn(
								"inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
								permState === opcion.id
									? "border-primary bg-primary text-primary-foreground"
									: "border-input bg-background text-foreground hover:bg-accent",
							)}
						>
							{opcion.label}
						</button>
					{/each}
				</div>
				<p class="mt-2 text-xs leading-relaxed text-muted-foreground">{permIntent}</p>
			</div>

			<div>
				<p class="text-xs font-medium text-foreground">Confirmación de borrado</p>
				<div role="group" aria-label="Confirmación de borrado" class="mt-2 flex flex-wrap gap-2">
					{#each DELETE_OPCIONES as opcion (opcion.id)}
						<button
							type="button"
							aria-pressed={deleteVariant === opcion.id}
							onclick={() => (deleteVariant = opcion.id)}
							class={cn(
								"inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
								deleteVariant === opcion.id
									? "border-primary bg-primary text-primary-foreground"
									: "border-input bg-background text-foreground hover:bg-accent",
							)}
						>
							{opcion.label}
						</button>
					{/each}
				</div>
				<p class="mt-2 text-xs leading-relaxed text-muted-foreground">{deleteIntent}</p>
			</div>

			<div>
				<p class="text-xs font-medium text-foreground">Estado del archivo</p>
				<div role="group" aria-label="Estado del archivo" class="mt-2 flex flex-wrap gap-2">
					{#each FILE_OPCIONES as opcion (opcion.id)}
						<button
							type="button"
							aria-pressed={fileState === opcion.id}
							onclick={() => (fileState = opcion.id)}
							class={cn(
								"inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
								fileState === opcion.id
									? "border-primary bg-primary text-primary-foreground"
									: "border-input bg-background text-foreground hover:bg-accent",
							)}
						>
							{opcion.label}
						</button>
					{/each}
				</div>
				<p class="mt-2 text-xs leading-relaxed text-muted-foreground">{fileIntent}</p>
			</div>
		</section>

		<!-- ─── 1. Formulario en modo edición ──────────────────────────── -->
		<section class="space-y-4">
			<div>
				<h2 class="font-heading text-2xl font-bold text-primary">
					1 · El formulario en modo edición
				</h2>
				<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					Mismos campos, mismo orden, mismas etiquetas, ayudas y mensajes que el asistente de
					creación. Lo único distinto es el modo: el título del encabezado, el botón que guarda y
					el slug, que llega fijo. Desbloquee el slug para ver los mensajes reales de validación.
				</p>
				<p class="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
					<span class="font-semibold text-foreground">Copia:</span> el layout y la sección
					«Recursos» son markup del asistente (su extracción a <code class="font-mono text-xs"
						>DatasetForm</code
					> todavía no ocurrió). <span class="font-semibold text-foreground">Real:</span>
					<code class="font-mono text-xs">TagsInput</code>, el editor de markdown y el schema de
					validación.
				</p>
			</div>

			<form
				onsubmit={(event) => {
					event.preventDefault();
					handleSubmit();
				}}
				novalidate
				class="grid grid-cols-1 gap-8 rounded-xl border border-border bg-card p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]"
				style="--label-offset: 0.5rem"
			>
				<div class="min-w-0 space-y-6">
					<!-- Metadatos básicos -->
					<section class="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
						<h3 class="font-heading text-lg font-semibold text-primary">Metadatos básicos</h3>

						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<label
									for="edit-title"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									Título <span class="text-destructive" aria-hidden="true">*</span>
								</label>
								{@render contador(title, MAX_TITLE_LENGTH, "edit-title-count")}
							</div>
							<input
								id="edit-title"
								type="text"
								bind:value={title}
								onblur={() => markTouched("title")}
								aria-invalid={fieldErrors.title ? "true" : undefined}
								aria-describedby="edit-title-count edit-title-error"
								class={inputClass}
							/>
							{#if fieldErrors.title}
								<p
									id="edit-title-error"
									class="pl-[var(--label-offset)] text-xs text-destructive"
								>
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
							{#if slugUnlocked}
								<div class="flex gap-2">
									<input
										id="edit-slug"
										aria-label="Slug"
										type="text"
										bind:value={slug}
										onblur={() => markTouched("name")}
										aria-invalid={fieldErrors.name ? "true" : undefined}
										aria-describedby={fieldErrors.name
											? "edit-slug-hint edit-slug-error"
											: "edit-slug-hint"}
										class="{inputClass} font-mono"
									/>
									<button
										type="button"
										onclick={() => (slugUnlocked = false)}
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
									<span id="edit-slug" class="truncate font-mono text-sm text-foreground"
										>{slug}</span
									>
									<button
										type="button"
										onclick={() => (slugUnlocked = true)}
										class="inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<Unlock class="size-3.5" aria-hidden="true" />
										Desbloquear
									</button>
								</div>
							{/if}
							<p id="edit-slug-hint" class="text-xs text-muted-foreground">
								{#if slugUnlocked}
									Cambiarlo rompe todos los enlaces existentes al dataset. Desbloquéelo sólo si
									sabe que el enlace anterior debe dejar de funcionar.
								{:else}
									El slug identifica al dataset en su dirección web y se presenta fijo: cambiarlo
									rompería todos los enlaces existentes.
								{/if}
							</p>
							{#if fieldErrors.name}
								<p id="edit-slug-error" class="text-xs text-destructive">{fieldErrors.name}</p>
							{/if}
						</div>

						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<label
									for="edit-summary"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									Resumen
								</label>
								{@render contador(summary, MAX_SUMMARY_LENGTH, "edit-summary-count")}
							</div>
							<textarea
								id="edit-summary"
								rows="2"
								bind:value={summary}
								aria-describedby="edit-summary-count edit-summary-help edit-summary-error"
								placeholder="Un resumen breve para las tarjetas del catálogo"
								class="{inputClass} h-auto"
								aria-invalid={fieldErrors.summary ? "true" : undefined}
								onblur={() => markTouched("summary")}
							></textarea>
							{#if fieldErrors.summary}
								<p
									id="edit-summary-error"
									class="pl-[var(--label-offset)] text-xs text-destructive"
								>
									{fieldErrors.summary}
								</p>
							{/if}
							<p
								id="edit-summary-help"
								class="pl-[var(--label-offset)] text-xs text-muted-foreground"
							>
								Lo que se ve en las tarjetas del buscador. Si lo deja vacío, se usa un extracto de
								la descripción.
							</p>
						</div>

						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<label
									for="edit-notes"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									Descripción
								</label>
								{@render contador(notes, MAX_NOTES_LENGTH, "edit-notes-count")}
							</div>
							<MarkdownEditor
								id="edit-notes"
								bind:value={notes}
								describedby="edit-notes-count edit-notes-error"
								invalid={Boolean(fieldErrors.notes)}
								onblur={() => markTouched("notes")}
								rows={6}
								placeholder="¿Qué contiene el dataset y para qué sirve?"
								class="{inputClass} h-auto"
							/>
							{#if fieldErrors.notes}
								<p
									id="edit-notes-error"
									class="pl-[var(--label-offset)] text-xs text-destructive"
								>
									{fieldErrors.notes}
								</p>
							{/if}
						</div>
					</section>

					<!-- Organización -->
					<section class="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
						<h3 class="font-heading text-lg font-semibold text-primary">Organización</h3>

						<div
							class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
						>
							<label for="edit-owner-org" class="text-sm font-medium text-foreground">
								Organización <span class="text-destructive" aria-hidden="true">*</span>
							</label>
							<select
								id="edit-owner-org"
								bind:value={ownerOrg}
								onblur={() => markTouched("owner_org")}
								aria-invalid={fieldErrors.owner_org ? "true" : undefined}
								aria-describedby={fieldErrors.owner_org ? "edit-owner-org-error" : undefined}
								class={inputClass}
							>
								<option value="">Seleccione una organización</option>
								<option value="fcyt">Facultad de Ciencias y Tecnología</option>
								<option value="fcs">Facultad de Ciencias de la Salud</option>
								<option value="fca">Facultad de Ciencias Agrícolas</option>
								<option value="rectorado">Rectorado UMSS</option>
								<option value="direccion-investigacion">Dirección de Investigación</option>
							</select>
							{#if fieldErrors.owner_org}
								<p id="edit-owner-org-error" class="text-xs text-destructive">
									{fieldErrors.owner_org}
								</p>
							{/if}
							<p class="text-xs text-muted-foreground">
								La organización dueña del dataset. La visibilidad la definirá el flujo de
								publicación.
							</p>
						</div>

						<!-- 6. Aviso de visibilidad -->
						<div class="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
							<Lock class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<p class="text-xs leading-relaxed text-muted-foreground">
								<strong class="font-semibold text-foreground"
									>La visibilidad no se edita acá.</strong
								>
								Este dataset es <strong class="font-semibold text-foreground">Privado</strong>, y
								seguirá siéndolo después de guardar. Pasar a público es una decisión del flujo de
								publicación: esta edición no incluye ningún campo de visibilidad en su payload.
							</p>
						</div>
					</section>

					<!-- Metadatos adicionales -->
					<section class="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
						<div>
							<h3 class="font-heading text-lg font-semibold text-primary">
								Metadatos adicionales
							</h3>
							<p class="mt-1 text-sm text-muted-foreground">
								Etiquetas, licencia, sitio web del dataset y datos de contacto. Todos opcionales.
							</p>
						</div>

						<div class="space-y-5">
							<div
								class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
							>
								<label for="edit-tag_string" class="text-sm font-medium text-foreground">
									Etiquetas
								</label>
								<TagsInput
									id="edit-tag_string"
									bind:value={tags}
									suggestions={TAG_SUGERENCIAS}
									describedby="edit-tags-help"
									invalid={Boolean(fieldErrors.tag_string)}
									placeholder="Busque o escriba una etiqueta…"
								/>
								{#if fieldErrors.tag_string}
									<p id="edit-tags-error" class="text-xs text-destructive">
										{fieldErrors.tag_string}
									</p>
								{/if}
								<p id="edit-tags-help" class="text-xs text-muted-foreground">
									Escriba para buscar entre las etiquetas existentes. Si no existe, se crea al
									agregarla.
								</p>
							</div>

							<div
								class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
							>
								<label for="edit-license" class="text-sm font-medium text-foreground">
									Licencia
								</label>
								<select
									id="edit-license"
									bind:value={licenseId}
									aria-invalid={fieldErrors.license_id ? "true" : undefined}
									aria-describedby="edit-license-help edit-license-error"
									class={inputClass}
								>
									<option value="">Sin especificar</option>
									{#each LICENCIAS as license (license.id)}
										<option value={license.id}>{license.label}</option>
									{/each}
								</select>
								<div
									class="rounded-lg border border-border bg-muted/30 p-3"
									id="edit-license-help"
								>
									<p class="text-xs leading-relaxed text-muted-foreground">
										{#if licenseId}
											{curatedLicenseLabel(licenseId) ?? licenseId}
										{:else}
											El dataset no declara una licencia de uso.
										{/if}
									</p>
								</div>
								{#if fieldErrors.license_id}
									<p id="edit-license-error" class="text-xs text-destructive">
										{fieldErrors.license_id}
									</p>
								{/if}
							</div>

							<div class="space-y-1.5">
								<div class="flex items-baseline justify-between gap-2">
									<label
										for="edit-url"
										class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
									>
										Sitio web del dataset
									</label>
									{@render contador(url, MAX_URL_LENGTH, "edit-url-count")}
								</div>
								<input
									id="edit-url"
									type="url"
									bind:value={url}
									aria-describedby="edit-url-count edit-url-help edit-url-error"
									placeholder="https://…"
									class={inputClass}
									aria-invalid={fieldErrors.url ? "true" : undefined}
									onblur={() => markTouched("url")}
								/>
								{#if fieldErrors.url}
									<p id="edit-url-error" class="pl-[var(--label-offset)] text-xs text-destructive">
										{fieldErrors.url}
									</p>
								{/if}
								<p
									id="edit-url-help"
									class="pl-[var(--label-offset)] text-xs text-muted-foreground"
								>
									La página propia del dataset: el sitio de la unidad que lo publica. No es la
									URL de descarga de un recurso.
								</p>
							</div>

							<div class="grid gap-5 sm:grid-cols-2">
								<div class="space-y-1.5">
									<div class="flex items-baseline justify-between gap-2">
										<label
											for="edit-maintainer"
											class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
										>
											Responsable
										</label>
										{@render contador(
											maintainer,
											MAX_MAINTAINER_LENGTH,
											"edit-maintainer-count",
										)}
									</div>
									<input
										id="edit-maintainer"
										type="text"
										bind:value={maintainer}
										aria-describedby="edit-maintainer-count edit-maintainer-error"
										placeholder="Unidad de Datos"
										class={inputClass}
										aria-invalid={fieldErrors.maintainer ? "true" : undefined}
										onblur={() => markTouched("maintainer")}
									/>
									{#if fieldErrors.maintainer}
										<p
											id="edit-maintainer-error"
											class="pl-[var(--label-offset)] text-xs text-destructive"
										>
											{fieldErrors.maintainer}
										</p>
									{/if}
								</div>
								<div
									class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"
								>
									<label for="edit-maintainer-email" class="text-sm font-medium text-foreground">
										Correo del responsable
									</label>
									<input
										id="edit-maintainer-email"
										type="email"
										bind:value={maintainerEmail}
										placeholder="datos@umss.edu"
										class={inputClass}
										aria-invalid={fieldErrors.maintainer_email ? "true" : undefined}
										aria-describedby="edit-maintainer-email-error"
										onblur={() => markTouched("maintainer_email")}
									/>
									{#if fieldErrors.maintainer_email}
										<p
											id="edit-maintainer-email-error"
											class="pl-[var(--label-offset)] text-xs text-destructive"
										>
											{fieldErrors.maintainer_email}
										</p>
									{/if}
								</div>
							</div>
						</div>
					</section>

					<!-- Recursos (copia del markup inline del asistente) -->
					<section class="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h3 class="font-heading text-lg font-semibold text-primary">Recursos</h3>
								<p class="mt-1 max-w-xl text-sm text-muted-foreground">
									En edición se listan los recursos actuales. El reemplazo de archivo se
									muestra en la sección 5.
								</p>
							</div>
							<span
								class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
							>
								{DATASET.resources.length}
								{DATASET.resources.length === 1 ? "recurso" : "recursos"}
							</span>
						</div>

						{#if DATASET.resources.length === 0}
							<div class="rounded-lg border border-border bg-muted/20 px-6 py-8 text-center">
								<Info class="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
								<p class="mt-2 text-sm font-medium text-foreground">Este dataset no tiene recursos</p>
							</div>
						{:else}
							<Card class="p-2">
								<ul class="space-y-1" aria-label="Recursos del dataset">
									{#each DATASET.resources as recurso (recurso.id)}
										<li>
											<div class="flex items-center gap-3 rounded-lg px-3 py-3">
												<span
													class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
												>
													{#if recurso.url_type === "upload"}
														<FileText class="size-4" aria-hidden="true" />
													{:else}
														<Link class="size-4" aria-hidden="true" />
													{/if}
												</span>
												<div class="min-w-0 flex-1">
													<div class="flex flex-wrap items-center gap-2">
														<span class="break-words text-sm font-medium text-foreground">
															{recurso.name}
														</span>
														<span
															class="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
														>
															{recurso.url_type === "upload" ? "Archivo" : "Enlace"}
														</span>
													</div>
													<p class="mt-1 truncate text-xs text-muted-foreground">
														{recurso.hash ? `Hash registrado: ${recurso.hash}` : "Sin hash registrado"}
													</p>
												</div>
												<div class="flex shrink-0 items-center gap-1">
													<button
														type="button"
														aria-label={`Editar ${recurso.name}`}
														class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													>
														<Pencil class="size-4" aria-hidden="true" />
													</button>
													<button
														type="button"
														aria-label={`Reemplazar archivo de ${recurso.name}`}
														class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													>
														<Upload class="size-4" aria-hidden="true" />
													</button>
													<button
														type="button"
														aria-label={`Quitar ${recurso.name}`}
														class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													>
														<Trash2 class="size-4" aria-hidden="true" />
													</button>
												</div>
											</div>
										</li>
									{/each}
								</ul>
							</Card>
						{/if}
					</section>
				</div>

				<!-- Barra lateral de guardado -->
				<aside class="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
					<!-- 2. Panel del payload -->
					<Card class="overflow-hidden">
						<div class="border-b border-border bg-muted/40 px-4 py-2.5">
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">
								Lo que envía una edición
							</p>
						</div>
						<div class="space-y-4 p-4">
							<div>
								<p class="text-xs font-semibold text-foreground">
									Partial update · sólo los campos que este formulario gobierna
								</p>
								<ul class="mt-2 space-y-1">
									{#each Object.entries(payloadParcial) as [campo, valor] (campo)}
										<li class="flex items-start justify-between gap-2 text-xs">
											<code class="font-mono text-foreground">{campo}</code>
											<span class="min-w-0 truncate text-right text-muted-foreground">{valor}</span>
										</li>
									{/each}
								</ul>
								<p class="mt-2 text-[11px] leading-relaxed text-muted-foreground">
									El resumen viaja <strong class="font-semibold text-foreground">dentro de</strong>
									<code class="font-mono">{SUMMARY_EXTRA_KEY}</code>, y <code class="font-mono">extras</code>
									es una <strong class="font-semibold text-foreground">lista de primer nivel</strong>: un
									<code class="font-mono">package_patch</code> que la lleve la
									<strong class="font-semibold text-foreground">reemplaza entera</strong>. Por eso este campo
									va con <code class="font-mono">package_revise</code> y una clave aplanada
									(<code class="font-mono">update__extras__…__value</code>), que toca sólo esa entrada. Los
									escalares de nivel superior (título, descripción, enlace…) sí van con
									<code class="font-mono">package_patch</code>. Y <code class="font-mono">package_revise</code>
									acepta <code class="font-mono">match</code>: si el dataset cambió mientras editabas,
									<strong class="font-semibold text-foreground">aborta</strong> en vez de pisar.
								</p>
							</div>

							<div class="rounded-lg border border-border bg-muted/30 p-3">
								<p class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
									<Check class="size-3.5 text-emerald-600" aria-hidden="true" />
									Lo que una edición NO envía
								</p>
								<ul class="mt-2 space-y-1.5">
									{#each camposNoEnviados as item (item.field)}
										<li class="text-[11px] leading-relaxed text-muted-foreground">
											<code class="font-mono text-foreground">{item.field}</code> — {item.reason}
										</li>
									{/each}
									{#each extrasNoGestionados as extra (extra.key)}
										<li class="text-[11px] leading-relaxed text-muted-foreground">
											<code class="font-mono text-foreground">extras.{extra.key}</code> — no lo
											gobierna el formulario; sobrevive a la edición.
										</li>
									{/each}
								</ul>
								<p class="mt-2 text-[11px] leading-relaxed text-muted-foreground">
									Es la promesa central del diseño: la actualización no parcial de CKAN borra todo lo
									que no esté presente, así que enviar el payload completo destruiría estos campos. La
									segunda columna de la promesa es más fina y
									<strong class="font-semibold text-foreground"
										>la encontró esta hoja al armarse</strong
									>: <code class="font-mono">extras</code> es una lista de primer nivel, y un patch la
									reemplaza entera — por eso el resumen no lo usa, y por eso estos extras sobreviven
									<strong class="font-semibold text-foreground">por construcción</strong> y no por
									cortesía del cliente.
								</p>
							</div>

							<div class="rounded-lg border border-border bg-muted/30 p-3">
								<p class="text-xs font-semibold text-foreground">
									Contraste: lo que el asistente envía al crear
								</p>
								<ul class="mt-2 space-y-1">
									{#each Object.keys(payloadCreacion) as campo (campo)}
										<li class="text-[11px] text-muted-foreground">
											<code class="font-mono text-foreground">{campo}</code>
										</li>
									{/each}
								</ul>
								<p class="mt-2 text-[11px] leading-relaxed text-muted-foreground">
									Payload <strong class="font-semibold text-foreground">real</strong> de
									<code class="font-mono">buildPackagePayload</code> en modo creación: incluye
									<code class="font-mono">private</code> y <code class="font-mono">extras</code>. Las
									dos formas deben diferir a propósito.
								</p>
							</div>
						</div>
					</Card>

					{#if submitted && errorList.length > 0}
						<div
							class="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
							role="alert"
							aria-live="assertive"
						>
							<p class="text-sm font-medium text-destructive">
								{errorList.length === 1
									? "Corrija 1 campo antes de guardar:"
									: `Corrija ${errorList.length} campos antes de guardar:`}
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

					<div class="space-y-2">
						<Button type="submit" class="w-full">
							<Check class="size-4" aria-hidden="true" />
							Guardar cambios
						</Button>
						<a
							href={`/dataset/${DATASET.name}`}
							class="block rounded-lg border border-input bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							Cancelar
						</a>
						<p class="text-center text-xs text-muted-foreground">
							Cancelar vuelve a la página del dataset sin guardar ningún cambio.
						</p>
					</div>
				</aside>
			</form>
		</section>

		<!-- ─── 3. Puntos de entrada y permiso ─────────────────────────── -->
		<section class="space-y-4">
			<div>
				<h2 class="font-heading text-2xl font-bold text-primary">
					3 · Los puntos de entrada en la página del dataset
				</h2>
				<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					La regla es fallar cerrado y no adivinar: la acción aparece sólo si CKAN respondió que el
					rol permite <code class="font-mono text-xs">update_dataset</code>. Cambie el estado del
					permiso arriba para ver las tres lecturas. El encabezado y las insignias imitan la página
					real del dataset.
				</p>
			</div>

			<Card class="overflow-hidden">
				<div class="border-b border-border bg-card px-5 py-6 sm:px-8">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div class="min-w-0">
							<h3 class="font-heading text-2xl font-bold leading-tight text-foreground">
								{DATASET.title}
							</h3>
							<p class="mt-2 text-sm text-muted-foreground">
								Actualizado 18/06/2025 · {DATASET.organization?.title}
							</p>
							<div class="mt-3 flex flex-wrap items-center gap-2">
								<span
									class="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700"
								>
									<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
									Activo
								</span>
								<span
									class="inline-flex items-center rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
								>
									Privado
								</span>
							</div>
						</div>

						{#if permState === "puede-editar"}
							<div class="flex shrink-0 items-center gap-2">
								<Button variant="outline" size="sm">
									<Pencil class="size-4" aria-hidden="true" />
									Editar
								</Button>
								<Button variant="destructive" size="sm">
									<Trash2 class="size-4" aria-hidden="true" />
									Eliminar
								</Button>
							</div>
						{/if}
					</div>

					{#if permState === "permiso-fallo"}
						<div
							class="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
							role="status"
							aria-live="polite"
						>
							<ShieldAlert class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							<p class="text-xs leading-relaxed text-muted-foreground">
								<strong class="font-semibold text-foreground"
									>No se pudo verificar si puede editar este dataset.</strong
								>
								La consulta a CKAN no respondió. Recargue la página para intentarlo de nuevo; esto no
								significa que usted no tenga permiso.
							</p>
						</div>
					{/if}
				</div>

				<div class="space-y-2 px-5 py-4 sm:px-8">
					<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Qué ve el usuario en cada estado
					</p>
					<ul class="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
						<li>
							<strong class="font-semibold text-foreground">Puede editar:</strong> «Editar» y
							«Eliminar» presentes.
						</li>
						<li>
							<strong class="font-semibold text-foreground">No puede editar:</strong> ninguna
							acción. No se dispara una petición para descubrirlo fallando.
						</li>
						<li>
							<strong class="font-semibold text-foreground">El permiso falló:</strong> ninguna
							acción y un texto que dice que no pudo verificarse, sin implicar falta de permiso.
						</li>
					</ul>
					<p class="text-[11px] leading-relaxed text-muted-foreground">
						La barra lateral del dashboard reusaría las mismas acciones por fila. La regla es la
						misma que ya usa el botón de crear
						(<code class="font-mono">permission="create_dataset"</code>), aplicada a
						<code class="font-mono">update_dataset</code>. Fuera de alcance declarado: el caso
						colaborador de CKAN (edición fuera de la organización).
					</p>
				</div>
			</Card>
		</section>

		<!-- ─── 4. Confirmación de borrado ─────────────────────────────── -->
		<section class="space-y-4">
			<div>
				<h2 class="font-heading text-2xl font-bold text-primary">
					4 · La confirmación del borrado lógico
				</h2>
				<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					Tres verdades, siempre: el dataset sale del portal y del catálogo; el portal no ofrece
					deshacer; y el slug queda tomado. La permanencia es una operación de sysadmin en CKAN, no
					un botón del portal.
				</p>
			</div>

			<Card class="overflow-hidden">
				<div class="border-b border-border bg-muted/40 px-5 py-2.5 sm:px-8">
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">
						Confirmar eliminación
					</p>
				</div>
				<div class="space-y-4 px-5 py-6 sm:px-8">
					<div class="flex items-start gap-3">
						<span
							class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
						>
							<TriangleAlert class="size-5" aria-hidden="true" />
						</span>
						<div class="min-w-0">
							<h3 class="font-heading text-lg font-semibold text-foreground">
								¿Eliminar «{DATASET.title}»?
							</h3>
							<p class="mt-1 text-sm text-muted-foreground">
								Esta acción se puede confirmar o cancelar; nada se borra hasta que confirme.
							</p>
						</div>
					</div>

					<ul class="space-y-2 text-sm leading-relaxed text-muted-foreground">
						<li class="flex items-start gap-2">
							<span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"></span>
							<span>
								El dataset <strong class="font-semibold text-foreground"
									>deja de estar en el portal y en el catálogo</strong
								>. Su página pasará a mostrar el estado de no encontrado del portal.
							</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"></span>
							<span>
								<strong class="font-semibold text-foreground"
									>El portal no ofrece deshacer.</strong
								>
								Recuperarlo es una operación de administración de CKAN, no un botón de esta pantalla.
							</span>
						</li>
						<li class="flex items-start gap-2">
							<span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"></span>
							<span>
								{#if deleteVariant === "nombra-slug"}
									<strong class="font-semibold text-foreground"
										>El slug queda tomado.</strong
									>
									Después de eliminarlo, no podrá volver a crear un dataset con el slug
									<code class="break-all font-mono text-xs">{DATASET.name}</code>: CKAN lo rechazará
									porque el nombre sigue reservado.
								{:else}
									<strong class="font-semibold text-foreground">El slug queda tomado.</strong>
									Aunque el dataset desaparezca, su nombre no se libera: no podrá crear uno nuevo con
									el mismo slug.
								{/if}
							</span>
						</li>
					</ul>

					<div class="flex flex-wrap items-center gap-3 border-t border-border pt-4">
						<Button variant="destructive">
							<Trash2 class="size-4" aria-hidden="true" />
							Eliminar dataset
						</Button>
						<Button variant="outline">Cancelar</Button>
					</div>

					<p class="text-[11px] leading-relaxed text-muted-foreground">
						<span class="font-semibold text-foreground">Nota de diseño:</span> el texto sobre el slug
						no es una suposición. Antes de congelar la copia se mide contra CKAN (crear → eliminar →
						recrear con el mismo nombre) y se registra el error real. Es el punto abierto n.º 2 del
						diseño.
					</p>
				</div>
			</Card>
		</section>

		<!-- ─── 5. Reemplazo de archivo ────────────────────────────────── -->
		<section class="space-y-4">
			<div>
				<h2 class="font-heading text-2xl font-bold text-primary">
					5 · El reemplazo de archivo de un recurso
				</h2>
				<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					El portal calcula el SHA-256 <strong class="font-semibold text-foreground">en el navegador</strong>
					(<code class="font-mono text-xs">crypto.subtle.digest</code>) porque CKAN guarda la columna y
					nunca la calcula. Cambie el estado del archivo arriba para ver los tres casos. El recurso
					en edición es
					<code class="font-mono text-xs">Flujos vehiculares por punto de conteo (2019–2025)</code>.
				</p>
			</div>

			<Card class="overflow-hidden">
				<div
					class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3 sm:px-8"
				>
					<div class="min-w-0">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">
							Reemplazar archivo
						</p>
						<p class="mt-0.5 truncate text-sm font-medium text-foreground">
							Flujos vehiculares por punto de conteo (2019–2025)
						</p>
					</div>
					{#if fileState === "sin-hash"}
						<span
							class="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
						>
							Sin hash registrado
						</span>
					{:else}
						<code class="break-all text-[11px] text-muted-foreground"
							>Hash actual: {RECURSO_HASH_ACTUAL}</code
						>
					{/if}
				</div>

				<div class="space-y-4 px-5 py-6 sm:px-8">
					<div
						class="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-6 text-center"
					>
						<label for="reemplazo-archivo" class="block cursor-pointer">
							<span
								class="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
							>
								<Upload class="size-5" aria-hidden="true" />
							</span>
							<p class="mt-2.5 text-sm text-foreground">
								Arrastre el archivo nuevo aquí o
								<span class="font-semibold text-primary underline underline-offset-2"
									>elíjalo del equipo</span
								>
							</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Hasta 50 MB. El archivo se hashea en el navegador y viaja por memoria.
							</p>
						</label>
						<input
							id="reemplazo-archivo"
							type="file"
							class="sr-only"
							aria-label="Seleccione el archivo de reemplazo"
						/>
					</div>

					<!-- Estado: archivo distinto -->
					{#if fileState === "distinto"}
						<div class="rounded-lg border border-border bg-muted/30 p-4">
							<p class="text-xs font-semibold text-foreground">Los bytes cambian</p>
							<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
								Hash del archivo elegido:
								<code class="break-all font-mono text-foreground">{RECURSO_HASH_NUEVO}</code>
								— distinto del registrado. Se ofrece el reemplazo y el motivo es obligatorio.
							</p>
							<div class="mt-3 space-y-1.5">
								<label
									for="motivo-reemplazo"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									Motivo del reemplazo <span class="text-destructive" aria-hidden="true">*</span>
								</label>
								<textarea
									id="motivo-reemplazo"
									rows="2"
									placeholder="Ej.: se corrigió un error de cálculo en la serie 2024."
									class="{inputClass} h-auto"
								></textarea>
								<p class="pl-[var(--label-offset)] text-xs text-muted-foreground">
									El motivo queda registrado con el cambio; sin él, el reemplazo se rechaza.
								</p>
							</div>
							<div class="mt-3 flex flex-wrap items-center gap-3">
								<Button>
									<Upload class="size-4" aria-hidden="true" />
									Reemplazar archivo
								</Button>
								<Button variant="ghost">Cancelar</Button>
							</div>
						</div>

						<!-- Estado: mismos bytes -->
					{:else if fileState === "mismos-bytes"}
						<div
							class="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
							role="alert"
						>
							<p class="flex items-center gap-1.5 text-xs font-semibold text-destructive">
								<TriangleAlert class="size-3.5" aria-hidden="true" />
								El archivo es idéntico al publicado
							</p>
							<p class="mt-1 text-xs leading-relaxed text-destructive">
								El archivo elegido tiene el mismo SHA-256 que el registrado
								(<code class="break-all font-mono">{RECURSO_HASH_ACTUAL}</code>). Los bytes no
								cambiaron: no se escribió nada y no se pidió ningún motivo.
							</p>
							<div class="mt-3 flex flex-wrap items-center gap-3">
								<Button disabled>
									<Upload class="size-4" aria-hidden="true" />
									Reemplazar archivo
								</Button>
								<Button variant="ghost">Elegir otro archivo</Button>
							</div>
						</div>

						<!-- Estado: sin hash -->
					{:else}
						<div class="rounded-lg border border-border bg-muted/30 p-4">
							<p class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
								<Info class="size-3.5 text-muted-foreground" aria-hidden="true" />
								Sin hash registrado
							</p>
							<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
								Este recurso se creó antes de que el portal registrara el hash del archivo. No hay
								con qué comparar automáticamente si el archivo cambió: se asume que puede haber
								cambiado, y el reemplazo se ofrece con motivo obligatorio.
							</p>
							<div class="mt-3 space-y-1.5">
								<label
									for="motivo-reemplazo-sin-hash"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									Motivo del reemplazo <span class="text-destructive" aria-hidden="true">*</span>
								</label>
								<textarea
									id="motivo-reemplazo-sin-hash"
									rows="2"
									placeholder="Ej.: se actualiza la serie con los datos de la última gestión."
									class="{inputClass} h-auto"
								></textarea>
							</div>
							<div class="mt-3 flex flex-wrap items-center gap-3">
								<Button>
									<Upload class="size-4" aria-hidden="true" />
									Reemplazar archivo
								</Button>
								<Button variant="ghost">Cancelar</Button>
							</div>
						</div>
					{/if}

					<div class="rounded-lg border border-border bg-muted/40 p-3">
						<p class="text-xs font-semibold text-foreground">Cómo funciona, sin adornos</p>
						<ul class="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
							<li>
								El SHA-256 se calcula <strong class="font-semibold text-foreground"
									>en el navegador</strong
								>: CKAN guarda el campo pero nunca lo computa, así que sin enviarlo no hay
								detección de cambios.
							</li>
							<li>
								El archivo pasa por la memoria del navegador para hashearse. El umbral y la
								conducta para archivos grandes (hashear o saltar el hash y decirlo) es una
								<strong class="font-semibold text-foreground">decisión abierta del autor</strong>
								— punto abierto n.º 3 del diseño.
							</li>
							<li>
								El reemplazo usa <code class="font-mono">resource_update</code> con el archivo
								nuevo; CKAN refresca <code class="font-mono">mimetype</code> y
								<code class="font-mono">size</code>.
							</li>
						</ul>
					</div>
				</div>
			</Card>
		</section>

		<!-- ─── 6. Nota de visibilidad ─────────────────────────────────── -->
		<section class="space-y-4">
			<div>
				<h2 class="font-heading text-2xl font-bold text-primary">
					6 · La visibilidad no se edita en este módulo
				</h2>
				<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					El módulo de edición no cambia la visibilidad de un dataset: esa decisión pertenece al
					flujo de solicitud de publicación, que es quien define cuándo un dataset pasa a público.
				</p>
			</div>

			<Card class="p-5 sm:p-6">
				<div class="flex items-start gap-3">
					<span
						class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
					>
						<Lock class="size-5" aria-hidden="true" />
					</span>
					<div class="min-w-0 space-y-2">
						<h3 class="font-heading text-base font-semibold text-foreground">
							Privado hasta que el flujo de publicación diga lo contrario
						</h3>
						<p class="text-sm leading-relaxed text-muted-foreground">
							Un dataset nace <strong class="font-semibold text-foreground">privado</strong>. Este
							formulario no ofrece pasar a público, y su payload parcial no incluye
							<code class="font-mono">private</code> ni <code class="font-mono">state</code>. La
							edición de metadatos deja la visibilidad intacta.
						</p>
						<p class="text-xs leading-relaxed text-muted-foreground">
							Si este formulario ofreciera el interruptor, duplicaría una decisión que el PRD
							asigna a la publicación y crearía dos caminos para el mismo cambio de estado.
						</p>
					</div>
				</div>
			</Card>
		</section>

		<footer class="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
			<p>
				<strong class="font-semibold text-foreground">Recordatorio:</strong> esta hoja es un borrador
				de diseño y se borra al promover. La ruta no existe en producción. Los puntos abiertos que
				el autor tiene que resolver están anotados en las secciones 4 y 5.
			</p>
		</footer>
	</div>
</div>
