<script lang="ts">
import { Database, Pencil } from "@lucide/svelte";
import { get } from "svelte/store";
import { page } from "$app/stores";
import { createPortalClient } from "$lib/api/client";
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
import ActionsMenu from "$lib/components/dataset/ActionsMenu.svelte";
import AnchorLink from "$lib/components/dataset/AnchorLink.svelte";
import DatasetSidebar from "$lib/components/dataset/DatasetSidebar.svelte";
import type { MenuItem } from "$lib/components/dataset/more-menu";
import OverflowBadges, { type BadgeItem } from "$lib/components/dataset/OverflowBadges.svelte";
import type { PublicationDecisionResult } from "$lib/components/dataset/publication-decision";
import RequestPublicationControl from "$lib/components/dataset/RequestPublicationControl.svelte";
import ResourceCard from "$lib/components/dataset/ResourceCard.svelte";
import ResponsiveAction from "$lib/components/dataset/ResponsiveAction.svelte";
import ErrorPage from "$lib/components/error/ErrorPage.svelte";
import { rewriteLegacyFragment } from "$lib/components/resource/legacy-fragment";
import { upgradeFragment } from "$lib/components/resource/preview-views";
import Breadcrumb, { type BreadcrumbItem } from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { CopyButton } from "$lib/components/ui/copy-button";
import { MetaGroup } from "$lib/components/ui/meta";
import { insigniaDeLaSolicitud } from "$lib/copy/publication";
import { stateLabel } from "$lib/copy/states";
import { technicalGroups } from "$lib/datasets/details";
import { getMockDatasetById } from "$lib/mock/data";
import { isPrototypeMode } from "$lib/prototype/mode";
import { resolveUnauthorized, type UnauthorizedResolution } from "$lib/session-guard";
import { auth } from "$lib/stores/auth";
import type { CkanPackage } from "$lib/types/ckan";
import { formatDate, ownerOrgIdOf } from "$lib/utils/ckan";
import { SUMMARY_EXTRA_KEY } from "$lib/utils/dataset-summary";
import { renderMarkdown } from "$lib/utils/markdown";
import DatasetCollections from "../../dev/prototype/collections/DatasetCollections.svelte";
import { collectionsOfRealDataset } from "../../dev/prototype/collections/data";

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
/**
 * Cuántas solicitudes **pendientes** hay para este dataset. La tarjeta muestra la vigente y, cuando
 * hay más de una, lo dice: la página no elige entre dos filas en silencio. Con una sola no agrega la
 * línea, que sería ruido.
 */
let pendingRequestCount = $state(0);
/**
 * El historial de solicitudes de **este** dataset, la más nueva primero (S12/S19). Vacío quiere decir «no
 * hay nada que mostrar» y también «no se pudo averiguar» o «el espectador es anónimo»: la tarjeta no
 * existe en ninguno de los tres casos.
 */
let historialDeSolicitudes = $state<PublicationRequest[]>([]);
let loading = $state(true);
let failure = $state<DatasetFailure | null>(null);

// Una URL incompleta es un estado propio, no un fallo del catálogo: reintentar no puede arreglar
// una dirección mal formada, así que se ofrece sólo el enlace de vuelta y la página no afirma nada
// sobre el catálogo que no haya medido. Modelarla como `failure` sería inventar un diagnóstico.
let invalidParams = $state(false);

// El camino único de expulsión ya limpió la sesión y navegó: no se renderiza nada más ni se
// vuelve a navegar.
let expelled = $state(false);

// Ids donde el usuario puede editar datasets (bulk). Fail closed: arranca vacío y sólo `known` lo llena.
let orgsEditables = $state<string[]>([]);

/**
 * ¿Administra quien mira la organización dueña del dataset? Es la pregunta que el catálogo exige para
 * **decidir** una solicitud —`permission: "admin"`—, distinta de la de editar, que incluye a los
 * editores. Falla cerrado y arranca en `false`: `may_not`, `unknown` y «todavía no se preguntó» se
 * comportan igual —la tarjeta no ofrece decidir— y la cola sigue siendo el camino de quien administra.
 */
