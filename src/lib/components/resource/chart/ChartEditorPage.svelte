<script lang="ts">
import { FileText } from "@lucide/svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { type ChartView, createChartApi } from "$lib/api/charts";
import { createPortalClient } from "$lib/api/client";
import { createDatasetApi } from "$lib/api/datasets";
import { createDatastoreApi, type DatastoreField } from "$lib/api/datastore";
import {
	type AccessContext,
	classifyFailure,
	describeFailure,
	type FailurePresentation,
	failureActions,
	statusFor,
} from "$lib/api/failure";
import { createResourceApi } from "$lib/api/resources";
import { readColumnRange } from "$lib/charts/column-range";
import { isSupportedChartVersion } from "$lib/charts/contract";
import { draftFromConfig } from "$lib/charts/form";
import { canEditResourceCharts } from "$lib/charts/permission";
import ErrorPage from "$lib/components/error/ErrorPage.svelte";
import type { BreadcrumbItem } from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import { resolveUnauthorized, type UnauthorizedResolution } from "$lib/session-guard";
import { auth } from "$lib/stores/auth";
import type { CkanPackage, CkanResource } from "$lib/types/ckan";
import ChartForm from "./ChartForm.svelte";

// La página propia del formulario del publicador (L21): `…/charts/new` crea una vista y `…/charts/[viewId]/edit`
// edita una guardada. Las dos rutas son un envoltorio fino de este componente, porque el trabajo es el mismo:
// cargar el recurso y las columnas de su tabla, decidir si hay formulario que mostrar, y volver a la página del
// recurso al guardar o cancelar (L20, punto 3).
//
// Cada estado en que NO hay formulario se dice con la página de error del portal y su texto honesto:
//  · una falla del catálogo (con la misma sonda de sesión que la página del recurso);
//  · el usuario no puede editar (se dice aunque sea anónimo: no se confirma nada que la ficha no muestre);
//  · el recurso no tiene una tabla en el DataStore;
//  · la vista no existe, o es de una versión que el portal no conoce (no se edita lo que no se sabe dibujar).
let { mode }: { mode: "new" | "edit" } = $props();

type Outcome =
	| { kind: "loading" }
	| { kind: "expelled" }
	| { kind: "invalid-params" }
	| { kind: "failure"; presentation: FailurePresentation; access: AccessContext }
	| { kind: "forbidden" }
	| { kind: "no-table" }
	| { kind: "view-missing" }
	| { kind: "view-unsupported" }
	| { kind: "ready"; fields: DatastoreField[]; view: ChartView | null };

let outcome = $state<Outcome>({ kind: "loading" });
let resource = $state<CkanResource | null>(null);
let dataset = $state<CkanPackage | null>(null);

const datasetId = $derived($page.params.id);
const resourceId = $derived($page.params.resourceId);
const viewId = $derived($page.params.viewId);

const resourcePath = $derived(`/dataset/${datasetId}/resource/${resourceId}`);

/** El número de la última carga: si el usuario ya navegó a otra, la respuesta vieja se descarta. */
let loadSeq = 0;

