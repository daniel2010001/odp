<script lang="ts">
import {
	Building2,
	Calendar,
	Check,
	Clock,
	Copy,
	Database,
	Inbox,
	Link2,
	Pencil,
	Shield,
	User,
} from "@lucide/svelte";
import { get } from "svelte/store";
import { page } from "$app/stores";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import {
	type AccessContext,
	classifyFailure,
	describeFailure,
	type FailurePresentation,
	failureActions,
	isDefinitive,
	statusFor,
} from "$lib/api/failure";
import { createOrganizationApi } from "$lib/api/organizations";
import { createPublicationApi, type PublicationRequest } from "$lib/api/publication";
import PublishControl from "$lib/components/dataset/PublishControl.svelte";
import RequestPublicationControl from "$lib/components/dataset/RequestPublicationControl.svelte";
import ResourceCard from "$lib/components/dataset/ResourceCard.svelte";
import ErrorPage from "$lib/components/error/ErrorPage.svelte";
import OrganizationLogo from "$lib/components/organizations/OrganizationLogo.svelte";
import Breadcrumb, { type BreadcrumbItem } from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { getMockDatasetById } from "$lib/mock/data";
import { resolveUnauthorized, type UnauthorizedResolution } from "$lib/session-guard";
import { auth, isSuperAdmin } from "$lib/stores/auth";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { copyToClipboard, formatCitationAPA, formatCitationBibTeX } from "$lib/utils/citation";
import { formatDate, ownerOrgIdOf } from "$lib/utils/ckan";
import { renderMarkdown } from "$lib/utils/markdown";

// ─── State ───────────────────────────────────────────────────────

/** Fallo del catálogo con el contexto de sesión que le da sentido al texto. */
type DatasetFailure = {
	presentation: FailurePresentation;
	access: AccessContext;
};

let dataset = $state<CkanPackage | null>(null);
/**
 * La solicitud vigente de **este** dataset, para la tarjeta del estado.
 *
 * `null` quiere decir «no hay ninguna que mostrar» y también «no se pudo averiguar»: la tarjeta no
 * distingue esos dos casos porque en los dos la ficha no tiene nada que decir. Lo que **no** hace es
 * conservar una solicitud vieja cuando la consulta falla.
 */
let solicitudVigente = $state<PublicationRequest | null>(null);
let loading = $state(true);
let failure = $state<DatasetFailure | null>(null);
let citationFormat = $state<"apa" | "bibtex">("apa");
let copied = $state(false);
let copiedLink = $state(false);

// Una URL incompleta es un estado propio, no un fallo del catálogo: reintentar no puede arreglar
// una dirección mal formada, así que se ofrece sólo el enlace de vuelta y la página no afirma nada
// sobre el catálogo que no haya medido. Modelarla como `failure` sería inventar un diagnóstico.
let invalidParams = $state(false);

// El camino único de expulsión ya limpió la sesión y navegó: no se renderiza nada más ni se
// vuelve a navegar.
let expelled = $state(false);

// Ids donde el usuario puede editar datasets (bulk). Fail closed: arranca vacío y sólo `known` lo llena.
let orgsEditables = $state<string[]>([]);

// ─── ID from URL ────────────────────────────────────────────────
const datasetId = $derived($page.params.id);

// ─── Data fetching ───────────────────────────────────────────────
// ─── API de publicación ─────────────────────────────────────────
// Un solo cliente para las acciones de publicación: los controles reciben **funciones estables**, y el
// token se lee en cada llamada (`apiKey` es una función), así que construir un cliente por llamada no
// compraría nada. Las cinco acciones existen en la capa de API desde `B1`; hasta antes de eso entraban
// inyectadas justamente porque no existían del lado del portal.
const publicationApi = createPublicationApi(
	createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token }),
);

/** El camino del editor: pedir la publicación de un dataset privado, y retirar la propia solicitud. */
const solicitar = (datasetId: string, comments?: string) =>
	publicationApi.request(datasetId, comments);
const cancelar = (requestId: string) => publicationApi.cancel(requestId);

/** El camino directo, reservado a la superadministración de la plataforma. */
const publicar = (datasetId: string, comments?: string) =>
	publicationApi.publish(datasetId, comments);

