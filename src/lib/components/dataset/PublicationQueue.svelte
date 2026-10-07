<script module lang="ts">
import type { PublicationRequestStatus } from "./RequestPublicationControl.svelte";

// ─── Tipos de la cola de solicitudes ──────────────────────────────────
// Lo que el portal necesita mostrar de una solicitud: de qué dataset es, quién la pidió y cuándo.
// Los campos de presentación (`dataset_title`, `organization_title`, `requested_by`) son valores ya
// resueltos por la capa de API; si faltan, la fila simplemente no los muestra. El estado reusa el
// vocabulario de `PublicationRequest`, que es el dueño de la tabla.
export interface PublicationQueueItem {
	id: string;
	dataset_title: string;
	organization_title?: string;
	requested_by?: string;
	created_at?: string;
	status: PublicationRequestStatus;
	comments?: string | null;
}
</script>

<script lang="ts">
// La cola del **administrador de la organización**: las solicitudes pendientes de las organizaciones
// donde administra, con aprobar, rechazar y un comentario opcional.
//
// Las dos llamadas entran **inyectadas** (`list`, `decide`): las acciones del catálogo todavía no
// existen en la capa de API del portal. Quién puede decidir lo decide el catálogo; acá sólo se lee su
// respuesta.
//
// Regla de honestidad: la fila sale de la cola **sólo** cuando el catálogo devolvió la solicitud con
// el estado de la decisión pedida. Un `200` cuya solicitud sigue pendiente no es una decisión, y un
// `403` se explica como capacidad faltante, no como error de red.
import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, XCircle } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { CkanApiError } from "$lib/types/api";
import { cn, formatDate } from "$lib/utils";

/** Lee las solicitudes de la cola; sin argumento, todas las que el catálogo autorice. */
export type ListPublicationRequests = (
	status?: PublicationRequestStatus,
) => Promise<PublicationQueueItem[]>;

/** Registra la decisión sobre una solicitud y devuelve la solicitud tal como quedó en el catálogo. */
export type DecidePublicationRequest = (
	requestId: string,
	approve: boolean,
	comments?: string,
) => Promise<PublicationQueueItem>;

const LOADING = "Cargando solicitudes…";
const EMPTY = "No hay solicitudes pendientes de revisión.";
const COMMENT_LABEL = "Comentario (opcional)";
const COMMENT_PLACEHOLDER = "Puede explicar la decisión. Es opcional.";
const APPROVE_LABEL = "Aprobar";
const REJECT_LABEL = "Rechazar";
const REFUSED_DECIDE =
	"Solo un administrador de la organización puede decidir sobre las solicitudes de publicación.";
const UNCONFIRMED_DECIDE = "El catálogo no confirmó la decisión.";
const APPROVED_NOTE = "La solicitud fue aprobada.";
const REJECTED_NOTE = "La solicitud fue rechazada.";

let {
	list,
	decide,
	ondecided,
	class: className = "",
}: {
	list: ListPublicationRequests;
	decide: DecidePublicationRequest;
	ondecided?: (item: PublicationQueueItem) => void;
	class?: string;
} = $props();

type Outcome = { kind: "refused" | "unconfirmed" | "error"; message: string };

let items = $state<PublicationQueueItem[]>([]);
let loading = $state(true);
let listError = $state<string | null>(null);
/** La decisión en vuelo, con su fila y su sentido; mientras haya una, ninguna fila acepta otra. */
let deciding = $state<{ id: string; approve: boolean } | null>(null);
let outcomes = $state<Record<string, Outcome | undefined>>({});
let comments = $state<Record<string, string>>({});
let announcement = $state<string | null>(null);

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
	if (deciding) return;

	deciding = { id: item.id, approve };
	outcomes[item.id] = undefined;
	announcement = null;

	try {
		const comentario = comments[item.id]?.trim();
		const respuesta = await decide(item.id, approve, comentario || undefined);
		const esperado: PublicationRequestStatus = approve ? "approved" : "rejected";

		if (respuesta?.status === esperado) {
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

					{#if item.requested_by || item.created_at}
						<p class="mt-1 text-xs text-muted-foreground">
							{#if item.requested_by}Solicitada por {item.requested_by}{/if}
							{#if item.requested_by && item.created_at} · {/if}
							{#if item.created_at}{formatDate(item.created_at)}{/if}
						</p>
					{/if}

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
						<Button size="sm" onclick={() => void decideOn(item, true)} disabled={deciding !== null}>
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
				</li>
			{/each}
		</ul>
	{/if}
</div>
