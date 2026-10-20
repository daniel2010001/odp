<script lang="ts">
// Solicitar la publicación de un dataset privado — el camino del **editor**.
//
// La compuerta NO es «administrador»: es la capacidad de `update_dataset`, que la página real ya
// resuelve (`listUpdatableOrganizationIds` → `puedeEditarDataset`) y que llega acá como prop. El
// componente no vuelve a derivar roles: si le dicen que la capacidad no está, no ofrece nada.
//
// Las dos llamadas —pedir y cancelar— entran **inyectadas** (`request`, `cancel`): las acciones del
// catálogo todavía no existen en la capa de API del portal. La regla de honestidad es la misma que la
// del control de publicación: sólo cuenta como éxito lo que el catálogo confirmó con el estado
// pedido; un `200` que no deja la solicitud donde se pidió no es un éxito.
import {
	Ban,
	CircleAlert,
	CircleX,
	Clock,
	LoaderCircle,
	RefreshCw,
	Send,
	ShieldAlert,
} from "@lucide/svelte";
import { technicalDetail } from "$lib/api/failure";
// El tipo de la fila lo define **la capa de API** (`$lib/api/publication`), que es la dueña de la forma
// que el catálogo devuelve y de los nombres de sus claves. Antes se definía acá y se exportaba para que
// la cola y las hojas no lo duplicaran: la intención —un solo dueño— era correcta, la **dirección** no.
// Un componente que define el tipo de la respuesta que consume la API mira hacia arriba, y el día que la
// fila gane un campo hay dos lugares donde escribirlo — de hecho la fila ya trae `requested_by_name`,
// `approved_by_name` y `motive`, y este archivo no los tenía.
import type { PublicationRequest } from "$lib/api/publication";
import Button from "$lib/components/ui/button/button.svelte";
import { insigniaDeLaSolicitud } from "$lib/copy/publication";
import { CkanApiError } from "$lib/types/api";
import { cn } from "$lib/utils";
import ResponsiveAction from "./ResponsiveAction.svelte";

/** Pide la publicación del dataset y devuelve la solicitud tal como quedó en el catálogo. */
export type RequestPublication = (datasetId: string) => Promise<PublicationRequest>;
/** Cancela una solicitud propia y devuelve la solicitud tal como quedó en el catálogo. */
export type CancelPublicationRequest = (requestId: string) => Promise<PublicationRequest>;

const REQUEST_LABEL = "Solicitar publicación";
const REQUEST_AGAIN_LABEL = "Volver a solicitar";
const CONSEQUENCE = "Un administrador de la organización revisará su solicitud.";
// Las dos frases que el usuario lee cuando el fallo no es de autorización. Son **nuestras**, en su
// idioma: el dato técnico va detrás, como dato secundario, porque un mensaje crudo del servidor no es
// un mensaje para una persona.
const REQUEST_FAILED = "No se pudo enviar la solicitud.";
const CANCEL_FAILED = "No se pudo cancelar la solicitud.";

const PENDING_HEADING = "Solicitud pendiente de revisión";
const PENDING_BODY =
	"Su solicitud está a la espera de que un administrador de la organización la revise.";
const CANCEL_LABEL = "Cancelar solicitud";
const REJECTED_HEADING = "Solicitud rechazada";
const NO_REASON = "No se indicó un motivo.";
const ANNULLED_HEADING = "Solicitud anulada";
const ANNULLED_BODY =
	"La solicitud ya no está vigente porque el conjunto de datos cambió de estado o dejó de existir.";
const REFUSED_REQUEST = "Solo quien puede editar este dataset puede solicitar su publicación.";
const REFUSED_CANCEL =
	"Solo quien la solicitó o un administrador de la organización puede cancelarla.";
const UNCONFIRMED_REQUEST = "El catálogo no confirmó la solicitud.";
const UNCONFIRMED_CANCEL = "El catálogo no confirmó la cancelación.";