/**
 * La **relectura** que confirma una publicación: la acción devuelve sólo su fila, así que el portal
 * mide el valor almacenado en vez de creerle a quien lo escribió. Por eso es una llamada aparte y no
 * una clave de la respuesta.
 */
function leerDataset(id: string): Promise<CkanPackage> {
	return createDatasetApi(
		createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token }),
	).show(id);
}

// La regla del hero (hoja `/dev/dataset-hero`, variante G): una acción va en la fila del título; dos o
// más van en la fila de las insignias. Acá copiar enlace siempre existe, «Editar» sólo con permiso y el
// control de publicación cuando le corresponde, así que el conteo —y el reparto— dependen de esas dos
// respuestas.
//
// La condición del control **espeja** la de los dos componentes, y es el único lugar donde eso pasa:
// `PublishControl` dibuja su acción si la capacidad está concedida, y `RequestPublicationControl` si el
// dataset es privado, quien mira puede pedir y no hay una solicitud aprobada. Si una de las dos cambia,
// **este conteo queda viejo** y el hero reserva una fila de más o de menos. Es el precio de que el
// reparto lo decida la página y el dibujo lo decidan los componentes, y queda declarado a propósito.
const publicacionEnElHero = $derived.by(() => {
	if (!dataset) return false;
	if ($isSuperAdmin) return true;
	if (!dataset.private || !puedeEditarDataset) return false;
	return solicitudVigente?.status !== "approved";
});

/**
 * La solicitud de este dataset, en su **propia** llamada y con su **propio** catch: un fallo acá no
 * puede tumbar la ficha que sí cargó, y una lista vacía es una respuesta, no un error. La acción acota
 * por organización y por solicitudes propias; **este dataset es el filtro que falta**.
 */
async function loadCurrentRequest() {
	try {
		const filas = await publicationApi.list();
		// El filtro compara contra el **id** del dataset cargado, no contra el parámetro de la ruta: la
		// tabla guarda ids, y la dirección puede traer el **nombre** (`/dataset/matricula-2026`), así que
		// comparar el parámetro contra `dataset_id` no coincidiría nunca — es la misma trampa que la
		// comparación de cuatro ojos, que comparaba un nombre contra un id y quedaba inerte y verde.
		const propias = filas.filter((fila) => fila.dataset_id === dataset?.id);
		solicitudVigente = propias.find((fila) => fila.status === "pending") ?? propias[0] ?? null;
	} catch {
		solicitudVigente = null;
	}
}

/**
 * La oración que resume el estado de la solicitud, para la tarjeta de la ficha.
 *
 * El vocabulario es el de la tabla, no el de esta página, y por eso la frase se arma con un `switch`
 * **exhaustivo**: si la tabla gana un estado, esto no compila hasta que se lo nombre. Es la misma forma
 * que usa el módulo de fallos, y evita que un estado nuevo se muestre como «desconocido» sin que nadie
 * se entere.
 */
function estadoDeLaSolicitud(solicitud: PublicationRequest): string {
	switch (solicitud.status) {
		case "pending":
			return solicitud.requested_by_name
				? `Pendiente de revisión, pedida por ${solicitud.requested_by_name}.`
				: "Pendiente de revisión.";
		case "approved":
			return solicitud.approved_by_name
				? `Publicada, aprobada por ${solicitud.approved_by_name}.`
				: "Publicada.";
		case "rejected":
			return solicitud.approved_by_name
				? `Rechazada por ${solicitud.approved_by_name}.`
				: "Rechazada.";
		case "cancelled":
			return "Retirada por quien la pidió.";
		case "annulled":
			return "Anulada: la solicitud dejó de estar vigente.";
		default: {
			const exhaustivo: never = solicitud.status;
			void exhaustivo;
			return "Estado desconocido.";
		}
	}
}

