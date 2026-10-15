<script module lang="ts">
import type { PublicationRequestStatus } from "$lib/api/publication";
import type { CkanPackage } from "$lib/types/ckan";
import type { DecidePublicationRequest, PublicationDecisionResult } from "./publication-decision";

// ─── Tipos de la cola de solicitudes ──────────────────────────────────
// Lo que el portal necesita mostrar de una solicitud: de qué dataset es, quién la pidió y cuándo.
// Los campos de presentación (`dataset_title`, `organization_title`, `requested_by_name`) son valores
// ya resueltos por la capa de API; si faltan, la fila simplemente no los muestra. `requested_by` es
// el **id** de usuario y sólo se usa para la comparación de cuatro ojos: nunca se renderiza. El
// estado reusa el vocabulario de `PublicationRequest`, que es el dueño de la tabla.
export interface PublicationQueueItem {
	id: string;
	/** Id del dataset de la solicitud; es lo que la cola relee para confirmar una aprobación. */
	dataset_id: string;
	dataset_title: string;
	organization_title?: string;
	/** Id de usuario de quien creó la solicitud; sólo alimenta la comparación de cuatro ojos. */
	requested_by?: string;
	/** Nombre visible de quien creó la solicitud; es lo que la fila muestra. */
	requested_by_name?: string;
	/** Nombre visible de quien decidió la solicitud; sólo lo traen las filas ya resueltas. */
	approved_by_name?: string;
	created_at?: string;
	status: PublicationRequestStatus;
	comments?: string | null;
}

/**
 * La respuesta de `publication_request_decide` y el contrato de la llamada viven en
 * `./publication-decision`, con el control que los usa: la cola es un **consumidor** de ese contrato, no
 * su dueño. La revisión nativa del PR #67 lo señaló (`R2-type-ownership-inverted`).
 */
</script>

<script lang="ts">
// La cola del **administrador de la organización**: las solicitudes pendientes de las organizaciones
// donde administra, con aprobar, rechazar y un comentario.
//
// Las reglas de **decidir** —cuatro ojos, motivo obligatorio para rechazar, y la confirmación contra
// el valor **almacenado**— no viven acá: son de `PublicationDecision.svelte`, el mismo control que la
// ficha del dataset monta cuando la variante (b) está encendida. Una sola copia, dos lugares.
//
// Lo que sí es de la cola:
//  · **Las llamadas entran inyectadas** (`list`, `decide`): quién puede decidir lo resuelve el
//    catálogo; acá sólo se lee su respuesta.
//  · **Una fila a la vez**: mientras una decisión está en vuelo, las otras filas no ofrecen la suya.
//  · **La fila sale de la cola sólo cuando el catálogo confirmó** la decisión, y el anuncio nombra el
//    desenlace.
import {
	CheckCircle2,
	ChevronDown,
	CircleAlert,
	LoaderCircle,
	RefreshCw,
} from "@lucide/svelte";
import { technicalDetail } from "$lib/api/failure";
import Button from "$lib/components/ui/button/button.svelte";
import { currentUser as currentUserStore } from "$lib/stores/auth";
import { cn, formatDate, formatRelativeAge } from "$lib/utils";
import PublicationDecision from "./PublicationDecision.svelte";

/** Lee las solicitudes de la cola; sin argumento, todas las que el catálogo autorice. */
export type ListPublicationRequests = (
	status?: PublicationRequestStatus,
) => Promise<PublicationQueueItem[]>;

const LOADING = "Cargando solicitudes…";
const EMPTY = "No hay solicitudes pendientes de revisión.";
// La presentación de la cola cuando se pide plegada y por secciones. El disparador del plegado lleva
// el título del dataset en su nombre accesible —dos filas nunca comparten nombre— y un **nombre
// estable**: el estado lo lleva `aria-expanded` y el chevron, no el texto. Un nombre que cambia con el
// estado («Ver…»/«Ocultar…») obliga a reconocer dos controles donde hay uno, y repite en el nombre lo
// que el estado ya dice.
const DETAILS_LABEL = "Detalles";
const SECTION_PENDING = "Pendientes";
const SECTION_RESOLVED = "Resueltas";
const APPROVED_NOTE = "La solicitud fue aprobada.";
const REJECTED_NOTE = "La solicitud fue rechazada.";
// Etiqueta neutral cuando el catálogo no entrega el nombre visible: la fila nunca cae al id crudo.
// La misma regla sirve para quien solicitó y para quien decidió.
const CATALOG_NAME_FALLBACK = "un usuario del catálogo";
// Se anuncia la pestaña nueva **dentro** del enlace y con texto `sr-only`: el nombre accesible del
// enlace conserva el título visible (label in name) y la apertura se anuncia sin reemplazarlo. El
// dataset está privado, así que este enlace es el único camino del revisor hasta él.
const OPENS_IN_NEW_TAB = "(se abre en una pestaña nueva)";
const APPROVED_BY_LABEL = "Aprobada por";
const REJECTED_BY_LABEL = "Rechazada por";
// Desenlaces sin decisor: la retiró quien la solicitó, y la anulada perdió su objeto.
const WITHDRAWN_NOTE = "Cancelada por quien la solicitó.";
const ANNULLED_NOTE = "Anulada: la solicitud dejó de estar vigente.";