async function load() {
	const seq = ++loadSeq;
	const stale = () => seq !== loadSeq;
	resource = null;
	dataset = null;

	if (!datasetId || !resourceId || (mode === "edit" && !viewId)) {
		outcome = { kind: "invalid-params" };
		return;
	}
	outcome = { kind: "loading" };

	const user = get(auth).user;
	const client = createPortalClient();

	const [resourceResult, datasetResult] = await Promise.allSettled([
		createResourceApi(client).show(resourceId),
		createDatasetApi(client).show(datasetId),
	]);
	if (stale()) return;

	if (resourceResult.status === "rejected") {
		const err = resourceResult.reason;
		let access: AccessContext = "anonymous";
		if (classifyFailure(err) === "unauthorized" && user) {
			let resolution: UnauthorizedResolution = "inconclusive";
			try {
				resolution = await resolveUnauthorized(client, err, user, $page.url.pathname);
			} catch {
				// Una navegación que falla no expulsa: ante la duda, la sesión queda intacta.
				resolution = "inconclusive";
			}
			if (stale()) return;
			if (resolution === "expelled") {
				outcome = { kind: "expelled" };
				return;
			}
			access = resolution === "alive" ? "session-alive" : "unknown";
		}
		outcome = { kind: "failure", presentation: describeFailure(err, "resource", access), access };
		return;
	}
	resource = resourceResult.value;
	dataset = datasetResult.status === "fulfilled" ? datasetResult.value : null;

	// Sin sesión, o sin permiso sobre la organización dueña: no hay formulario. El servidor lo exige igual.
	const allowed = user ? await canEditResourceCharts(client, dataset) : false;
	if (stale()) return;
	if (!allowed) {
		outcome = { kind: "forbidden" };
		return;
	}

	if (resourceResult.value.datastore_active !== true) {
		outcome = { kind: "no-table" };
		return;
	}

	let fields: DatastoreField[];
	try {
		// `limit: 0`: sólo interesan las columnas y sus tipos, no las filas.
		fields = (await createDatastoreApi(client).search(resourceId, { limit: 0 })).fields;
	} catch (err) {
		if (stale()) return;
		// Un recurso que existe y no tiene tabla responde «no encontrado», igual que uno inexistente.
		outcome =
			classifyFailure(err) === "not-found"
				? { kind: "no-table" }
				: {
						kind: "failure",
						presentation: describeFailure(err, "resource", "unknown"),
						access: "unknown",
					};
		return;
	}
	if (stale()) return;

	if (mode === "new") {
		outcome = { kind: "ready", fields, view: null };
		return;
	}

	let view: ChartView | undefined;
	try {
		view = (await createChartApi(client).listViews(resourceId)).find((item) => item.id === viewId);
	} catch (err) {
		if (stale()) return;
		outcome = {
			kind: "failure",
			presentation: describeFailure(err, "resource", "unknown"),
			access: "unknown",
		};
		return;
	}
	if (stale()) return;
	if (!view) {
		outcome = { kind: "view-missing" };
		return;
	}
	outcome = isSupportedChartVersion(view.config.version)
		? { kind: "ready", fields, view }
		: { kind: "view-unsupported" };
}

$effect(() => {
	void datasetId;
	void resourceId;
	void viewId;
	load();
});

// El formulario habla con el mismo puente que el resto de la página.
const chartApi = createChartApi(createPortalClient());

/** El mínimo y el máximo de una columna, para proponer el paso de los rangos (L49). */
function columnRange(column: string) {
	return readColumnRange(createPortalClient(), resource?.id ?? resourceId ?? "", column);
}

function backToResource() {
	void goto(resourcePath);
}

const breadcrumbItems = $derived.by((): BreadcrumbItem[] => {
	const items: BreadcrumbItem[] = [{ label: "Datasets", href: "/search", role: "Catálogo" }];
	if (dataset?.organization?.title) {
		items.push({
			label: dataset.organization.title,
			href: dataset.organization.name
				? `/organization/${encodeURIComponent(dataset.organization.name)}`
				: undefined,
			role: "Organización",
		});
	}
	if (dataset?.title || dataset?.name) {
		items.push({
			label: dataset.title || dataset.name,
			href: `/dataset/${datasetId}`,
			role: "Dataset",
		});
	}
	if (resource?.name) {
		items.push({ label: resource.name, href: resourcePath, role: "Recurso" });
	}
	items.push({ label: mode === "new" ? "Nuevo gráfico" : "Editar gráfico", role: "Gráfico" });
	return items;
});

const heading = $derived(mode === "new" ? "Nuevo gráfico" : "Editar gráfico");

/** El texto de cada estado sin formulario; el de una falla del catálogo viene de `describeFailure`. */
const STATE_COPY = {
	forbidden: {
		status: 403,
		heading: "No puede configurar los gráficos de este recurso",
		body: "Sólo quienes pueden editar el dataset crean, modifican o eliminan sus gráficos. Puede volver al recurso para ver los gráficos publicados.",
	},
	"no-table": {
		status: 404,
		heading: "Este recurso no tiene una tabla de datos",
		body: "Los gráficos se arman con las filas de la tabla del recurso, y este recurso todavía no tiene una cargada.",
	},
	"view-missing": {
		status: 404,
		heading: "No se encontró el gráfico",
		body: "Puede que el gráfico se haya eliminado. Vuelva al recurso para ver los que hay.",
	},
	"view-unsupported": {
		status: 422,
		heading: "Este gráfico no se puede editar",
		body: "Se guardó con una versión del formato que el portal no reconoce. Puede eliminarlo desde el recurso y crear uno nuevo.",
	},
} as const;