async function loadDataset() {
	if (!datasetId) {
		// URL incompleta: estado propio, no un fallo del catálogo (ver el comentario de `invalidParams`).
		invalidParams = true;
		failure = null;
		dataset = null;
		loading = false;
		return;
	}

	invalidParams = false;
	expelled = false;
	loading = true;
	failure = null;
	dataset = null;
	orgsEditables = [];

	const token = get(auth).token;
	// El cliente lleva el token de la sesión. Sin él, `package_show` de un dataset **privado**
	// responde 403 incluso para su propio dueño: todo dataset se crea privado hasta que el
	// flujo de publicación defina su visibilidad.
	const client = createCkanClient({
		baseUrl: env.CKAN_URL,
		apiKey: () => get(auth).token,
	});
	const datasetApi = createDatasetApi(client);

	try {
		dataset = await datasetApi.show(datasetId);
	} catch (err) {
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

		const presentation = describeFailure(err, "dataset", access);

		if (!presentation.definitive && import.meta.env.DEV) {
			// Sólo una no-respuesta se enmascara con datos mock. Un 403/404 es la respuesta final del
			// catálogo y enmascararlo es el defecto que este slice corrige.
			const mock = getMockDatasetById(datasetId);
			if (mock) {
				dataset = mock;
			} else {
				failure = { presentation, access };
			}
		} else {
			failure = { presentation, access };
		}
	} finally {
		loading = false;
	}

	// Permiso y solicitud vigente en sus **propias** llamadas: un fallo de cualquiera de las dos no puede
	// tumbar el dataset que sí cargó, y por eso ninguna de las dos propaga.
	if (dataset) {
		await loadEditPermission();
		await loadCurrentRequest();
	}
}

// Bulk de permiso de edición. `unknown` se trata como «no podés»: fail closed.
async function loadEditPermission() {
	try {
		const client = createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token });
		const resultado = await createOrganizationApi(client).listUpdatableOrganizationIds();
		orgsEditables = resultado.state === "known" ? resultado.ids : [];
	} catch {
		// El catch vive acá, no en el llamador: cubre también el cliente y aísla el dataset ya cargado.
		orgsEditables = [];
	}
}

// ─── Effect: load on mount ───────────────────────────────────────
$effect(() => {
	void datasetId;
	loadDataset();
});

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
		? "La dirección no contiene un dataset válido."
		: (failure?.presentation.message ?? ""),
);

const pageTitle = $derived.by(() => {
	if (dataset) return `${dataset.title || dataset.name} — UMSS`;
	if (loading) return "Cargando... — UMSS";
	if (failure) return `${failure.presentation.title} — UMSS`;
	if (invalidParams) return "Parámetros de navegación inválidos — UMSS";
	return "Dataset — UMSS";
});

