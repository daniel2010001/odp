<script lang="ts">
import {
	ArrowDownToLine,
	Check,
	Copy,
	Download,
	ExternalLink,
	FileText,
	Link2,
	Maximize2,
} from "@lucide/svelte";
import { get } from "svelte/store";
import { page } from "$app/stores";
import { createChartApi } from "$lib/api/charts";
import { createPortalClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createDatastoreApi } from "$lib/api/datastore";
import {
	type AccessContext,
	classifyFailure,
	describeFailure,
	type FailurePresentation,
	failureActions,
	isDefinitive,
	statusFor,
} from "$lib/api/failure";
import { createResourceApi } from "$lib/api/resources";
import { canEditResourceCharts } from "$lib/charts/permission";
import { ACCION_BASE } from "$lib/components/dataset/action-class";
import ErrorPage from "$lib/components/error/ErrorPage.svelte";
import ResourceCharts from "$lib/components/resource/chart/ResourceCharts.svelte";
import ResourceKindChip from "$lib/components/resource/ResourceKindChip.svelte";
import ResourcePreview from "$lib/components/resource/ResourcePreview.svelte";
import ResourceStepper from "$lib/components/resource/ResourceStepper.svelte";
import CreateChartLink from "$lib/components/resource/views/CreateChartLink.svelte";
import type { BreadcrumbItem } from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { getMockDatasetById, getMockResourceById } from "$lib/mock/data";
import { fileUrl } from "$lib/resources/file-url";
import { resourceKind } from "$lib/resources/kind";
import { resourceNeighbours } from "$lib/resources/order";
import { previewKind } from "$lib/resources/preview";
import { resolveUnauthorized, type UnauthorizedResolution } from "$lib/session-guard";
import { auth } from "$lib/stores/auth";
import type { CkanExtra, CkanPackage, CkanResource } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { copyToClipboard } from "$lib/utils/citation";
import { formatDate, formatSize } from "$lib/utils/ckan";
import { safeExternalUrl } from "$lib/utils/external-url";

// Cliente del DataStore para la vista previa (RF-30: PDF/imagen/TXT/JSON; RF-31: tabla). Pasa por el
// puente del portal, que pone la credencial de la sesión: sin ella, el `datastore_search` de un recurso
// de un dataset privado responde 403 y el dueño ve la ficha pero nunca sus filas.
const datastoreApi = createDatastoreApi(createPortalClient());
// Los gráficos del recurso (S1): el visitante los ve, quien puede editar los administra. Mismo puente.
const chartApi = createChartApi(createPortalClient());

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

// Si el usuario puede crear, editar y eliminar los gráficos de este recurso. Sólo decide qué se ofrece: el
// servidor exige `resource_update` de todos modos. Hasta que la respuesta llega es `false` (falla cerrado).
let canEditCharts = $state(false);

