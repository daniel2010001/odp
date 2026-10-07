<!--
	Hoja de revisión de la publicación — superficie sólo para desarrollo (`/dev/publication`).

	Duplica las superficies reales que la publicación toca y las renderiza con los **componentes
	reales** (`PublishControl`, `RequestPublicationControl`, `PublicationQueue`):

	· la **zona de acciones del hero** de la ficha del dataset (`src/routes/dataset/[id]/+page.svelte`),
	  vista como editor, como administrador de la organización y como superadministración, para que las
	  compuertas se comparen sin derivar una de la otra — y, para el control de publicación, sus **dos
	  colocaciones**: la fila de acciones del hero y el panel bajo la card de organización, con el conteo
	  de acciones del hero a la vista (`?boton=`);
	· la **cola del panel** del administrador, en cada una de las colocaciones donde el diseño podría
	  hospedarla: una sección del panel —que ahora sólo **referencia** la page, porque la cola entera
	  vive en la suya—, una ruta propia, un contador en la navegación y en el menú de usuario, y un aviso
	  en la ficha del dataset. La hoja cambia de colocación sin perder los demás interruptores: descubrir
	  la cola es parte de que la compuerta funcione, porque una solicitud que nadie ve es un bloqueo mudo;
	· la **page propia de la cola** (`?colocacion=ruta`), con las formas que puede tomar cuando quien
	  mira administra varias organizaciones (`?orgs=plana|agrupada|filtro`), los grupos de **pendientes y
	  después resueltas** (`?secciones=`) y el **plegado** de todo menos la primera solicitud
	  **decidible** (`?expansion=`). El plegado es presentación, no política: la fila plegada sigue
	  diciendo qué dataset es, de qué organización y quién la pidió.

	Las reglas que la hoja deja mirar: el **camino directo de publicación** sólo se ofrece a la
	superadministración (un administrador de organización no lo ve); la **cola** no decide la solicitud
	que creó quien mira y **exige un motivo para rechazar**; y una solicitud **anulada** dice que dejó
	de estar vigente. Una solicitud ya resuelta dice quién la decidió, y la cancelada o la anulada no
	se atribuyen un decisor. También los estados que no se pueden provocar a mano: un `403` rechazado
	con nombre propio, un `200` que no concede, una solicitud rechazada con su motivo y una cola que no
	carga.

	Todas las llamadas —`publish`, `readDataset`, `request`, `cancel`, `list`, `decide`— entran por
	**dobles**: las acciones del catálogo todavía no existen en la capa de API del portal, así que la
	hoja no puede cablearlas de verdad. El panel de control es de la hoja, no del producto: es fijo y
	colapsable, guarda su estado en la URL (`?vista=&caso=&fallo=&cola=&colocacion=&boton=&orgs=`
	`&secciones=&expansion=&panel=`) y `?clic=1`
	aprieta el primer control disponible, para poder enlazar un estado que sólo aparece después del
	clic.

	La hoja es material de revisión: se borra sin tocar los componentes. La compuerta de producción
	está en `+page.ts`.
-->
<script lang="ts">
import {
	Bell,
	Building2,
	ChevronDown,
	Database,
	Inbox,
	Info,
	LayoutDashboard,
	Link2,
	Lock,
	LogOut,
	RotateCcw,
	SlidersHorizontal,
	SquarePen,
} from "@lucide/svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import PublicationQueue, {
	type PublicationDecisionResult,
	type PublicationQueueItem,
} from "$lib/components/dataset/PublicationQueue.svelte";
import PublishControl, { type PublishResult } from "$lib/components/dataset/PublishControl.svelte";
import RequestPublicationControl, {
	type PublicationRequest,
} from "$lib/components/dataset/RequestPublicationControl.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import { cn, formatDate } from "$lib/utils";
import {
	ADMINISTRADOR,
	ADMINISTRADOR_ID,
	AHORA_REVISION,
	COLA,
	COLA_RESUELTA,
	DATASET,
	DATASET_PUBLICADO,
	MOTIVO_RECHAZO,
	makeDataset,
	makeRequest,
	ORGANIZACION,
	SOLICITANTE_ID,
} from "./fixtures";

// ─── Dimensiones del panel ────────────────────────────────────────────
type Vista = "ambas" | "editor" | "administrador" | "sysadmin";
type Caso = "sin-solicitud" | "pendiente" | "rechazada" | "propia" | "sin-motivo" | "annulada";
type Fallo = "ninguno" | "403" | "sin-confirmar" | "relectura" | "red";
type Cola = "con-solicitudes" | "vacia" | "error" | "resueltas" | "una-organizacion";
/** Dónde vive la cola: el eje que el autor quiere decidir. */
type Colocacion = "dashboard" | "ruta" | "contador" | "aviso";
/** Dónde vive el control de publicar en la ficha: en el hero, en el panel, o los dos para comparar. */
type Boton = "hero" | "aside" | "ambos";
/** Cómo se ve, en su propia page, una cola que trae solicitudes de varias organizaciones. */
type Orgs = "plana" | "agrupada" | "filtro";
/** Si la cola se lee en dos grupos —pendientes y resueltas— o corrida. */
type Secciones = "con" | "sin";
/** Cuántas filas arrancan desplegadas: `"primera"` abre sólo la primera decidible. */
type Expansion = "todas" | "primera";

const VISTAS: { id: Vista; label: string }[] = [
	{ id: "ambas", label: "Editor y superadministración" },
	{ id: "editor", label: "Sólo el editor" },
	{ id: "administrador", label: "Sólo el administrador" },
	{ id: "sysadmin", label: "Sólo la superadministración" },
];
const CASOS: { id: Caso; label: string }[] = [
	{ id: "sin-solicitud", label: "Sin solicitud" },
	{ id: "pendiente", label: "Pendiente (con cancelar)" },
	{ id: "rechazada", label: "Rechazada (con motivo)" },
	{ id: "propia", label: "Solicitud propia (no decidible)" },
	{ id: "sin-motivo", label: "Rechazo sin motivo" },
	{ id: "annulada", label: "Solicitud anulada" },
];
const FALLOS: { id: Fallo; label: string }[] = [
	{ id: "ninguno", label: "Concede" },
	{ id: "403", label: "403: rechazo honesto" },
	{ id: "sin-confirmar", label: "La relectura sigue privada" },
	{ id: "relectura", label: "La confirmación no se puede leer" },
	{ id: "red", label: "Falla de red o 5xx" },
];
const COLAS: { id: Cola; label: string }[] = [
	{ id: "con-solicitudes", label: "Con solicitudes" },
	{ id: "vacia", label: "Sin solicitudes" },
	{ id: "una-organizacion", label: "Una sola organización" },
	{ id: "error", label: "No carga" },
	{ id: "resueltas", label: "Con solicitudes resueltas" },
];
const COLOCACIONES: { id: Colocacion; label: string }[] = [
	{ id: "dashboard", label: "Sección del panel" },
	{ id: "ruta", label: "Ruta propia" },
	{ id: "contador", label: "Contador en la navegación" },
	{ id: "aviso", label: "Aviso en /dataset/[id]" },
];
const BOTONES: { id: Boton; label: string }[] = [
	{ id: "hero", label: "En el hero, junto a «Editar»" },
	{ id: "aside", label: "En el panel, bajo la organización" },
	{ id: "ambos", label: "Los dos, lado a lado" },
];
const ORGS: { id: Orgs; label: string }[] = [
	{ id: "plana", label: "Lista plana, con la organización" },
	{ id: "agrupada", label: "Agrupada: una lista por organización" },
	{ id: "filtro", label: "Con filtro por organización" },
];
const SECCIONES: { id: Secciones; label: string }[] = [
	{ id: "con", label: "Pendientes y después resueltas" },
	{ id: "sin", label: "Lista corrida" },
];
const EXPANSIONES: { id: Expansion; label: string }[] = [
	{ id: "primera", label: "Sólo la primera, el resto plegado" },
	{ id: "todas", label: "Todas desplegadas" },
];

