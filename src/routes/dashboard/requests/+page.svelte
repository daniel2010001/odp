<!--
	Solicitudes de publicación — la cola del administrador de la organización, en su **propia page**.

	Existe porque **descubrir la cola es parte de la compuerta**: si un editor pide publicar y nadie ve la
	solicitud, la pared se vuelve un **bloqueo mudo**. La cola estaba en la hoja de revisión y en el panel; acá
	vive donde el trabajo se hace, con las presentaciones que el autor ya decidió y que son del componente:
	**pendientes y después resueltas**, **sólo la primera solicitud decidible** desplegada, y un **filtro por
	organización que no aparece cuando hay una sola** — un filtro que no filtra es ruido.

	Las llamadas son las **reales**: `publication_request_list`, `_decide` y la relectura del dataset, todas de
	`$lib/api/publication`. Hasta `B1` entraban inyectadas porque la capa de API no las exponía.
-->
<script lang="ts">
import { Inbox } from "@lucide/svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createPublicationApi, type PublicationRequest } from "$lib/api/publication";
import { createSessionApi } from "$lib/api/session";
import PublicationQueue, {
	type PublicationQueueItem,
} from "$lib/components/dataset/PublicationQueue.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { endInvalidSession } from "$lib/session-guard";
import { auth, isAuthenticated } from "$lib/stores/auth";
import { cn } from "$lib/utils";

function makeClient() {
	return createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token });
}

const publicationApi = createPublicationApi(makeClient());
const datasetApi = createDatasetApi(makeClient());

// La antigüedad que la cola muestra sale de acá y se fija al montar: una lectura no debería ver dos
// antigüedades distintas para la misma fila según cuándo se dibujó.
const ahora = new Date();

let authed = $state(false);
let comprobando = $state(true);
/** Las filas del listado: de acá salen el filtro y las organizaciones que lo justifican. */
let filas = $state<PublicationRequest[] | null>(null);
let orgElegida = $state<string | null>(null);
/** Remonta la cola al cambiar de filtro, sin volver a pedir nada al catálogo. */
let clave = $state(0);

const organizaciones = $derived([
	...new Set(
		(filas ?? [])
			.map((fila) => fila.organization_title)
			.filter((titulo): titulo is string => Boolean(titulo)),
	),
]);

/** Con **una sola** organización el selector no se dibuja: no hay nada que filtrar. */
const hayFiltro = $derived(organizaciones.length > 1);

/**
 * El título con el que la fila se lee.
 *
 * La fila trae `dataset_title` con la semántica del contrato —**vacío → `null`**, **irresoluble → el token
 * `"unknown"`**, nunca el id— y la cola **siempre dibuja un título**: su tipo lo exige justamente para que
 * ninguna fila se lea con la línea principal vacía. Acá es donde ese hueco se convierte en una frase **del
 * portal**, y la frase no afirma más de lo que se sabe: «no disponible» cubre las dos formas de vacío sin
 * decir que el dataset se borró —podría existir y no tener título— ni que existe.
 */
function tituloLegible(fila: PublicationRequest): string {
	const titulo = fila.dataset_title;
	return titulo && titulo !== "unknown" ? titulo : "Dataset no disponible";
}

/**
 * La fila de la API como la cola la consume: es el **borde de presentación**, y por eso vive en un solo
 * lugar. La cola declara sus tipos como presentación —`dataset_title` obligatorio porque siempre se dibuja,
 * `organization_title` opcional porque la fila se lee sin organización—, mientras la fila de la API espeja
 * el contrato y admite los huecos. Traducir de una a la otra acá evita que cada consumidor improvise su
 * propia versión del fallback.
 */
function paraLaCola(fila: PublicationRequest): PublicationQueueItem {
	return {
		id: fila.id,
		dataset_id: fila.dataset_id,
		dataset_title: tituloLegible(fila),
		organization_title: fila.organization_title ?? undefined,
		requested_by: fila.requested_by ?? undefined,
		requested_by_name: fila.requested_by_name ?? undefined,
		approved_by_name: fila.approved_by_name ?? undefined,
		created_at: fila.created_at ?? undefined,
		status: fila.status,
		comments: fila.comments ?? null,
	};
}

/**
 * El cargador de la cola.
 *
 * La **primera** llamada trae las filas y con ellas arma el filtro; las siguientes responden de memoria, así
 * que cambiar de organización no cuesta otra llamada ni puede mostrar dos listados distintos. El filtro se
 * aplica **acá** y no en el componente: la cola no sabe de organizaciones, recibe las filas que le tocan.
 */
const list = async (status?: PublicationRequest["status"]): Promise<PublicationQueueItem[]> => {
	if (filas === null) {
		filas = await publicationApi.list(status);
	}
	const visibles =
		orgElegida === null ? filas : filas.filter((fila) => fila.organization_title === orgElegida);
	return visibles.map(paraLaCola);
};

const decide = async (requestId: string, approve: boolean, comments?: string) =>
	paraLaCola(await publicationApi.decide(requestId, approve, comments));

/** La relectura que confirma una aprobación: la fila de `decide` no trae el dataset. */
const readDataset = (id: string) => datasetApi.show(id);

onMount(() => {
	if (!get(isAuthenticated)) {
		void goto("/auth/login");
		return;
	}
	authed = true;
	void comprobarSesion();
});

async function comprobarSesion() {
	const check = await createSessionApi(makeClient()).check();
	if (check.state === "dead") {
		// Limpiar **antes** de navegar, igual que el panel: el guard de `/auth/login` reenvía a quien todavía
		// tiene un token guardado, y navegar primero produciría un bucle de redirección.
		await endInvalidSession("/dashboard/requests");
		return;
	}
	comprobando = false;
}

function elegirOrg(org: string | null) {
	orgElegida = org;
	clave += 1;
}
</script>

<svelte:head>
	<title>Solicitudes de publicación — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
		{#if authed && !comprobando}
			<Breadcrumb
				items={[{ label: "Panel", href: "/dashboard" }, { label: "Solicitudes de publicación" }]}
				icon={Inbox}
			/>

			<header class="mt-5">
				<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">
					Solicitudes de publicación
				</h1>
				<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Las solicitudes pendientes de las organizaciones donde usted administra. Revise cada una
					para aprobarla, o para rechazarla con un motivo.
				</p>
			</header>

			{#if hayFiltro}
				<div class="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por organización">
					<button
						type="button"
						aria-pressed={orgElegida === null}
						onclick={() => elegirOrg(null)}
						class={cn(
							"inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
							orgElegida === null
								? "border-primary bg-primary text-primary-foreground"
								: "border-border bg-card text-foreground hover:bg-accent",
						)}
					>
						Todas las organizaciones
					</button>
					{#each organizaciones as organizacion (organizacion)}
						<button
							type="button"
							aria-pressed={orgElegida === organizacion}
							onclick={() => elegirOrg(organizacion)}
							class={cn(
								"inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
								orgElegida === organizacion
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-card text-foreground hover:bg-accent",
							)}
						>
							{organizacion}
						</button>
					{/each}
				</div>
			{/if}

			<Card class="mt-6 p-5">
				{#key clave}
					<PublicationQueue {list} {decide} {readDataset} now={ahora} secciones expansion="primera" />
				{/key}
			</Card>
		{:else}
			<p class="text-sm text-muted-foreground" aria-busy="true">Comprobando la sesión…</p>
		{/if}
	</div>
</div>