// ─── Derived ─────────────────────────────────────────────────────
// La descripción es markdown (RF-39) y se renderiza con `renderMarkdown`, que es seguro por
// construcción: HTML crudo deshabilitado y URLs validadas con la política de la app.
const description = $derived.by(() => {
	const notas = dataset?.notes;
	return notas?.trim() ? renderMarkdown(notas) : null;
});

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
const breadcrumbItems = $derived.by((): BreadcrumbItem[] => {
	const items: BreadcrumbItem[] = [{ label: "Datasets", href: "/search", role: "Catálogo" }];
	if (dataset?.organization?.title) {
		// Con `href`: la organización tiene página propia (la ruta resuelve name o id). El `href` se
		// arma con `name`, así que se exige `name`, no `title`: una organización con título pero sin
		// `name` conserva la miga como texto y no inventa `/organization/undefined` (la revisión
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
		items.push({ label: dataset.title || dataset.name, role: "Dataset" });
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
	dataset?.organization?.name
		? `/organization/${encodeURIComponent(dataset.organization.name)}`
		: null,
);

// El enlace cuelga del `owner_org` de este dataset, contrastado contra el conjunto bulk.
const puedeEditarDataset = $derived.by(() => {
	if (!dataset) return false;
	return orgsEditables.includes(ownerOrgIdOf(dataset));
});

// La regla del hero (hoja `/dev/dataset-hero`, variante G): una acción va en la fila del título;
// dos o más van en la fila de las insignias. Acá copiar enlace siempre existe y «Editar» sólo con
// permiso, así que el conteo —y por lo tanto el reparto— depende de la respuesta de permiso.
const heroActionCount = $derived(1 + (puedeEditarDataset ? 1 : 0) + (publicacionEnElHero ? 1 : 0));

// ─── Technical metadata table ───────────────────────────────────
// La tabla conserva los campos semánticos; los identificadores (Slug, ID) viven en la franja
// monoespaciada bajo la tabla, igual que en la tarjeta del recurso.
const generalMetaRows = $derived.by(() => {
	if (!dataset) return [];
	const rows: { label: string; value: string }[] = [
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
	<title>{pageTitle}</title>
</svelte:head>

<div>
	<!-- Breadcrumb bar -->
	{#if !loading && !expelled}
		<div class="border-b border-border bg-card">
			<div class="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
				<!-- Unificado con el componente: el mismo breadcrumb en las dos páginas, y en móvil el chip de
				     contexto con el árbol adentro. La decisión del autor (2026-09-24) cubría los dos casos —«en un
				     dataset sería `[] My Dataset`, en un recurso `[] My Resource`»— así que la asimetría de tener
				     dos breadcrumbs distintos se cierra acá. -->
				<Breadcrumb items={breadcrumbItems} icon={Database} />
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

	<!-- Expulsión: el guard ya limpió la sesión y navegó, no queda nada que renderizar -->
	{:else if expelled}

	<!-- Error state — la MISMA página de error que una ruta inexistente, con el copy honesto de
	     `describeFailure` pasado como `copy`: un solo diseño para un solo estado, sin perder el
	     texto que distingue «no existe» de «sin permiso con sesión viva». -->
	{:else if invalidParams || failure}
		<ErrorPage
			status={failureStatus}
			code={failure ? failure.presentation.code : null}
			variant={failureVariant}
			copy={{ title: pageTitle, heading: errorTitle, body: errorMessage }}
			primaryAction={{ href: "/search", label: "Volver al catálogo" }}
			retry={actions.retry ? () => loadDataset() : null}
		/>

	<!-- Dataset content -->
	{:else if dataset}
		<!-- ─── Piezas del hero ─────────────────────────────────────────────
		     La regla es condicional, así que las acciones y las insignias se declaran una sola vez y
		     el reparto las mueve de fila. Duplicarlas sería la forma más segura de que las dos ramas
		     se desincronicen. -->
		{#snippet copyLinkButton()}
			<button
				type="button"
				onclick={handleCopyLink}
				aria-label={copiedLink ? "Enlace copiado" : "Copiar enlace del dataset"}
				title="Copiar enlace"
				class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				{#if copiedLink}
					<Check class="size-4 text-emerald-600" aria-hidden="true" />
				{:else}
					<Link2 class="size-4" aria-hidden="true" />
				{/if}
			</button>
		{/snippet}

		{#snippet heroActions(item: CkanPackage)}
			<div class="flex shrink-0 items-center gap-2">
				{@render copyLinkButton()}
				<!-- Fail closed: sin respuesta afirmativa no hay enlace; `unknown` y el conjunto vacío se
				     tratan igual. CKAN es la frontera de seguridad, no el botón oculto. -->
				{#if puedeEditarDataset}
					<a
						href={`/dashboard/datasets/${item.name}/edit`}
						class="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<Pencil class="size-4" aria-hidden="true" />
						Editar
					</a>
				{/if}
				{#if publicacionEnElHero}
					<!-- El control de publicación **en la fila de sus hermanos**: mismo alto y misma forma que
					     «Copiar enlace» y «Editar» (`apariencia="accion"`), con la explicación en el tooltip y
					     no debajo. La compuerta la decide cada componente: el camino directo es de la
					     superadministración, y el editor ve ahí su solicitud. -->
					{#if $isSuperAdmin}
						<PublishControl
							dataset={item}
							publish={publicar}
							readDataset={leerDataset}
							apariencia="accion"
							onpublished={(publicado) => (dataset = publicado)}
						/>
					{:else}
						<RequestPublicationControl
							dataset={{ id: item.id, private: item.private }}
							canRequest={puedeEditarDataset}
							currentRequest={solicitudVigente}
							request={solicitar}
							cancel={cancelar}
							apariencia="accion"
							onrequested={(reportada) => (solicitudVigente = reportada)}
							oncancelled={(reportada) => (solicitudVigente = reportada)}
						/>
					{/if}
				{/if}
			</div>
		{/snippet}

		{#snippet heroBadges(item: CkanPackage)}
			{#if item.organization?.title}
				{#if orgHref}
					<a
						href={orgHref}
						class="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
					>
						<Building2 class="size-3.5" />
						{item.organization.title}
					</a>
				{:else}
					<span
						class="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
					>
						<Building2 class="size-3.5" />
						{item.organization.title}
					</span>
				{/if}
			{/if}

			{#if stateLabel}
				<span
					class={cn(
						"inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
						item.state === "active"
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
					item.private
						? "border-destructive/20 bg-destructive/10 text-destructive"
						: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
				)}
			>
				{visibilityLabel}
			</span>
		{/snippet}

		<!-- Hero -->
		<section class="border-b border-border bg-card">
			<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				{#if heroActionCount > 1}
					<!-- Dos acciones (copiar + «Editar»): bajan a la fila de las insignias, alineadas a la
					     derecha; el título se queda con la primera fila. -->
					<h1 class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
						{dataset.title || dataset.name}
					</h1>
					<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
						<span>Actualizado {formatDate(dataset.metadata_modified)}</span>
					</div>
					<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
						<div class="flex flex-wrap items-center gap-2">{@render heroBadges(dataset)}</div>
						{@render heroActions(dataset)}
					</div>
				{:else}
					<!-- Una sola acción (copiar): se queda en la fila del título. La columna de texto lleva
					     `min-w-0 flex-1` y el grupo `shrink-0`, así el título se parte dentro de su columna y
					     la acción nunca cae a una línea propia. -->
					<div class="flex items-start gap-4">
						<div class="min-w-0 flex-1">
							<h1 class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
								{dataset.title || dataset.name}
							</h1>
							<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
								<span>Actualizado {formatDate(dataset.metadata_modified)}</span>
							</div>
							<div class="mt-4 flex flex-wrap items-center gap-2">{@render heroBadges(dataset)}</div>
						</div>
						{@render heroActions(dataset)}
					</div>
				{/if}
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
							<div
								class="markdown-body mt-3 text-sm leading-relaxed text-muted-foreground"
							>
								{@html description}
							</div>
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

					<!-- La tarjeta del estado de la solicitud, **después de la información textual**.
					     Muestra en qué está y **no** trae el formulario de decidir: decidir es el trabajo de la
					     page de solicitudes, no un accesorio de la ficha. La acción, cuando le corresponde a
					     quien mira, vive en el hero junto a sus hermanas. -->
					{#if solicitudVigente}
						<Card class="p-6 sm:p-8">
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">
								Solicitud de publicación
							</p>
							<p
								class="mt-2 flex items-center gap-2 text-sm leading-relaxed text-foreground"
								data-testid="estado-solicitud"
							>
								<Inbox class="size-4 shrink-0 text-primary" aria-hidden="true" />
								{estadoDeLaSolicitud(solicitudVigente)}
							</p>
						</Card>
					{/if}

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
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">
							Metadatos
						</p>
						<h2 class="mt-1 font-heading text-xl font-bold text-primary">
							Información sobre el dataset
						</h2>
						<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
							Visibilidad, estado y sus identificadores.
						</p>
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
										<span class="break-all font-medium text-foreground">{row.value}</span>
									</div>
								{/each}
							</div>
						</div>

						<!-- Identificadores: misma franja monoespaciada que la tarjeta del recurso. La fila
						     envuelve entre elementos (cada identificador es un hijo propio) para que un valor
						     largo no sea lo primero en romperse; `break-all` queda en el `code` como último recurso. -->
						<div class="mt-6 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
							<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
								<span>Dirección web: <code class="break-all font-mono">{dataset.name}</code></span>
								<span>·</span>
								<span>Identificador: <code class="break-all font-mono">{dataset.id}</code></span>
							</div>
						</div>
					</Card>
				</div>

				<!-- Sidebar -->
				<aside
					class="min-w-0 space-y-6 transition-[top] duration-200 ease-out lg:sticky lg:top-[calc(var(--header-h)+1rem)]"
				>
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
							<!-- «Detalles», no «Metadatos» (decisión del autor, 2026-09-28): la palabra «Metadatos» es de la
							     tarjeta de la tabla técnica —arriba en esta página y en la del recurso—, y acá lo que hay es un
							     **resumen** (creado, modificado, licencia, autor, mantenedor). Repetir el título era el defecto. -->
							<p class="text-xs font-medium uppercase tracking-wider text-destructive">Detalles</p>
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