let {
	dataset,
	canRequest,
	currentRequest = null,
	request,
	cancel,
	onrequested,
	oncancelled,
	apariencia = "bloque",
	class: className = "",
}: {
	/** Del dataset sólo se necesitan el identificador y si sigue privado. */
	dataset: { id: string; private: boolean };
	/** Capacidad de `update_dataset` ya resuelta por quien monta el control. Fail closed. */
	canRequest: boolean;
	/** La solicitud vigente que la página conoce, o `null` si no hay ninguna. */
	currentRequest?: PublicationRequest | null;
	request: RequestPublication;
	cancel: CancelPublicationRequest;
	onrequested?: (request: PublicationRequest) => void;
	oncancelled?: (request: PublicationRequest) => void;
	/**
	 * Presentación. `"bloque"` (lo de siempre) dibuja el botón con su explicación debajo. `"accion"` dibuja
	 * **la unidad del hero** (T13, variante C7 + M1): una tarjeta con el estado de la solicitud a la izquierda
	 * y su acción a la derecha, en una fila que no envuelve (ocupa el ancho bajo 44 rem del contenedor y se
	 * ajusta a su contenido desde ahí). La acción mide 44 px (36 px desde 44 rem) y queda sólo en ícono bajo
	 * 20 rem; la explicación va como **tooltip**, asociada además con `aria-describedby` porque el `title` no
	 * se alcanza con el teclado. Debe montarse dentro de un `@container`.
	 */
	apariencia?: "bloque" | "accion";
	class?: string;
} = $props();

// Identificador único por instancia: dos controles del mismo dataset en una página —la hoja los monta
// dos veces— no pueden compartir el `id` de la descripción.
const uid = $props.id();

type Outcome = {
	kind: "refused" | "unconfirmed" | "error";
	message: string;
	/** El dato técnico que sigue a la frase; `null` cuando no hay ninguno que citar. */
	technical?: string | null;
};

let pending = $state<"request" | "cancel" | null>(null);
let outcome = $state<Outcome | null>(null);
// La respuesta confirmada del catálogo gana sobre la lectura de la página; no hay estado optimista.
let decided = $state<PublicationRequest | null>(null);
// Con qué llamada reintentar cuando el fallo no fue de autorización.
let lastAction = $state<"request" | "cancel">("request");

const active = $derived(decided ?? currentRequest);

async function handleRequest() {
	if (pending) return;

	lastAction = "request";
	pending = "request";
	outcome = null;

	try {
		const respuesta = await request(dataset.id);
		if (respuesta?.status === "pending") {
			decided = respuesta;
			onrequested?.(respuesta);
		} else {
			outcome = { kind: "unconfirmed", message: UNCONFIRMED_REQUEST };
		}
	} catch (err) {
		outcome =
			err instanceof CkanApiError && err.status === 403
				? { kind: "refused", message: REFUSED_REQUEST }
				: {
						kind: "error",
						message: REQUEST_FAILED,
						technical: technicalDetail(err),
					};
	} finally {
		pending = null;
	}
}

async function handleCancel() {
	const solicitud = active;
	if (!solicitud || pending) return;

	lastAction = "cancel";
	pending = "cancel";
	outcome = null;

	try {
		const respuesta = await cancel(solicitud.id);
		if (respuesta?.status === "cancelled") {
			decided = respuesta;
			oncancelled?.(respuesta);
		} else {
			outcome = { kind: "unconfirmed", message: UNCONFIRMED_CANCEL };
		}
	} catch (err) {
		outcome =
			err instanceof CkanApiError && err.status === 403
				? { kind: "refused", message: REFUSED_CANCEL }
				: {
						kind: "error",
						message: CANCEL_FAILED,
						technical: technicalDetail(err),
					};
	} finally {
		pending = null;
	}
}

function retry() {
	if (lastAction === "cancel") void handleCancel();
	else void handleRequest();
}
</script>