interface Preset {
	id: string;
	label: string;
	detalle: string;
	vista: Vista;
	caso: Caso;
	fallo: Fallo;
	cola: Cola;
}

const PRESETS: Preset[] = [
	{
		id: "sin-solicitud",
		label: "1 · Sin solicitud",
		detalle:
			"El editor y el administrador ven la solicitud; sólo la superadministración publica en directo.",
		vista: "ambas",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "pendiente",
		label: "2 · Pendiente",
		detalle: "El editor ve la solicitud pendiente y sólo puede cancelarla.",
		vista: "ambas",
		caso: "pendiente",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "rechazada",
		label: "3 · Rechazada con motivo",
		detalle: "El motivo que escribió el administrador vuelve al editor, y puede volver a pedirla.",
		vista: "ambas",
		caso: "rechazada",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "propia",
		label: "4 · Solicitud propia",
		detalle:
			"La cola marca la solicitud que creó quien mira: no puede aprobarla ni decidirla. Agregue ?clic=1 si quiere verlo tras un clic.",
		vista: "administrador",
		caso: "propia",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "sin-motivo",
		label: "5 · Rechazo sin motivo",
		detalle:
			"Apriete Rechazar sin escribir un motivo: la cola lo exige, lo dice y no envía la decisión. Enlace con ?clic=1.",
		vista: "administrador",
		caso: "sin-motivo",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "annulada",
		label: "6 · Solicitud anulada",
		detalle:
			"La solicitud perdió su objeto (el dataset se eliminó o ya se publicó por otra vía) y deja de ofrecerse.",
		vista: "editor",
		caso: "annulada",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "sysadmin",
		label: "7 · Superadministración publica",
		detalle: "El camino directo, ofrecido sólo con el flag `sysadmin`.",
		vista: "sysadmin",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "rechazo-403",
		label: "8 · 403 en el camino directo",
		detalle:
			"Apriete Publicar: el catálogo niega la capacidad y la hoja lo dice con nombre propio. Enlace con ?clic=1.",
		vista: "sysadmin",
		caso: "sin-solicitud",
		fallo: "403",
		cola: "con-solicitudes",
	},
	{
		id: "sin-conceder",
		label: "9 · La relectura sigue privada",
		detalle:
			"Apriete Publicar: el catálogo contesta 200 con su fila, pero la relectura del valor almacenado sigue privada. No hay ningún estado de éxito. Enlace con ?clic=1.",
		vista: "sysadmin",
		caso: "sin-solicitud",
		fallo: "sin-confirmar",
		cola: "con-solicitudes",
	},
	{
		id: "relectura-falla",
		label: "10 · La confirmación no se puede leer",
		detalle:
			"Apriete Publicar: la acción concede y devuelve su fila, pero la relectura del valor almacenado falla. La hoja lo reporta como confirmación no establecida, no como un fallo de la acción. Enlace con ?clic=1.",
		vista: "sysadmin",
		caso: "sin-solicitud",
		fallo: "relectura",
		cola: "con-solicitudes",
	},
	{
		id: "cola-vacia",
		label: "11 · Cola sin solicitudes",
		detalle: "El estado vacío de la cola, sin filas inventadas.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "vacia",
	},
	{
		id: "cola-error",
		label: "12 · Cola que no carga",
		detalle: "La cola no cargada no se disfraza de cola vacía: error explícito con reintento.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "error",
	},
	{
		id: "solicitud-antigua",
		label: "13 · Solicitud antigua",
		detalle:
			"Una solicitud pendiente desde hace meses: la cola muestra su antigüedad con énfasis para que una solicitud estancada se note al mirar.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "resueltas",
		label: "14 · Solicitudes resueltas",
		detalle:
			"La cola con desenlaces: la decidida muestra quién la aprobó o rechazó, y la cancelada o anulada no se atribuye un decisor. Una aprobada llega sin nombre para ver la etiqueta neutral.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "resueltas",
	},
];

const PANEL_VALUES = ["abierto", "cerrado"] as const;

/**
 * Lee un parámetro de la URL y cae al default si falta o no es uno de los valores permitidos. No
 * lanza: una URL vieja o un typo deja la hoja en su estado por defecto en vez de vaciarla.
 */
function paramOr<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	const raw = $page.url.searchParams.get(key);
	return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function values<T extends string>(items: readonly { id: T; label: string }[]): readonly T[] {
	return items.map((item) => item.id);
}

const VISTA_VALUES = values(VISTAS);
const CASO_VALUES = values(CASOS);
const FALLO_VALUES = values(FALLOS);
const COLA_VALUES = values(COLAS);
const COLOCACION_VALUES = values(COLOCACIONES);
const BOTON_VALUES = values(BOTONES);
const ORGS_VALUES = values(ORGS);
const SECCION_VALUES = values(SECCIONES);
const EXPANSION_VALUES = values(EXPANSIONES);

// ─── Estado del panel, preseleccionable por URL ───────────────────────
let vista = $state<Vista>(paramOr("vista", VISTA_VALUES, "ambas"));
let caso = $state<Caso>(paramOr("caso", CASO_VALUES, "sin-solicitud"));
let fallo = $state<Fallo>(paramOr("fallo", FALLO_VALUES, "ninguno"));
let cola = $state<Cola>(paramOr("cola", COLA_VALUES, "con-solicitudes"));
let colocacion = $state<Colocacion>(paramOr("colocacion", COLOCACION_VALUES, "dashboard"));
let boton = $state<Boton>(paramOr("boton", BOTON_VALUES, "ambos"));
let orgs = $state<Orgs>(paramOr("orgs", ORGS_VALUES, "filtro"));
let secciones = $state<Secciones>(paramOr("secciones", SECCION_VALUES, "con"));
let expansion = $state<Expansion>(paramOr("expansion", EXPANSION_VALUES, "primera"));
// El filtro de la forma con filtro es UI del mock, no un interruptor de la hoja: vive en la page que
// se está mostrando, como viviría en la page real.
let orgFiltro = $state<string | null>(null);
let panelAbierto = $state(paramOr("panel", PANEL_VALUES, "abierto") === "abierto");