let endpointCopied = $state(false);
let copiedLink = $state(false);

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
	canEditCharts = false;

	const user = get(auth).user;
	// El puente del portal pone la credencial de la sesión. Sin ella, `resource_show` de un recurso de un
	// dataset privado responde 403 incluso para su propio dueño.
	const client = createPortalClient();
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
		// Sólo se sondea ante un 403 con usuario. Sin usuario el espectador es anónimo, y sondear
		// `user_show {}` respondería 404 (medido), etiquetándolo como una sesión muerta que no es.
		let access: AccessContext = "anonymous";
		if (classifyFailure(err) === "unauthorized" && user) {
			let resolution: UnauthorizedResolution = "inconclusive";
			try {
				resolution = await resolveUnauthorized(client, err, user, $page.url.pathname);
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

	// Los permisos no frenan la ficha: se preguntan aparte, y sólo si hay algo que administrar (una tabla) y
	// alguien con sesión. Si el usuario ya navegó a otro recurso, la respuesta vieja se descarta.
	if (resource?.datastore_active === true && user) {
		const loadedFor = resourceId;
		const allowed = await canEditResourceCharts(client, dataset);
		if (loadedFor === resourceId) canEditCharts = allowed;
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
	const items: BreadcrumbItem[] = [{ label: "Datasets", href: "/search", role: "Catálogo" }];
	if (dataset?.organization?.title) {
		// Con `href`: la organización tiene página propia (la ruta resuelve name o id). Sin él la miga se
		// dibujaba como texto plano y no había nada que clicar, que es el defecto que este slice corrige.
		// El `href` se arma con `name`, así que se exige `name`, no `title`: una organización con título
		// pero sin `name` conserva la miga como texto y no inventa `/organization/undefined` (la revisión
		// `R3-ORG-NAME-GUARD`).
		items.push({
			label: dataset.organization.title,
			href: dataset.organization.name
				? `/organization/${encodeURIComponent(dataset.organization.name)}`
				: undefined,
			role: "Organización",
		});
	}
	if (dataset?.title || dataset?.name) {
		items.push({
			label: dataset.title || dataset.name,
			href: `/dataset/${datasetId}`,
			role: "Dataset",
		});
	}
	if (resource?.name) {
		items.push({ label: resource.name, role: "Recurso" });
	}
	return items;
});

// ─── Derived: vecinos del recurso (navegar sin volver al dataset) ───
// El orden y los extremos son decisiones y viven en una función pura (`$lib/resources/order`): el dataset ya
// viene con sus recursos y con la `position` de cada uno, así que esto **no pide nada nuevo a CKAN**.
const neighbours = $derived(resourceNeighbours(dataset?.resources, resourceId));

/**
 * El salto secuencial sólo existe con más de un recurso: con uno solo no hay a dónde saltar, y la
 * banda de la acción no debe quedar con el control solo por dibujarlo.
 */
const hasJump = $derived(neighbours.ordered.length > 1);

// ─── Derived: estado de error ────────────────────────────────
// Las acciones se deciden en `failureActions` para que la página no vuelva a derivar la regla. Hoy
// sólo puede ofrecer reintento: un enlace de inicio de sesión en este estado delataría que el
// recurso existe, así que el camino al login vive en el encabezado de la aplicación.
const actions = $derived(
	failure ? failureActions(failure.presentation, failure.access) : { retry: false },
);

// El estado que la página de error rotula. `invalidParams` no observó ninguna respuesta del
// catálogo: la dirección no lleva a nada, y eso se rotula como tal.
const failureStatus = $derived(
	invalidParams ? 404 : failure ? statusFor(failure.presentation.kind) : 503,
);

// Qué se puede ofrecer, que NO es lo mismo que el código observado: un `403` de una sonda que no
// concluyó conserva su rótulo y **ofrece reintento**, porque no es una respuesta final. La señal es
// la acción disponible (`retry`); `presentation.definitive` no sirve acá porque mira sólo la clase
// del fallo y declara final un `403` cuya causa nadie confirmó.
const failureVariant = $derived<"client" | "server">(
	invalidParams || !actions.retry ? "client" : "server",
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
// El tipo de recurso (`url_type`, la regla de CKAN) decide el chip del encabezado, y es exclusivo:
// un recurso alojado muestra su formato; una referencia externa muestra «Enlace» y deja de mostrar
// el formato declarado —un enlace es un enlace, no un archivo con formato—. El cómo vive en
// `ResourceKindChip`, compartido con la lista del dataset.

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
	// Decisión del autor (2026-09-22): la ficha de un enlace dice la verdad. Un enlace es una
	// referencia externa, así que estas dos filas no son del portal: el **tamaño** de una URL externa
	// nadie lo midió —CKAN no puede pesarla sin descargarla y el valor sembrado es inventado— y el
	// **nombre del archivo** sería un adivinazo parseado del último segmento de la URL, no un metadato.
	// Un archivo alojado conserva ambas: CKAN reescribe su URL al camino de descarga y midió el tamaño
	// al subirlo, así que ahí las dos filas son hechos medidos.
	const LINK_FORBIDDEN_ROWS = new Set(["Nombre del archivo", "Tamaño"]);
	const isExternalLink = resourceKind(resource) === "link";
	return fields.filter(
		(f) =>
			f.raw !== undefined &&
			f.raw !== null &&
			f.raw !== "" &&
			!(isExternalLink && LINK_FORBIDDEN_ROWS.has(f.label)),
	);
});