const pageTitle = $derived.by(() => {
	if (outcome.kind === "ready") return `${heading} — UMSS`;
	if (outcome.kind === "loading") return "Cargando... — UMSS";
	if (outcome.kind === "failure") return `${outcome.presentation.title} — UMSS`;
	if (outcome.kind === "invalid-params") return "Parámetros de navegación inválidos — UMSS";
	if (outcome.kind === "expelled") return "UMSS";
	return `${STATE_COPY[outcome.kind].heading} — UMSS`;
});

const backAction = $derived(
	datasetId && resourceId
		? { href: resourcePath, label: "Volver al recurso" }
		: { href: "/search", label: "Volver al catálogo" },
);

const failureActionsFor = $derived(
	outcome.kind === "failure"
		? failureActions(outcome.presentation, outcome.access)
		: { retry: false },
);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div>
	{#if outcome.kind !== "loading" && outcome.kind !== "expelled"}
		<div class="border-b border-border bg-card">
			<div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
				<Breadcrumb items={breadcrumbItems} icon={FileText} />
			</div>
		</div>
	{/if}

	{#if outcome.kind === "loading"}
		<div class="mx-auto max-w-7xl animate-pulse space-y-6 px-4 py-10 sm:px-6 lg:px-8 motion-reduce:animate-none" role="status">
			<span class="sr-only">Cargando…</span>
			<div class="h-9 w-1/3 rounded-lg bg-muted"></div>
			<div class="h-[420px] rounded-xl border border-border bg-card"></div>
		</div>
	{:else if outcome.kind === "expelled"}
		<!-- El camino único de expulsión ya limpió la sesión y navegó: no queda nada que dibujar. -->
	{:else if outcome.kind === "invalid-params"}
		<ErrorPage
			status={404}
			variant="client"
			copy={{
				title: pageTitle,
				heading: "Parámetros de navegación inválidos",
				body: "La dirección no contiene un dataset, un recurso y un gráfico válidos.",
			}}
			primaryAction={{ href: "/search", label: "Volver al catálogo" }}
		/>
	{:else if outcome.kind === "failure"}
		<ErrorPage
			status={statusFor(outcome.presentation.kind)}
			code={outcome.presentation.code}
			variant={failureActionsFor.retry ? "server" : "client"}
			copy={{
				title: pageTitle,
				heading: outcome.presentation.title,
				body: outcome.presentation.message,
			}}
			primaryAction={backAction}
			retry={failureActionsFor.retry ? () => load() : null}
		/>
	{:else if outcome.kind === "ready"}
		<section class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
			<header>
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">Gráfico</p>
				<h1 class="mt-1 font-heading text-3xl font-bold text-primary">{heading}</h1>
				<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					Configure qué se agrupa y qué se mide. Quienes visiten el recurso verán el gráfico ya
					calculado con los datos de la tabla.
				</p>
			</header>

			<!-- Sin tarjeta propia: el formulario trae sus tarjetas separadas y el gráfico (L49). -->
			{#key outcome.view?.id ?? "new"}
				<ChartForm
					fields={outcome.fields}
					api={chartApi}
					resourceId={resource?.id ?? resourceId ?? ""}
					viewId={outcome.view?.id}
					initialTitle={outcome.view?.title ?? ""}
					initialDescription={outcome.view?.description ?? ""}
					initialConfig={outcome.view ? draftFromConfig(outcome.view.config) : undefined}
					onsaved={backToResource}
					oncancel={backToResource}
					readColumnRange={columnRange}
				/>
			{/key}
		</section>
	{:else}
		{@const copy = STATE_COPY[outcome.kind]}
		<ErrorPage
			status={copy.status}
			variant="client"
			copy={{ title: pageTitle, heading: copy.heading, body: copy.body }}
			primaryAction={backAction}
		/>
	{/if}
</div>
