<script lang="ts">
import { Loader2 } from "@lucide/svelte";
import { page } from "$app/stores";
import { type ChartView, createChartApi } from "$lib/api/charts";
import { createPortalClient } from "$lib/api/client";
import { classifyFailure, describeFailure } from "$lib/api/failure";
import { createResourceApi } from "$lib/api/resources";
import ChartViewBody from "$lib/components/resource/chart/ChartViewBody.svelte";
import Button from "$lib/components/ui/button/button.svelte";

// La página incrustable de un gráfico guardado (P4, L28 punto 4): `/embed/charts/[viewId]`. Se muestra dentro de
// un `<iframe>` de otro sitio, así que el layout raíz no le pone encabezado ni pie, y **no depende de una
// sesión**: pide todo como lo haría un visitante anónimo (en un `<iframe>` de otro origen la cookie `SameSite`
// ni siquiera viaja). Lo que se muestra es el título, el gráfico —el mismo `ChartViewBody` de la página del
// recurso— y una línea que vuelve al recurso en el portal.
//
// Tres cosas que se dicen distinto, y una que no:
//  · una vista que **no existe, se eliminó o es privada** se dice con la misma frase, a propósito: quien no tiene
//    sesión no puede distinguir una privada de una inexistente (`$lib/api/failure`, § «Indistinguibilidad sin
//    sesión»); acá no hay sesión, así que la regla es la de siempre;
//  · un fallo del catálogo se dice aparte y deja reintentar;
//  · una versión del formato desconocida la dice `ChartViewBody`, como en la página del recurso.
const client = createPortalClient();
const chartApi = createChartApi(client);
const resourceApi = createResourceApi(client);

type State =
	| { status: "loading" }
	| { status: "unavailable" }
	| { status: "failed"; message: string }
	| { status: "ready"; view: ChartView };

let current = $state<State>({ status: "loading" });
/** La atribución: el recurso al que vuelve el enlace. Si no se puede leer, la línea queda sin enlace. */
let resourceHref = $state<{ href: string; name: string } | null>(null);
let requestSeq = 0;

async function load(viewId: string) {
	const seq = ++requestSeq;
	current = { status: "loading" };
	resourceHref = null;
	try {
		const view = await chartApi.getView(viewId);
		if (seq !== requestSeq) return;
		current = view ? { status: "ready", view } : { status: "unavailable" };
		if (view) void loadResource(view.resource_id, seq);
	} catch (err) {
		if (seq !== requestSeq) return;
		// Sin sesión (el embed es siempre anónimo): el texto del fallo del catálogo es el de `failure.ts`.
		current =
			classifyFailure(err) === "unavailable"
				? { status: "failed", message: describeFailure(err, "resource", "anonymous").message }
				: { status: "unavailable" };
	}
}

async function loadResource(resourceId: string, seq: number) {
	try {
		const resource = await resourceApi.show(resourceId);
		if (seq !== requestSeq) return;
		resourceHref = {
			href: `/dataset/${resource.package_id}/resource/${resource.id}`,
			name: resource.name?.trim() || "el recurso",
		};
	} catch {
		// Sin enlace: la atribución sigue diciendo de dónde sale el gráfico.
	}
}

$effect(() => {
	load($page.params.viewId ?? "");
});
</script>

<svelte:head>
	<title>Gráfico · Datos UMSS</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4 sm:p-6">
	{#if current.status === "loading"}
		<div class="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
			<Loader2 class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
			Cargando el gráfico…
		</div>
	{:else if current.status === "unavailable"}
		<div class="space-y-1 rounded-md border border-border bg-muted/40 px-4 py-4" role="note">
			<p class="font-heading text-base font-bold text-foreground">Gráfico no disponible</p>
			<p class="text-sm leading-relaxed text-muted-foreground">
				No se encontró el gráfico solicitado, o no tiene permiso para verlo.
			</p>
		</div>
	{:else if current.status === "failed"}
		<div class="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3" role="alert">
			<div>
				<p class="text-sm font-medium text-foreground">No se pudo cargar el gráfico</p>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
					{current.message}
				</p>
			</div>
			<Button type="button" variant="outline" size="sm" onclick={() => load($page.params.viewId ?? "")}>
				Intentar nuevamente
			</Button>
		</div>
	{:else}
		{@const view = current.view}
		<div>
			<h1 class="font-heading text-xl font-bold text-foreground">
				{view.title.trim() || "Gráfico sin título"}
			</h1>
			{#if view.description.trim()}
				<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{view.description}</p>
			{/if}
		</div>
		<ChartViewBody {view} api={chartApi} />
		<p class="mt-auto text-xs text-muted-foreground">
			Gráfico de
			{#if resourceHref}
				<a
					href={resourceHref.href}
					target="_blank"
					rel="noopener"
					class="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{resourceHref.name}
				</a>
			{:else}
				un recurso
			{/if}
			· Datos UMSS
		</p>
	{/if}
</div>
