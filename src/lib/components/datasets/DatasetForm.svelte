<script module lang="ts">
// ─── Tipos del listado de recursos ───────────────────────────────────
// El contenedor (`/dashboard/datasets/new`) ejecuta la subida de cada recurso, así que necesita
// leer y actualizar las entradas que este formulario dibuja. Los tipos y `nombreEfectivo` viven acá
// —el formulario es el dueño del listado— y se exportan para no duplicar la regla del nombre.

export type RecursoTipo = "archivo" | "enlace";
export type RecursoEstado =
	| "pendiente"
	| "subiendo"
	| "procesando"
	| "listo"
	| "error"
	| "cancelado";

export interface RecursoEntry {
	key: string;
	tipo: RecursoTipo;
	nombre: string; // Editable; si queda vacío, cae al nombre del archivo o al dominio de la URL.
	descripcion: string;
	file?: File; // Sólo archivo.
	url?: string; // Sólo enlace.
	estado: RecursoEstado;
	progreso: number; // 0..100, sólo archivos.
	error?: string;
}

// CKAN no completa el nombre del recurso con el del archivo (verificado): si el `nombre`
// queda vacío, lo resuelve el portal — con el nombre del archivo, o con el dominio de la
// URL cuando el recurso es un enlace.
function dominioDe(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

/** Nombre efectivo de un recurso: el editable, o el fallback según el tipo. */
export function nombreEfectivo(entry: RecursoEntry): string {
	if (entry.nombre.trim()) return entry.nombre.trim();
	if (entry.tipo === "archivo") return entry.file?.name ?? "Archivo";
	return dominioDe(entry.url ?? "");
}

/** Modo del formulario. En este slice sólo se ejerce `"create"`; `"edit"` llega en 1b. */
export type DatasetFormMode = "create" | "edit";

/** Valores iniciales del formulario. En creación van vacíos; la edición los prellena (1b). */
export interface DatasetFormInitial {
	title?: string;
	name?: string;
	summary?: string;
	notes?: string;
	owner_org?: string;
	license_id?: string;
	tags?: string[];
	url?: string;
	maintainer?: string;
	maintainer_email?: string;
	slug_edited?: boolean;
}
</script>

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
	Plus,
	RotateCw,
	Trash2,
	TriangleAlert,
	Unlock,
	Upload,
	X,
} from "@lucide/svelte";
import { untrack } from "svelte";
import TagsInput from "$lib/components/form/TagsInput.svelte";
import MarkdownEditor from "$lib/components/markdown/MarkdownEditor.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import {
	datasetCreateSchema,
	licenseIdError,
	MAX_MAINTAINER_LENGTH,
	MAX_NOTES_LENGTH,
	MAX_SUMMARY_LENGTH,
	MAX_TITLE_LENGTH,
	MAX_URL_LENGTH,
} from "$lib/schemas/dataset";
import type { DatasetCreateInput } from "$lib/schemas/dataset";
import {
	MAX_RESOURCE_DESCRIPTION_LENGTH,
	MAX_RESOURCE_NAME_LENGTH,
	MAX_RESOURCE_URL_LENGTH,
	resourceCreateSchema,
} from "$lib/schemas/resource";
import type { CkanLicense, CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import {
	MAX_RESOURCE_BYTES,
	suggestSlug,
	validateResourceFile,
} from "$lib/utils/dataset-payload";
import { safeExternalUrl } from "$lib/utils/external-url";
import { curatedLicenseLabel } from "$lib/utils/licenses";

// ─── Constantes ──────────────────────────────────────────────────────
const LIMIT_MB = MAX_RESOURCE_BYTES / 1024 / 1024;

const inputClass =
	"h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// ─── Props ───────────────────────────────────────────────────────────
interface Props {
	/** Modo del formulario. Tipado desde ya; en este slice sólo se ejerce `"create"`. */
	mode?: DatasetFormMode;
	/** Valores iniciales. En creación no se pasa; la edición lo usa en 1b. */
	initial?: DatasetFormInitial;

	// Datos que carga el contenedor (él es el dueño de la carga).
	organizations: CkanOrganization[];
	licenses: CkanLicense[];
	licensesLoading?: boolean;
	licensesError?: string | null;
	tagSuggestions?: string[];

	// Listado de recursos compartido con el contenedor: él ejecuta la subida y necesita leer y
	// actualizar las entradas (estado y progreso) que este formulario dibuja.
	resources?: RecursoEntry[];
	// La organización inicial la resuelve el contenedor al cargarlas (una sola ⇒ automática).
	ownerOrg?: string;

	// Estado del envío, propiedad del contenedor: él orquesta crear el paquete y subir los recursos.
	submitting?: boolean;
	submitError?: string | null;
	uploadFinished?: boolean;
	createdDataset?: CkanPackage | null;

	// Callbacks. El contenedor conserva la orquestación (crear el dataset, subir los recursos y
	// navegar); el formulario valida, dibuja y avisa.
	onsubmit: (data: DatasetCreateInput) => void | Promise<void>;
	oncancel?: () => void;
	onretry?: () => void | Promise<void>;
	oncancelupload?: (key: string) => void;
}

let {
	mode = "create",
	initial = {},
	organizations,
	licenses,
	licensesLoading = false,
	licensesError = null,
	tagSuggestions: tagSugerencias = [],
	resources: recursos = $bindable<RecursoEntry[]>([]),
	ownerOrg = $bindable(""),
	submitting = false,
	submitError = $bindable<string | null>(null),
	uploadFinished = false,
	createdDataset = null,
	onsubmit,
	oncancel = () => {},
	onretry = () => {},
	oncancelupload = () => {},
}: Props = $props();

// ─── Metadatos del formulario ────────────────────────────────────────
// El estado se prellena **una sola vez** desde `initial` (los valores que la página cargó): en
// creación llega vacío y en edición trae el dataset. La lectura se hace con `untrack` a propósito:
// el prellenado es el punto de partida, no una fuente que deba seguir cambiando el formulario bajo
// los pies del usuario, así que un `initial` que llegue después no pisa lo que ya se escribió.
const prefill = untrack(() => initial);
let title = $state(prefill.title ?? "");
let slug = $state(prefill.name ?? "");
let summary = $state(prefill.summary ?? "");
let notes = $state(prefill.notes ?? "");
let licenseId = $state(prefill.license_id ?? "");
let tags = $state<string[]>([...(prefill.tags ?? [])]);
let url = $state(prefill.url ?? "");
let maintainer = $state(prefill.maintainer ?? "");
let maintainerEmail = $state(prefill.maintainer_email ?? "");

// La organización es un **hecho** en edición: la del dataset cargado, que nunca se escribe. La
// página puede pasarla por `initial.owner_org` o reflejarla en `ownerOrg`; acá se captura al montar.
let orgFact = $state(prefill.owner_org ?? ownerOrg);

// Slug: en creación sigue al título hasta que el usuario lo edita (`slugEdited`); en edición llega
// fijado por el dataset y sólo se habilita con un desbloqueo explícito (`slugUnlocked`).
let slugEdited = $state(Boolean(prefill.slug_edited));
let slugUnlocked = $state(false);
const slugEditable = $derived(mode === "edit" ? slugUnlocked : slugEdited);

/** Verbo de la acción de envío, para el copy del resumen: «guardar» en edición, «crear» en creación. */
const accionVerbo = $derived(mode === "edit" ? "guardar" : "crear");

// ─── Recursos (archivos y enlaces) ────────────────────────────────────
// Un único listado: un recurso es archivo **o** enlace (PRD RF-13), nunca ambos. El
// modelo unifica las dos listas anteriores (`fileEntries` + `linkEntries`) para que la
// alta, la edición y los estados de subida sean los mismos para los dos tipos.
let rejectedFiles = $state<{ name: string; message: string }[]>([]);

// ─── Mini-form de recursos: alta y edición ──────────────────────────
let borradorTipo = $state<RecursoTipo>("archivo");
let borradorNombre = $state("");
let borradorDescripcion = $state("");
let borradorUrl = $state("");
let borradorArchivo = $state<File | null>(null);
let editandoKey = $state<string | null>(null);
let recursoSeq = 0;

// ─── Estado local del submit ─────────────────────────────────────────
// Campos que el usuario ya tocó (perdieron el foco): antes de eso no se le muestran errores, para no
// regañarlo mientras todavía no escribió nada.
let touched = $state<Record<string, boolean>>({});
// Se pone en true al intentar enviar: ahí se muestran **todos** los errores, no sólo los tocados.
let submitted = $state(false);

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
		// En edición la organización llega con el dataset y es un hecho; en creación la elige el usuario.
		owner_org: mode === "edit" ? orgFact : ownerOrg,
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

// CKAN ofrece `notspecified` como una licencia más y su etiqueta curada es la misma que la de la
// opción vacía («Sin especificar»). Renderizarla producía **dos opciones idénticas** con efectos
// distintos: la vacía dejaba el campo recomendado como pendiente y `notspecified` lo daba por
// completo, con el mismo texto a la vista. Se oculta del selector y queda **una sola** opción para
// «sin licencia». `idsOfrecidos` conserva el id a propósito, para poder validar los datasets que ya
// lo tengan guardado.
const licenciasOfrecidas = $derived(licenses.filter((license) => license.id !== "notspecified"));

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
const failedResources = $derived<FailedResource[]>(
	recursos
		.filter((entry) => entry.estado === "error" || entry.estado === "cancelado")
		.map((entry) => ({
			key: entry.key,
			label: nombreEfectivo(entry),
			reason:
				entry.estado === "cancelado"
					? "subida cancelada"
					: (entry.error ??
						(entry.tipo === "archivo"
							? "No se pudo subir el archivo"
							: "No se pudo crear el enlace")),
		})),
);

// ─── Sugerencia de slug ──────────────────────────────────────────────
// En creación sigue al título mientras el usuario no lo haya editado a mano; una vez editado, se
// preserva aunque el título cambie después. En edición **nunca** sigue al título: el slug identifica
// al dataset en su dirección web y cambiarlo rompería todos los enlaces existentes.
$effect(() => {
	if (mode === "create" && !slugEdited) {
		slug = suggestSlug(title);
	}
});

// ─── Recursos: alta, edición y validación ─────────────────────────────
/** Nombre efectivo del borrador: lo que validará el schema y mostrará el botón. */
function nombreEfectivoBorrador(): string {
	if (borradorNombre.trim()) return borradorNombre.trim();
	if (borradorTipo === "enlace") {
		const url = borradorUrl.trim();
		return url ? dominioDe(url) : "";
	}
	return borradorArchivo?.name ?? "";
}

/** Borrador validado con el mismo schema que usará el envío real. */
const borradorRecurso = $derived(
	resourceCreateSchema.safeParse({
		tipo: borradorTipo,
		name: nombreEfectivoBorrador(),
		description: borradorDescripcion,
		url: borradorTipo === "enlace" ? borradorUrl : undefined,
	}),
);
const borradorValido = $derived(
	borradorRecurso.success && (borradorTipo === "enlace" || borradorArchivo !== null),
);
const errorRecursoUrl = $derived(
	borradorRecurso.success
		? null
		: (borradorRecurso.error.issues.find((issue) => issue.path[0] === "url")?.message ?? null),
);

function limpiarBorrador() {
	editandoKey = null;
	borradorNombre = "";
	borradorDescripcion = "";
	borradorUrl = "";
	borradorArchivo = null;
}

function onArchivoPicked(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0] ?? null;
	// Permite volver a elegir el mismo archivo en una próxima selección.
	input.value = "";
	if (!file) return;
	const result = validateResourceFile(file);
	if (!result.ok) {
		rejectedFiles = [...rejectedFiles, { name: file.name, message: result.message }];
		borradorArchivo = null;
		return;
	}
	borradorArchivo = file;
}

