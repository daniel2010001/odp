<script module lang="ts">
// El cuerpo de **decidir** una solicitud —el motivo, aprobar, rechazar y el desenlace—, sin saber
// **dónde** se lo está mirando.
//
// Nació extrayéndolo de `PublicationQueue` (la fila de la cola) para que la **ficha del dataset**
// pueda ofrecer lo mismo sin una segunda copia de las reglas: dos copias divergen, y la gobernanza
// no admite dos formas de aprobar. La extracción se probó con la suite de la cola, que no cambió.
//
// Las reglas de las que este componente es dueño —valen en cualquier lugar donde se lo monte:
//  · **Cuatro ojos**: nadie decide una solicitud que creó. Se dice con una nota y no se dibujan
//    botones, en vez de ofrecer algo que el catálogo va a rechazar.
//  · **Rechazar exige un motivo**: sin comentario la decisión no se envía y se explica por qué.
//  · **La acción falló y la confirmación que no se pudo establecer son estados distintos**: un `200`
//    no es la concesión. Aprobar se confirma releyendo el **valor almacenado** (`readDataset`) —una
//    relectura que falla o que sigue privada es esa confirmación que no se pudo establecer—; un
//    rechazo no toca la visibilidad y confirma con el estado que su propia fila devolvió.
//
// Quien lo monta decide **qué hacer** con una decisión confirmada (`ondecided`) y si el control está
// bloqueado por algo suyo (`disabled`). La cola, por ejemplo, cierra sus otras filas mientras una
// decisión está en vuelo: eso es asunto de la cola, no de este componente.
import type { CkanPackage } from "$lib/types/ckan";
import type {
	DecidableRequest,
	DecidePublicationRequest,
	PublicationDecisionResult,
} from "./publication-decision";
</script>

<script lang="ts">
import { CheckCircle2, CircleAlert, LoaderCircle, ShieldAlert, XCircle } from "@lucide/svelte";
import { technicalDetail } from "$lib/api/failure";
import Button from "$lib/components/ui/button/button.svelte";
import { currentUser as currentUserStore } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import { cn } from "$lib/utils";

const COMMENT_LABEL = "Comentario (obligatorio para rechazar)";
const COMMENT_PLACEHOLDER = "Escriba el motivo del rechazo. Es opcional al aprobar.";
const APPROVE_LABEL = "Aprobar";
const REJECT_LABEL = "Rechazar";
const SELF_APPROVAL = "No puede aprobar su propia solicitud.";
const REASON_REQUIRED = "Para rechazar una solicitud debe escribir un motivo.";
const REFUSED_DECIDE =
	"Solo un administrador de la organización puede decidir sobre las solicitudes de publicación.";
const UNCONFIRMED_DECIDE = "El catálogo no confirmó la decisión.";
// La frase que el usuario lee cuando el fallo al decidir no es de autorización. Es **nuestra**: el dato
// técnico va detrás, como dato secundario.
const DECIDE_FAILED = "No se pudo registrar la decisión.";

type Outcome = {
	kind: "refused" | "unconfirmed" | "error" | "reason-required";
	message: string;
	/** El dato técnico que sigue a la frase; `null` cuando no hay ninguno que citar. */
	technical?: string | null;
};

let {
	item,
	decide,
	readDataset,
	currentUser,
	disabled = false,
	onpendingchange,
	ondecided,
}: {
	item: DecidableRequest;
	decide: DecidePublicationRequest;
	/**
	 * Relee el dataset almacenado. Es la confirmación de una aprobación: la fila de `decide` no trae
	 * el dataset, y medir el valor guardado es más fuerte que creerle a quien lo cambió.
	 */
	readDataset: (id: string) => Promise<CkanPackage>;
	/** Quién está mirando; su propia solicitud no es decidible por él. Default: la sesión. */
	currentUser?: string | null;
	/**
	 * Bloqueo decidido por quien monta: con `true` los controles no aceptan clics. La cola lo usa para
	 * no ofrecer dos decisiones a la vez; la ficha no lo necesita.
	 */
	disabled?: boolean;
	/** Avisa que una decisión entró o salió de vuelo, para que quien monta coordine lo suyo. */
	onpendingchange?: (pending: { id: string; approve: boolean } | null) => void;
	/** Una decisión **confirmada**, con su fila. Qué hacer con ella lo decide quien monta. */
	ondecided?: (result: PublicationDecisionResult) => void;
} = $props();

let pending = $state<{ id: string; approve: boolean } | null>(null);
let outcome = $state<Outcome | null>(null);
let comment = $state("");

