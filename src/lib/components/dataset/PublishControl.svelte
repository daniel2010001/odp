<script lang="ts">
// Publicar un dataset privado — el camino **directo** de la superadministración de la plataforma.
//
// La regla: el camino directo es `sysadmin`-only. Un administrador de organización **no** publica en
// directo — su camino es decidir solicitudes en la cola —, así que la compuerta ya no es la
// capacidad de organización sino el flag `sysadmin` que el portal ya mantiene (`isSuperAdmin`). La
// capacidad es **inyectable** (`canPublish`) para que la hoja de revisión y la página real la
// conduzcan; sin ella, el default es el flag, sin ninguna llamada nueva.
//
// La llamada que publica entra **inyectada** (`publish`): la acción `publication_publish` todavía no
// está en la capa de API del portal.
//
// La regla de honestidad: se reporta como publicación **sólo** lo que el catálogo confirmó. Un `200`
// cuya respuesta sigue diciendo `private: true` no es un éxito, y un `403` no se disfraza de error
// genérico.
import { CircleAlert, Globe, LoaderCircle, RefreshCw, ShieldAlert } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { isSuperAdmin } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";

/**
 * Publica el dataset y devuelve la respuesta del catálogo: la fila que ya devolvía, más el dataset
 * resultante bajo `dataset`. La publicación se lee de `dataset`, nunca del nivel superior.
 *
 * Es la acción de publicación directa (`publication_publish`), autorizada a la superadministración
 * de la plataforma. La inyecta quien monta el control: la capa de API del portal todavía no la
 * expone.
 */
export type PublishResult = CkanPackage & { dataset: CkanPackage };

export type PublishDataset = (id: string) => Promise<PublishResult>;

let {
	dataset,
	publish,
	canPublish,
	onpublished,
	class: className = "",
}: {
	dataset: CkanPackage;
	publish: PublishDataset;
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
// Sólo la respuesta confirmada del catálogo reemplaza al dataset. No hay estado optimista: si el
// catálogo contesta 200 sin conceder la publicación, el dataset sigue privado y así se reporta.
let published = $state<CkanPackage | null>(null);

const current = $derived(published ?? dataset);

async function handlePublish() {
	if (pending) return;

	pending = true;
	outcome = null;

	try {
		const respuesta = await publish(current.id);
		if (respuesta.dataset?.private === false) {
			// El catálogo lo confirmó: el dataset que se renderiza es `dataset`, no lo que pedimos ni el
			// nivel superior de la respuesta.
			published = respuesta.dataset;
			onpublished?.(respuesta.dataset);
		} else {
			outcome = { kind: "unconfirmed", message: "El catálogo no confirmó la publicación." };
		}
	} catch (err) {
		// Un 403 es una negativa de autorización (distinguible de un 409 de validación): se
		// explica qué capacidad falta y se vuelve a ofrecer el control.
		outcome =
			err instanceof CkanApiError && err.status === 403
				? {
						kind: "refused",
						message: "Solo la superadministración de la plataforma puede publicar este dataset.",
					}
				: {
						kind: "error",
						message: `No se pudo publicar el dataset: ${
							err instanceof Error ? err.message : "error desconocido"
						}`,
					};
	} finally {
		pending = false;
	}
}
</script>

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