function agregarRecurso() {
	if (!borradorValido) return;
	const esEnlace = borradorTipo === "enlace";
	recursos = [
		...recursos,
		{
			key: `recurso-${++recursoSeq}`,
			tipo: borradorTipo,
			nombre: borradorNombre.trim(),
			descripcion: borradorDescripcion.trim(),
			file: esEnlace ? undefined : (borradorArchivo ?? undefined),
			url: esEnlace ? (safeExternalUrl(borradorUrl) ?? borradorUrl.trim()) : undefined,
			estado: "pendiente",
			progreso: 0,
		},
	];
	limpiarBorrador();
}

function editarRecurso(key: string) {
	const recurso = recursos.find((entry) => entry.key === key);
	if (!recurso) return;
	editandoKey = key;
	borradorTipo = recurso.tipo;
	borradorNombre = recurso.nombre;
	borradorDescripcion = recurso.descripcion;
	borradorUrl = recurso.tipo === "enlace" ? (recurso.url ?? "") : "";
	borradorArchivo = recurso.tipo === "archivo" ? (recurso.file ?? null) : null;
}

function guardarRecurso() {
	if (!editandoKey) return;
	const key = editandoKey;
	const esEnlace = borradorTipo === "enlace";
	recursos = recursos.map((entry) =>
		entry.key === key
			? {
					...entry,
					tipo: borradorTipo,
					nombre: borradorNombre.trim(),
					descripcion: borradorDescripcion.trim(),
					file: esEnlace ? undefined : (borradorArchivo ?? entry.file),
					url: esEnlace ? (safeExternalUrl(borradorUrl) ?? borradorUrl.trim()) : undefined,
				}
			: entry,
	);
	limpiarBorrador();
}