{#snippet alerta()}
	{#if outcome}
		<div
			role="alert"
			class={cn(
				"flex w-full flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm",
				outcome.kind === "refused"
					? "border-destructive/20 bg-destructive/10 text-destructive"
					: "border-border bg-muted/40 text-muted-foreground",
			)}
		>
			{#if outcome.kind === "refused"}
				<ShieldAlert class="size-4 shrink-0" />
			{:else}
				<CircleAlert class="size-4 shrink-0" />
			{/if}
			<span>{outcome.message}</span>
			{#if outcome.technical}
				<span class="font-mono text-xs">{outcome.technical}</span>
			{/if}
			{#if outcome.kind === "error"}
				<Button variant="outline" size="sm" onclick={retry}>
					<RefreshCw class="size-4" />
					Reintentar
				</Button>
			{/if}
		</div>
	{/if}
{/snippet}

{#if dataset.private && canRequest && active?.status !== "approved"}
	{#if apariencia === "accion"}
		{@const insignia = insigniaDeLaSolicitud(active?.status)}
		<div class={cn("flex flex-col items-start gap-2", className)}>
			<!-- La unidad (M1): el estado a la izquierda y su acción a la derecha, en una fila que no envuelve.
			     El estado es una **insignia** informativa (no un enlace); la explicación larga y el motivo viven en
			     la tarjeta del estado, más abajo. «Sin solicitud» se acorta bajo 44 rem. -->
			<div
				data-unit
				class="flex w-full flex-nowrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-1.5 pl-3 @[44rem]:w-fit @[44rem]:flex-wrap @[44rem]:gap-x-3"
			>
				<div class="min-w-0 flex-1 @[44rem]:flex-none">
					{#if insignia}
						<span
							class={cn(
								"inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold",
								insignia.tone,
							)}>{insignia.label}</span
						>
					{:else}
						<span class="text-xs text-muted-foreground @[44rem]:hidden">Sin solicitud</span>
						<span class="hidden text-xs text-muted-foreground @[44rem]:inline"
							>Sin solicitud de publicación</span
						>
					{/if}
				</div>
				{#if active?.status === "pending"}
					<ResponsiveAction
						icon={pending === "cancel" ? LoaderCircle : CircleX}
						iconClass={pending === "cancel" ? "animate-spin" : ""}
						label={pending === "cancel" ? "Cancelando…" : CANCEL_LABEL}
						text={pending === "cancel" ? "Cancelando…" : "Cancelar"}
						suffix={pending === "cancel" ? undefined : "solicitud"}
						suffixFrom="24rem"
						collapseBelow="20rem"
						height="11"
						class="@[44rem]:h-9"
						onclick={handleCancel}
						disabled={pending !== null}
					/>
				{:else if active?.status !== "annulled"}
					<!-- Una solicitud anulada perdió su objeto: no se ofrece volver a pedirla. -->
					<ResponsiveAction
						icon={pending === "request" ? LoaderCircle : Send}
						iconClass={pending === "request" ? "animate-spin" : ""}
						label={pending === "request"
							? "Enviando…"
							: active?.status === "rejected"
								? REQUEST_AGAIN_LABEL
								: REQUEST_LABEL}
						collapseBelow="20rem"
						height="11"
						class="@[44rem]:h-9"
						title={CONSEQUENCE}
						describedby={`${uid}-consecuencia`}
						onclick={handleRequest}
						disabled={pending !== null}
					/>
					<span id={`${uid}-consecuencia`} class="sr-only">{CONSEQUENCE}</span>
				{/if}
			</div>
			{@render alerta()}
		</div>
	{:else}
		<div class={cn("flex flex-col items-start gap-2", className)}>
			{@render alerta()}

			{#if active?.status === "pending"}
				<div class="w-full rounded-md border border-border bg-muted/40 px-3 py-2">
					<p class="flex items-center gap-2 text-sm font-medium text-foreground">
						<Clock class="size-4 shrink-0" aria-hidden="true" />
						{PENDING_HEADING}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">{PENDING_BODY}</p>
					<Button
						variant="outline"
						size="sm"
						class="mt-2"
						onclick={handleCancel}
						disabled={pending !== null}
					>
						{#if pending === "cancel"}
							<LoaderCircle class="size-4 animate-spin" />
							Cancelando…
						{:else}
							<CircleX class="size-4" />
							{CANCEL_LABEL}
						{/if}
					</Button>
				</div>
			{:else if active?.status === "annulled"}
				<!-- La solicitud perdió su objeto: el dataset se eliminó o ya se publicó por otra vía. No
				     se ofrece volver a pedirla, porque el estado que la justificaba ya no está. -->
				<div class="w-full rounded-md border border-border bg-muted/40 px-3 py-2">
					<p class="flex items-center gap-2 text-sm font-medium text-foreground">
						<Ban class="size-4 shrink-0" aria-hidden="true" />
						{ANNULLED_HEADING}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">{ANNULLED_BODY}</p>
				</div>
			{:else}
				{#if active?.status === "rejected"}
					<div class="w-full rounded-md border border-border bg-muted/40 px-3 py-2">
						<p class="flex items-center gap-2 text-sm font-medium text-foreground">
							<CircleX class="size-4 shrink-0" aria-hidden="true" />
							{REJECTED_HEADING}
						</p>
						{#if active.comments?.trim()}
							<p class="mt-1 text-xs text-muted-foreground">Motivo: {active.comments.trim()}</p>
						{:else}
							<p class="mt-1 text-xs text-muted-foreground">{NO_REASON}</p>
						{/if}
					</div>
				{/if}

				<div class="flex flex-col items-start gap-1.5">
					<Button onclick={handleRequest} disabled={pending !== null}>
						{#if pending === "request"}
							<LoaderCircle class="size-4 animate-spin" />
							Enviando…
						{:else}
							<Send class="size-4" />
							{active?.status === "rejected" ? REQUEST_AGAIN_LABEL : REQUEST_LABEL}
						{/if}
					</Button>
					<p class="text-xs text-muted-foreground">{CONSEQUENCE}</p>
				</div>
			{/if}
		</div>
	{/if}
{/if}
