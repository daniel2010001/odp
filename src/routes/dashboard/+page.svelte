<script lang="ts">
import {
	ArrowRight,
	Building2,
	ChevronLeft,
	ChevronRight,
	Database,
	Inbox,
	Lock,
	Plus,
	RotateCw,
	ShieldCheck,
	TriangleAlert,
} from "@lucide/svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { createCkanClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createOrganizationApi } from "$lib/api/organizations";
import { createSessionApi } from "$lib/api/session";
import OrganizationLogo from "$lib/components/organizations/OrganizationLogo.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { env } from "$lib/env";
import { endInvalidSession } from "$lib/session-guard";
import { auth, currentUser, isAuthenticated, isSuperAdmin } from "$lib/stores/auth";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { formatDate } from "$lib/utils/ckan";

// ─── Estado ──────────────────────────────────────────────────────────
// Tamaño de página acordado para «Mis datasets»: 20, igual que el default de `package_search`.
const PAGE_SIZE = 20;

let authed = $state(false);
let datasets = $state<CkanPackage[]>([]);
let datasetsLoading = $state(true);
let datasetsError = $state<string | null>(null);
let pagina = $state(1);
let totalDatasets = $state(0);
let organizations = $state<CkanOrganization[]>([]);
let orgsLoading = $state(true);
let orgsError = $state<string | null>(null);
// La sonda resolvió y **no** declaró la sesión muerta. El nombre es modesto a propósito: significa
// «comprobada y no declarada muerta», no «viva» —una sonda inconclusa (5xx, timeout, red) también
// abre el panel—. Sólo esta bandera habilita mostrar identidad (saludo y badge): mientras la sonda
// está en vuelo la sesión guardada todavía puede ser una sesión muerta, y nada suyo debe renderizarse.
let sessionNotDead = $state(false);
// Respuesta a la **misma** pregunta que hace el asistente (`organization_list_for_user` con
// `permission: "create_dataset"`). Arranca en `false` y sólo el éxito la cambia: fail closed.
let puedeCrear = $state(false);
// ¿Se pudo hacer la pregunta de permiso? Un fallo (o la pregunta todavía en vuelo) deja el asunto
// abierto, así que la copia no puede afirmar que falte un rol.
let permisoResuelto = $state(false);

// ─── Cliente CKAN autenticado ────────────────────────────────────────
function makeClient() {
	return createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token });
}

// ─── Guard de auth + carga inicial ───────────────────────────────────
onMount(() => {
	if (!get(isAuthenticated)) {
		void goto("/auth/login");
		return;
	}
	authed = true;
	void iniciarPanel();
});

// La sonda corre **antes** de cualquier decisión. Medido (2026-09-20): un token muerto y un usuario
// vivo sin organizaciones reciben de CKAN el mismo `200 []`, así que sin la sonda el panel no puede
// distinguir «no tengo organizaciones» de «mi sesión murió»: ofrece publicar a una sesión caída (D3)
// y el asistente diagnostica un permiso inexistente (D2).
async function iniciarPanel() {
	// El token se lee **una sola vez** y sólo se reescribe si existe: `login("", …)` persistiría una
	// sesión vacía en el almacenamiento, un estado que el guard de `/auth/login` no puede distinguir de
	// una sesión real y que expulsaría al usuario en el siguiente montaje.
	const token = get(auth).token;
	const check = await createSessionApi(makeClient()).check();

	if (check.state === "dead") {
		// Limpiar **antes** de navegar: el guard de `/auth/login` reenvía al dashboard a quien todavía
		// tiene un token guardado, así que navegar primero produciría un bucle de redirección.
		await endInvalidSession("/dashboard");
		return;
	}

	// La sonda resolvió sin declarar la sesión muerta: recién ahora se puede mostrar identidad. No
	// significa «viva» (una sonda inconclusa también abre el panel), sí «comprobada y no muerta».
	sessionNotDead = true;

	if (check.state === "alive" && token) {
		// El llamador que devolvió la sonda **es** la identidad: se refresca el store con él para que
		// `$currentUser` siga siendo la única fuente y no sobreviva un usuario local obsoleto.
		auth.login(token, check.user);
	}

	// `inconclusive` (5xx, timeout, red): un hipo de CKAN no expulsa a nadie autenticado. Se carga
	// con la sesión guardada, sin limpiarla ni navegar.
	void loadDatasets();
	void loadOrganizations();
	void loadCreatePermission();
}