// ─── Estado de las superficies ────────────────────────────────────────
let dataset = $state<CkanPackage>({ ...DATASET });
// `undefined` = "lo que diga el caso"; un objeto = lo que el componente reportó.
let solicitud = $state<{ value: PublicationRequest | null } | null>(null);
// Remonta las superficies al cambiar el panel, para descartar su estado interno.
let montaje = $state(0);
let llamadas = $state<string[]>([]);

const solicitudVigente = $derived.by(() => {
	if (solicitud) return solicitud.value;
	if (caso === "pendiente" || caso === "sin-motivo") return makeRequest();
	if (caso === "rechazada") return makeRequest({ status: "rejected", comments: MOTIVO_RECHAZO });
	if (caso === "annulada") return makeRequest({ status: "annulled" });
	return null;
});

// Quién mira la cola: en el caso «propia» es la misma persona que creó la solicitud `req-1`. La
// comparación es por id de usuario, que es lo que el catálogo devuelve en `requested_by`.
const usuarioActual = $derived(caso === "propia" ? SOLICITANTE_ID : ADMINISTRADOR_ID);

// La cola que la hoja está mostrando: **fuente única** del contador, del filtro y de los grupos por
// organización. La cola caída no es un dato (`null` la distingue de vacía) y la vacía es una lista
// vacía de verdad: si el filtro leyera el fixture en vez de lo cargado, ofrecería organizaciones
// sobre una lista vacía. `una-organizacion` es el caso que hace visible la regla de no ofrecer un
// filtro cuando no hay nada que filtrar.
const itemsDeLaCola = $derived(
	cola === "error"
		? null
		: cola === "vacia"
			? []
			: cola === "resueltas"
				? COLA_RESUELTA
				: cola === "una-organizacion"
					? COLA.filter((item) => item.organization_title === ORGANIZACION.title)
					: COLA,
);

// El contador cuenta lo que falta decidir y lee la misma fuente que la cola: con la cola caída no hay
// dato (`null`) y la cola vacía tiene cero, no tres.
const pendientes = $derived(
	itemsDeLaCola === null ? null : itemsDeLaCola.filter((item) => item.status === "pending").length,
);
const contadorTexto = $derived(pendientes === null ? "—" : String(pendientes));

// El aviso de la ficha sólo aparece si hay una solicitud pendiente que quien mira no creó.
const avisoVisible = $derived(
	solicitudVigente !== null &&
		solicitudVigente.status === "pending" &&
		solicitudVigente.requested_by !== usuarioActual,
);

// ─── Las organizaciones de la cola, para su page propia ───────────────
// El filtro se construye sobre los datos que la cola carga de verdad, no sobre una lista escrita a
// mano: si una organización no aparece en las filas, no aparece acá tampoco.
const organizacionesDeLaCola = $derived([
	...new Set(
		(itemsDeLaCola ?? [])
			.map((item) => item.organization_title)
			.filter((titulo): titulo is string => Boolean(titulo)),
	),
]);

// Quién mira decide **qué** hay en el lugar del control: el camino directo es de la plataforma
// —superadministración— y el editor o administrador de organización ve ahí su solicitud. Con «ambas»
// se muestra el llenado del botón, que es el que se está comparando.
const canPublishDelSlot = $derived(vista === "sysadmin" || vista === "ambas");

// El reparto del hero: «Copiar enlace» y «Editar» más el control de publicación si se lo coloca ahí.
// El conteo —y por lo tanto la fila— sale de la regla de `dataset/[id]/+page.svelte:302-305`.
const accionesEnElHero = $derived(boton === "aside" ? 2 : 3);

function registrar(texto: string): void {
	llamadas = [texto, ...llamadas].slice(0, 6);
}

function reset(): void {
	dataset = { ...DATASET };
	solicitud = null;
	llamadas = [];
	orgFiltro = null;
	montaje += 1;
}

/** Todos los interruptores vigentes, en un solo lugar: la barra de la URL los escribe una vez. */
function paramsActuales(): URLSearchParams {
	return new URLSearchParams({
		vista,
		caso,
		fallo,
		cola,
		colocacion,
		boton,
		orgs,
		secciones,
		expansion,
		panel: panelAbierto ? "abierto" : "cerrado",
	});
}

/** Refleja el estado del panel en la URL con `replaceState` (segundo argumento: estado plano). */
function syncUrl(): void {
	replaceState(`/dev/publication?${paramsActuales().toString()}`, {});
}

/** Enlace que conserva el estado y cambia sólo la colocación: lo usan la navegación y el aviso. */
function urlFor(destino: Colocacion): string {
	const params = paramsActuales();
	params.set("colocacion", destino);
	return `/dev/publication?${params.toString()}`;
}

function setVista(id: string): void {
	vista = id as Vista;
	reset();
	syncUrl();
}
function setCaso(id: string): void {
	caso = id as Caso;
	reset();
	syncUrl();
}
function setFallo(id: string): void {
	fallo = id as Fallo;
	reset();
	syncUrl();
}
function setCola(id: string): void {
	cola = id as Cola;
	reset();
	syncUrl();
}
function setColocacion(id: string): void {
	colocacion = id as Colocacion;
	reset();
	syncUrl();
}
function setBoton(id: string): void {
	boton = id as Boton;
	reset();
	syncUrl();
}
function setOrgs(id: string): void {
	orgs = id as Orgs;
	reset();
	syncUrl();
}
function setSecciones(id: string): void {
	secciones = id as Secciones;
	reset();
	syncUrl();
}
function setExpansion(id: string): void {
	expansion = id as Expansion;
	reset();
	syncUrl();
}
function togglePanel(): void {
	panelAbierto = !panelAbierto;
	syncUrl();
}
function aplicarPreset(preset: Preset): void {
	vista = preset.vista;
	caso = preset.caso;
	fallo = preset.fallo;
	cola = preset.cola;
	reset();
	syncUrl();
}

// ─── Dobles de las llamadas inyectadas ────────────────────────────────
// No hay ninguna llamada real: la acción de publicar, las de solicitar/cancelar y las de la cola
// todavía no existen en la capa de API del portal. Cada doble obedece al interruptor de fallo.

function fallaDeAutorizacion(): CkanApiError {
	return new CkanApiError("Authorization Error", 403, "Authorization Error");
}

function fallaDeRed(): CkanApiError {
	return new CkanApiError("502 Bad Gateway", 502, "Bad Gateway");
}

async function publicar(id: string): Promise<PublishResult> {
	registrar(`Publicar «${id}»`);
	if (fallo === "403") throw fallaDeAutorizacion();
	if (fallo === "red") throw fallaDeRed();
	// La acción devuelve SÓLO su fila `publication_requests`: no trae el dataset. La confirmación
	// sale de `leerDataset`, que relee el valor almacenado.
	return makeRequest({ dataset_id: id, id: "publicacion-nueva", status: "approved" });
}

async function leerDataset(id: string): Promise<CkanPackage> {
	registrar(`Leer el dataset «${id}»`);
	// La relectura es la confirmación: puede fallar, y entonces la confirmación no se establece —no es
	// un fallo de la acción, que ya concedió.
	if (fallo === "relectura") throw fallaDeRed();
	// Con `sin-confirmar` el valor almacenado sigue privado: la acción resolvió, pero no concedió.
	return makeDataset({ id, private: fallo === "sin-confirmar" });
}