// ─── Derived: API extras ───────────────────────────────────────
// Las cuatro claves que el portal muestra en sus propias cards. El resto de las extras del recurso
// se lista al pie de la tarjeta de la API.
const API_EXTRA_CARD_KEYS = ["api_base_url", "docs_url", "example_request", "example_response"];

const apiExtras = $derived.by((): CkanExtra[] => {
	if (!resource?.extras) return [];
	return resource.extras.filter((e) => API_EXTRA_CARD_KEYS.includes(e.key));
});

const hasApiExtras = $derived(apiExtras.length > 0);

// Etiquetas de las claves internas que CKAN agrega a un recurso. Las cuatro primeras viven en las
// cards; `api_key` y `datastore_active` son extras internos que el portal traduce en vez de mostrar
// la clave cruda.
const API_EXTRA_LABELS: Record<string, string> = {
	api_base_url: "Dirección base",
	docs_url: "Documentación",
	example_request: "Ejemplo de solicitud",
	example_response: "Ejemplo de respuesta",
	api_key: "Clave de la API",
	datastore_active: "Tabla de datos",
};

/**
 * Rótulo del extra que no tiene su propia card. Un extra desconocido no se rotula con su clave cruda
 * (nombraría la implementación) ni con una etiqueta repetida: dos «Campo adicional» idénticos
 * borrarían cuál valor es cuál. El ordinal lo mantiene distinguible.
 */
const apiExtraLabel = (key: string, index: number): string =>
	API_EXTRA_LABELS[key] ?? `Campo adicional ${index + 1}`;

// Extras que no tienen card propia. Se derivan del recurso **completo**: hacerlo de `apiExtras` (ya
// filtrado a las cuatro claves de las cards) dejaba esta lista siempre vacía.
const apiExtraRows = $derived(
	(resource?.extras ?? []).filter((e) => !API_EXTRA_CARD_KEYS.includes(e.key)),
);

// Sin `PUBLIC_CKAN_URL` (el caso del stack: el portal pide a CKAN por su propio `/api/`, que el proxy
// publica), la dirección lleva el origen del portal: un path solo no funciona copiado tal cual.
const apiBaseUrl = $derived(
	(
		apiExtras.find((e) => e.key === "api_base_url")?.value ||
		env.CKAN_URL ||
		$page.url.origin
	).replace(/\/$/, ""),
);

const apiEndpoint = $derived(
	resource ? `${apiBaseUrl}/api/3/action/datastore_search?resource_id=${resource.id}` : "",
);

const curlCommand = $derived.by(() => {
	if (!resource) return "";
	const extraRequest = apiExtras.find((e) => e.key === "example_request")?.value;
	if (extraRequest) return extraRequest;
	return [
		`curl -X POST ${apiBaseUrl}/api/3/action/datastore_search \\`,
		`  -H "Content-Type: application/json" \\`,
		`  -d '{"resource_id": "${resource.id}"}'`,
	].join("\n");
});

const exampleResponse = $derived(
	apiExtras.find((e) => e.key === "example_response")?.value ?? null,
);

// `docs_url` es un extra de CKAN: puede llegar con cualquier esquema si el recurso se creó
// por la API o por la UI nativa de CKAN. Se sanea antes de renderizarlo como `href`.
const docsUrl = $derived(safeExternalUrl(apiExtras.find((e) => e.key === "docs_url")?.value));

// Un archivo alojado se descarga por el portal (`/catalog/download/<id>`, con la sesión); un enlace
// conserva `resource.url`, que también viene de CKAN y se renderiza como `href`: el saneo en el
// borde de salida (`fileUrl` → `safeExternalUrl`) es lo que impide un `javascript:` almacenado.
const downloadUrl = $derived(resource ? fileUrl(resource) : null);

