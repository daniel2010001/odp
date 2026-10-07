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
	dataset_title: string;
	organization_title?: string;
	/** Id de usuario de quien creó la solicitud; sólo alimenta la comparación de cuatro ojos. */
	requested_by?: string;
	/** Nombre visible de quien creó la solicitud; es lo que la fila muestra. */
	requested_by_name?: string;
	created_at?: string;
	status: PublicationRequestStatus;
	comments?: string | null;
}

/**
 * La respuesta de `publication_request_decide`: la fila decidida, más el dataset resultante cuando la
 * decisión fue una aprobación. Un rechazo no toca la visibilidad y puede no traerlo.
 */
export interface PublicationDecisionResult extends PublicationQueueItem {
	dataset?: CkanPackage;
}
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
// Regla de honestidad: la fila sale de la cola **sólo** cuando el catálogo confirmó la decisión. Un
// `200` cuya solicitud sigue pendiente no es una decisión. Y aprobar es más que el estado: la fila
// sale únicamente si el catálogo devolvió además el dataset ya público (`dataset.private === false`),
// porque un `approved` sin el flip no concedió la publicación. Un `403` se explica como capacidad
// faltante, no como error de red.
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
import { cn, formatDate } from "$lib/utils";

/** Lee las solicitudes de la cola; sin argumento, todas las que el catálogo autorice. */
export type ListPublicationRequests = (
	status?: PublicationRequestStatus,
) => Promise<PublicationQueueItem[]>;

/**
 * Registra la decisión sobre una solicitud y devuelve la fila, más el dataset resultante cuando la
 * decisión fue una aprobación.
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
const REQUESTER_FALLBACK = "un usuario del catálogo";

let {
	list,
	decide,
	currentUser,
	ondecided,
	class: className = "",
}: {
	list: ListPublicationRequests;
	decide: DecidePublicationRequest;
	/** Quién está mirando la cola; su propia solicitud no es decidible por él. Default: la sesión. */
	currentUser?: string | null;
	ondecided?: (item: PublicationQueueItem) => void;
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
		const esperado: PublicationRequestStatus = approve ? "approved" : "rejected";

		// Aprobar se concede sólo cuando, además del estado, el catálogo devuelve el dataset ya público:
		// un `approved` sin el flip (`dataset.private` en `true`, o sin `dataset`) no concedió la
		// publicación. Un rechazo no toca la visibilidad, así que su fila confirmada alcanza.
		const confirmada =
			respuesta?.status === esperado && (!approve || respuesta.dataset?.private === false);

		if (confirmada) {
			items = items.filter((solicitud) => solicitud.id !== item.id);
			announcement = approve ? APPROVED_NOTE : REJECTED_NOTE;
			ondecided?.(respuesta);
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
							{#if item.requested_by_name || item.requested_by}Solicitada por {item.requested_by_name ?? REQUESTER_FALLBACK}{/if}
							{#if (item.requested_by_name || item.requested_by) && item.created_at} · {/if}
							{#if item.created_at}{formatDate(item.created_at)}{/if}
						</p>
					{/if}

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
				</li>
			{/each}
		</ul>
	{/if}
</div>
