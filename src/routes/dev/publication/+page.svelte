<!--
	Hoja de revisión de la publicación — superficie sólo para desarrollo (`/dev/publication`).

	Duplica las superficies reales que la publicación toca y las renderiza con los **componentes
	reales** (`RequestPublicationControl`, `PublicationQueue`):

	· la **zona de acciones del hero** de la ficha del dataset (`src/routes/dataset/[id]/+page.svelte`),
	  vista como editor, como administrador de la organización y como superadministración, para que la
	  solicitud se mire desde los tres roles;
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

	La regla que la hoja deja mirar: publicar es siempre **pedir**; se decide en la cola y, desde el
	2026-10-14, también en la **ficha del dataset**. No hay camino
	directo, ni siquiera para la superadministración. La **cola** no decide la solicitud que creó quien
	mira y **exige un motivo para rechazar**; y una solicitud **anulada** dice que dejó de estar vigente.
	Una solicitud ya resuelta dice quién la decidió, y la cancelada o la anulada no se atribuyen un
	decisor. También los estados que no se pueden provocar a mano: un `403` rechazado con nombre propio,
	un `200` que no concede, una solicitud rechazada con su motivo y una cola que no carga.

	La hoja también **espeja** lo promovido el 2026-10-14: la ficha del dataset decide la solicitud desde
	su propia tarjeta, con el **mismo** control de la cola (`PublicationDecision.svelte`), para que las
	reglas de decidir tengan un solo dueño. Por eso el interruptor de rol dejó de ser un rótulo: el editor
	no decide su propia solicitud (cuatro ojos), quien administra la organización sí, y la
	superadministración de la plataforma recibe la misma respuesta afirmativa del catálogo porque la
	pregunta no discrimina para ella (el quirk medido de `organization_list_for_user`).

	Todas las llamadas —`readDataset`, `request`, `cancel`, `list`, `decide`— entran por **dobles**: las
	acciones del catálogo todavía no existen en la capa de API del portal, así que la hoja no puede
	cablearlas de verdad. El panel de control es de la hoja, no del producto: es fijo y colapsable,
	guarda su estado en la URL (`?vista=&caso=&fallo=&cola=&colocacion=&orgs=`
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
	Lock,
	LogOut,
	RotateCcw,
	SlidersHorizontal,
} from "@lucide/svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import type { PublicationRequest } from "$lib/api/publication";
import PublicationDecision from "$lib/components/dataset/PublicationDecision.svelte";
import PublicationQueue, {
	type PublicationDecisionResult,
	type PublicationQueueItem,
} from "$lib/components/dataset/PublicationQueue.svelte";
import RequestPublicationControl from "$lib/components/dataset/RequestPublicationControl.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { estadoDeLaSolicitud } from "$lib/copy/publication";
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
	SUPERADMIN_ID,
} from "./fixtures";

// ─── Dimensiones del panel ────────────────────────────────────────────
type Vista = "todos" | "editor" | "administrador" | "sysadmin";
type Caso = "sin-solicitud" | "pendiente" | "rechazada" | "propia" | "sin-motivo" | "annulada";
type Fallo = "ninguno" | "403" | "sin-confirmar" | "relectura" | "red";
type Cola = "con-solicitudes" | "vacia" | "error" | "resueltas" | "una-organizacion";
/** Dónde vive la cola: el eje que el autor quiere decidir. */
type Colocacion = "dashboard" | "ruta" | "contador" | "aviso";
/** Cómo se ve, en su propia page, una cola que trae solicitudes de varias organizaciones. */
type Orgs = "plana" | "agrupada" | "filtro";
/** Si la cola se lee en dos grupos —pendientes y resueltas— o corrida. */
type Secciones = "con" | "sin";
/** Cuántas filas arrancan desplegadas: `"primera"` abre sólo la primera decidible. */
type Expansion = "todas" | "primera";
/**
 * Quién mira la ficha. Hasta el 2026-10-14 este interruptor sólo cambiaba el **rótulo**: las tres
 * fichas eran la misma. Para juzgar la variante (b) eso no alcanza, porque lo que la tarjeta ofrece
 * **depende de quién mira**.
 */
type Rol = "editor" | "administrador" | "sysadmin";

