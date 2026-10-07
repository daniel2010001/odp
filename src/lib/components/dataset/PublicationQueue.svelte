<script module lang="ts">
import type { CkanPackage } from "$lib/types/ckan";
import type { PublicationRequestStatus } from "./RequestPublicationControl.svelte";

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
 * La respuesta de `publication_request_decide`: **sólo** su fila `publication_requests`, el contrato
 * uniforme de las cinco acciones. No trae el dataset; la confirmación de una aprobación viene de
 * releer el **valor almacenado** (`readDataset`), y un rechazo confirma con el estado de su propia
 * fila.
 */
export type PublicationDecisionResult = PublicationQueueItem;
</script>

<script lang="ts">
// La cola del **administrador de la organización**: las solicitudes pendientes de las organizaciones
// donde administra, con aprobar, rechazar y un comentario.
//
// Dos reglas de la cola:
//  · **Cuatro ojos**: nadie aprueba una solicitud que creó. Una fila cuyo `requested_by` —el **id**
//    de usuario— es quien mira se muestra como **no decidible** — sin aprobar ni rechazar — en vez de
//    ofrecer un botón que el catálogo va a rechazar. El nombre visible viaja aparte
//    (`requested_by_name`) y es lo único que la fila muestra: el id nunca se renderiza.
//  · **Rechazar exige un motivo**: el control se niega a enviar un rechazo sin comentario y lo
//    explica, en vez de dejar que el catálogo lo rechace. Aprobar con comentario sigue siendo
//    opcional.
//
// Las dos llamadas entran **inyectadas** (`list`, `decide`): las acciones del catálogo todavía no
// existen en la capa de API del portal. Quién puede decidir lo decide el catálogo; acá sólo se lee su
// respuesta.
//
// Regla de honestidad: la fila sale de la cola **sólo** cuando el catálogo confirmó la decisión, y
// las tres situaciones se mantienen separadas. *La acción falló* (`403` o error). *La acción
// concedió y la confirmación no se pudo establecer*: aprobar confirma contra el valor **almacenado**
// —la fila no trae dataset—, así que una relectura que sigue privada o que falla es esa confirmación
// que no se pudo establecer, no un fallo de la acción. *Confirmada*: una aprobación sale de la cola
// sólo si la relectura ve el dataset ya público; un rechazo no toca la visibilidad y sale con el
// estado que su propia fila devolvió, sin relectura.
import {
	CheckCircle2,
	CircleAlert,
	LoaderCircle,
	RefreshCw,
	ShieldAlert,
	XCircle,
} from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { currentUser as currentUserStore } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import { cn, formatDate, formatRelativeAge } from "$lib/utils";

/** Lee las solicitudes de la cola; sin argumento, todas las que el catálogo autorice. */
export type ListPublicationRequests = (
	status?: PublicationRequestStatus,
) => Promise<PublicationQueueItem[]>;

/**
 * Registra la decisión sobre una solicitud y devuelve **sólo** su fila `publication_requests`. La
 * aprobación se confirma releyendo el valor almacenado; el rechazo, con el estado de la fila.
 */
export type DecidePublicationRequest = (
	requestId: string,
	approve: boolean,
	comments?: string,
) => Promise<PublicationDecisionResult>;

const LOADING = "Cargando solicitudes…";
const EMPTY = "No hay solicitudes pendientes de revisión.";
const COMMENT_LABEL = "Comentario (obligatorio para rechazar)";
const COMMENT_PLACEHOLDER = "Escriba el motivo del rechazo. Es opcional al aprobar.";
const APPROVE_LABEL = "Aprobar";
const REJECT_LABEL = "Rechazar";
const SELF_APPROVAL = "No puede aprobar su propia solicitud.";
const REASON_REQUIRED = "Para rechazar una solicitud debe escribir un motivo.";
const REFUSED_DECIDE =
	"Solo un administrador de la organización puede decidir sobre las solicitudes de publicación.";
const UNCONFIRMED_DECIDE = "El catálogo no confirmó la decisión.";
const APPROVED_NOTE = "La solicitud fue aprobada.";
const REJECTED_NOTE = "La solicitud fue rechazada.";
// Etiqueta neutral cuando el catálogo no entrega el nombre visible: la fila nunca cae al id crudo.
// La misma regla sirve para quien solicitó y para quien decidió.
const CATALOG_NAME_FALLBACK = "un usuario del catálogo";
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
	ondecided?: (item: PublicationQueueItem) => void;
	/**
	 * Reloj inyectable: fija la antigüedad que muestra cada fila. Por defecto, el momento de montar la
	 * cola; la hoja de revisión lo fija para que el ejemplo no dependa de cuándo se mire.
	 */
	now?: Date;
	class?: string;
} = $props();

type Outcome = { kind: "refused" | "unconfirmed" | "error" | "reason-required"; message: string };

let items = $state<PublicationQueueItem[]>([]);
let loading = $state(true);
let listError = $state<string | null>(null);
/** La decisión en vuelo, con su fila y su sentido; mientras haya una, ninguna fila acepta otra. */
let deciding = $state<{ id: string; approve: boolean } | null>(null);
let outcomes = $state<Record<string, Outcome | undefined>>({});
let comments = $state<Record<string, string>>({});
let announcement = $state<string | null>(null);

// La identidad de quien mira: la inyectada, o la de la sesión. La comparación de cuatro ojos es por
// **id** de usuario, que es lo que el catálogo devuelve en `requested_by`; con `null` ninguna fila se
// bloquea.
const viewer = $derived(currentUser === undefined ? ($currentUserStore?.id ?? null) : currentUser);

