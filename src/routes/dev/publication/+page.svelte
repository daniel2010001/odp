<!--
	Hoja de revisión de la publicación — superficie sólo para desarrollo (`/dev/publication`).

	Duplica las superficies reales que la publicación toca y las renderiza con los **componentes
	reales** (`PublishControl`, `RequestPublicationControl`, `PublicationQueue`):

	· la **zona de acciones del hero** de la ficha del dataset (`src/routes/dataset/[id]/+page.svelte`),
	  vista como editor, como administrador de la organización y como superadministración, para que las
	  compuertas se comparen sin derivar una de la otra;
	· la **cola del panel** del administrador, en el lugar donde el diseño la hospeda
	  (`src/routes/dashboard/+page.svelte`).

	Las reglas que la hoja deja mirar: el **camino directo de publicación** sólo se ofrece a la
	superadministración (un administrador de organización no lo ve); la **cola** no decide la solicitud
	que creó quien mira y **exige un motivo para rechazar**; y una solicitud **anulada** dice que dejó
	de estar vigente. También los estados que no se pueden provocar a mano: un `403` rechazado con
	nombre propio, un `200` que no concede, una solicitud rechazada con su motivo y una cola que no
	carga.

	Todas las llamadas —`publish`, `request`, `cancel`, `list`, `decide`— entran por **dobles**: las
	acciones del catálogo todavía no existen en la capa de API del portal, así que la hoja no puede
	cablearlas de verdad. El panel de control es de la hoja, no del producto: es fijo y colapsable,
	guarda su estado en la URL (`?vista=&caso=&fallo=&cola=&panel=`) y `?clic=1` aprieta el primer
	control disponible, para poder enlazar un estado que sólo aparece después del clic.

	La hoja es material de revisión: se borra sin tocar los componentes. La compuerta de producción
	está en `+page.ts`.
-->
<script lang="ts">
import { Info, RotateCcw, SlidersHorizontal } from "@lucide/svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import PublicationQueue, {
	type PublicationQueueItem,
} from "$lib/components/dataset/PublicationQueue.svelte";
import PublishControl from "$lib/components/dataset/PublishControl.svelte";
import RequestPublicationControl, {
	type PublicationRequest,
} from "$lib/components/dataset/RequestPublicationControl.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import {
	ADMINISTRADOR,
	COLA,
	DATASET,
	DATASET_PUBLICADO,
	MOTIVO_RECHAZO,
	makeRequest,
	SOLICITANTE,
} from "./fixtures";

