<script lang="ts">
// Publicar un dataset privado — el camino del **administrador de la organización**.
//
// La llamada que publica es una acción del catálogo que todavía no existe en la capa de API del
// portal, así que entra **inyectada** (`publish`) y no tiene default. Lo único que se resuelve acá
// es la capacidad, con una pregunta que sí existe hoy: `organization_list_for_user` filtrada por
// `permission: "admin"`, que devuelve sólo las organizaciones donde el usuario administra (con
// cascada a las organizaciones padre, y todas para un sysadmin). La lista se cruza contra el id de
// la organización del dataset; una lista sin filtrar no es prueba de nada.
//
// La regla de honestidad: se reporta como publicación **sólo** lo que el catálogo confirmó. Un
// `200` cuya respuesta sigue diciendo `private: true` no es un éxito, y un `403` no se disfraza de
// error genérico.
import {
	CircleAlert,
	Globe,
	LoaderCircle,
	RefreshCw,
	ShieldAlert,
	TriangleAlert,
} from "@lucide/svelte";
import { get } from "svelte/store";
import { createCkanClient } from "$lib/api/client";
import { createOrganizationApi } from "$lib/api/organizations";
import Button from "$lib/components/ui/button/button.svelte";
import { env } from "$lib/env";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";

/**
 * Publica el dataset y devuelve su estado tal como quedó en el catálogo.
 *
 * Es la acción de publicación (`publication_publish`), autorizada al administrador de la
 * organización. La inyecta quien monta el control: la capa de API del portal todavía no la expone.
 */
export type PublishDataset = (id: string) => Promise<CkanPackage>;

let {
	dataset,
	publish,
	listAdminOrganizations = listAdminOrganizationsViaApi,
	onpublished,
	class: className = "",
}: {
	dataset: CkanPackage;
	publish: PublishDataset;
	listAdminOrganizations?: () => Promise<CkanOrganization[]>;
	onpublished?: (dataset: CkanPackage) => void;
	class?: string;
} = $props();

/** El cliente lleva el token de la sesión: sin él la pregunta de capacidad responde 403. */
function makeClient() {
	return createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token });
}

/** La misma pregunta que hace la acción de publicación: ¿administra el usuario esta organización? */
function listAdminOrganizationsViaApi() {
	return createOrganizationApi(makeClient()).listForUser("admin");
}

type ApproverHint = "checking" | "approver" | "not-approver" | "unavailable";
type Outcome = { kind: "refused" | "unconfirmed" | "error"; message: string };

let approver = $state<ApproverHint>("checking");
let pending = $state(false);
let outcome = $state<Outcome | null>(null);
// Sólo la respuesta confirmada del catálogo reemplaza al dataset. No hay estado optimista: si el
// catálogo contesta 200 sin conceder la publicación, el dataset sigue privado y así se reporta.
let published = $state<CkanPackage | null>(null);

const current = $derived(published ?? dataset);

/** Descarta las respuestas de una verificación vieja cuando se reintenta. */
let hintRun = 0;

async function checkApprover() {
	const orgId = current.organization?.id;
	if (!orgId) {
		// Sin organización no hay predicado que evaluar: se falla cerrado, no se adivina.
		approver = "unavailable";
		return;
	}

	const run = ++hintRun;
	approver = "checking";

	try {
		const adminOrganizations = await listAdminOrganizations();
		if (run !== hintRun) return;
		approver = adminOrganizations.some((organization) => organization.id === orgId)
			? "approver"
			: "not-approver";
	} catch {
		// La verificación no se pudo completar: sin control antes que con un control que miente.
		if (run !== hintRun) return;
		approver = "unavailable";
	}
}

$effect(() => {
	if (!current.private) return;
	void checkApprover();
});

async function handlePublish() {
	if (pending) return;

	pending = true;
	outcome = null;

	try {
		const respuesta = await publish(current.id);
		if (respuesta.private === false) {
			// El catálogo lo confirmó: el dataset que se renderiza es su respuesta, no lo que pedimos.
			published = respuesta;
			onpublished?.(respuesta);
		} else {
			outcome = { kind: "unconfirmed", message: "El catálogo no confirmó la publicación." };
		}
	} catch (err) {
		// Un 403 es una negativa de autorización (distinguible de un 409 de validación): se
		// explica quién puede publicar y se vuelve a ofrecer el control.
		outcome =
			err instanceof CkanApiError && err.status === 403
				? {
						kind: "refused",
						message: "Solo un administrador de la organización puede publicar este dataset.",
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

		{#if approver === "approver"}
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
		{:else if approver === "not-approver"}
			<p class="text-sm text-muted-foreground">
				Solo un administrador de la organización puede publicar este dataset.
			</p>
		{:else if approver === "unavailable"}
			<div class="flex flex-col items-start gap-2">
				<p class="flex items-center gap-2 text-sm text-muted-foreground">
					<TriangleAlert class="size-4 shrink-0" />
					No se pudo verificar su permiso para publicar.
				</p>
				<Button variant="outline" size="sm" onclick={checkApprover}>
					<RefreshCw class="size-4" />
					Reintentar
				</Button>
			</div>
		{:else}
			<p class="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
				<LoaderCircle class="size-4 animate-spin" />
				Verificando su permiso…
			</p>
		{/if}
	</div>
{/if}
