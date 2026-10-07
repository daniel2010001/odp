<script lang="ts">
// Publicar un dataset privado — el camino **directo** de la superadministración de la plataforma.
//
// La regla: el camino directo es `sysadmin`-only. Un administrador de organización **no** publica en
// directo — su camino es decidir solicitudes en la cola —, así que la compuerta ya no es la
// capacidad de organización sino el flag `sysadmin` que el portal ya mantiene (`isSuperAdmin`). La
// capacidad es **inyectable** (`canPublish`) para que la hoja de revisión y la página real la
// conduzcan; sin ella, el default es el flag, sin ninguna llamada nueva.
//
// El contrato de retorno es **uniforme**: `publish` —la acción `publication_publish`— devuelve sólo
// su fila `publication_requests`, sin `dataset`. La confirmación entra por una segunda llamada
// inyectada (`readDataset`), que relee el **valor almacenado**: el portal no la toma de la respuesta
// de quien escribió, porque medir el valor guardado es más fuerte que creerle al escritor que lo
// cambió.
//
// La regla de honestidad: se mantienen separadas tres situaciones y no se colapsan. *La acción
// falló* (un `403` se explica como capacidad faltante, no como error de red). *La acción concedió y
// la confirmación no se pudo establecer* —porque la relectura sigue privada o porque la relectura
// misma falla—: presentarla como un fallo de la acción sería falso. *Confirmada*: sólo el valor
// almacenado ya público reemplaza al dataset.
import { CheckCircle2, CircleAlert, Globe, LoaderCircle, RefreshCw, ShieldAlert } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { isSuperAdmin } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import type { PublicationRequest } from "./RequestPublicationControl.svelte";

/**
 * Publica el dataset y devuelve **sólo** su fila `publication_requests`: el contrato uniforme de las
 * cinco acciones. No trae el dataset; la confirmación sale de releer el valor almacenado.
 *
 * Es la acción de publicación directa (`publication_publish`), autorizada a la superadministración
 * de la plataforma. La inyecta quien monta el control: la capa de API del portal todavía no la
 * expone.
 */
export type PublishResult = PublicationRequest;
export type PublishDataset = (id: string) => Promise<PublishResult>;

/**
 * Relee el dataset del catálogo. Es la **confirmación**: el portal mide el valor almacenado en vez
 * de creerle a la respuesta de quien lo cambió. También es inyectada.
 */
export type ReadDataset = (id: string) => Promise<CkanPackage>;

const REFUSAL = "Solo la superadministración de la plataforma puede publicar este dataset.";
const UNCONFIRMED = "El catálogo no confirmó la publicación.";
const CONFIRMED = "El catálogo confirmó la publicación.";

let {
	dataset,
	publish,
	readDataset,
	canPublish,
	onpublished,
	class: className = "",
}: {
	dataset: CkanPackage;
	publish: PublishDataset;
	readDataset: ReadDataset;
	/** Capacidad ya resuelta por quien monta el control; por defecto, el flag `sysadmin`. */
	canPublish?: boolean;
	onpublished?: (dataset: CkanPackage) => void;
	class?: string;
} = $props();

// La compuerta es el flag `sysadmin`, no la capacidad de organización. Si no se inyecta, se lee del
// store que el portal ya mantiene: no hay ninguna llamada nueva que inventar.
const offered = $derived(canPublish ?? $isSuperAdmin);

type Outcome = { kind: "refused" | "unconfirmed" | "error"; message: string };

let pending = $state(false);
let outcome = $state<Outcome | null>(null);
// Sólo la relectura confirmada del valor almacenado reemplaza al dataset. No hay estado optimista: si
// la acción contesta 200 sin que el valor guardado sea público, el dataset sigue privado y así se
// reporta.
let published = $state<CkanPackage | null>(null);

const current = $derived(published ?? dataset);

async function handlePublish() {
	if (pending) return;

	pending = true;
	outcome = null;

	try {
		// La acción devuelve sólo su fila. Que resuelva no es la confirmación.
		await publish(current.id);
	} catch (err) {
		// Un 403 es una negativa de autorización (distinguible de un 409 de validación): se
		// explica qué capacidad falta y se vuelve a ofrecer el control.
		outcome =
			err instanceof CkanApiError && err.status === 403
				? { kind: "refused", message: REFUSAL }
				: {
						kind: "error",
						message: `No se pudo publicar el dataset: ${
							err instanceof Error ? err.message : "error desconocido"
						}`,
					};
		pending = false;
		return;
	}

	// La acción concedió: confirmar contra el valor **almacenado**. Un fallo de la relectura —o un
	// valor que sigue privado— es la confirmación que no se pudo establecer, no un fallo de la
	// acción.
	try {
		const almacenado = await readDataset(current.id);
		if (almacenado.private === false) {
			published = almacenado;
			onpublished?.(almacenado);
		} else {
			outcome = { kind: "unconfirmed", message: UNCONFIRMED };
		}
	} catch {
		outcome = { kind: "unconfirmed", message: UNCONFIRMED };
	} finally {
		pending = false;
	}
}
</script>

{#if published}
	<p
		role="status"
		class="flex w-full items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
	>
		<CheckCircle2 class="size-4 shrink-0" aria-hidden="true" />
		<span>{CONFIRMED}</span>
	</p>
{/if}

{#if current.private}
	<div class={cn("flex flex-col items-start gap-2", className)}>
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
				{#if outcome.kind === "error"}
					<Button variant="outline" size="sm" onclick={handlePublish}>
						<RefreshCw class="size-4" />
						Reintentar
					</Button>
				{/if}
			</div>
		{/if}

		{#if offered}
			<div class="flex flex-col items-start gap-1.5">
				<Button onclick={handlePublish} disabled={pending}>
					{#if pending}
						<LoaderCircle class="size-4 animate-spin" />
						Publicando…
					{:else}
						<Globe class="size-4" />
						Publicar dataset
					{/if}
				</Button>
				<p class="text-xs text-muted-foreground">Será visible en el catálogo público.</p>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				Solo un administrador de la organización puede aprobar esta publicación.
			</p>
		{/if}
	</div>
{/if}
