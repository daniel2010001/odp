<!--
	Solicitudes de publicación — la cola del administrador de la organización, en su **propia page**.

	Existe porque **descubrir la cola es parte de la compuerta**: si un editor pide publicar y nadie ve la
	solicitud, la pared se vuelve un **bloqueo mudo**. La cola estaba en la hoja de revisión y en el panel; acá
	vive donde el trabajo se hace, con la presentación que el autor eligió (`RequestsQueue`, C1 de la hoja
	`/dev/requests`): las organizaciones como pestañas —que no aparecen cuando hay una sola: un filtro que no
	filtra es ruido—, «Mostrar» pendientes o resueltas, las pendientes en orden de llegada y, abierta una fila, el
	resumen de su dataset y el control de decidir.

	Las llamadas son las **reales**: `publication_request_list`, `_decide` y la relectura del dataset, todas de
	`$lib/api/publication` y `$lib/api/datasets`. La page pide el listado **una vez**; el filtro por organización
	y el de estado los aplica la cola sobre las filas cargadas.
-->
<script lang="ts">
import { Inbox } from "@lucide/svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { createPortalClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createPublicationApi, type PublicationRequest } from "$lib/api/publication";
import { createSessionApi } from "$lib/api/session";
import type { PublicationQueueItem } from "$lib/components/dataset/PublicationQueue.svelte";
import RequestsQueue from "$lib/components/requests/RequestsQueue.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { endInvalidSession } from "$lib/session-guard";
import { isAuthenticated } from "$lib/stores/auth";

function makeClient() {
	return createPortalClient();
}

const publicationApi = createPublicationApi(makeClient());
const datasetApi = createDatasetApi(makeClient());

// La antigüedad que la cola muestra sale de acá y se fija al montar: una lectura no debería ver dos
// antigüedades distintas para la misma fila según cuándo se dibujó.
const ahora = new Date();

let authed = $state(false);
let comprobando = $state(true);
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
		decided_at: fila.decided_at ?? undefined,
		status: fila.status,
		comments: fila.comments ?? null,
		// La respuesta del catálogo sobre la excepción de cuatro ojos (#74): sin ella la cola aplica la regla
		// vieja y bloquea la propia aunque quien mira sea el único que puede aprobarla.
		decidable_by_caller: fila.decidable_by_caller ?? null,
	};
}

/**
 * El cargador de la cola: una llamada, sin estado —pendientes y resueltas juntas; el catálogo ya acota lo visible—.
 * Cada vez que la cola pide la lista (al montar, «Reintentar», «Actualizar la lista») es una lectura nueva.
 */
const list = async (): Promise<PublicationQueueItem[]> =>
	(await publicationApi.list()).map(paraLaCola);

/** La decisión tal como el catálogo la devuelve; la cola la lee para dejar la fila resuelta. */
const decide = (requestId: string, approve: boolean, comments?: string) =>
	publicationApi.decide(requestId, approve, comments);

/** La relectura que confirma una aprobación y alimenta el resumen del dataset de la fila abierta. */
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
</script>

<svelte:head>
	<title>Solicitudes de publicación — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<!-- El ancho del panel (`max-w-7xl`): con `max-w-5xl` el contenedor de la cola no llega a los 64 rem en que las pestañas y «Mostrar» comparten fila. -->
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
					Las solicitudes de las organizaciones donde usted administra. Revise cada pendiente para
					aprobarla, o para rechazarla con un motivo; las resueltas quedan a continuación.
				</p>
			</header>

			<Card class="mt-6 p-5">
				<RequestsQueue {list} {decide} {readDataset} now={ahora} surface="card" />
			</Card>
		{:else}
			<p class="text-sm text-muted-foreground" aria-busy="true">Comprobando la sesión…</p>
		{/if}
	</div>
</div>