async function solicitar(id: string): Promise<PublicationRequest> {
	registrar(`Solicitar la publicación de «${id}»`);
	if (fallo === "403") throw fallaDeAutorizacion();
	if (fallo === "red") throw fallaDeRed();
	if (fallo === "sin-confirmar") return makeRequest({ dataset_id: id, status: "rejected" });
	return makeRequest({ dataset_id: id, id: "req-nueva" });
}

async function cancelar(requestId: string): Promise<PublicationRequest> {
	registrar(`Cancelar la solicitud «${requestId}»`);
	if (fallo === "403") throw fallaDeAutorizacion();
	if (fallo === "red") throw fallaDeRed();
	if (fallo === "sin-confirmar") return makeRequest({ id: requestId, status: "pending" });
	return makeRequest({ id: requestId, status: "cancelled" });
}

async function listarCola(): Promise<PublicationQueueItem[]> {
	if (cola === "error")
		throw new CkanApiError("503 Service Unavailable", 503, "Service Unavailable");
	if (cola === "vacia") return [];
	if (cola === "resueltas") return COLA_RESUELTA;
	if (cola === "una-organizacion")
		return COLA.filter((item) => item.organization_title === ORGANIZACION.title);
	return COLA;
}

/**
 * El mismo cargador, acotado a una organización: es lo que usan la forma agrupada —una lista por
 * organización— y la del filtro. Se inyecta, así que el componente de la cola no sabe de
 * organizaciones: recibe las filas que le tocan.
 */
function listarColaDe(org: string | null) {
	return async (): Promise<PublicationQueueItem[]> => {
		const todas = await listarCola();
		return org === null ? todas : todas.filter((item) => item.organization_title === org);
	};
}

async function decidirCola(
	requestId: string,
	approve: boolean,
	comments?: string,
): Promise<PublicationDecisionResult> {
	registrar(
		`${approve ? "Aprobar" : "Rechazar"} la solicitud «${requestId}»${
			comments ? ` con el comentario «${comments}»` : " sin comentario"
		}`,
	);
	if (fallo === "403") throw fallaDeAutorizacion();
	if (fallo === "red") throw fallaDeRed();
	const fila = COLA.find((item) => item.id === requestId) ?? {
		id: requestId,
		dataset_id: DATASET.id,
		dataset_title: "Solicitud sin título",
		status: "pending" as const,
	};
	if (!approve) {
		// Rechazar confirma con su propia fila y no toca la visibilidad; con `sin-confirmar` vuelve
		// pendiente y no concede.
		return fallo === "sin-confirmar"
			? { ...fila, status: "pending" }
			: { ...fila, status: "rejected", comments: comments ?? null };
	}
	// Aprobar devuelve SÓLO su fila: la confirmación sale de `leerDataset`.
	return { ...fila, status: "approved", comments: comments ?? null };
}

// `?clic=1` aprieta el primer control disponible: los estados de fallo sólo existen después del
// clic, y así cada uno se puede enlazar por URL en vez de obligar a apretar a mano. El objetivo
// depende del caso: el rechazo sin motivo apunta al botón de la cola, el resto al control de la ficha.
$effect(() => {
	if (montaje < 0) return; // Sólo lee `montaje`: al remontar hay que volver a apretar.
	if ($page.url.searchParams.get("clic") !== "1") return;
	const objetivo =
		caso === "sin-motivo"
			? /^Rechazar$/
			: vista === "sysadmin"
				? /^Publicar dataset$/
				: /^Solicitar publicación$/;
	// El intervalo se rinde después de ~6 s: si ningún control aparece (por ejemplo con la
	// verificación caída), no queda un temporizador vivo para siempre.
	let intentos = 0;
	const intervalo = setInterval(() => {
		intentos += 1;
		const boton = [...document.querySelectorAll("button")].find(
			(candidato) => objetivo.test((candidato.textContent ?? "").trim()) && !candidato.disabled,
		);
		if (boton) {
			clearInterval(intervalo);
			boton.click();
		} else if (intentos >= 40) {
			clearInterval(intervalo);
		}
	}, 150);
	return () => clearInterval(intervalo);
});
</script>

<svelte:head>
	<title>Hoja de revisión de la publicación — UMSS</title>
</svelte:head>

{#snippet grupo(
	etiqueta: string,
	actual: string,
	opciones: readonly { id: string; label: string }[],
	elegir: (id: string) => void,
)}
	<div>
		<p class="text-xs font-medium text-foreground">{etiqueta}</p>
		<div role="group" aria-label={etiqueta} class="mt-2 flex flex-wrap gap-2">
			{#each opciones as opcion (opcion.id)}
				<button
					type="button"
					aria-pressed={actual === opcion.id}
					onclick={() => elegir(opcion.id)}
					class={cn(
						"inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
						actual === opcion.id
							? "border-primary bg-primary text-primary-foreground"
							: "border-border bg-card text-foreground hover:bg-accent",
					)}
				>
					{opcion.label}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet fichaDataset(item: CkanPackage, canPublish: boolean)}
	<Card class="space-y-4 p-5">
		<div class="flex flex-wrap items-center gap-3 border-b border-border pb-4">
			<span class="font-heading text-xl font-bold text-primary">{item.title}</span>
			<span class="text-xs text-muted-foreground">{item.organization?.title}</span>
			<span
				class={cn(
					"inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
					item.private
						? "border-border bg-muted text-muted-foreground"
						: "border-primary/20 bg-primary/10 text-primary",
				)}
			>
				{item.private ? "Privado" : "Público"}
			</span>
		</div>

		<div class="flex flex-col gap-4">
			<RequestPublicationControl
				dataset={{ id: item.id, private: item.private }}
				canRequest
				currentRequest={solicitudVigente}
				request={solicitar}
				cancel={cancelar}
				onrequested={(reportada) => (solicitud = { value: reportada })}
				oncancelled={(reportada) => (solicitud = { value: reportada })}
			/>

			<PublishControl
				dataset={item}
				publish={publicar}
				readDataset={leerDataset}
				canPublish={canPublish}
				onpublished={(publicado) => (dataset = publicado)}
			/>
		</div>
	</Card>
{/snippet}