let puedeDecidirSolicitud = $state(false);

// ─── ID from URL ────────────────────────────────────────────────
const datasetId = $derived($page.params.id);

// ─── Data fetching ───────────────────────────────────────────────
// ─── API de publicación ─────────────────────────────────────────
// Un solo cliente para las acciones de publicación: los controles reciben **funciones estables**, y la
// credencial la pone el puente del portal en cada llamada, así que construir un cliente por llamada no
// compraría nada. Las cuatro acciones existen en la capa de API desde `B1`; los controles las reciben
// inyectadas porque no importan la API —la página las cablea—, no porque falten del lado del portal.
const publicationClient = createPortalClient();
const publicationApi = createPublicationApi(publicationClient);

/**
 * La relectura con la que se **confirma** una aprobación: el mismo `package_show` con el que esta página
 * carga el dataset, sobre el valor **almacenado** —no el que la ficha tiene en memoria—. Es lo que
 * distingue «el catálogo concedió» de «el catálogo contestó 200».
 */
const readStoredDataset = (id: string) => createDatasetApi(publicationClient).show(id);

/** El camino del editor: pedir la publicación de un dataset privado, y retirar la propia solicitud. */
const solicitar = (datasetId: string, comments?: string) =>
	publicationApi.request(datasetId, comments);
const cancelar = (requestId: string) => publicationApi.cancel(requestId);

/** Decide una solicitud: lo que llama el control de la tarjeta cuando quien administra la decide. */
const decidir = (requestId: string, approve: boolean, comments?: string) =>
	publicationApi.decide(requestId, approve, comments);

/**
 * Qué hace la ficha con una decisión **confirmada**: la solicitud queda en el estado que confirmó el
 * catálogo —con quién la decidió y el motivo del rechazo, si lo hubo— y, si la aprobación concedió, el
 * dataset ya es público. La visibilidad no se deduce de la respuesta: el control la confirmó releyendo
 * el valor **almacenado**.
 */
function reflejarDecision(respuesta: PublicationDecisionResult): void {
	if (!solicitudVigente) return;
	// Una fila decidida **ya no es decidible** —es la semántica del campo en el catálogo—, así que la
	// copia en memoria no conserva un `true` que dejó de ser cierto.
	solicitudVigente = {
		...solicitudVigente,
		status: respuesta.status,
		decidable_by_caller: false,
		comments: respuesta.comments ?? solicitudVigente.comments,
		approved_by_name: respuesta.approved_by_name ?? solicitudVigente.approved_by_name,
	};
	if (respuesta.status === "approved" && dataset) dataset = { ...dataset, private: false };
	void loadHistory();
}