// La misma regla del chip decide la vista previa: una referencia externa no aloja contenido en el
// portal, así que no hay nada que previsualizar. Derivarlo acá y no repetir la comparación en la
// plantilla mantiene una sola lectura de `resourceKind` por render.
const isLink = $derived(resource ? resourceKind(resource) === "link" : false);

// Hay algo que «ajustar» sólo si la tarjeta muestra una vista previa de verdad: ni el enlace externo ni
// el tipo sin vista previa (estado «none») la tienen, y ofrecer saltar a una nota vacía sería ruido.
const hasPreview = $derived(resource ? !isLink && previewKind(resource) !== "none" : false);

// Tarjeta de la vista previa, destino del salto («Ir a la vista previa» del hero y «Ajustar a la pantalla»).
let previewEl = $state<HTMLElement>();

/**
 * Sube la tarjeta bajo el encabezado y le pasa el foco. El hueco lo da el `scroll-margin-top` de la tarjeta
 * (encabezado + 16px de aire), así que el alto de la vista previa —que ya descuenta ese aire— cabe
 * entero en la pantalla. Con `prefers-reduced-motion` el salto es instantáneo; `preventScroll` evita que el
 * foco mueva la página por segunda vez.
 */
function fitPreview() {
	if (!previewEl) return;
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	previewEl.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
	previewEl.focus({ preventScroll: true });
}