let {
	list,
	decide,
	readDataset,
	currentUser,
	ondecided,
	now = new Date(),
	class: className = "",
	secciones = false,
	expansion = "todas",
}: {
	list: ListPublicationRequests;
	decide: DecidePublicationRequest;
	/**
	 * Relee el dataset almacenado. Es la confirmación de una aprobación: la fila de `decide` no trae
	 * el dataset, y medir el valor guardado es más fuerte que creerle a quien lo cambió.
	 */
	readDataset: (id: string) => Promise<CkanPackage>;
	/** Quién está mirando la cola; su propia solicitud no es decidible por él. Default: la sesión. */
	currentUser?: string | null;
	ondecided?: (item: PublicationDecisionResult) => void;
	/**
	 * Reloj inyectable: fija la antigüedad que muestra cada fila. Por defecto, el momento de montar la
	 * cola; la hoja de revisión lo fija para que el ejemplo no dependa de cuándo se mire.
	 */
	now?: Date;
	class?: string;
	/**
	 * Presentación: `true` agrupa la cola en **Pendientes** y después **Resueltas**, cada grupo con su
	 * conteo, y no titula un grupo vacío. `false` (lo de siempre) deja la lista plana, sin títulos.
	 */
	secciones?: boolean;
	/**
	 * Presentación: `"primera"` abre **sólo** el primer pendiente que quien mira puede decidir —nunca
	 * una solicitud propia— y pliega el resto, cada uno con su disparador. `"todas"` (lo de siempre)
	 * abre cada fila. Plegar no es ocultar: el disparador es un botón, y la fila plegada sigue
	 * mostrando el dataset, la organización y quién la pidió.
	 */
	expansion?: "todas" | "primera";
} = $props();

let items = $state<PublicationQueueItem[]>([]);
let loading = $state(true);
// El fallo tal como se observó, **envuelto en un objeto**: el estado de fallo no puede depender de la
// verdad del valor lanzado, porque un `throw ""` —o `0`, o `null`— es falsy y la cola caída se
// disfrazaría de cola vacía, que es exactamente lo que este componente no hace. El dato técnico que se
// muestra sale de `technicalDetail`, que decide qué se puede citar.
let listError = $state<{ cause: unknown } | null>(null);
/**
 * La decisión en vuelo, con su fila y su sentido; mientras haya una, ninguna fila acepta otra. El
 * control en vuelo es del componente de decidir: acá sólo se lo registra para bloquear a sus hermanas.
 */
let deciding = $state<{ id: string; approve: boolean } | null>(null);
let announcement = $state<string | null>(null);

// La identidad de quien mira: la inyectada, o la de la sesión. La comparación de cuatro ojos es por
// **id** de usuario, que es lo que el catálogo devuelve en `requested_by`; con `null` ninguna fila se
// bloquea.
const viewer = $derived(currentUser === undefined ? ($currentUserStore?.id ?? null) : currentUser);

function isOwn(item: PublicationQueueItem): boolean {
	return viewer !== null && item.requested_by === viewer;
}

// ─── Presentación: el plegado y las secciones ─────────────────────────
// El plegado es una decisión de **presentación**, no una política: lo único que se esconde es la
// vista de decidir, y el disparador es un botón —nunca un estado que sólo viva en el hover—.
let abiertos = $state<Record<string, boolean>>({});

const pendientes = $derived(items.filter((item) => item.status === "pending"));
const resueltas = $derived(items.filter((item) => item.status !== "pending"));

// La fila que arranca abierta: la primera que quien mira **puede decidir**. Cuatro ojos: la propia
// nunca, porque abrirla para decidir sería ofrecer lo que no se puede hacer. Si no hay ninguna
// decidible, no se abre ninguna.
const abiertaPorDefecto = $derived(
	expansion === "primera" ? (pendientes.find((item) => !isOwn(item))?.id ?? null) : null,
);