async function loadDatasets(permitirCorreccion = true) {
	datasetsLoading = true;
	datasetsError = null;
	try {
		const client = makeClient();
		const datasetApi = createDatasetApi(client);
		const userId = get(currentUser)?.id;
		if (!userId) {
			// Sesión local corrupta: hay token pero no identidad. Medido, para la UI es la misma
			// condición que un token muerto (la sonda `dead` respondió 404), así que va por el mismo
			// camino —una condición, un mensaje, una ruta— en vez de un segundo diagnóstico.
			await endInvalidSession("/dashboard");
			return;
		}
		const result = await datasetApi.currentUser(userId, {
			limit: PAGE_SIZE,
			offset: (pagina - 1) * PAGE_SIZE,
		});
		// Caso límite: si el `count` devuelto deja la página pedida más allá de la última (por
		// ejemplo, borraron lo que quedaba en la última página), volvemos a la última válida y
		// recargamos una sola vez. Mostrar la lista vacía con un rango «41–40 de 40» sería peor:
		// el rango se ve legítimo y no habría forma de volver desde la UI.
		const ultimaPagina = Math.max(1, Math.ceil(result.count / PAGE_SIZE));
		if (pagina > ultimaPagina && permitirCorreccion) {
			pagina = ultimaPagina;
			await loadDatasets(false);
			return;
		}
		datasets = result.results;
		totalDatasets = result.count;
	} catch (err) {
		datasets = [];
		datasetsError = err instanceof Error ? err.message : "No se pudo cargar sus datasets.";
	} finally {
		datasetsLoading = false;
	}
}

function irAPagina(nueva: number) {
	pagina = nueva;
	void loadDatasets();
}

async function loadOrganizations() {
	orgsLoading = true;
	orgsError = null;
	try {
		const client = makeClient();
		const orgApi = createOrganizationApi(client);
		organizations = await orgApi.listForUser();
	} catch (err) {
		organizations = [];
		orgsError = err instanceof Error ? err.message : "No se pudieron cargar sus organizaciones.";
	} finally {
		orgsLoading = false;
	}
}

// Carga que sólo responde una pregunta: ¿puede crear datasets? Va aparte de `loadOrganizations`
// porque la tarjeta «Mis organizaciones» lista **toda** membresía (con su rol), y esa lista incluye
// capacidades que no pueden crear. Su fallo es fail closed —`puedeCrear` queda en `false`— y **no**
// toca `organizations`: un problema de permiso no debe borrar una lista de membresías que sí cargó.
async function loadCreatePermission() {
	try {
		const client = makeClient();
		const orgApi = createOrganizationApi(client);
		puedeCrear = await orgApi.canCreateDataset();
		permisoResuelto = true;
	} catch {
		// Pregunta sin respuesta: no se ofrece publicar y la copia no afirma nada sobre el rol.
		puedeCrear = false;
		permisoResuelto = false;
	}
}

// ─── ¿Se puede ofrecer publicar? ─────────────────────────────────────
// Una sola condición para las tres superficies que ofrecen publicar (la grilla, la barra pegajosa y
// el CTA del estado vacío). NO alcanza con pertenecer a una organización: medido contra CKAN
// (2026-09-20), un `capacity: "member"` figura en `organization_list_for_user {}` pero no en
// `{permission:"create_dataset"}`, así que la oferta colgaba de una pregunta más amplia que la
// acción que ofrece (D3). `puedeCrear` responde la pregunta exacta del asistente y su loader es fail
// closed. Sin organización donde crear, el wizard fallaría (D3), así que el panel no anuncia nada que
// el backend todavía no pueda cumplir (ver BACKLOG.md).
const puedePublicar = $derived(!orgsLoading && puedeCrear);