// ─── Dimensiones del panel ────────────────────────────────────────────
type Vista = "ambas" | "editor" | "administrador" | "sysadmin";
type Caso = "sin-solicitud" | "pendiente" | "rechazada" | "propia" | "sin-motivo" | "annulada";
type Fallo = "ninguno" | "403" | "sin-confirmar" | "red";
type Cola = "con-solicitudes" | "vacia" | "error";

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
	{ id: "sin-confirmar", label: "200 que no concede" },
	{ id: "red", label: "Falla de red o 5xx" },
];
const COLAS: { id: Cola; label: string }[] = [
	{ id: "con-solicitudes", label: "Con solicitudes" },
	{ id: "vacia", label: "Sin solicitudes" },
	{ id: "error", label: "No carga" },
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
		label: "9 · 200 que no concede",
		detalle:
			"Apriete Publicar: el catálogo contesta 200 y no concede; no hay ningún estado de éxito. Enlace con ?clic=1.",
		vista: "sysadmin",
		caso: "sin-solicitud",
		fallo: "sin-confirmar",
		cola: "con-solicitudes",
	},
	{
		id: "cola-vacia",
		label: "10 · Cola sin solicitudes",
		detalle: "El estado vacío de la cola, sin filas inventadas.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "vacia",
	},
	{
		id: "cola-error",
		label: "11 · Cola que no carga",
		detalle: "La cola no cargada no se disfraza de cola vacía: error explícito con reintento.",
		vista: "administrador",
		caso: "sin-solicitud",
		fallo: "ninguno",
		cola: "error",
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

// ─── Estado del panel, preseleccionable por URL ───────────────────────
let vista = $state<Vista>(paramOr("vista", VISTA_VALUES, "ambas"));
let caso = $state<Caso>(paramOr("caso", CASO_VALUES, "sin-solicitud"));
let fallo = $state<Fallo>(paramOr("fallo", FALLO_VALUES, "ninguno"));
let cola = $state<Cola>(paramOr("cola", COLA_VALUES, "con-solicitudes"));
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

// Quién mira la cola: en el caso «propia» es la misma persona que creó la solicitud `req-1`.
const usuarioActual = $derived(caso === "propia" ? SOLICITANTE : ADMINISTRADOR);

function registrar(texto: string): void {
	llamadas = [texto, ...llamadas].slice(0, 6);
}

function reset(): void {
	dataset = { ...DATASET };
	solicitud = null;
	llamadas = [];
	montaje += 1;
}

/** Refleja el estado del panel en la URL con `replaceState` (segundo argumento: estado plano). */
function syncUrl(): void {
	const params = new URLSearchParams({
		vista,
		caso,
		fallo,
		cola,
		panel: panelAbierto ? "abierto" : "cerrado",
	});
	replaceState(`/dev/publication?${params.toString()}`, {});
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

async function publicar(id: string): Promise<CkanPackage> {
	registrar(`Publicar «${id}»`);
	if (fallo === "403") throw fallaDeAutorizacion();
	if (fallo === "red") throw fallaDeRed();
	if (fallo === "sin-confirmar") return { ...DATASET, id, private: true };
	return { ...DATASET_PUBLICADO, id };
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
	return COLA;
}

async function decidirCola(
	requestId: string,
	approve: boolean,
	comments?: string,
): Promise<PublicationQueueItem> {
	registrar(
		`${approve ? "Aprobar" : "Rechazar"} la solicitud «${requestId}»${
			comments ? ` con el comentario «${comments}»` : " sin comentario"
		}`,
	);
	if (fallo === "403") throw fallaDeAutorizacion();
	if (fallo === "red") throw fallaDeRed();
	const fila = COLA.find((item) => item.id === requestId) ?? {
		id: requestId,
		dataset_title: "Solicitud sin título",
		status: "pending" as const,
	};
	if (fallo === "sin-confirmar") return { ...fila, status: "pending" };
	return { ...fila, status: approve ? "approved" : "rejected", comments: comments ?? null };
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
			(candidato) =>
				objetivo.test((candidato.textContent ?? "").trim()) && !candidato.disabled,
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
				canPublish={canPublish}
				onpublished={(publicado) => (dataset = publicado)}
			/>
		</div>
	</Card>
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

		<section class="mt-12" aria-labelledby="cola-heading">
			<h2 id="cola-heading" class="font-heading text-xl font-semibold text-foreground">
				El panel: la cola del administrador
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Las solicitudes pendientes de las organizaciones donde el usuario administra. Nadie
				aprueba una solicitud que creó, y rechazar exige un motivo; aprobar puede llevar uno
				opcional. Es el único lugar donde se decide: sólo un administrador llega.
			</p>

			<Card class="mt-4 p-5">
				{#key montaje}
					<PublicationQueue list={listarCola} decide={decidirCola} currentUser={usuarioActual} />
				{/key}
			</Card>
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
					Panel de la hoja (no es UI de producto)
				</button>
				<p class="text-xs text-muted-foreground">{vista} · {caso} · {fallo} · {cola}</p>
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

					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{@render grupo("Vista", vista, VISTAS, setVista)}
						{@render grupo("Solicitud vigente", caso, CASOS, setCaso)}
						{@render grupo("Resultado de las llamadas", fallo, FALLOS, setFallo)}
						{@render grupo("Estado de la cola", cola, COLAS, setCola)}
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