{#snippet colaDeSolicitudes(org: string | null = null)}
	{#key montaje}
		<PublicationQueue
			list={listarColaDe(org)}
			decide={decidirCola}
			readDataset={leerDataset}
			currentUser={usuarioActual}
			now={AHORA_REVISION}
			secciones={secciones === "con"}
			expansion={expansion}
		/>
	{/key}
{/snippet}

{#snippet navDeSolicitudes(pendientes: number | null, activo: boolean)}
	<div class="rounded-xl border border-border bg-card shadow-sm">
		<nav
			class="mx-auto flex h-[var(--header-h)] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
			aria-label="Navegación simulada"
		>
			<span class="flex flex-col justify-center leading-tight">
				<span class="font-heading text-xl font-bold tracking-tight text-primary">Datos UMSS</span>
				<span class="text-[11px] text-muted-foreground">Plataforma de Datos Abiertos</span>
			</span>
			<div class="flex items-center gap-1">
				<span class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">Catálogo</span>
				<span class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">
					Organizaciones
				</span>
				<a
					href={urlFor("ruta")}
					data-sveltekit-reload
					aria-current={activo ? "page" : undefined}
					class={cn(
						"inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
						activo
							? "bg-accent font-semibold text-primary"
							: "font-medium text-foreground hover:bg-accent hover:text-primary",
					)}
				>
					Solicitudes
					{#if pendientes !== null && pendientes > 0}
						<span
							class="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
						>
							{pendientes}
						</span>
					{/if}
				</a>
			</div>
		</nav>
	</div>
{/snippet}

{#snippet navDeUsuario(pendientes: number | null, activo: boolean)}
	<div class="inline-block rounded-xl border border-border bg-card p-3 shadow-sm">
		<span
			class="flex w-64 items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-foreground"
		>
			{ADMINISTRADOR}
			<ChevronDown class="size-4" aria-hidden="true" />
		</span>
		<div class="mt-1 w-64 rounded-lg border border-border bg-card p-1">
			<span class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground">
				<LayoutDashboard class="size-4" aria-hidden="true" />
				Panel
			</span>
			<a
				href={urlFor("ruta")}
				data-sveltekit-reload
				aria-current={activo ? "page" : undefined}
				class={cn(
					"flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
					activo
						? "bg-accent font-semibold text-primary"
						: "font-medium text-foreground hover:bg-accent hover:text-primary",
				)}
			>
				<Inbox class="size-4" aria-hidden="true" />
				Solicitudes
				{#if pendientes !== null && pendientes > 0}
					<span
						class="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
					>
						{pendientes}
					</span>
				{/if}
			</a>
			<span class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive">
				<LogOut class="size-4" aria-hidden="true" />
				Cerrar sesión
			</span>
		</div>
	</div>
{/snippet}

{#snippet controlDeLaFicha()}
	{#if canPublishDelSlot}
		<PublishControl
			dataset={dataset}
			publish={publicar}
			readDataset={leerDataset}
			canPublish
			apariencia="accion"
			onpublished={(publicado) => (dataset = publicado)}
		/>
	{:else}
		<RequestPublicationControl
			dataset={{ id: dataset.id, private: dataset.private }}
			canRequest
			currentRequest={solicitudVigente}
			request={solicitar}
			cancel={cancelar}
			apariencia="accion"
			onrequested={(reportada) => (solicitud = { value: reportada })}
			oncancelled={(reportada) => (solicitud = { value: reportada })}
		/>
	{/if}
{/snippet}

{#snippet fichaConBoton(ubicacion: "hero" | "aside")}
	<div class="overflow-hidden rounded-xl border border-border">
		<div class="border-b border-border bg-card px-4 py-8 sm:px-6">
			<h3 class="font-heading text-3xl font-bold leading-tight text-foreground">
				{dataset.title}
			</h3>
			<p class="mt-3 text-sm text-muted-foreground">
				Actualizado {formatDate(dataset.metadata_modified)}
			</p>
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
				>
					{dataset.organization?.title}
				</span>
				<span
					class="inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
				>
					{dataset.private ? "Privado" : "Público"}
				</span>
				<span
					class="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground"
				>
					<Link2 class="size-4" aria-hidden="true" />
					Copiar enlace
				</span>
				<a
					href="/dashboard"
					data-sveltekit-reload
					class="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground"
				>
					<SquarePen class="size-4" aria-hidden="true" />
					Editar
				</a>
				{#if ubicacion === "hero"}
					{@render controlDeLaFicha()}
				{/if}
			</div>
		</div>

		<div class="grid gap-8 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
			<div class="space-y-3">
				<p class="text-sm leading-relaxed text-muted-foreground">
					Los datos abiertos de matrícula estudiantil, por gestión y por carrera. El portal los publica
					con su resumen y sus recursos.
				</p>
			</div>
			<aside class="space-y-4">
				<Card class="p-5">
					<p class="font-heading text-sm font-semibold text-card-foreground">Metadatos</p>
					<dl class="mt-2 space-y-1 text-xs text-muted-foreground">
						<div class="flex justify-between gap-2"><dt>Frecuencia</dt><dd>Anual</dd></div>
						<div class="flex justify-between gap-2"><dt>Licencia</dt><dd>CC BY 4.0</dd></div>
					</dl>
				</Card>
				<Card class="p-5">
					<div class="flex items-start gap-3">
						<span
							class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
						>
							<Building2 class="size-5" aria-hidden="true" />
						</span>
						<div class="min-w-0">
							<p class="font-heading text-sm font-semibold text-card-foreground">Organización</p>
							<p class="mt-1 text-xs text-muted-foreground">{dataset.organization?.title}</p>
						</div>
					</div>
				</Card>
				{#if ubicacion === "aside"}
					{@render controlDeLaFicha()}
				{/if}
			</aside>
		</div>
	</div>
{/snippet}

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class={cn("mx-auto max-w-6xl px-4 py-10 sm:px-6", panelAbierto ? "pb-80" : "pb-24")}>
		<header class="space-y-2">
			<p class="text-xs font-medium uppercase tracking-wider text-destructive">
				Hoja de revisión, sólo desarrollo
			</p>
			<h1 class="font-heading text-3xl font-bold text-primary">
				La publicación de un dataset
			</h1>
			<p class="max-w-3xl text-sm leading-relaxed text-muted-foreground">
				La solicitud del editor, el camino directo de la superadministración y la cola donde el
				administrador decide, sobre el mismo dataset. Los tres controles son los componentes
				reales (<code class="font-mono text-xs">PublishControl.svelte</code>,
				<code class="font-mono text-xs">RequestPublicationControl.svelte</code>,
				<code class="font-mono text-xs">PublicationQueue.svelte</code>): la hoja no reescribe ni
				el copy ni el comportamiento. Todas las llamadas salen de dobles de la hoja, porque las
				acciones del catálogo todavía no tienen capa de API en el portal.
			</p>
		</header>

		<p
			data-testid="dev-only-note"
			class="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>
				Página sólo para desarrollo. En producción <code class="font-mono text-xs"
					>/dev/publication</code
				> no existe (responde 404). La hoja se borra sin tocar los componentes.
			</span>
		</p>

		<section class="mt-10" aria-labelledby="hero-heading">
			<h2 id="hero-heading" class="font-heading text-xl font-semibold text-foreground">
				La ficha del dataset: la zona de acciones del hero
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Las compuertas son independientes y ninguna se deriva de la otra: el editor y el
				administrador pueden editar (así que pueden
				<strong class="font-semibold">solicitar</strong>), y la superadministración
				(<strong class="font-semibold">sysadmin</strong>) es la única que publica en directo. Un
				administrador de organización <strong class="font-semibold">no</strong> recibe el control
				directo: su camino es decidir solicitudes en la cola.
			</p>

			<div class="mt-4 rounded-xl border border-border bg-muted/30 p-4">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Opciones de esta sección
				</p>
				<div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{@render grupo("Quién mira la ficha", vista, VISTAS, setVista)}
				</div>
			</div>

			<div class={cn("mt-4 grid gap-6", vista === "ambas" ? "lg:grid-cols-2" : "grid-cols-1")}>
				{#if vista === "ambas" || vista === "editor"}
					<div data-testid="vista-editor">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Como editor de la organización
						</p>
						{#key montaje}{@render fichaDataset(dataset, false)}{/key}
					</div>
				{/if}
				{#if vista === "ambas" || vista === "sysadmin"}
					<div data-testid="vista-sysadmin">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Como superadministración de la plataforma
						</p>
						{#key montaje}{@render fichaDataset(dataset, true)}{/key}
					</div>
				{/if}
				{#if vista === "administrador"}
					<div data-testid="vista-administrador">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Como administrador de la organización
						</p>
						{#key montaje}{@render fichaDataset(dataset, false)}{/key}
					</div>
				{/if}
			</div>
		</section>

		<section class="mt-12" aria-labelledby="colocacion-heading">
			<h2 id="colocacion-heading" class="font-heading text-xl font-semibold text-foreground">
				Dónde vive la cola
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				La misma cola, dentro del contexto real donde el administrador la encontraría. La cola
				decide, pero si nadie la ve el editor pide y no pasa nada: por eso cada colocación se mira
				con el contexto que la hace —o no— descubrible. Nadie aprueba una solicitud que creó, y
				rechazar exige un motivo; aprobar puede llevar uno opcional. Una solicitud ya resuelta dice
				quién la decidió, y la cancelada o la anulada no se atribuyen un decisor.
			</p>

			<div class="mt-4 rounded-xl border border-border bg-muted/30 p-4">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Opciones de esta sección
				</p>
				<div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{@render grupo("Dónde vive la cola", colocacion, COLOCACIONES, setColocacion)}
					{@render grupo("Estado de la cola", cola, COLAS, setCola)}
					{@render grupo("Varias organizaciones", orgs, ORGS, setOrgs)}
					{@render grupo("Grupos de la cola", secciones, SECCIONES, setSecciones)}
					{@render grupo("Qué se despliega", expansion, EXPANSIONES, setExpansion)}
				</div>
			</div>

			<div class="mt-6" data-testid="colocacion-actual" data-colocacion={colocacion}>
				{#if colocacion === "dashboard"}
					<!-- 1 · Una sección dentro del panel, con el ritmo de «Mis datasets». -->
					<div class="rounded-xl border border-border bg-muted/20 p-4 sm:p-6">
						<header>
							<h3 class="font-heading text-2xl font-bold text-primary">Hola, {ADMINISTRADOR}</h3>
							<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
								Este es su panel personal. Desde aquí crea datasets y revisa las organizaciones
								a las que pertenece.
							</p>
						</header>

						<div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
							<section aria-labelledby="sim-datasets-heading" class="min-w-0">
								<div class="flex items-center gap-3">
									<span
										class="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
									>
										<Database class="size-4" aria-hidden="true" />
									</span>
									<h4
										id="sim-datasets-heading"
										class="font-heading text-lg font-semibold text-primary"
									>
										Mis datasets
									</h4>
									<span
										class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
									>
										2
									</span>
								</div>
								<p class="mt-1.5 text-pretty text-xs leading-relaxed text-muted-foreground">
									Los datasets que usted creó.
								</p>
								<Card class="mt-4 p-2">
									<ul class="space-y-1">
										{#each [DATASET, DATASET_PUBLICADO] as item, indice (indice)}
											<li>
												<span class="flex min-w-0 items-center gap-3 rounded-lg px-3 py-4">
													<span
														class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
													>
														<Database class="size-4" aria-hidden="true" />
													</span>
													<span class="min-w-0 flex-1">
														<span
															class="line-clamp-2 break-words text-sm font-medium text-foreground"
														>
															{item.title}
														</span>
														<span
															class="mt-1.5 block text-xs leading-relaxed text-muted-foreground"
														>
															{item.resources.length} recursos · Actualizado el {formatDate(
																item.metadata_modified,
															)}
														</span>
													</span>
													{#if item.private}
														<span
															class="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
														>
															<Lock class="size-3" aria-hidden="true" />
															Privado
														</span>
													{/if}
												</span>
											</li>
										{/each}
									</ul>
								</Card>
							</section>

							<section aria-labelledby="sim-orgs-heading" class="min-w-0">
								<div class="flex items-center gap-3">
									<span
										class="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"
									>
										<Building2 class="size-4" aria-hidden="true" />
									</span>
									<h4 id="sim-orgs-heading" class="font-heading text-lg font-semibold text-primary">
										Mis organizaciones
									</h4>
									<span
										class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
									>
										1
									</span>
								</div>
								<p class="mt-1.5 text-pretty text-xs leading-relaxed text-muted-foreground">
									Organizaciones de las que forma parte y el rol que tiene en cada una.
								</p>
								<Card class="mt-4 p-2">
									<ul class="space-y-1">
										<li>
											<span class="flex items-start gap-3 rounded-lg px-3 py-4">
												<span
													class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
												>
													<Building2 class="size-4" aria-hidden="true" />
												</span>
												<span class="min-w-0 flex-1">
													<span
														class="line-clamp-2 break-words text-sm font-medium text-foreground"
													>
														{DATASET.organization?.title}
													</span>
													<span
														class="mt-1.5 inline-flex rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
													>
														Administrador
													</span>
												</span>
											</span>
										</li>
									</ul>
								</Card>
							</section>
						</div>

						<!-- 1 · Una sección del panel: ahora **referencia** la page, porque la cola entera vive en la suya. -->
						<section aria-labelledby="sim-cola-heading" class="mt-8">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex items-center gap-3">
								<span
									class="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
								>
									<Inbox class="size-4" aria-hidden="true" />
								</span>
								<h4
									id="sim-cola-heading"
									class="font-heading text-lg font-semibold text-primary"
								>
									Solicitudes de publicación
								</h4>
								<span
									class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
								>
									{contadorTexto}
								</span>
							</div>
							<a
								href={urlFor("ruta")}
								data-sveltekit-reload
								class="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
							>
								<Inbox class="size-4" aria-hidden="true" />
								Ver las solicitudes
							</a>
						</div>
						<p class="mt-1.5 text-pretty text-xs leading-relaxed text-muted-foreground">
							Las solicitudes pendientes de las organizaciones donde usted administra. El panel no
							hospeda la cola: muestra cuántas hay y ofrece la <strong class="font-semibold"
								>acción</strong
							> que lleva a su page, como el resto de las acciones del panel.
						</p>
						</section>
					</div>
				{:else if colocacion === "ruta"}
					<!-- 2 · Su propia ruta, con la entrada en la navegación que la hace alcanzable. -->
					<div class="space-y-4">
						{@render navDeSolicitudes(pendientes, true)}
						<div class="rounded-xl border border-border bg-background p-4 sm:p-6">
							<Breadcrumb
								items={[
									{ label: "Panel", href: "/dashboard" },
									{ label: "Solicitudes de publicación" },
								]}
								icon={Inbox}
							/>
							<div class="mt-5">
								<h3 class="font-heading text-3xl font-bold text-primary sm:text-4xl">
									Solicitudes de publicación
								</h3>
								<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
									Las solicitudes pendientes de las organizaciones donde usted administra. Revise cada
									una para aprobarla, o para rechazarla con un motivo. Cuando quien mira administra
									varias organizaciones, la lista puede leerse de tres maneras: corrida con la
									organización en cada fila, agrupada en una lista por organización, o con un filtro
									arriba.
								</p>
							</div>

							{#if orgs === "agrupada"}
								<div class="mt-6 space-y-6">
									{#each organizacionesDeLaCola as organizacion, indice (organizacion)}
										<section aria-labelledby={`cola-org-${indice}`}>
											<h4
												id={`cola-org-${indice}`}
												class="font-heading text-sm font-semibold text-foreground"
											>
												{organizacion}
											</h4>
											<Card class="mt-2 p-5">
												{@render colaDeSolicitudes(organizacion)}
											</Card>
										</section>
									{/each}
								</div>
							{:else if orgs === "filtro"}
								<div class="mt-6">
									{#if organizacionesDeLaCola.length > 1}
									<div
										role="group"
										aria-label="Filtrar por organización"
										class="flex flex-wrap gap-2"
									>
										<button
											type="button"
											aria-pressed={orgFiltro === null}
											onclick={() => (orgFiltro = null)}
											class={cn(
												"inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
												orgFiltro === null
													? "border-primary bg-primary text-primary-foreground"
													: "border-border bg-card text-foreground hover:bg-accent",
											)}
										>
											Todas las organizaciones
										</button>
										{#each organizacionesDeLaCola as organizacion, indice (organizacion)}
											<button
												type="button"
												aria-pressed={orgFiltro === organizacion}
												onclick={() => (orgFiltro = organizacion)}
												class={cn(
													"inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
													orgFiltro === organizacion
														? "border-primary bg-primary text-primary-foreground"
														: "border-border bg-card text-foreground hover:bg-accent",
												)}
												data-org={indice}
											>
												{organizacion}
											</button>
											{/each}
									</div>
									{/if}
									<p class="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
										Con una sola organización el filtro
										<strong class="font-semibold text-foreground">no se muestra</strong>: no hay
										nada que filtrar. Con dos o más aparece arriba de la lista. El caso «Una sola
										organización» del panel lo muestra en vivo.
									</p>
									<Card class="mt-3 p-5">
										{@render colaDeSolicitudes(orgFiltro)}
									</Card>
								</div>
							{:else}
								<Card class="mt-6 p-5">
									{@render colaDeSolicitudes()}
								</Card>
							{/if}
						</div>
					</div>
				{:else if colocacion === "contador"}
					<!-- 3 · Un contador en la navegación, con y sin insignia. -->
					<div class="space-y-5">
						<div class="space-y-2">
							<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Con solicitudes pendientes
							</p>
							{@render navDeSolicitudes(pendientes, true)}
						</div>
						<div class="space-y-2">
							<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Sin solicitudes pendientes: el contador no aparece
							</p>
							{@render navDeSolicitudes(0, true)}
						</div>
						<p class="max-w-3xl text-sm leading-relaxed text-muted-foreground">
							El contador cuenta lo que falta decidir. Cuando no hay nada pendiente el enlace queda
							sin insignia, y la navegación no cambia de alto ni se ve rota. Elija
							<code class="font-mono text-xs">cola=vacia</code>
							en el panel para verlo sobre la cola real.
						</p>
						<div class="space-y-2">
							<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								En el menú de usuario, con y sin contador
							</p>
							<div class="flex flex-wrap gap-6">
								{@render navDeUsuario(pendientes, true)}
								{@render navDeUsuario(0, true)}
							</div>
						</div>
						<Card class="p-5">
							{@render colaDeSolicitudes()}
						</Card>
					</div>
				{:else}
					<!-- 4 · El aviso en la ficha del dataset (`/dataset/[id]`): el ESTADO de la solicitud, sin el formulario de decidir. -->
					<div class="overflow-hidden rounded-xl border border-border">
						<section class="border-b border-border bg-card">
							<div class="px-4 py-8 sm:px-6">
								<h3 class="font-heading text-3xl font-bold leading-tight text-foreground">
									{DATASET.title}
								</h3>
								<p class="mt-3 text-sm text-muted-foreground">
									Actualizado {formatDate(DATASET.metadata_modified)}
								</p>
								<div class="mt-4 flex flex-wrap items-center gap-2">
									<span
										class="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
									>
										{DATASET.organization?.title}
									</span>
									<span
										class="inline-flex items-center rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
									>
										Privado
									</span>
								</div>
							</div>
						</section>

						<div
							class="grid gap-8 bg-background p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
						>
							<!-- Columna izquierda: la información **textual** primero, y **después** la tarjeta del
							     estado. La decisión no vive acá: el formulario de aprobar es de la page de solicitudes. -->
							<div class="space-y-6">
								<div>
									<p class="text-xs font-medium uppercase tracking-wider text-destructive">
										Descripción
									</p>
									<h4 class="mt-1 font-heading text-xl font-bold text-primary">
										Sobre este dataset
									</h4>
									<p class="mt-3 text-sm leading-relaxed text-muted-foreground">
										Los datos abiertos de matrícula estudiantil, por gestión y por carrera. El portal
										los publica con su resumen y sus recursos.
									</p>
								</div>

								<Card class="p-5" data-testid="aviso-estado">
									<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Estado de la solicitud de publicación
									</p>
							{#if avisoVisible}
								<div
									role="status"
									class="flex flex-wrap items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
								>
									<span
										class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
									>
										<Bell class="size-4" aria-hidden="true" />
									</span>
									<div class="min-w-0 flex-1">
										<p class="font-heading text-sm font-semibold text-foreground">
											Este dataset tiene una solicitud de publicación pendiente.
										</p>
										<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
											Un editor de la organización pidió publicarlo. La decisión se toma en la page de
											solicitudes: acá la ficha muestra el estado, sin el formulario de aprobar.
										</p>
									</div>
									<a
										href={urlFor("ruta")}
										data-sveltekit-reload
										class="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
									>
										Ver las solicitudes
									</a>
								</div>
							{:else}
								<p
									class="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground"
								>
									Este dataset no tiene una solicitud pendiente, así que la ficha no muestra
									ningún aviso. Elija el caso «Pendiente» en el panel para verlo.
								</p>
							{/if}

							<p class="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								El estado de la solicitud, en la ficha
							</p>
							<div class="mt-2">
								<RequestPublicationControl
									dataset={{ id: DATASET.id, private: DATASET.private }}
									canRequest
									currentRequest={solicitudVigente}
									request={solicitar}
									cancel={cancelar}
									onrequested={(reportada) => (solicitud = { value: reportada })}
									oncancelled={(reportada) => (solicitud = { value: reportada })}
								/>
							</div>
							<p class="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
								<strong class="font-semibold text-foreground">Nada de aprobar acá.</strong> La ficha muestra
								<em>en qué estado está</em> la solicitud —y le deja pedirla o cancelarla—, pero el formulario
								de aprobar o rechazar es una opción de la page de solicitudes, donde decidir es el trabajo
								principal y no un accesorio de otra página.
							</p>
								</Card>

								<div>
									<p class="text-xs font-medium uppercase tracking-wider text-destructive">
										Información técnica
									</p>
									<h4 class="mt-1 font-heading text-xl font-bold text-primary">
										Información técnica
									</h4>
									<dl class="mt-3 space-y-1 text-sm text-muted-foreground">
										<div class="flex justify-between gap-4"><dt>Frecuencia</dt><dd>Anual</dd></div>
										<div class="flex justify-between gap-4"><dt>Licencia</dt><dd>CC BY 4.0</dd></div>
										<div class="flex justify-between gap-4">
											<dt>Actualizado</dt>
											<dd>{formatDate(DATASET.metadata_modified)}</dd>
										</div>
									</dl>
								</div>
							</div>

							<aside class="space-y-4">
								<Card class="p-5">
									<p class="text-xs font-medium uppercase tracking-wider text-destructive">Detalles</p>
									<dl class="mt-2 space-y-1 text-xs text-muted-foreground">
										<div class="flex justify-between gap-3">
											<dt>Creado</dt>
											<dd>{formatDate(DATASET.metadata_created)}</dd>
										</div>
										<div class="flex justify-between gap-3"><dt>Formato</dt><dd>CSV</dd></div>
									</dl>
								</Card>
							</aside>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<section class="mt-12" aria-labelledby="boton-heading">
			<h2 id="boton-heading" class="font-heading text-xl font-semibold text-foreground">
				Dónde vive el botón de publicar
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				El mismo control en los dos lugares propuestos: la fila de acciones del hero, junto a
				«Editar», y el panel, debajo de la card de organización. Lo que se compara es <strong
					>el lugar</strong
				>, no el botón: el lugar se llena según quién mira — la superadministración ve «Publicar
				dataset», y el editor o el administrador de organización ven «Solicitar publicación» en el mismo
				hueco. Con <code class="font-mono text-xs">?vista=editor</code> se ve el otro llenado.
			</p>

			<div class="mt-4 rounded-xl border border-border bg-muted/30 p-4">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Opciones de esta sección
				</p>
				<div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{@render grupo("Dónde vive el botón", boton, BOTONES, setBoton)}
				</div>
			</div>

			<p
				data-testid="instrumento-hero"
				class="mt-4 max-w-3xl rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground"
			>
				Con el control en el hero:
				<strong class="font-semibold text-foreground">{accionesEnElHero} acciones</strong>
				→ {accionesEnElHero > 1 ? "la fila de las insignias" : "la fila del título"}. Con el control en el
				panel: <strong class="font-semibold text-foreground">2 acciones</strong> → la fila de las insignias,
				que es donde el hero ya está hoy. La regla vive en
				<code class="font-mono text-xs">src/routes/dataset/[id]/+page.svelte:302-305</code>: una acción en la
				fila del título, dos o más en la de las insignias.
			</p>

			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				En el panel el control va <strong class="font-semibold">como botón y sin card</strong>: una card
				adentro de otra card repite el marco y se ve redundante. Y en los dos lugares va con la
				<strong class="font-semibold">presentación de acción</strong> que los componentes ya tienen
				(<code class="font-mono text-xs">apariencia="accion"</code>): el mismo alto y la misma forma que
				«Copiar enlace» y «Editar», sin el texto de ayuda debajo —la explicación pasa al tooltip—. Lo que
				falta es el cableado de la ficha real, que es el trabajo de `B1`.
			</p>

			<div class={cn("mt-6 grid gap-6", boton === "ambos" && "lg:grid-cols-2")}>
				{#if boton === "hero" || boton === "ambos"}
					<div>
						<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							1 · En el hero, junto a «Editar»
						</p>
						<div class="mt-2">{@render fichaConBoton("hero")}</div>
					</div>
				{/if}
				{#if boton === "aside" || boton === "ambos"}
					<div>
						<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							2 · En el panel, debajo de la card de organización
						</p>
						<div class="mt-2">{@render fichaConBoton("aside")}</div>
					</div>
				{/if}
			</div>
		</section>

		{#if llamadas.length > 0}
			<section class="mt-12" aria-labelledby="registro-heading">
				<h2 id="registro-heading" class="font-heading text-lg font-semibold text-foreground">
					Registro de llamadas (instrumento de la hoja)
				</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Lo que el portal habría pedido, en orden inverso. Sirve para comprobar que un fallo no
					dispara ninguna llamada, y qué comentario viaja con una decisión.
				</p>
				<ol
					data-testid="registro-llamadas"
					class="mt-3 space-y-1 rounded-lg border border-border bg-muted/40 px-4 py-3 font-mono text-xs text-muted-foreground"
				>
					{#each llamadas as llamada, indice (indice)}
						<li>{llamada}</li>
					{/each}
				</ol>
			</section>
		{/if}
	</div>

	<aside
		data-testid="control-panel"
		aria-label="Panel de la hoja"
		class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur"
	>
		<div class="mx-auto max-w-6xl px-4 py-3 sm:px-6">
			<div class="flex flex-wrap items-center gap-3">
				<button
					type="button"
					aria-expanded={panelAbierto}
					aria-controls="control-panel-body"
					onclick={togglePanel}
					class="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				>
					<SlidersHorizontal class="size-4" aria-hidden="true" />
					Panel de la hoja: el caso y los dobles (no es UI de producto)
				</button>
				<p class="text-xs text-muted-foreground">
					{caso} · {fallo}
				</p>
			</div>

			{#if panelAbierto}
				<div id="control-panel-body" class="mt-3 space-y-4">
					<div>
						<p class="text-xs font-medium text-foreground">Presets de caso</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each PRESETS as preset (preset.id)}
								<button
									type="button"
									data-testid={`preset-${preset.id}`}
									onclick={() => aplicarPreset(preset)}
									title={preset.detalle}
									class="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
								>
									{preset.label}
								</button>
							{/each}
						</div>
					</div>

					<p class="text-xs text-muted-foreground">
						Los demás interruptores viven en su sección, al lado de lo que cambian: la vista en la de la
						ficha, y la cola —dónde vive, cómo se agrupa y cuánto se despliega— en la suya.
					</p>

					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{@render grupo("Solicitud vigente", caso, CASOS, setCaso)}
						{@render grupo("Resultado de las llamadas", fallo, FALLOS, setFallo)}
						<div class="flex items-end">
							<button
								type="button"
								onclick={() => {
									reset();
									syncUrl();
								}}
								class="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
							>
								<RotateCcw class="size-3.5" aria-hidden="true" />
								Reiniciar las superficies
							</button>
						</div>
					</div>

					<p class="text-xs text-muted-foreground">
						El estado del panel vive en la URL: agregue <code class="font-mono text-xs"
							>?clic=1</code
						> para que la hoja apriete el primer control disponible y enlazar así un estado de
						fallo.
					</p>
				</div>
			{/if}
		</div>
	</aside>
</div>