// El `id` del comentario sale de la **instancia**, no del id de la solicitud: el mismo control puede
// estar montado dos veces sobre la misma solicitud —la cola y la ficha, o dos vistas de la hoja de
// revisión— y dos `id` iguales en el documento le rompen el campo a su `label`.
const uid = $props.id();

// La identidad de quien mira: la inyectada, o la de la sesión. La comparación de cuatro ojos es por
// **id** de usuario, que es lo que el catálogo devuelve en `requested_by`; con `null` nada se bloquea.
const viewer = $derived(currentUser === undefined ? ($currentUserStore?.id ?? null) : currentUser);

const isOwn = $derived(viewer !== null && item.requested_by === viewer);

async function decideOn(approve: boolean) {
	// Cuatro ojos: la propia solicitud no se decide, ni siquiera si el botón llegara a existir.
	if (pending || isOwn) return;

	const comentario = comment.trim();
	if (!approve && !comentario) {
		// Rechazar exige un motivo: se dice acá y no se envía la decisión al catálogo.
		outcome = { kind: "reason-required", message: REASON_REQUIRED };
		return;
	}

	pending = { id: item.id, approve };
	onpendingchange?.(pending);
	outcome = null;

	try {
		const respuesta = await decide(item.id, approve, comentario || undefined);

		if (!approve) {
			// Rechazar no toca la visibilidad: su propia fila confirmada alcanza, sin relectura. Un `200`
			// que la deja pendiente no concedió la decisión.
			if (respuesta?.status === "rejected") {
				ondecided?.(respuesta);
			} else {
				outcome = { kind: "unconfirmed", message: UNCONFIRMED_DECIDE };
			}
			return;
		}

		// Aprobar se confirma sólo contra el valor **almacenado**: la fila no trae el dataset, así que un
		// `200` no es la concesión. Una relectura que falla o que sigue privada es la confirmación que no
		// se pudo establecer, no un fallo de la acción.
		const datasetId = respuesta?.dataset_id;
		if (!datasetId) {
			outcome = { kind: "unconfirmed", message: UNCONFIRMED_DECIDE };
			return;
		}
		let almacenado: CkanPackage;
		try {
			almacenado = await readDataset(datasetId);
		} catch {
			outcome = { kind: "unconfirmed", message: UNCONFIRMED_DECIDE };
			return;
		}
		if (almacenado.private === false) {
			ondecided?.(respuesta);
		} else {
			outcome = { kind: "unconfirmed", message: UNCONFIRMED_DECIDE };
		}
	} catch (err) {
		outcome =
			err instanceof CkanApiError && err.status === 403
				? { kind: "refused", message: REFUSED_DECIDE }
				: {
						kind: "error",
						message: DECIDE_FAILED,
						technical: technicalDetail(err),
					};
	} finally {
		pending = null;
		onpendingchange?.(null);
	}
}
</script>

{#if isOwn}
	<div
		role="note"
		class="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
	>
		<ShieldAlert class="size-4 shrink-0" aria-hidden="true" />
		<span>{SELF_APPROVAL}</span>
	</div>
{:else}
	<label for={`comentario-${uid}`} class="mt-3 block text-xs font-medium text-muted-foreground">
		{COMMENT_LABEL}
	</label>
	<textarea
		id={`comentario-${uid}`}
		rows="2"
		placeholder={COMMENT_PLACEHOLDER}
		value={comment}
		oninput={(event) => (comment = event.currentTarget.value)}
		class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	></textarea>

	{#if outcome}
		<div
			role="alert"
			class={cn(
				"mt-2 flex w-full flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm",
				outcome.kind === "refused"
					? "border-destructive/20 bg-destructive/10 text-destructive"
					: "border-border bg-muted/40 text-muted-foreground",
			)}
		>
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
			<span>{outcome.message}</span>
			{#if outcome.technical}
				<span class="font-mono text-xs">{outcome.technical}</span>
			{/if}
		</div>
	{/if}

	<div class="mt-3 flex flex-wrap gap-2">
		<Button size="sm" onclick={() => void decideOn(true)} disabled={disabled || pending !== null}>
			{#if pending?.approve}
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
			onclick={() => void decideOn(false)}
			disabled={disabled || pending !== null}
		>
			{#if pending && !pending.approve}
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
				Rechazando…
			{:else}
				<XCircle class="size-4" aria-hidden="true" />
				{REJECT_LABEL}
			{/if}
		</Button>
	</div>
{/if}