function quitarRecurso(key: string) {
	if (editandoKey === key) limpiarBorrador();
	recursos = recursos.filter((entry) => entry.key !== key);
}

// ─── Submit ──────────────────────────────────────────────────────────
// La validación vive acá; la orquestación (crear el paquete, subir los recursos, navegar) pertenece
// al contenedor, que la recibe por `onsubmit`.
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

function handleSubmit() {
	if (submitting) return;

	const data = validation.data;
	if (!validation.success || !data) {
		submitted = true;
		submitError = null;
		focusFirstInvalid();
		return;
	}

	void onsubmit(data);
}

// ─── Derivados de la ficha (resumen lateral) ─────────────────────────
const singleOrg = $derived(organizations.length === 1 ? organizations[0] : null);
// Organización efectiva: la elegida en creación o el hecho cargado en edición. La ficha lateral y la
// sección de organización la leen de acá para que edición no muestre "falta elegir".
const effectiveOwnerOrg = $derived(mode === "edit" ? orgFact : ownerOrg);
const orgDisplayTitle = $derived(
	singleOrg
		? singleOrg.title
		: (organizations.find((org) => org.name === effectiveOwnerOrg)?.title ??
			(effectiveOwnerOrg || "")),
);
// La ficha no puede quedar **en blanco**: mientras haya más de una organización y ninguna elegida, el
// bloque tiene que decir que falta elegir. Antes pintaba `orgDisplayTitle`, que en ese estado es "", y
// el usuario veía un hueco sin explicación.
const orgIsMissing = $derived(orgDisplayTitle === "");