// «No tiene ninguna organización» es una **afirmación**, no un fallo: sólo se puede hacer con la carga
// terminada, sin error y con la lista vacía. Un fallo deja la pregunta abierta —¿tiene o no?—, así que
// el estado vacío conserva la copia neutra y el panel de error dice, honestamente, que no se pudo saber.
const confirmedNoOrganizations = $derived(!orgsLoading && !orgsError && organizations.length === 0);

// El usuario sí pertenece a organizaciones, pero en ninguna puede crear. Exige la pregunta de permiso
// **respondida** (no alcanza con `puedeCrear === false`, porque eso también es el estado de carga o de
// fallo): si no se pudo preguntar, la copia no puede afirmar que falte el rol.
const confirmedNoCreatePermission = $derived(
	!orgsLoading && !orgsError && organizations.length > 0 && permisoResuelto,
);

// Sólo acciones que existen: la grilla ya está preparada para crecer cuando cada CRUD aterrice.
const actions = $derived(
	puedePublicar
		? [
				{
					title: "Publicar dataset",
					description: "Cree un dataset y suba sus recursos con el asistente.",
					href: "/dashboard/datasets/new",
					icon: Database,
				},
			]
		: [],
);

// ─── Barra de acciones pegajosa ──────────────────────────────────────
// El centinela vive justo después de la grilla: cuando queda detrás de la barra, la barra aparece;
// al volver a subir, se esconde.
//
// Ojo con la condición (medido en Chromium): con `rootMargin` igual a `STICKY_TOP_PX` el callback
// llega cuando el centinela cruza esa altura, y en ese momento `boundingClientRect.top` todavía es
// **positivo** (+22 en la medición). Comparar contra 0 nunca se cumple y la barra no aparece.
const HEADER_PX = 80; // altura del encabezado del sitio (`h-20` del layout)
const STICKY_GAP_PX = 8; // aire aprobado entre el encabezado y la barra (`pt-2`)
const STICKY_TOP_PX = HEADER_PX + STICKY_GAP_PX;

let actionsSentinel: HTMLDivElement | undefined = $state();
let actionsStuck = $state(false);

$effect(() => {
	if (!actionsSentinel) return;
	if (typeof IntersectionObserver === "undefined") return;

	const observer = new IntersectionObserver(
		([entry]) => {
			// `top < STICKY_TOP_PX` distingue «quedó arriba, detrás de la barra» de «todavía está más
			// abajo del pliegue» (viewport chico o página corta), que no debe mostrar la barra.
			actionsStuck = !entry.isIntersecting && entry.boundingClientRect.top < STICKY_TOP_PX;
		},
		{ rootMargin: `-${STICKY_TOP_PX}px 0px 0px 0px` },
	);
	observer.observe(actionsSentinel);
	return () => observer.disconnect();
});

// ─── Etiquetas de las filas ──────────────────────────────────────────
const datasetCountLabel = (count: number) => (count === 1 ? "1 recurso" : `${count} recursos`);

const packageCountLabel = (count: number) => (count === 1 ? "1 dataset" : `${count} datasets`);

const capacityLabel: Record<string, string> = {
	admin: "Administrador",
	editor: "Editor",
	member: "Miembro",
};

function siglaOf(organization: CkanOrganization): string | undefined {
	return organization.extras?.find((extra) => extra.key === "sigla")?.value;
}
</script>

<svelte:head>
	<title>Panel — UMSS</title>
</svelte:head>