// Un enlace compartido con `#vista-previa`: el navegador resuelve el fragmento antes de que la tarjeta
// exista (llega cuando carga el recurso), así que se re-aplica **una vez**, cuando el destino aparece.
// Mismo criterio que los saltos del buscador (`R3-001` de `review-fda3530895a9b51f`).
let previewHashApplied = false;
$effect(() => {
	if (!previewEl || previewHashApplied) return;
	if (window.location.hash !== `#${previewEl.id}`) return;
	previewHashApplied = true;
	previewEl.scrollIntoView({ block: "start" });
});

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
	<!-- Breadcrumb: una sola fila, sólo el recorrido. La navegación entre recursos vive en el hero,
	     dentro del grupo de la acción del recurso: debajo del breadcrumb le robaba el foco al título. -->
	{#if !loading && !expelled}
		<div class="border-b border-border bg-card">
			<div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
				<Breadcrumb items={breadcrumbItems} icon={FileText} />
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

	<!-- Error state — la MISMA página de error que una ruta inexistente, con el copy honesto de
	     `describeFailure` pasado como `copy`: un solo diseño para un solo estado. Vuelve al dataset
	     cuando se sabe cuál es, porque ése es el paso siguiente útil. -->
	{:else if invalidParams || failure}
		<ErrorPage
			status={failureStatus}
			code={failure ? failure.presentation.code : null}
			variant={failureVariant}
			copy={{ title: pageTitle, heading: errorTitle, body: errorMessage }}
			primaryAction={datasetId
				? { href: `/dataset/${datasetId}`, label: "Volver al dataset" }
				: { href: "/search", label: "Volver al catálogo" }}
			retry={actions.retry ? () => loadData() : null}
		/>

	<!-- Resource content -->
	{:else if resource}
		<!-- Resource header -->
		<section class="border-b border-border bg-card">
			<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<!-- Title + copy link: el salto secuencial dejó esta fila (decisión del autor) y vive en la
				     banda de la acción de descarga. `min-w-0` deja que un nombre largo se encoja en vez de
				     desbordar. -->
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
					<h1 class="min-w-0 font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
						{resource.name || "Recurso"}
					</h1>
				</div>

				<!-- Subtitle: updated -->
				{#if resource.last_modified}
					<div class="mt-3 text-sm text-muted-foreground">
						Actualizado {formatDate(resource.last_modified)}
					</div>
				{/if}


				<!-- Badges row: el chip de tipo es exclusivo — un enlace muestra «Enlace» y no el formato,
				     un archivo alojado muestra su formato y nunca «Enlace». **Sin el chip del tipo MIME** (decisión del
				     autor, 2026-09-28): era intencional, y en el único recurso del catálogo que lo tiene repetía el
				     formato («PDF» en el chip, «application/pdf» acá) mientras el dato técnico ya vive en la tabla de
				     metadatos de abajo. Un chip que no agrega información es ruido en el hero. -->
				<div class="mt-4 flex flex-wrap items-center gap-2">
					<ResourceKindChip kind={resourceKind(resource)} format={resource.format} />

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
				</div>

				<!-- Description -->
				{#if resource.description}
					<p class="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
						{resource.description}
					</p>
				{/if}

				<!-- Salto a la vista previa (foco F3, ancla): el destino es la tarjeta `#vista-previa`. Sólo si hay
				     vista previa que mostrar. -->
				{#if hasPreview}
					<a
						href="#vista-previa"
						class="mt-4 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ArrowDownToLine class="size-4" aria-hidden="true" />
						Ir a la vista previa
					</a>
				{/if}

				<!-- Acción del recurso + salto secuencial (variante D, decisión del autor 2026-10-19). La banda
				     es un contenedor de consultas: bajo 32 rem (`@lg`) la descarga y el control compacto van en dos
				     filas de ancho completo; desde ahí, en una fila, con el control a la derecha (`@lg:ml-auto`,
				     que lo alinea aunque no haya botón). La banda se renderiza sólo si tiene algún hijo, así que
				     sin acción y sin salto no queda una fila vacía. -->
				{#if downloadUrl || hasJump || canEditCharts}
					<div class="@container mt-5">
					<div class="flex flex-col gap-2 @lg:flex-row @lg:items-center @lg:gap-3">
						{#if downloadUrl}
							<a
								href={downloadUrl}
								target="_blank"
								rel="noopener noreferrer"
								class={cn(
									ACCION_BASE,
									"h-11 w-full justify-center border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 @lg:w-auto",
								)}
							>
								<!-- La forma de las acciones del hero del dataset, la misma que «Crear gráfico», con el color
								     coral de siempre para que descargar resalte (decisiones del autor, 2026-10-18). `cn`
								     resuelve el choque: el fondo coral reemplaza al `bg-background` de la base. -->
								{#if isLink}
									<ExternalLink class="size-4" aria-hidden="true" />
									Abrir enlace
								{:else}
									<Download class="size-4 shrink-0" aria-hidden="true" />
									<!-- «recurso» sólo se oculta a la vista según el ancho de la banda (contenedor), no el de
									     la ventana: el nombre accesible sigue siendo «Descargar recurso». -->
									<span>Descargar{" "}<span class="sr-only @sm:not-sr-only">recurso</span></span>
								{/if}
							</a>
						{/if}

						<!-- «Crear gráfico» en la banda de acciones del hero, como las acciones del dataset: sólo para
						     quien puede editar (`canEditCharts` ya exige `datastore_active`). El servidor exige
						     `resource_update` de todos modos. -->
						{#if canEditCharts}
							<CreateChartLink
								href="/dataset/{datasetId}/resource/{resource.id}/charts/new"
							/>
						{/if}

						<!-- Navegación entre recursos: un solo control compacto «‹ Recurso N de M ⇅ ›» (ver
						     `ResourceStepper`). Reemplaza al desplegable de hermanos de la miga. -->
						{#if hasJump}
							<ResourceStepper datasetId={datasetId ?? ""} {neighbours} />
						{/if}
					</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- Preview + metadata content -->
		<section class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
			{#snippet previewCard()}
				{#if resource}
					<!-- Destino del foco. `scroll-mt` = encabezado (`--header-h`) + 1px de su borde + 16px de aire. Se lee
					     `--header-h` y no un 4rem fijo porque el salto casi siempre parte del tope, con el encabezado
					     aún en 5rem: al bajar, éste se encoge 16px y sube el contenido otro tanto, y con 4rem fijos la
					     tarjeta aterrizaba 16px más arriba de lo medido (pegada al encabezado). Con la variable el
					     margen vale 16px más cuando el encabezado está alto, justo lo que se pierde al encogerse.
					     `tabindex="-1"` la deja recibir el foco sin entrar en el orden del teclado. -->
					<div
						id="vista-previa"
						tabindex="-1"
						bind:this={previewEl}
						class="scroll-mt-[calc(var(--header-h)+17px)] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
					<Card class="overflow-hidden border-primary/20">
						<!-- La barra mide 41px con o sin botón (`min-h` + `h-7`): el alto de la vista previa descuenta ese número. -->
						<div class="flex min-h-[41px] flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-1.5">
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">Vista previa</p>
							{#if hasPreview}
								<button type="button" onclick={fitPreview} class={cn(ACCION_BASE, "h-7 px-2.5 text-xs")}>
									<Maximize2 class="size-3.5" aria-hidden="true" />
									Ajustar a la pantalla
								</button>
							{/if}
						</div>
						{#if isLink}
							<!-- Nota compacta. La CAJA era el problema, no el texto: 220px de alto mínimo, 40px de padding
							     y un círculo de 64px para una sola oración. El copy se conserva palabra por palabra porque
							     los tests lo anclan, y sin ícono: no agregaba información al lado de una oración. -->
							<div class="space-y-1 p-5">
								<p class="font-heading text-base font-bold text-foreground">
									Este recurso es un enlace externo
								</p>
								<p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
									Su contenido está en el sitio de origen, no en el portal, así que no hay nada que
									previsualizar aquí.
								</p>
							</div>
						{:else}
							<ResourcePreview resource={resource} datastore={datastoreApi} />
						{/if}
					</Card>
					</div>
				{/if}
			{/snippet}

			<!-- Con tabla en el DataStore la vista previa es la pestaña «Tabla» y cada gráfico `umss_chart` tiene la
			     suya. Es el mismo marcador que gobierna la vista previa y la sección de la API. Sin tabla no hay
			     pestañas: queda la vista previa sola. -->
			{#if resource.datastore_active === true}
				{#key resource.id}
					<ResourceCharts
						resourceId={resource.id}
						datasetId={datasetId ?? ""}
						api={chartApi}
						canEdit={canEditCharts}
						table={previewCard}
					/>
				{/key}
			{:else}
				{@render previewCard()}
			{/if}

		<!-- API content -->
		<!-- El gate es `datastore_active`, no `resource_type`: `resource_type` es un campo heredado que
		     nada escribe (el formulario de CKAN lo tiene comentado; medido `None` en los 35 recursos del
		     catálogo), así que la sección no se renderizaba nunca. `datastore_active` es el marcador de
		     CKAN para «existe una tabla real» —el mismo que usa la vista previa— y sin tabla no hay filas
		     que consultar. -->
		{#if resource.datastore_active === true}
			<div>
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">API</p>
					<h2 class="mt-1 font-heading text-xl font-bold text-primary">Acceso por API</h2>
					<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
						Consulte las filas de este recurso a través de la API.
					</p>
				</div>
	
				<div class="mt-4 space-y-4">
					<!-- Tarjeta de la API -->
					<Card class="p-5">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<p class="text-sm font-semibold text-foreground">Dirección de la API</p>
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
								{#each apiExtraRows as extra, i}
									<div class="flex items-start justify-between gap-3 py-2.5">
										<span class="text-xs text-muted-foreground">{apiExtraLabel(extra.key, i)}</span>
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
						<p class="mt-1 text-sm text-muted-foreground">Obtenga las filas de la tabla del recurso.</p>
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
					Metadatos
				</p>
				<h2 class="mt-1 font-heading text-xl font-bold text-primary">Información sobre el recurso</h2>
				<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Formato, tamaño, tipo MIME y sus identificadores.
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
						Identificador: <code class="font-mono">{resource.id}</code>
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

