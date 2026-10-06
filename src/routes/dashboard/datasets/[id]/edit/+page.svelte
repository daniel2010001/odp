<script lang="ts">
import { Info, LoaderCircle, RotateCw, TriangleAlert } from "@lucide/svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { type CkanClient, createCkanClient } from "$lib/api/client";
import { createDatasetApi, isEditConflict } from "$lib/api/datasets";
import { type AccessContext, describeFailure, type FailurePresentation } from "$lib/api/failure";
import { createLicenseApi } from "$lib/api/licenses";
import { createOrganizationApi, type UpdateDatasetPermission } from "$lib/api/organizations";
import { createSessionApi } from "$lib/api/session";
import DatasetForm, { type DatasetFormInitial } from "$lib/components/datasets/DatasetForm.svelte";
import { env } from "$lib/env";
import type { DatasetCreateInput } from "$lib/schemas/dataset";
import { endInvalidSession } from "$lib/session-guard";
import { auth, isAuthenticated } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanLicense, CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { ownerOrgIdOf } from "$lib/utils/ckan";
import { buildRevisePayload, toLoadedDataset } from "$lib/utils/dataset-payload";
import { SUMMARY_EXTRA_KEY } from "$lib/utils/dataset-summary";

// ─── Copy de los estados en los que el formulario NO se puede justificar ──
// Un rechazo nunca se sustituye por una lista vacía ni por un formulario a medias: el lector merece
// el motivo, no una pantalla que finja que todo está en orden.
const COPY = {
	extras:
		"No se pudieron leer los campos adicionales de este dataset. Editar sin ellos podría duplicar el resumen, así que la edición está deshabilitada.",
	version:
		"No se pudo leer la versión actual del dataset. Sin ese dato, guardar podría pisar un cambio hecho por otra persona.",
	noPermission: "Su cuenta no tiene permiso para modificar los datasets de esta organización.",
	permissionUnknown:
		"No se pudo verificar si su cuenta puede modificar este dataset. La edición queda deshabilitada hasta poder confirmarlo.",
};

let authed = $state(false);
let loading = $state(true);
let failure = $state<FailurePresentation | null>(null);
let refusal = $state<string | null>(null);
let permission = $state<UpdateDatasetPermission | null>(null);
let pkg = $state<CkanPackage | null>(null);
let initial = $state<DatasetFormInitial>({});
let organizations = $state<CkanOrganization[]>([]);
let ownerOrgId = $state("");
let licenses = $state<CkanLicense[]>([]);
let licensesLoading = $state(false);
let licensesError = $state<string | null>(null);
let tagSugerencias = $state<string[]>([]);
let submitting = $state(false);
let submitError = $state<string | null>(null);
let conflict = $state(false);
// Contexto de la sonda para los textos de `$lib/api/failure`. No concluyente hasta que la sonda diga otra cosa.
let access: AccessContext = "unknown";

function makeClient() {
	return createCkanClient({ baseUrl: env.CKAN_URL, apiKey: () => get(auth).token });
}

// El id de la ruta es la dependencia de la carga: si SvelteKit reutiliza este componente para una
// navegación entre dos URLs de edición, el efecto vuelve a correr y `cargar()` reemplaza todo lo que
// pertenecía al dataset anterior (ver el reset al inicio de `cargar`). Sin esto el formulario seguiría
// atado al dataset viejo y el guardado lo revisaría a él, no al `id` de la URL.
const datasetId = $derived($page.params.id);

// Cada carga pertenece a una generación: si el id cambia con una carga en vuelo, la vieja queda
// obsoleta y ninguna de sus respuestas puede pisar a la nueva. Una recarga sin generación abre una nueva.
let loadId = 0;
$effect(() => {
	void datasetId;
	const generation = ++loadId;
	if (!get(isAuthenticated)) {
		void goto("/auth/login");
		return;
	}
	authed = true;
	void iniciar(generation);
});

// La sonda corre **antes** de cargar: `inconclusive` (5xx, timeout, red) no expulsa a nadie
// autenticado; sólo una sesión muerta vuelve al login, por el camino único.
async function iniciar(generation: number) {
	const token = get(auth).token;
	const check = await createSessionApi(makeClient()).check();
	if (generation !== loadId) return;

	if (check.state === "dead") {
		await endInvalidSession(`/dashboard/datasets/${$page.params.id}/edit`);
		return;
	}
	if (check.state === "alive" && token) auth.login(token, check.user);
	access = check.state === "alive" ? "session-alive" : "unknown";
	await cargar(generation);
}