// Hero C7 (T13, v0.1.1): «Editar» es la acción principal y va a la derecha de la fila de las insignias; la
// solicitud de publicación **no** es un botón de esa fila: es una unidad (estado + acción) bajo las insignias.
// Esta bandera decide si esa unidad existe.
//
// La condición de la solicitud **espeja** la de `RequestPublicationControl`, y es el único lugar donde
// eso pasa: el componente dibuja su acción si el dataset es privado, quien mira puede pedir y no hay
// una solicitud aprobada. Si esa condición cambia, **este conteo queda viejo** y el hero reserva una
// unidad de más o de menos. Es el precio de que el reparto lo decida la página y el dibujo lo decida el
// componente, y queda declarado a propósito.
//
// No hay un segundo control: publicar en directo dejó de existir y la única vía es pedir y decidir en
// la cola, así que la compuerta es **una sola**, para todos los roles.
const publicacionEnElHero = $derived.by(() => {
	if (!dataset) return false;
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
		// El filtro compara contra el dataset **cargado**, no contra el parámetro de la ruta, y acepta sus
		// **dos formas**: las filas nuevas guardan el **id** canónico (el PR #12 del otro repo) y las
		// **legadas** guardaron el **nombre**, que la lectura devuelve tal cual (`_row_dict` arma el
		// diccionario con las columnas crudas). Comparar sólo contra el id dejaba a las legadas invisibles en
		// la ficha aunque la cola las muestre; y comparar contra el parámetro de la ruta no coincidiría nunca
		// cuando la dirección trae el nombre — la misma trampa de cuatro ojos, que quedó inerte y verde.
		const propias = filas.filter(
			(fila) => fila.dataset_id === dataset?.id || fila.dataset_id === dataset?.name,
		);
		// Determinista y **total**: entre las pendientes gana la **más reciente** por `created_at` y, ante un
		// empate exacto (dos filas con el mismo instante), la de **`id` mayor**. Todas las filas usan
		// `YYYY-MM-DDTHH:MM:SS.ffffff`, así que el orden lexicográfico es el cronológico y no depende del
		// arreglo; con la comparación estricta sola, el empate lo decidía el orden de entrada — la dependencia
		// que esta selección viene a quitar. La más vieja puede venir primero: no se toma «la primera».
		const pendingRows = propias.filter((fila) => fila.status === "pending");
		const mostRecent = pendingRows.reduce<PublicationRequest | null>((latest, row) => {
			if (!latest) return row;
			const rowAt = row.created_at ?? "";
			const latestAt = latest.created_at ?? "";
			if (rowAt !== latestAt) return rowAt > latestAt ? row : latest;
			return row.id > latest.id ? row : latest;
		}, null);
		solicitudVigente = mostRecent ?? propias[0] ?? null;
		pendingRequestCount = pendingRows.length;
	} catch {
		solicitudVigente = null;
		pendingRequestCount = 0;
	}
}

/**
 * El historial, en su **propia** llamada y con su **propio** catch: un fallo acá no puede tumbar la ficha.
 * El anónimo no lo pide —el catálogo le respondería vacío— y la visibilidad por rol la acota el catálogo,
 * no el portal. Se pide con el **id** del dataset cargado: el filtro del servidor es por `dataset_id`.
 */
async function loadHistory() {
	if (!dataset || !get(auth).user) {
		historialDeSolicitudes = [];
		return;
	}
	try {
		historialDeSolicitudes = await publicationApi.history(dataset.id);
	} catch {
		historialDeSolicitudes = [];
	}
}

// La oración del estado de la solicitud vive en `$lib/copy/publication.ts`: cualquier superficie que
// muestre la tarjeta tiene que renderizar **esta** frase, no una copia que puede quedar vieja.

// Qué tarjeta de la solicitud dibuja la columna lateral lo decide `DatasetSidebar`.

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
	historialDeSolicitudes = [];
	orgsEditables = [];

	const user = get(auth).user;
	// El puente del portal pone la credencial de la sesión. Sin ella, `package_show` de un dataset
	// **privado** responde 403 incluso para su propio dueño: todo dataset se crea privado hasta que el
	// flujo de publicación defina su visibilidad.
	const client = createPortalClient();
	const datasetApi = createDatasetApi(client);

	try {
		dataset = await datasetApi.show(datasetId);
	} catch (err) {
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
		// La pregunta de administración va **antes** de la solicitud: cuando la tarjeta se dibuja, ya tiene
		// respuesta, así que «no se ofrece decidir» nunca significa «todavía no se sabe».
		//
		// **El precio, declarado**: es una llamada por vista de dataset, incluso cuando no hay ninguna
		// solicitud que decidir. Se paga a propósito —el orden es lo que vuelve determinista la respuesta— y
		// es lo que señaló la revisión nativa del PR #67 (`R4-unconditional-permission-roundtrip`): una
		// deuda **declarada**, no un descuido. Ahorrarla exige garantizar el orden por otra vía —resolver la
		// solicitud primero y **no** dibujar la tarjeta hasta tener las dos respuestas—, y eso hay que
		// medirlo antes de tocarlo.
		await loadDecidePermission(ownerOrgIdOf(dataset));
		await loadCurrentRequest();
		await loadHistory();
	}
}