const VISTAS: { id: Vista; label: string }[] = [
	{ id: "todos", label: "Los tres roles" },
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
			"El editor, el administrador y la superadministración ven la solicitud; publicar es siempre pedir, y se decide en la cola o en la ficha del dataset.",
		vista: "todos",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "pendiente",
		label: "2 · Pendiente",
		detalle: "El editor ve la solicitud pendiente y sólo puede cancelarla.",
		vista: "todos",
		caso: "pendiente",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "rechazada",
		label: "3 · Rechazada con motivo",
		detalle: "El motivo que escribió el administrador vuelve al editor, y puede volver a pedirla.",
		vista: "todos",
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
		id: "cola-vacia",
		label: "7 · Cola sin solicitudes",
		detalle: "El estado vacío de la cola, sin filas inventadas.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "vacia",
	},
	{
		id: "cola-error",
		label: "8 · Cola que no carga",
		detalle: "La cola no cargada no se disfraza de cola vacía: error explícito con reintento.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "error",
	},
	{
		id: "solicitud-antigua",
		label: "9 · Solicitud antigua",
		detalle:
			"Una solicitud pendiente desde hace meses: la cola muestra su antigüedad con énfasis para que una solicitud estancada se note al mirar.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "con-solicitudes",
	},
	{
		id: "resueltas",
		label: "10 · Solicitudes resueltas",
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
const ORGS_VALUES = values(ORGS);
const SECCION_VALUES = values(SECCIONES);
const EXPANSION_VALUES = values(EXPANSIONES);

// ─── Estado del panel, preseleccionable por URL ───────────────────────
let vista = $state<Vista>(paramOr("vista", VISTA_VALUES, "todos"));
let caso = $state<Caso>(paramOr("caso", CASO_VALUES, "sin-solicitud"));
let fallo = $state<Fallo>(paramOr("fallo", FALLO_VALUES, "ninguno"));
let cola = $state<Cola>(paramOr("cola", COLA_VALUES, "con-solicitudes"));
let colocacion = $state<Colocacion>(paramOr("colocacion", COLOCACION_VALUES, "dashboard"));
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

/**
 * Quién mira la **ficha**, por rol: la comparación de cuatro ojos es por **id** de usuario, así que cada
 * rol necesita su identidad. El editor es quien creó la solicitud de las fixtures —por eso no puede
 * decidirla—, el administrador es otro y sí puede, y la superadministración es un tercero que tampoco
 * administra esa organización.
 */
function quienMira(rol: Rol): string {
	if (rol === "editor") return SOLICITANTE_ID;
	if (rol === "sysadmin") return SUPERADMIN_ID;
	return caso === "propia" ? SOLICITANTE_ID : ADMINISTRADOR_ID;
}

/**
 * Qué hace la ficha con una decisión **confirmada**. La página real volvería a leer —o invalidaría— y
 * mostraría el estado nuevo; acá se refleja lo mismo: la solicitud con el estado que confirmó el
 * catálogo y, en un rechazo, el motivo que viajó con ella, y el dataset ya público si la aprobación
 * concedió. Una decisión que no concedió no llega acá: el componente la trata como confirmación que no
 * se pudo establecer.
 */
function reflejarDecision(vigente: PublicationRequest, respuesta: PublicationDecisionResult): void {
	solicitud = {
		value: {
			...vigente,
			status: respuesta.status,
			comments: respuesta.comments ?? vigente.comments,
		},
	};
	dataset = { ...dataset, private: respuesta.status !== "approved" };
}

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
// No hay ninguna llamada real: las de solicitar/cancelar y las de la cola todavía no existen en la
// capa de API del portal. Cada doble obedece al interruptor de fallo.

function fallaDeAutorizacion(): CkanApiError {
	return new CkanApiError("Authorization Error", 403, "Authorization Error");
}

function fallaDeRed(): CkanApiError {
	return new CkanApiError("502 Bad Gateway", 502, "Bad Gateway");
}

async function leerDataset(id: string): Promise<CkanPackage> {
	registrar(`Leer el dataset «${id}»`);
	// La relectura es la confirmación de una aprobación: puede fallar, y entonces la confirmación no se
	// establece —no es un fallo de la decisión, que ya concedió.
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
	const objetivo = caso === "sin-motivo" ? /^Rechazar$/ : /^Solicitar publicación$/;
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

{#snippet fichaDataset(item: CkanPackage, rol: Rol)}
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
		</div>

		<!-- La tarjeta del estado de la solicitud, como la tiene la página real: es **la** superficie que la
		     variante (b) cambia. La frase la calcula `$lib/copy/publication.ts` —la misma función que usa la
		     página— para que esta hoja no pueda mostrar un texto que el portal nunca renderiza. -->
		{#if solicitudVigente}
			{@const vigente = solicitudVigente}
			<div class="rounded-lg border border-border bg-muted/20 p-4" data-testid="ficha-solicitud">
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">
					Solicitud de publicación
				</p>
				<p
					class="mt-2 flex items-center gap-2 text-sm leading-relaxed text-foreground"
					data-testid="estado-solicitud"
				>
					<Inbox class="size-4 shrink-0 text-primary" aria-hidden="true" />
					{estadoDeLaSolicitud(vigente)}
				</p>

				{#if vigente.status !== "pending"}
					<!-- Nada que decidir: la solicitud ya está resuelta y la frase de arriba lo dice. El control
					     no se dibuja para que no parezca que hay algo pendiente. -->
				{:else if rol === "sysadmin"}
					<PublicationDecision
						item={vigente}
						decide={decidirCola}
						readDataset={leerDataset}
						currentUser={quienMira(rol)}
						ondecided={(respuesta) => reflejarDecision(vigente, respuesta)}
					/>
					<p class="mt-2 text-xs leading-relaxed text-muted-foreground">
						Medido en el CKAN que corre (2026-10-14): con el permiso
						<code class="font-mono text-xs">admin</code> la pregunta devuelve <em>todas</em> las
						organizaciones para la superadministración de la plataforma, así que la ficha le ofrece decidir.
						La frontera sigue siendo el catálogo, que responde su propia frase si la decisión no correspondía.
					</p>
				{:else}
					<PublicationDecision
						item={vigente}
						decide={decidirCola}
						readDataset={leerDataset}
						currentUser={quienMira(rol)}
						ondecided={(respuesta) => reflejarDecision(vigente, respuesta)}
					/>
				{/if}
			</div>
		{/if}
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
				La solicitud del editor, el administrador de la organización y la superadministración, y la
				cola donde se decide, sobre el mismo dataset. Publicar es siempre <strong
					class="font-semibold">pedir</strong
				> y decidir en la cola o en la ficha del dataset: no hay camino directo. Los dos componentes reales
				(<code class="font-mono text-xs">RequestPublicationControl.svelte</code>,
				<code class="font-mono text-xs">PublicationQueue.svelte</code>) son los que la hoja renderiza: no
				reescribe ni el copy ni el comportamiento. Todas las llamadas salen de dobles de la hoja, porque
				las acciones del catálogo todavía no tienen capa de API en el portal.
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
				No hay dos compuertas: publicar es siempre
				<strong class="font-semibold">solicitar</strong>. Quien puede editar el dataset ve la solicitud
				en el hero, y la decisión se toma en la cola. La superadministración pasa por el mismo camino:
				no publica en directo. Desde el 2026-10-14 la <strong class="font-semibold">ficha también
				decide</strong> —la tarjeta de la solicitud monta el mismo control de la cola—, así que el
				interruptor de la vista cambia de verdad lo que se ve: el editor mira su propia solicitud y no la
				decide (cuatro ojos), quien administra la organización decide ahí mismo, y la superadministración
				de la plataforma recibe la respuesta afirmativa que el catálogo le da a su pregunta.
			</p>

			<div class="mt-4 rounded-xl border border-border bg-muted/30 p-4">
				<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Opciones de esta sección
				</p>
				<div class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{@render grupo("Quién mira la ficha", vista, VISTAS, setVista)}
				</div>
			</div>

			<div class={cn("mt-4 grid gap-6", vista === "todos" ? "lg:grid-cols-3" : "grid-cols-1")}>
				{#if vista === "todos" || vista === "editor"}
					<div data-testid="vista-editor">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Como editor de la organización
						</p>
						{#key montaje}{@render fichaDataset(dataset, "editor")}{/key}
					</div>
				{/if}
				{#if vista === "todos" || vista === "administrador"}
					<div data-testid="vista-administrador">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Como administrador de la organización
						</p>
						{#key montaje}{@render fichaDataset(dataset, "administrador")}{/key}
					</div>
				{/if}
				{#if vista === "todos" || vista === "sysadmin"}
					<div data-testid="vista-sysadmin">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Como superadministración de la plataforma
						</p>
						{#key montaje}{@render fichaDataset(dataset, "sysadmin")}{/key}
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
							{#if solicitudVigente}
								{@const vigente = solicitudVigente}
								{#if vigente.status === "pending" && vigente.requested_by !== usuarioActual}
									<div class="mt-4 border-t border-border pt-3">
										<p class="text-xs font-medium text-muted-foreground">
											La tarjeta también decide: es el mismo control de la cola.
										</p>
										<PublicationDecision
											item={vigente}
											decide={decidirCola}
											readDataset={leerDataset}
											currentUser={ADMINISTRADOR_ID}
											ondecided={(respuesta) => reflejarDecision(vigente, respuesta)}
										/>
									</div>
								{:else}
									<p class="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
										Acá no hay nada que decidir: o la solicitud ya está resuelta, o es de quien mira.
									</p>
								{/if}
							{/if}
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