{#if authed}
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		<!-- Encabezado -->
		<!-- Identidad sólo cuando la sonda resolvió sin declarar la sesión muerta: el saludo y el badge
		     salen de la sesión guardada, que mientras la sonda está en vuelo todavía puede ser una sesión
		     que CKAN ya no acepta. El panel sigue siendo responsivo: no se bloquea la página entera. -->
		{#if sessionNotDead}
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">
					Hola, {$currentUser?.display_name || $currentUser?.name}
				</h1>
				{#if $isSuperAdmin}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30"
					>
						<ShieldCheck class="size-3.5" aria-hidden="true" />
						Administrador
					</span>
				{/if}
			</div>
		{/if}
		<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
			Este es su panel personal. Desde aquí publica datasets y revisa las organizaciones a las que
			pertenece.
		</p>

		<!-- Acciones: la sección entera —encabezado, grilla, centinela y barra pegajosa— existe sólo
		     cuando hay al menos una acción. La barra nunca puede quedar vacía y el centinela/observer
		     no se registra si no hay acción. -->
		{#if actions.length > 0}
		<section aria-labelledby="actions-heading" class="mt-8">
			<h2 id="actions-heading" class="text-xs font-medium uppercase tracking-wider text-destructive">
				Acciones
			</h2>

			<div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{#each actions as action (action.title)}
					<a
						href={action.href}
						class="group flex items-start gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<span
							class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
						>
							<action.icon class="size-5" aria-hidden="true" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="flex items-center gap-2">
								<span class="font-heading text-base font-semibold text-primary">
									{action.title}
								</span>
								<ArrowRight
									class="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
									aria-hidden="true"
								/>
							</span>
							<span class="mt-1 block text-xs leading-relaxed text-muted-foreground">
								{action.description}
							</span>
						</span>
					</a>
				{/each}
			</div>

			<!-- Centinela: marca el momento en que la grilla deja de estar a la vista. -->
			<div bind:this={actionsSentinel} class="h-px" aria-hidden="true"></div>

			<!-- Barra de acciones pegajosa: se pega en `top-20` más el aire elegido (`pt-2`). Mientras
			     está oculta, `inert` la saca del foco y de los clics. El `pointer-events-none` del
			     contenedor evita que el aire transparente se trague los clics del contenido detrás. -->
			<div
				class={cn(
					"pointer-events-none fixed inset-x-0 top-20 z-30 px-4 pt-2 transition-all duration-200 ease-out sm:px-6 lg:px-8",
					actionsStuck ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
				)}
				inert={!actionsStuck}
			>
				<div
					class="pointer-events-auto mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur"
					data-sticky-actions=""
				>
					<span
						class="hidden shrink-0 pl-2 pr-1 text-xs font-medium uppercase tracking-wider text-destructive lg:inline"
					>
						Acciones
					</span>
					{#each actions as action (action.title)}
						<a
							href={action.href}
							class="inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-card px-3 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:justify-start"
						>
							<Plus class="size-4" aria-hidden="true" />
							{action.title}
						</a>
					{/each}
				</div>
			</div>
		</section>
		{/if}

		<div class="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
			<!-- Mis datasets -->
			<section aria-labelledby="datasets-heading" class="min-w-0">
				<div class="flex items-center gap-3">
					<span
						class="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<Database class="size-4" aria-hidden="true" />
					</span>
					<h2 id="datasets-heading" class="font-heading text-lg font-semibold text-primary">
						Mis datasets
					</h2>
					<span
						class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
					>
						{datasetsLoading ? "—" : totalDatasets}
					</span>
				</div>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					Los datasets que usted creó.
				</p>

				<Card class="mt-4 p-2">
					{#if datasetsLoading}
						<div role="status" aria-live="polite">
							<span class="sr-only">Cargando datasets...</span>
							{#each [0, 1, 2] as row (row)}
								<div class="flex items-center gap-3 rounded-lg px-3 py-4">
									<div class="size-10 shrink-0 animate-pulse rounded-lg bg-muted"></div>
									<div class="min-w-0 flex-1 space-y-2">
										<div class="h-3.5 w-2/5 animate-pulse rounded bg-muted"></div>
										<div class="h-3 w-3/5 animate-pulse rounded bg-muted"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if datasetsError}
						<div class="p-6 text-center" role="alert">
							<TriangleAlert class="mx-auto size-6 text-destructive" aria-hidden="true" />
							<p class="mt-2 text-sm font-medium text-destructive">
								No se pudieron cargar sus datasets
							</p>
							<p class="mx-auto mt-1 max-w-md break-words text-xs text-muted-foreground">
								{datasetsError}
							</p>
							<button
								type="button"
								onclick={() => loadDatasets()}
								class="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<RotateCw class="size-4" aria-hidden="true" />
								Reintentar
							</button>
						</div>
					{:else if datasets.length === 0}
						<div class="p-8 text-center">
							<Inbox class="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
							<p class="mt-2 text-sm font-medium text-foreground">Publique su primer dataset</p>
							<!-- Cuatro estados, no dos: mientras las organizaciones cargan todavía **no sabemos** si
							     el usuario tiene una; si la carga falló tampoco; y si la pregunta de permiso quedó sin
							     responder, tampoco. En esos casos el estado vacío no puede afirmar nada sobre el requisito
							     y conserva la copia neutra. La frase de «pertenecer» sólo es cierta con la lista
							     terminada, sin error y vacía (`confirmedNoOrganizations`); la de «rol de editor o
							     administrador», con la lista no vacía y la pregunta de permiso respondida
							     (`confirmedNoCreatePermission`). -->
							<p class="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
								{#if puedePublicar}
									Aún no ha creado ningún dataset. El asistente lo guía paso a paso.
								{:else if confirmedNoOrganizations}
									Aún no ha creado ningún dataset. El asistente lo guía paso a paso. Publicar un dataset
									requiere pertenecer a una organización.
								{:else if confirmedNoCreatePermission}
									Aún no ha creado ningún dataset. El asistente lo guía paso a paso. Publicar un dataset
									requiere rol de editor o administrador en una organización.
								{:else}
									Aún no ha creado ningún dataset. El asistente lo guía paso a paso.
								{/if}
							</p>
							{#if puedePublicar}
								<a
									href="/dashboard/datasets/new"
									class="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<Plus class="size-4" aria-hidden="true" />
									Publicar dataset
								</a>
							{/if}
						</div>
					{:else}
						<ul class="space-y-1">
							{#each datasets as dataset (dataset.id)}
								<li>
									<a
										href={`/dataset/${dataset.name}`}
										class="group flex items-center gap-3 rounded-lg px-3 py-4 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
									>
										<span
											class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary"
										>
											<Database class="size-4" aria-hidden="true" />
										</span>
										<span class="min-w-0 flex-1">
											<span
												class="line-clamp-2 break-words text-sm font-medium text-foreground group-hover:text-primary"
											>
												{dataset.title}
											</span>
											<span class="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
												{datasetCountLabel(dataset.resources.length)} · Actualizado el {formatDate(
													dataset.metadata_modified,
												)}
											</span>
										</span>
										{#if dataset.private}
											<span
												class="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
											>
												<Lock class="size-3" aria-hidden="true" />
												Privado
											</span>
										{/if}
										<ChevronRight
											class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
											aria-hidden="true"
										/>
									</a>
								</li>
							{/each}
						</ul>
					{/if}

					<!-- Los controles viven **fuera** de la cadena de estados a propósito: si estuvieran dentro
					     del `{:else}` de la lista, desaparecerían en cada carga y los botones saltarían de lugar
					     con cada cambio de página. Mientras carga se muestran igual, deshabilitados. -->
					<!-- La excepción es el error: con el panel de error a la vista el pie se oculta, porque el rango
					     («21–40 de 137») describe filas que no se están mostrando, y ése es exactamente el reporte
					     engañoso que este trabajo vino a eliminar. Costo aceptado: si el fallo es persistente,
					     «Reintentar» vuelve a pedir la misma página, así que recuperar la página 1 exige recargar
					     (el número de página no viaja en la URL). -->
					{#if totalDatasets > PAGE_SIZE && !datasetsError}
						<div class="border-t border-border p-3">
							<div class="flex items-center justify-between gap-3">
								<button
									type="button"
									aria-label="Página anterior"
									disabled={datasetsLoading || pagina <= 1}
									onclick={() => irAPagina(pagina - 1)}
									class="inline-flex size-9 items-center justify-center rounded-lg border border-input bg-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
								>
									<ChevronLeft class="size-4" aria-hidden="true" />
								</button>
								<p class="text-xs text-muted-foreground" aria-live="polite">
									{(pagina - 1) * PAGE_SIZE + 1}–{Math.min(
										pagina * PAGE_SIZE,
										totalDatasets,
									)} de {totalDatasets}
								</p>
								<button
									type="button"
									aria-label="Página siguiente"
									disabled={datasetsLoading || pagina * PAGE_SIZE >= totalDatasets}
									onclick={() => irAPagina(pagina + 1)}
									class="inline-flex size-9 items-center justify-center rounded-lg border border-input bg-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
								>
									<ChevronRight class="size-4" aria-hidden="true" />
								</button>
							</div>
						</div>
					{/if}
				</Card>
			</section>

			<!-- Mis organizaciones -->
			<section aria-labelledby="organizations-heading" class="min-w-0">
				<div class="flex items-center gap-3">
					<span
						class="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"
					>
						<Building2 class="size-4" aria-hidden="true" />
					</span>
					<h2 id="organizations-heading" class="font-heading text-lg font-semibold text-primary">
						Mis organizaciones
					</h2>
					<span
						class="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
					>
						{orgsLoading ? "—" : organizations.length}
					</span>
				</div>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					Organizaciones de las que forma parte y el rol que tiene en cada una.
				</p>

				<Card class="mt-4 p-2">
					{#if orgsLoading}
						<div role="status" aria-live="polite">
							<span class="sr-only">Cargando organizaciones...</span>
							{#each [0, 1] as row (row)}
								<div class="flex items-center gap-3 rounded-lg px-3 py-4">
									<div class="size-10 shrink-0 animate-pulse rounded-lg bg-muted"></div>
									<div class="space-y-2">
										<div class="h-3.5 w-32 animate-pulse rounded bg-muted"></div>
										<div class="h-3 w-20 animate-pulse rounded bg-muted"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if orgsError}
						<div class="p-6 text-center" role="alert">
							<TriangleAlert class="mx-auto size-6 text-destructive" aria-hidden="true" />
							<p class="mt-2 text-sm font-medium text-destructive">
								No se pudieron cargar sus organizaciones
							</p>
							<p class="mx-auto mt-1 max-w-md break-words text-xs text-muted-foreground">
								{orgsError}
							</p>
							<button
								type="button"
								onclick={loadOrganizations}
								class="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<RotateCw class="size-4" aria-hidden="true" />
								Reintentar
							</button>
						</div>
					{:else if organizations.length === 0}
						<div class="p-8 text-center">
							<Inbox class="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
							<p class="mt-2 text-sm font-medium text-foreground">
								Aún no pertenece a ninguna organización
							</p>
							<p class="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
								Solicite a un administrador que lo agregue a una para publicar datasets.
							</p>
						</div>
					{:else}
						<ul class="space-y-1">
							{#each organizations as organization (organization.id)}
								<li>
									<a
										href={`/organization/${organization.name}`}
										class="group flex items-start gap-3 rounded-lg px-3 py-4 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
									>
										<OrganizationLogo
											imageUrl={organization.image_url}
											name={organization.title}
											abbr={siglaOf(organization)}
											class="size-10 shrink-0 bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary"
										/>
										<span class="min-w-0 flex-1">
											<span
												class="line-clamp-2 break-words text-sm font-medium text-foreground group-hover:text-primary"
											>
												{organization.title}
											</span>
											{#if organization.description}
												<span class="mt-1 line-clamp-1 block text-xs text-muted-foreground">
													{organization.description}
												</span>
											{/if}
											<span class="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
												{#if typeof organization.package_count === "number"}
													<span class="text-muted-foreground">
														{packageCountLabel(organization.package_count)}
													</span>
												{/if}
												{#if organization.capacity}
													<span
														class={cn(
															"rounded border px-1.5 py-0.5 text-[11px] font-medium",
															organization.capacity === "admin"
																? "border-primary/30 bg-primary/10 text-primary"
																: "border-border bg-muted text-muted-foreground",
														)}
													>
														{capacityLabel[organization.capacity] ?? organization.capacity}
													</span>
												{/if}
											</span>
										</span>
										<ChevronRight
											class="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
											aria-hidden="true"
										/>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</Card>
			</section>
		</div>
	</div>
{/if}