/**
 * La pregunta de administración, en su **propia** llamada y con su **propio** catch: un fallo acá no
 * puede tumbar la ficha que sí cargó. `may` es la única respuesta que ofrece el control en la tarjeta.
 */
async function loadDecidePermission(dueno: string) {
	if (!dueno) {
		puedeDecidirSolicitud = false;
		return;
	}
	try {
		const client = createPortalClient();
		puedeDecidirSolicitud =
			(await createOrganizationApi(client).canAdministerOrganization(dueno)) === "may";
	} catch {
		puedeDecidirSolicitud = false;
	}
}

// Bulk de permiso de edición. `unknown` se trata como «no podés»: fail closed.
async function loadEditPermission() {
	try {
		const client = createPortalClient();
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

// Un enlace compartido con el fragmento de una sección (`#history`, o el heredado en español `#historial`): el
// navegador no lo resuelve porque la sección se dibuja después de cargar. Se baja a ella **una vez** y cuando ya
// existe (el historial llega después del dataset: si falta, se espera); un fragmento heredado además reescribe la
// URL a su forma en inglés. Si la persona se desplaza antes de que llegue la sección, el salto se abandona.
let fragmentApplied = false;
$effect(() => {
	const stop = () => {
		fragmentApplied = true;
	};
	const events = ["wheel", "touchstart", "keydown"] as const;
	for (const e of events) window.addEventListener(e, stop, { passive: true });
	return () => {
		for (const e of events) window.removeEventListener(e, stop);
	};
});
$effect(() => {
	void dataset;
	void historialDeSolicitudes;
	if (fragmentApplied || !dataset) return;
	const hash = window.location.hash;
	const id = (upgradeFragment(hash) ?? hash).slice(1);
	if (!id) {
		fragmentApplied = true;
		return;
	}
	const target = document.getElementById(id);
	if (!target) return;
	fragmentApplied = true;
	rewriteLegacyFragment(new URL(window.location.href));
	const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	// `?.`: los entornos sin layout (jsdom) no implementan `scrollIntoView`; sin la guarda, cualquier test que monte la
	// ficha con un fragmento termina con un error sin manejar y la suite sale con código de error.
	target.scrollIntoView?.({ behavior: reduce ? "instant" : "smooth", block: "start" });
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

// Los grupos de «Información técnica» (ver `$lib/datasets/details`); el «Resumen» lo arma `DatasetSidebar`.
const technical = $derived(dataset ? technicalGroups(dataset) : []);

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
// Regla de las insignias (L32): una insignia es enlace sólo si existe un filtro de búsqueda para su valor
// (organización, etiquetas, formato, licencia). Los estados informan y no son enlaces. «Público» y «Activo»
// son los estados por defecto y no se muestran: sólo las excepciones («Privado», «Borrador», «Eliminado», la
// solicitud) dicen algo.
const searchHref = (key: "org" | "tags" | "license", value: string) =>
	`/search?${new URLSearchParams({ [key]: value })}`;

// «Activo» es el estado por defecto y el hero no lo repite; cualquier otro, conocido o no, se dice.
const stateBadge = $derived(dataset?.state === "active" ? null : stateLabel(dataset?.state));

// La página de la organización es la de la miga y la tarjeta lateral (`DatasetSidebar`); la insignia del hero
// filtra el catálogo.

const heroBadges = $derived.by((): BadgeItem[] => {
	if (!dataset) return [];
	const list: BadgeItem[] = [];
	const org = dataset.organization;
	if (org?.title) {
		list.push({
			id: "org",
			label: org.title,
			priority: 0,
			shrinks: true,
			tone: "border-primary/20 bg-primary/10 text-primary",
			...(org.name
				? {
						linkable: true,
						href: searchHref("org", org.name),
						linkLabel: `Ver datasets de ${org.title} en el catálogo`,
					}
				: {}),
		});
	}
	if (stateBadge) {
		list.push({
			id: "estado",
			label: stateBadge,
			priority: 3,
			tone: "border-destructive/20 bg-destructive/10 text-destructive",
		});
	}
	// Con la unidad del hero el estado de la solicitud vive en ella; sin unidad (quien mira no puede pedir)
	// sigue siendo una insignia, para que el estado no se pierda.
	const solicitud = publicacionEnElHero ? null : insigniaDeLaSolicitud(solicitudVigente?.status);
	if (solicitud) list.push({ id: "solicitud", priority: 2, ...solicitud });
	if (dataset.private) {
		list.push({
			id: "privacidad",
			label: "Privado",
			priority: 1,
			tone: "border-destructive/20 bg-destructive/10 text-destructive",
		});
	}
	return list;
});

// Acciones secundarias del hero, para «Más acciones» (variante C7). Hoy no hay ninguna: «Editar» va sola, sin
// flecha. Una acción nueva se agrega acá, con su destino, y el botón dividido aparece solo.
const heroMoreActions: MenuItem[] = [];

// El enlace cuelga del `owner_org` de este dataset, contrastado contra el conjunto bulk.
const puedeEditarDataset = $derived.by(() => {
	if (!dataset) return false;
	return orgsEditables.includes(ownerOrgIdOf(dataset));
});

// «Copiar enlace» es sólo ícono y va siempre a la izquierda del título (T4, v0.1.1; decisión del autor,
// 2026-10-19).

// La cita («Citar como») la arma `DatasetSidebar`.

// Enlace canónico del dataset (usa el slug, no el id interno).
// Modo prototipo (`$lib/prototype/mode.ts`, sólo en desarrollo): las colecciones de la maqueta que incluyen
// este dataset, vistas como un visitante (Q10: sólo las públicas). `null` si el dataset real no tiene maqueta,
// y entonces no hay sección.
const prototypeCollections = $derived(
	isPrototypeMode($page.data) && dataset
		? collectionsOfRealDataset(dataset.name, { kind: "visitor" })
		: null,
);

const shareUrl = $derived(dataset ? `${$page.url.origin}/dataset/${dataset.name}` : "");
// El resumen corto que escribió quien publica (extra `summary`); vacío si no lo hay.
const resumenEditorial = $derived(
	dataset?.extras?.find((extra) => extra.key === SUMMARY_EXTRA_KEY)?.value?.trim() ?? "",
);
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
		<!-- Hero -->
		<section class="border-b border-border bg-card">
			<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<!-- «Copiar enlace» a la izquierda del título, anclado a su primera línea: el contenedor hereda el
				     tamaño y el interlineado del título, así `1lh` es el alto de esa línea y el botón (más alto) se
				     centra en ella aunque el título ocupe varias. `min-w-0` deja que el título se parta. -->
				<div class="flex items-start gap-3 font-heading text-3xl leading-tight sm:text-4xl">
					<div class="flex h-[1lh] shrink-0 items-center">
						<CopyButton
							text={shareUrl}
							label="Copiar enlace del dataset"
							copiedLabel="Enlace copiado"
							icon="link"
						/>
					</div>
					<h1 class="min-w-0 font-bold text-foreground">
						{dataset.title || dataset.name}
					</h1>
				</div>
				<!-- El resumen editorial como bajada del título (P17): sólo el extra que escribió quien publica. Sin él
				     no se arma uno con la descripción, que ya está en el cuerpo de la página. -->
				{#if resumenEditorial}
					<p data-dataset-summary class="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
						{resumenEditorial}
					</p>
				{/if}
				<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
					<span>Actualizado {formatDate(dataset.metadata_modified)}</span>
				</div>
				<!-- Hero C7 (T13). La fila de las insignias y «Editar» no envuelve: la organización trunca y las demás
				     insignias pasan a un «+N» antes de empujar a «Editar». La solicitud de publicación es una
				     unidad (estado + acción) bajo esa fila, a la izquierda. El contenedor de consultas hace que
				     los botones respondan al ancho del hero y no al de la ventana. -->
				<div class="@container mt-4 space-y-3">
					<div data-hero-row class="flex flex-nowrap items-center gap-3">
						<div class="min-w-0 flex-1 basis-[10rem]">
							<OverflowBadges badges={heroBadges} />
						</div>
						<!-- Fail closed: sin respuesta afirmativa no hay enlace; `unknown` y el conjunto vacío se
						     tratan igual. CKAN es la frontera de seguridad, no el botón oculto. -->
						{#if puedeEditarDataset}
							<div class="flex shrink-0 items-center">
								<ResponsiveAction
									icon={Pencil}
									label="Editar"
									href={`/dashboard/datasets/${dataset.name}/edit`}
									collapseBelow="32rem"
									class={heroMoreActions.length > 0 ? "rounded-r-none" : ""}
								/>
								{#if heroMoreActions.length > 0}
									<ActionsMenu items={heroMoreActions} />
								{/if}
							</div>
						{/if}
					</div>
					{#if publicacionEnElHero}
						<!-- La compuerta la decide el componente: el editor ve ahí su solicitud. No hay camino
						     directo —publicar en directo dejó de existir—, así que la única vía es pedir y decidir
						     en la cola. -->
						<RequestPublicationControl
							dataset={{ id: dataset.id, private: dataset.private }}
							canRequest={puedeEditarDataset}
							currentRequest={solicitudVigente}
							request={solicitar}
							cancel={cancelar}
							apariencia="accion"
							onrequested={(reportada) => {
								solicitudVigente = reportada;
								void loadHistory();
							}}
							oncancelled={(reportada) => {
								solicitudVigente = reportada;
								void loadHistory();
							}}
						/>
					{/if}
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
								{#each visibleTags as tag (tag.id)}
									{@const label = tag.display_name || tag.name}
									<!-- La etiqueta filtra el catálogo (`/search?tags=`). El área táctil llega a 44 px con el
									     pseudoelemento, sin mover el diseño. -->
									<a
										href={searchHref("tags", tag.name)}
										aria-label={`Ver datasets con la etiqueta ${label} en el catálogo`}
										class="relative inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										#{label}
									</a>
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
					<Card id="resources" class="scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] p-6 sm:p-8">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">Recursos</p>
						<div class="group/ancla mt-1 flex items-center gap-2">
							<h2 class="font-heading text-xl font-bold text-primary">
								Archivos disponibles
								{#if activeResources.length > 0}
									<span class="font-normal text-muted-foreground">({activeResources.length})</span>
								{/if}
							</h2>
							<AnchorLink id="resources" title="Recursos" />
						</div>
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

					{#if prototypeCollections}
						<DatasetCollections
							collections={prototypeCollections}
							orgTitle={dataset.organization?.title ?? dataset.organization?.name ?? ""}
						/>
					{/if}

					<!-- Información técnica: todos los campos registrados, en grupos (variante C / 3b de
					     `/dev/dataset-details`, elegida por el autor el 2026-10-19). Es el destino de «Ver la
					     información técnica completa» del «Resumen»; `scroll-mt` deja el título bajo el encabezado fijo,
					     como `#preview` en la página del recurso. -->
					<Card id="technical-info" class="scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] p-6 sm:p-8">
						<p class="text-xs font-medium uppercase tracking-wider text-destructive">
							Información técnica
						</p>
						<div class="group/ancla mt-1 flex items-center gap-2">
							<h2 class="font-heading text-xl font-bold text-primary">Ficha completa</h2>
							<AnchorLink id="technical-info" title="Información técnica" />
						</div>
						<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
							Todos los datos que el catálogo registra de este dataset.
						</p>
						<div class="mt-4 space-y-8">
							{#each technical as group (group.id)}
								<MetaGroup {...group} />
							{/each}
						</div>
					</Card>
				</div>

				<!-- Sidebar: la columna lateral vive en `DatasetSidebar` (la monta también `/dev/dataset-panel`). -->
				<DatasetSidebar
					{dataset}
					{solicitudVigente}
					{pendingRequestCount}
					{puedeDecidirSolicitud}
					{decidir}
					{readStoredDataset}
					{reflejarDecision}
					{historialDeSolicitudes}
				/>
			</div>
		</section>
	{/if}
</div>