/** Carga el dataset, pregunta el permiso y, sólo si todo es afirmativo, siembra el formulario. */
async function cargar(generation: number = ++loadId) {
	loading = true;
	failure = null;
	refusal = null;
	permission = null;
	pkg = null;
	initial = {};
	organizations = [];
	conflict = false;
	submitError = null;
	// Cada generación es dueña de las banderas que enciende: la nueva parte en cero aunque no llegue a
	// pedir licencias ni etiquetas, y así el `finally` de una generación obsoleta no deja una bandera
	// encendida que ya nadie apagará. Sólo la generación actual puede volver a tocarlas.
	licenses = [];
	licensesLoading = false;
	licensesError = null;
	tagSugerencias = [];

	const client = makeClient();

	// El router no produce un `id` vacío en esta ruta, pero el tipo sí lo permite. Sin id no hay
	// dataset que cargar, así que se cae al mismo camino honesto que un 404 en vez de dejar la
	// página muda afirmando que todo va bien.
	if (!datasetId) {
		failure = describeFailure(new CkanApiError("Missing dataset id", 404), "dataset", access);
		loading = false;
		return;
	}

	let paquete: CkanPackage;
	try {
		paquete = await createDatasetApi(client).show(datasetId);
	} catch (err) {
		// Un 403/404 o un fallo de transporte se cuentan con el vocabulario compartido, no con prosa nueva.
		if (generation !== loadId) return;
		failure = describeFailure(err, "dataset", access);
		loading = false;
		return;
	}
	if (generation !== loadId) return;

	const verificacion = toLoadedDataset(paquete);
	if (!verificacion.ok) {
		refusal = verificacion.reason === "extras_unavailable" ? COPY.extras : COPY.version;
		loading = false;
		return;
	}

	pkg = paquete;
	ownerOrgId = ownerOrgIdOf(paquete);
	// El formulario resuelve el título de la organización por `org.name`; el paquete la embebe.
	organizations = paquete.organization ? [paquete.organization] : [];
	initial = {
		title: paquete.title,
		name: paquete.name,
		// El resumen vive en el extra `SUMMARY_EXTRA_KEY`. Se lee la lista **verificada**: un fallback a
		// un extracto de `notes` sembraría un resumen que no existe y el guardado lo escribiría.
		summary:
			verificacion.dataset.extras.find((extra) => extra.key === SUMMARY_EXTRA_KEY)?.value ?? "",
		notes: paquete.notes,
		owner_org: paquete.organization?.name ?? ownerOrgId,
		license_id: paquete.license_id,
		tags: paquete.tags.map((tag) => tag.name),
		url: paquete.url,
		maintainer: paquete.maintainer,
		maintainer_email: paquete.maintainer_email,
	};

	// Pregunta de permiso, fail-closed: `unknown` no es un permiso y no habilita el formulario.
	const permiso = await createOrganizationApi(client).canUpdateDatasetIn(ownerOrgId);
	if (generation !== loadId) return;
	permission = permiso;

	if (permission === "may") {
		await Promise.all([cargarLicencias(client, generation), cargarEtiquetas(client, generation)]);
		if (generation !== loadId) return;
	}
	loading = false;
}

async function cargarLicencias(client: CkanClient, generation: number) {
	licensesLoading = true;
	licensesError = null;
	try {
		const lista = await createLicenseApi(client).list();
		if (generation !== loadId) return;
		licenses = lista;
	} catch (err) {
		if (generation !== loadId) return;
		licenses = [];
		// El diagnóstico va a la consola en **todos** los modos: en producción es el único registro
		// disponible, y el texto crudo del servidor no puede entrar a la oración visible.
		console.error("No se pudo cargar la lista de licencias:", err);
		licensesError = "No se pudo cargar la lista de licencias.";
	} finally {
		if (generation === loadId) licensesLoading = false;
	}
}

async function cargarEtiquetas(client: CkanClient, generation: number) {
	try {
		const sugerencias = await createDatasetApi(client).tagSuggestions();
		if (generation !== loadId) return;
		tagSugerencias = sugerencias;
	} catch {
		// La sugerencia es cosmética: un rechazo deja la lista vacía en vez de escapar de `cargar` y
		// dejar la página cargando para siempre. No se inventa mensaje porque no hay nada que decir.
		if (generation !== loadId) return;
		tagSugerencias = [];
	}
}