function estaAbierta(item: PublicationQueueItem): boolean {
	if (expansion !== "primera") return true;
	return abiertos[item.id] ?? item.id === abiertaPorDefecto;
}

function alternar(item: PublicationQueueItem): void {
	abiertos[item.id] = !estaAbierta(item);
}

// Énfasis de **presentación**, no una política: la solicitud no expira. A partir de los 90 días la
// antigüedad se marca para que una solicitud estancada se note al mirar la cola, en vez de quedar
// como un dato más entre varios. Noventa días es una elección de la fila —sobrevivió a un
// trimestre—, no un umbral del catálogo.
const UMBRAL_ANTIGUA_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * La antigüedad ya resuelta por fila, para no recalcularla en cada referencia del template. `null`
 * cuando la fecha falta o no se puede parsear: la fila no inventa una frase ni una marca.
 */
const antiguedades = $derived(
	new Map(
		items.map((item) => {
			if (!item.created_at) return [item.id, null] as const;
			const texto = formatRelativeAge(item.created_at, now);
			if (texto === "") return [item.id, null] as const;
			const creada = new Date(item.created_at).getTime();
			const antigua = !Number.isNaN(creada) && now.getTime() - creada >= UMBRAL_ANTIGUA_MS;
			return [item.id, { texto, antigua }] as const;
		}),
	),
);

async function load() {
	loading = true;
	listError = null;

	try {
		items = await list("pending");
	} catch (err) {
		// La cola no cargada no se disfraza de cola vacía: son estados distintos. Se guarda el fallo
		// —no su texto— porque el mensaje que el usuario lee es nuestro y el dato técnico se deriva.
		listError = { cause: err };
		items = [];
	} finally {
		loading = false;
	}
}

$effect(() => {
	void load();
});

/** Confirma una fila: sale de la cola y el anuncio nombra el desenlace. */
function sacarDeLaCola(
	item: PublicationQueueItem,
	respuesta: PublicationDecisionResult,
	nombre: string,
) {
	items = items.filter((solicitud) => solicitud.id !== item.id);
	announcement = nombre;
	ondecided?.(respuesta);
}

/**
 * El desenlace de una fila ya resuelta, con quién lo decidió cuando hubo un decisor. `null` mientras
 * la solicitud sigue pendiente: una fila sin desenlace no inventa uno. La cancelada la retiró quien
 * la solicitó y la anulada perdió su objeto, así que ninguna de las dos se atribuye un decisor.
 */
function outcomeLine(item: PublicationQueueItem): string | null {
	switch (item.status) {
		case "approved":
			return `${APPROVED_BY_LABEL} ${item.approved_by_name ?? CATALOG_NAME_FALLBACK}`;
		case "rejected":
			return `${REJECTED_BY_LABEL} ${item.approved_by_name ?? CATALOG_NAME_FALLBACK}`;
		case "cancelled":
			return WITHDRAWN_NOTE;
		case "annulled":
			return ANNULLED_NOTE;
		default:
			return null;
	}
}

</script>