const selectedLicense = $derived(licenses.find((license) => license.id === licenseId) ?? null);
const safeLicenseUrl = $derived(selectedLicense ? safeExternalUrl(selectedLicense.url) : null);

interface FichaResource {
	key: string;
	tipo: "archivo" | "enlace";
	nombre: string;
}
const fichaResources = $derived<FichaResource[]>(
	recursos.map((entry) => ({
		key: entry.key,
		tipo: entry.tipo,
		nombre: nombreEfectivo(entry),
	})),
);

const recomendados = $derived([
	{ label: "Recursos", ok: recursos.length > 0 },
	{ label: "Licencia", ok: licenseId !== "" },
	{ label: "Etiquetas", ok: tags.length > 0 },
]);
const recomendadosOk = $derived(recomendados.filter((c) => c.ok).length);
const recomendadosPendientes = $derived(recomendados.filter((c) => !c.ok));
const hayTitulo = $derived(title.trim().length > 0);
</script>

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
					<label for="title" class="pl-[var(--label-offset)] text-sm font-medium text-foreground">
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

			<div class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]">
				<span class="block pl-[var(--label-offset)] text-sm font-medium text-foreground">
					Slug <span class="text-destructive" aria-hidden="true">*</span>
				</span>
				{#if slugEditable}
					<div class="flex gap-2">
						<input
							id="slug"
							aria-label="Slug"
							type="text"
							bind:value={slug}
							onblur={() => markTouched("name")}
							aria-invalid={fieldErrors.name ? "true" : undefined}
							aria-describedby={fieldErrors.name ? "slug-hint slug-error" : "slug-hint"}
							class={cn(inputClass, mode === "edit" && "font-mono")}
						/>
						<button
							type="button"
							onclick={() => {
								if (mode === "edit") slugUnlocked = false;
								else slugEdited = false;
							}}
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
							onclick={() => {
								if (mode === "edit") slugUnlocked = true;
								else slugEdited = true;
							}}
							class="inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{#if mode === "edit"}
								<Unlock class="size-3.5" aria-hidden="true" />
								Desbloquear
							{:else}
								<Pencil class="size-3.5" aria-hidden="true" />
								Editar
							{/if}
						</button>
					</div>
				{/if}
				<p id="slug-hint" class="text-xs text-muted-foreground">
					{#if mode === "edit"}
						{#if slugUnlocked}
							Cambiarlo rompe todos los enlaces existentes al dataset. Desbloquéelo sólo si
							sabe que el enlace anterior debe dejar de funcionar.
						{:else}
							El slug identifica al dataset en su dirección web y se presenta fijo:
							cambiarlo rompería todos los enlaces existentes.
						{/if}
					{:else}
						Se genera automáticamente a partir del título. Desbloquéelo sólo si necesita
						cambiarlo.
					{/if}
				</p>
				{#if fieldErrors.name}
					<p id="slug-error" class="text-xs text-destructive">{fieldErrors.name}</p>
				{/if}
			</div>

			<div class="space-y-1.5">
				<div class="flex items-baseline justify-between gap-2">
					<label for="summary" class="pl-[var(--label-offset)] text-sm font-medium text-foreground">
						Resumen
					</label>
					{@render contador(summary, MAX_SUMMARY_LENGTH, "summary-count")}
				</div>
				<textarea
					id="summary"
					rows="2"
					bind:value={summary}
					aria-describedby="summary-count summary-help summary-error"
					placeholder="Un resumen breve para las tarjetas del catálogo"
					class="{inputClass} h-auto"
					aria-invalid={fieldErrors.summary ? "true" : undefined}
					onblur={() => markTouched("summary")}
				></textarea>
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
					<label for="notes" class="pl-[var(--label-offset)] text-sm font-medium text-foreground">
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

			<div class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]">
				{#if mode === "edit"}
					<!-- En edición la organización es un hecho: se muestra la del dataset y nunca se escribe. -->
					<span class="block pl-[var(--label-offset)] text-sm font-medium text-foreground">
						Organización
					</span>
					<div
						class="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2"
					>
						<Lock class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<span id="owner-org" class="truncate text-sm text-foreground">{orgDisplayTitle}</span>
					</div>
					<p class="text-xs text-muted-foreground">
						La organización dueña del dataset. Mover el dataset a otra organización es una
						operación aparte (cambia quién puede verlo y administrarlo) y no forma parte de este
						módulo.
					</p>
				{:else if organizations.length === 1}
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
						Pertenece a más de una organización: elija dónde crear. La visibilidad del
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
				<div class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]">
					<label for="tag_string" class="text-sm font-medium text-foreground">Etiquetas</label>
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

				<div class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]">
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
						{#each licenciasOfrecidas as license (license.id)}
							<option value={license.id}>{curatedLicenseLabel(license.id) ?? license.title}</option>
						{/each}
					</select>
					{#if licensesLoading}
						<p class="text-xs text-muted-foreground">Cargando licencias...</p>
					{:else if licensesError}
						<p class="text-xs text-destructive" role="alert">
							No se pudo cargar la lista de licencias. La licencia es opcional: puede crear
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
						<label for="url" class="pl-[var(--label-offset)] text-sm font-medium text-foreground">
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
							<p id="maintainer-error" class="pl-[var(--label-offset)] text-xs text-destructive">
								{fieldErrors.maintainer}
							</p>
						{/if}
					</div>
					<div class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]">
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
							<p id="maintainer-email-error" class="pl-[var(--label-offset)] text-xs text-destructive">
								{fieldErrors.maintainer_email}
							</p>
						{/if}
					</div>
				</div>
			</div>
		</section>

		<!-- Recursos: mini-form de alta/edición + lista compacta -->
		<section class="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 class="font-heading text-lg font-semibold text-primary">Recursos</h2>
					<p class="mt-1 max-w-xl text-sm text-muted-foreground">
						Un recurso es un <strong class="font-semibold">archivo</strong> o un
						<strong class="font-semibold">enlace</strong>: nunca los dos.
					</p>
				</div>
				{#if recursos.length > 0}
					<span
						class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
					>
						{recursos.length}
						{recursos.length === 1 ? "recurso" : "recursos"}
					</span>
				{/if}
			</div>

			<!-- Mini-form: da de alta un recurso y también lo edita -->
			<div class="rounded-xl border border-border bg-muted/30 p-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h3 class="font-heading text-base font-semibold text-primary">
						{editandoKey ? "Editar recurso" : "Nuevo recurso"}
					</h3>
					{#if editandoKey}
						<button
							type="button"
							onclick={limpiarBorrador}
							class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							Cancelar edición
						</button>
					{/if}
				</div>

				<div class="mt-4 space-y-4">
					<div class="space-y-1.5">
						<div class="flex items-baseline justify-between gap-2">
							<label
								for="recurso-titulo"
								class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
							>
								Nombre del recurso
							</label>
							{@render contador(borradorNombre, MAX_RESOURCE_NAME_LENGTH, "recurso-titulo-count")}
						</div>
						<input
							id="recurso-titulo"
							type="text"
							bind:value={borradorNombre}
							aria-describedby="recurso-titulo-count recurso-titulo-help"
							placeholder="Informe de gestión 2026"
							class={inputClass}
						/>
						<p id="recurso-titulo-help" class="pl-[var(--label-offset)] text-xs text-muted-foreground">
							El nombre que verá el público. Si lo deja vacío, se usará el nombre del archivo (o el
							dominio, si es un enlace).
						</p>
					</div>

					<div class="space-y-1.5">
						<div class="flex items-baseline justify-between gap-2">
							<label
								for="recurso-descripcion"
								class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
							>
								Descripción
							</label>
							{@render contador(borradorDescripcion, MAX_RESOURCE_DESCRIPTION_LENGTH, "recurso-descripcion-count")}
						</div>
						<textarea
							id="recurso-descripcion"
							rows="2"
							bind:value={borradorDescripcion}
							aria-describedby="recurso-descripcion-count"
							placeholder="¿Qué contiene este recurso?"
							class="{inputClass} h-auto"
						></textarea>
					</div>

					<div class="space-y-1.5">
						<span class="block pl-[var(--label-offset)] text-sm font-medium text-foreground">
							Tipo
						</span>
						<div class="flex w-fit items-center gap-1 rounded-md border border-border bg-background p-0.5">
							<button
								type="button"
								onclick={() => (borradorTipo = "archivo")}
								aria-label="Tipo Archivo"
								aria-pressed={borradorTipo === "archivo"}
								class={cn(
									"inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors",
									borradorTipo === "archivo"
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<Upload class="size-3.5" aria-hidden="true" />
								Archivo
							</button>
							<button
								type="button"
								onclick={() => (borradorTipo = "enlace")}
								aria-label="Tipo Enlace"
								aria-pressed={borradorTipo === "enlace"}
								class={cn(
									"inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors",
									borradorTipo === "enlace"
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<Link class="size-3.5" aria-hidden="true" />
								Enlace
							</button>
						</div>
					</div>

					{#if borradorTipo === "archivo"}
						<div class="rounded-xl border border-dashed border-border bg-background px-6 py-6 text-center">
							<label for="recurso-archivo" class="block cursor-pointer">
								<span
									class="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
								>
									<Upload class="size-5" aria-hidden="true" />
								</span>
								{#if borradorArchivo}
									<p class="mt-2.5 break-words text-sm font-medium text-foreground">{borradorArchivo.name}</p>
									<p class="mt-1 text-xs text-muted-foreground">Elija otro archivo para reemplazarlo</p>
								{:else}
									<p class="mt-2.5 text-sm text-foreground">
										Arrastre archivos aquí o
										<span class="font-semibold text-primary underline underline-offset-2">elíjalos del equipo</span>
									</p>
								{/if}
								<p class="mt-1 text-xs text-muted-foreground">Hasta {LIMIT_MB} MB por archivo.</p>
							</label>
							<input
								id="recurso-archivo"
								type="file"
								onchange={onArchivoPicked}
								class="sr-only"
								aria-label="Seleccione un archivo"
							/>
						</div>
					{:else}
						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<label
									for="recurso-url"
									class="pl-[var(--label-offset)] text-sm font-medium text-foreground"
								>
									URL del enlace
								</label>
								{@render contador(borradorUrl, MAX_RESOURCE_URL_LENGTH, "recurso-url-count")}
							</div>
							<input
								id="recurso-url"
								type="url"
								bind:value={borradorUrl}
								aria-invalid={errorRecursoUrl ? "true" : undefined}
								aria-describedby="recurso-url-count recurso-url-error"
								placeholder="https://…"
								class={inputClass}
							/>
							{#if errorRecursoUrl}
								<p id="recurso-url-error" class="pl-[var(--label-offset)] text-xs text-destructive">
									{errorRecursoUrl}
								</p>
							{/if}
						</div>
					{/if}

					<div class="flex flex-wrap items-center gap-3">
						<button
							type="button"
							disabled={!borradorValido}
							onclick={editandoKey ? guardarRecurso : agregarRecurso}
							class="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
						>
							{#if editandoKey}
								<Check class="size-4" aria-hidden="true" />
								Guardar cambios
							{:else}
								<Plus class="size-4" aria-hidden="true" />
								Agregar recurso
							{/if}
						</button>
						{#if editandoKey}
							<button
								type="button"
								onclick={limpiarBorrador}
								class="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								Cancelar
							</button>
						{/if}
					</div>
				</div>
			</div>

			<!-- Rechazos por tamaño -->
			{#if rejectedFiles.length > 0}
				<div class="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
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

			<!-- Lista de recursos agregados -->
			{#if recursos.length === 0}
				<div class="rounded-lg border border-border bg-muted/20 px-6 py-8 text-center">
					<Info class="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
					<p class="mt-2 text-sm font-medium text-foreground">Todavía no agregó recursos</p>
					<p class="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
						Puede crear el dataset sin recursos y agregarlos después.
					</p>
				</div>
			{:else}
				<div>
					<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Recursos agregados
					</p>
					<Card class="mt-2 p-2">
						<ul class="space-y-1" aria-label="Recursos agregados">
							{#each recursos as recurso (recurso.key)}
								<li>
									<div
										class={cn(
											"flex items-center gap-3 rounded-lg px-3 py-3 transition-colors",
											editandoKey === recurso.key && "bg-accent/60",
											recurso.estado === "error" && "bg-destructive/5",
										)}
									>
										<span
											class={cn(
												"inline-flex size-10 shrink-0 items-center justify-center rounded-lg",
												recurso.estado === "error"
													? "bg-destructive/10 text-destructive"
													: "bg-muted text-muted-foreground",
											)}
										>
											{#if recurso.tipo === "archivo"}
												<FileText class="size-4" aria-hidden="true" />
											{:else}
												<Link class="size-4" aria-hidden="true" />
											{/if}
										</span>

										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-center gap-2">
												<span class="break-words text-sm font-medium text-foreground">
													{nombreEfectivo(recurso)}
												</span>
												<span
													class="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
												>
													{recurso.tipo === "archivo" ? "Archivo" : "Enlace"}
												</span>
											</div>
											{#if recurso.descripcion}
												<p class="mt-1 line-clamp-1 text-xs text-muted-foreground">
													{recurso.descripcion}
												</p>
											{/if}
											<p class="mt-1 truncate text-xs text-muted-foreground">
												{recurso.tipo === "archivo" ? (recurso.file?.name ?? "") : (recurso.url ?? "")}
											</p>

											{#if recurso.estado === "subiendo"}
												<div class="mt-2 flex items-center gap-3">
													<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
														<div
															class="h-full rounded-full bg-primary transition-[width] duration-300"
															style={`width: ${recurso.progreso}%`}
														></div>
													</div>
													<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
														{recurso.progreso}%
													</span>
												</div>
											{:else if recurso.estado === "procesando"}
												<div class="mt-2 space-y-1.5">
													<div class="flex items-center gap-3">
														<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
															<div class="h-full w-full rounded-full bg-emerald-600"></div>
														</div>
														<span class="shrink-0 text-xs font-medium tabular-nums text-emerald-700">100 %</span>
													</div>
													<p class="flex items-center gap-1.5 text-xs font-medium text-primary">
														<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
														Procesando en CKAN… (validando y guardando; no cierre la página)
													</p>
												</div>
											{:else if recurso.estado === "error"}
												<p class="mt-1.5 text-xs text-destructive">{recurso.error}</p>
											{:else if recurso.estado === "cancelado"}
												<p class="mt-1.5 text-xs text-muted-foreground">Subida cancelada</p>
											{/if}
										</div>

										<div class="flex shrink-0 items-center gap-1">
											{#if recurso.estado === "subiendo"}
												<button
													type="button"
													aria-label={`Cancelar la subida de ${nombreEfectivo(recurso)}`}
													onclick={() => oncancelupload(recurso.key)}
													class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												>
													<X class="size-4" aria-hidden="true" />
												</button>
											{:else if recurso.estado === "procesando"}
												<span class="px-1 text-xs text-muted-foreground">Procesando…</span>
											{:else}
												{#if recurso.estado === "error"}
													<span class="inline-flex items-center gap-1 pr-1 text-xs font-medium text-destructive">
														<TriangleAlert class="size-3.5" aria-hidden="true" />
														Error
													</span>
												{:else if recurso.estado === "listo"}
													<span class="inline-flex items-center gap-1 pr-1 text-xs text-muted-foreground">
														<Check class="size-4 text-emerald-600" aria-hidden="true" />
														Listo
													</span>
												{/if}
												<button
													type="button"
													aria-label={`Editar ${nombreEfectivo(recurso)}`}
													onclick={() => editarRecurso(recurso.key)}
													class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												>
													<Pencil class="size-4" aria-hidden="true" />
												</button>
												<button
													type="button"
													aria-label={`Quitar ${nombreEfectivo(recurso)}`}
													onclick={() => quitarRecurso(recurso.key)}
													class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												>
													<Trash2 class="size-4" aria-hidden="true" />
												</button>
											{/if}
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</Card>
				</div>
			{/if}
		</section>

		<!-- Fallo parcial: recursos que no se pudieron adjuntar -->
		{#if uploadFinished && failedResources.length > 0}
			<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-6" role="alert">
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
						onclick={onretry}
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

	<aside
		class="min-w-0 space-y-4 transition-[top] duration-200 ease-out lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:self-start"
	>
		<!-- Ficha de creación -->
		<Card class="overflow-hidden">
			<div class="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
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
						{#if orgIsMissing}
							<span class="truncate text-muted-foreground">Falta elegir una organización</span>
						{:else}
							<span class="truncate">{orgDisplayTitle}</span>
						{/if}
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
							Puede crear sin recursos y agregarlos después.
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
							Son opcionales: no bloquean la creación.
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
						? `Corrija 1 campo antes de ${accionVerbo}:`
						: `Corrija ${errorList.length} campos antes de ${accionVerbo}:`}
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
					{mode === "edit" ? "Guardando..." : "Creando..."}
				{:else if mode === "edit"}
					<Check class="size-4" aria-hidden="true" />
					Guardar cambios
				{:else}
					<Upload class="size-4" aria-hidden="true" />
					Crear dataset
				{/if}
			</button>
			<a
				href={mode === "edit" && initial.name ? `/dataset/${initial.name}` : "/dashboard"}
				onclick={(event) => {
					event.preventDefault();
					oncancel();
				}}
				class="block rounded-lg border border-input bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				Cancelar
			</a>
			<p class="text-center text-xs text-muted-foreground">
				{mode === "edit"
					? "Cancelar vuelve a la página del dataset sin guardar ningún cambio."
					: "Podrá editarlo después de crearlo."}
			</p>
		</div>
	</aside>
</form>