// ─── Copy de los fallos de guardado ──────────────────────────────────
// Un fallo conocido se dice con su causa y con lo que el lector puede hacer; sólo lo inesperado cae
// en el reintento genérico. Un 5xx, un timeout o una caída de red no observaron respuesta del
// catálogo, así que no se les atribuye una causa. El reintento no es ciego igual: el `match` del
// guardado lleva el `metadata_modified` cargado, de modo que un cambio ya aplicado se rinde como
// conflicto en vez de pisar el estado nuevo.
function describeSaveError(err: unknown): string {
	// El diagnóstico va a la consola en todos los modos; el texto crudo del servidor no entra a la
	// oración visible.
	console.error("No se pudo guardar el dataset:", err);
	if (err instanceof CkanApiError) {
		if (err.status === 403) {
			return "No se pudo guardar el dataset: su cuenta no tiene permiso para modificar este dataset.";
		}
		// Un 400/409/422 es una respuesta definitiva al payload: corregir los campos cambia el
		// resultado, reintentar lo mismo no. El conflicto de `metadata_modified` ya lo atendió
		// `isEditConflict`, así que lo que llega acá es validación de esquema.
		if (err.status === 400 || err.status === 409 || err.status === 422) {
			return "No se pudo guardar el dataset: el catálogo rechazó los cambios. Revise los campos del formulario e intente nuevamente.";
		}
	}
	return "No se pudo guardar el dataset. Verifique los valores actuales del dataset antes de reintentar.";
}

// ─── Guardado ────────────────────────────────────────────────────────
async function handleSubmit(data: DatasetCreateInput) {
	if (!pkg || conflict) return;
	submitting = true;
	submitError = null;
	try {
		// El `match` lleva el `metadata_modified` **cargado con el formulario**: nunca se relee, porque
		// releerlo anularía la precondición de concurrencia.
		const payload = buildRevisePayload({
			dataset: pkg,
			input: {
				title: data.title,
				name: data.name,
				notes: data.notes,
				summary: data.summary,
				license_id: data.license_id,
				tag_string: data.tag_string,
				url: data.url,
				maintainer: data.maintainer,
				maintainer_email: data.maintainer_email,
			},
		});
		const guardado = await createDatasetApi(makeClient()).revise(payload);
		await goto(`/dataset/${guardado.name}`);
	} catch (err) {
		if (isEditConflict(err)) {
			// El formulario ya no conoce el estado del dataset: se bloquea hasta recargarlo.
			conflict = true;
		} else {
			submitError = describeSaveError(err);
		}
	} finally {
		submitting = false;
	}
}

function handleCancel() {
	void goto(pkg ? `/dataset/${pkg.name}` : "/dashboard");
}
</script>

<svelte:head>
	<title>Editar dataset — UMSS</title>
</svelte:head>

{#if authed}
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		<header class="mb-8">
			<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">Editar dataset</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Modifique los metadatos del dataset. La organización dueña y la visibilidad no se editan acá.
			</p>
		</header>

		{#if loading}
			<div
				class="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground"
				role="status"
				aria-live="polite"
			>
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
				Cargando el dataset...
			</div>
		{:else if failure}
			<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center" role="alert">
				<TriangleAlert class="mx-auto size-6 text-destructive" aria-hidden="true" />
				<p class="mt-2 text-sm font-medium text-destructive">{failure.title}</p>
				<p class="mt-1 text-xs text-muted-foreground">{failure.message}</p>
			</div>
		{:else if refusal}
			<div class="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center" role="alert">
				<TriangleAlert class="mx-auto size-6 text-destructive" aria-hidden="true" />
				<p class="mt-2 text-sm text-foreground">{refusal}</p>
			</div>
		{:else if permission === "may_not"}
			<div class="rounded-xl border border-border bg-card p-8 text-center" role="alert">
				<Info class="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
				<p class="mt-2 text-sm font-medium text-foreground">{COPY.noPermission}</p>
			</div>
		{:else if permission === "unknown"}
			<div class="rounded-xl border border-border bg-card p-8 text-center" role="alert">
				<TriangleAlert class="mx-auto size-6 text-destructive" aria-hidden="true" />
				<p class="mt-2 text-sm font-medium text-foreground">{COPY.permissionUnknown}</p>
				<button
					type="button"
					onclick={() => void cargar()}
					class="mt-4 inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<RotateCw class="size-4" aria-hidden="true" />
					Reintentar
				</button>
			</div>
		{:else if permission === "may" && pkg}
			{#if conflict}
				<div class="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6" role="alert">
					<TriangleAlert class="size-5 text-destructive" aria-hidden="true" />
					<h2 class="mt-2 font-heading text-lg font-semibold text-destructive">
						El dataset cambió desde que abrió este formulario.
					</h2>
					<p class="mt-1 text-sm text-destructive">
						No se guardó ningún cambio. Recargue para ver los valores actuales y rehaga la edición.
					</p>
					<button
						type="button"
						onclick={() => void cargar()}
						class="mt-4 inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<RotateCw class="size-4" aria-hidden="true" />
						Recargar el formulario
					</button>
				</div>
			{/if}

			<DatasetForm
				mode="edit"
				{initial}
				{organizations}
				{licenses}
				{licensesLoading}
				{licensesError}
				tagSuggestions={tagSugerencias}
				ownerOrg={ownerOrgId}
				{submitting}
				bind:submitError
				locked={conflict}
				onsubmit={handleSubmit}
				oncancel={handleCancel}
			/>
		{/if}
	</div>
{/if}