function isOwn(item: PublicationQueueItem): boolean {
	return viewer !== null && item.requested_by === viewer;
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
		// La cola no cargada no se disfraza de cola vacía: son estados distintos.
		listError = err instanceof Error ? err.message : "error desconocido";
		items = [];
	} finally {
		loading = false;
	}
}

$effect(() => {
	void load();
});

async function decideOn(item: PublicationQueueItem, approve: boolean) {
	// Cuatro ojos: la propia solicitud no se decide, ni siquiera si el botón llegara a existir.
	if (deciding || isOwn(item)) return;

	const comentario = comments[item.id]?.trim();
	if (!approve && !comentario) {
		// Rechazar exige un motivo: se dice acá y no se envía la decisión al catálogo.
		outcomes[item.id] = { kind: "reason-required", message: REASON_REQUIRED };
		return;
	}

	deciding = { id: item.id, approve };
	outcomes[item.id] = undefined;
	announcement = null;

	try {
		const respuesta = await decide(item.id, approve, comentario || undefined);

		if (!approve) {
			// Rechazar no toca la visibilidad: su propia fila confirmada alcanza, sin relectura. Un `200`
			// que la deja pendiente no concedió la decisión.
			if (respuesta?.status === "rejected") {
				sacarDeLaCola(item, respuesta, REJECTED_NOTE);
			} else {
				outcomes[item.id] = { kind: "unconfirmed", message: UNCONFIRMED_DECIDE };
			}
			return;
		}

		// Aprobar se confirma sólo contra el valor **almacenado**: la fila no trae el dataset, así que un
		// `200` no es la concesión. Una relectura que falla o que sigue privada es la confirmación que no
		// se pudo establecer, no un fallo de la acción.
		const datasetId = respuesta?.dataset_id;
		if (!datasetId) {
			outcomes[item.id] = { kind: "unconfirmed", message: UNCONFIRMED_DECIDE };
			return;
		}
		let almacenado: CkanPackage;
		try {
			almacenado = await readDataset(datasetId);
		} catch {
			outcomes[item.id] = { kind: "unconfirmed", message: UNCONFIRMED_DECIDE };
			return;
		}
		if (almacenado.private === false) {
			sacarDeLaCola(item, respuesta, APPROVED_NOTE);
		} else {
			outcomes[item.id] = { kind: "unconfirmed", message: UNCONFIRMED_DECIDE };
		}
	} catch (err) {
		outcomes[item.id] =
			err instanceof CkanApiError && err.status === 403
				? { kind: "refused", message: REFUSED_DECIDE }
				: {
						kind: "error",
						message: `No se pudo registrar la decisión: ${
							err instanceof Error ? err.message : "error desconocido"
						}`,
					};
	} finally {
		deciding = null;
	}
}

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

function setComment(id: string, value: string) {
	comments[id] = value;
}
</script>

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
		<div
			role="alert"
			class="flex w-full flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
		>
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
			<span>No se pudieron cargar las solicitudes: {listError}</span>
			<Button variant="outline" size="sm" onclick={() => void load()}>
				<RefreshCw class="size-4" aria-hidden="true" />
				Reintentar
			</Button>
		</div>
	{:else if items.length === 0}
		<p class="text-sm text-muted-foreground">{EMPTY}</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each items as item (item.id)}
				{@const desenlace = outcomeLine(item)}
				<li class="rounded-lg border border-border bg-card p-4" data-request-id={item.id}>
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<p class="font-heading text-sm font-semibold text-card-foreground">
							{item.dataset_title}
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
						{#if isOwn(item)}
							<div
								role="note"
								class="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
							>
								<ShieldAlert class="size-4 shrink-0" aria-hidden="true" />
								<span>{SELF_APPROVAL}</span>
							</div>
						{:else}
							<label
								for={`comentario-${item.id}`}
								class="mt-3 block text-xs font-medium text-muted-foreground"
							>
								{COMMENT_LABEL}
							</label>
							<textarea
								id={`comentario-${item.id}`}
								rows="2"
								placeholder={COMMENT_PLACEHOLDER}
								value={comments[item.id] ?? ""}
								oninput={(event) => setComment(item.id, event.currentTarget.value)}
								class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							></textarea>

							{#if outcomes[item.id]}
								<div
									role="alert"
									class={cn(
										"mt-2 flex w-full flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm",
										outcomes[item.id]?.kind === "refused"
											? "border-destructive/20 bg-destructive/10 text-destructive"
											: "border-border bg-muted/40 text-muted-foreground",
									)}
								>
									<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
									<span>{outcomes[item.id]?.message}</span>
								</div>
							{/if}

							<div class="mt-3 flex flex-wrap gap-2">
								<Button
									size="sm"
									onclick={() => void decideOn(item, true)}
									disabled={deciding !== null}
								>
									{#if deciding?.id === item.id && deciding.approve}
										<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
										Aprobando…
									{:else}
										<CheckCircle2 class="size-4" aria-hidden="true" />
										{APPROVE_LABEL}
									{/if}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={() => void decideOn(item, false)}
									disabled={deciding !== null}
								>
									{#if deciding?.id === item.id && !deciding.approve}
										<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
										Rechazando…
									{:else}
										<XCircle class="size-4" aria-hidden="true" />
										{REJECT_LABEL}
									{/if}
								</Button>
							</div>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