{#snippet cuerpoPendiente(item: PublicationQueueItem)}
	<!-- Las reglas de decidir son del componente: cuatro ojos, motivo obligatorio para rechazar y la
	     confirmación contra el valor almacenado. La cola sólo aporta su candado —una fila a la vez— y
	     lo que hace con una decisión confirmada: sacar la fila y anunciar el desenlace. -->
	<PublicationDecision
		item={item}
		{decide}
		{readDataset}
		currentUser={viewer}
		disabled={deciding !== null && deciding.id !== item.id}
		onpendingchange={(enVuelo) => {
			deciding = enVuelo;
			// Empezar una decisión limpia el anuncio anterior: mientras la nueva está en vuelo, la cola no
			// sigue afirmando el desenlace de la anterior. Es lo que la cola hacía antes de que el cuerpo de
			// decidir se mudara al componente; la revisión nativa del PR #67 lo encontró perdido (`R3-1`),
			// porque la asignación había quedado **después** de la confirmación, donde ya no servía.
			if (enVuelo) announcement = null;
		}}
		ondecided={(respuesta) => {
			sacarDeLaCola(
				item,
				respuesta,
				respuesta.status === "approved" ? APPROVED_NOTE : REJECTED_NOTE,
			);
		}}
	/>
{/snippet}

{#snippet fila(item: PublicationQueueItem)}
	{@const desenlace = outcomeLine(item)}
	{@const plegable = expansion === "primera" && item.status === "pending"}
	{@const abierta = estaAbierta(item)}
	<li class="rounded-lg border border-border bg-card p-4" data-request-id={item.id}>
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<p class="font-heading text-sm font-semibold text-card-foreground">
				<a
					href={`/dataset/${encodeURIComponent(item.dataset_id)}`}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-sm underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{item.dataset_title}
					<span class="sr-only"> {OPENS_IN_NEW_TAB}</span>
				</a>
			</p>
			{#if item.organization_title}
				<span class="text-xs text-muted-foreground">{item.organization_title}</span>
			{/if}
		</div>

		{#if item.requested_by_name || item.requested_by || item.created_at}
			<p class="mt-1 text-xs text-muted-foreground">
				{#if item.requested_by_name || item.requested_by}Solicitada por {item.requested_by_name ?? CATALOG_NAME_FALLBACK}{/if}
				{#if (item.requested_by_name || item.requested_by) && item.created_at} · {/if}
				{#if item.created_at}
					{formatDate(item.created_at)}
					{#if antiguedades.get(item.id)}
						·
						<span
							data-testid="request-age"
							data-stale={antiguedades.get(item.id)?.antigua ? "true" : "false"}
							class={cn(
								"whitespace-nowrap",
								antiguedades.get(item.id)?.antigua && "font-semibold text-destructive",
							)}
						>{antiguedades.get(item.id)?.texto}</span>
					{/if}
				{/if}
			</p>
		{/if}

		{#if desenlace}
			<p data-testid="request-outcome" class="mt-1 text-xs text-muted-foreground">
				{desenlace}
			</p>
		{/if}

		{#if item.status === "pending"}
			{#if plegable}
				<button
					type="button"
					aria-expanded={abierta}
					aria-controls={`detalle-${item.id}`}
					onclick={() => alternar(item)}
					class="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<ChevronDown
						class={cn("size-3.5 transition-transform", abierta && "rotate-180")}
						aria-hidden="true"
					/>
					{DETAILS_LABEL}
					<span class="sr-only"> de {item.dataset_title}</span>
				</button>
				<div id={`detalle-${item.id}`}>
					{#if abierta}{@render cuerpoPendiente(item)}{/if}
				</div>
			{:else}
				{@render cuerpoPendiente(item)}
			{/if}
		{/if}
	</li>
{/snippet}

<div class={cn("flex flex-col gap-3", className)}>
	{#if announcement}
		<p
			role="status"
			class="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
		>
			<CheckCircle2 class="size-4 shrink-0" aria-hidden="true" />
			{announcement}
		</p>
	{/if}

	{#if loading}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
			<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			{LOADING}
		</p>
	{:else if listError}
		{@const detalle = technicalDetail(listError.cause)}
		<div
			role="alert"
			class="flex w-full flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
		>
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
			<span>No se pudieron cargar las solicitudes.</span>
			{#if detalle}
				<span class="font-mono text-xs">{detalle}</span>
			{/if}
			<Button variant="outline" size="sm" onclick={() => void load()}>
				<RefreshCw class="size-4" aria-hidden="true" />
				Reintentar
			</Button>
		</div>
	{:else if items.length === 0}
		<p class="text-sm text-muted-foreground">{EMPTY}</p>
	{:else if secciones}
		{#if pendientes.length > 0}
			<section aria-label={SECTION_PENDING} class="flex flex-col gap-3">
				<h3 class="font-heading text-sm font-semibold text-foreground">
					{SECTION_PENDING}
					<span
						class="ml-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">{pendientes.length}</span
					>
				</h3>
				<ul class="flex flex-col gap-3">
					{#each pendientes as item (item.id)}{@render fila(item)}{/each}
				</ul>
			</section>
		{/if}
		{#if resueltas.length > 0}
			<section aria-label={SECTION_RESOLVED} class="flex flex-col gap-3">
				<h3 class="font-heading text-sm font-semibold text-foreground">
					{SECTION_RESOLVED}
					<span
						class="ml-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">{resueltas.length}</span
					>
				</h3>
				<ul class="flex flex-col gap-3">
					{#each resueltas as item (item.id)}{@render fila(item)}{/each}
				</ul>
			</section>
		{/if}
	{:else}
		<ul class="flex flex-col gap-3">
			{#each items as item (item.id)}{@render fila(item)}{/each}
		</ul>
	{/if}
</div>
