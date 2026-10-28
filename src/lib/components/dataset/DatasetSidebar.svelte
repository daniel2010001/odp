<!--
	La columna lateral de la ficha del dataset: la solicitud de publicación (cuando hay algo que decir de ella),
	«Citar como», «Resumen», el historial de solicitudes y la organización. Vive aparte para que el playground
	`/dev/dataset-panel` (S17 de `odd/tasks/prototype-presentation.md`) la monte con datos fijos y compare sus
	variantes contra la de la ficha; la ficha la monta con sus valores por defecto, que son exactamente los de hoy.

	Las variantes (sólo las usa el playground):
	- `order`: el orden de las tarjetas. Una tarjeta que no tiene nada que mostrar no se dibuja en ningún orden.
	- `scroll`: `"page"` es la columna pegajosa de hoy (la página se baja para ver las últimas tarjetas);
	  `"own"` la deja pegajosa y le da su propio desplazamiento, con un alto que sigue a la ventana.
	- `reveal`: dónde aparece el botón del enlace de cada tarjeta (ver `AnchorLink`).
	- `historyLimit`: cuántas entradas del historial se ven antes de «Ver más».
-->
<script lang="ts">
import { Check, ChevronRight, Copy, ExternalLink, FileText, Inbox } from "@lucide/svelte";
import type { PublicationRequest } from "$lib/api/publication";
import OrganizationLogo from "$lib/components/organizations/OrganizationLogo.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { estadoDeLaSolicitud } from "$lib/copy/publication";
import { summaryFacts } from "$lib/datasets/details";
import type { CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import { copyToClipboard, formatCitationAPA, formatCitationBibTeX } from "$lib/utils/citation";
import { safeExternalUrl } from "$lib/utils/external-url";
import { licenseTermsUrl } from "$lib/utils/licenses";
import AnchorLink from "./AnchorLink.svelte";
import PublicationDecision from "./PublicationDecision.svelte";
import type { DecidePublicationRequest, PublicationDecisionResult } from "./publication-decision";
import RequestHistory from "./RequestHistory.svelte";
import { CURRENT_SIDEBAR_ORDER, OWN_SCROLL_CLASS, type SidebarCard } from "./sidebar";

let {
	dataset,
	solicitudVigente,
	pendingRequestCount,
	puedeDecidirSolicitud,
	decidir,
	readStoredDataset,
	reflejarDecision,
	historialDeSolicitudes,
	order = CURRENT_SIDEBAR_ORDER,
	scroll = "page",
	reveal = "title",
	historyLimit,
	element = $bindable(),
}: {
	dataset: CkanPackage;
	/** La solicitud vigente de este dataset (ver la ficha), o `null`. */
	solicitudVigente: PublicationRequest | null;
	pendingRequestCount: number;
	puedeDecidirSolicitud: boolean;
	decidir: DecidePublicationRequest;
	readStoredDataset: (id: string) => Promise<CkanPackage>;
	reflejarDecision: (respuesta: PublicationDecisionResult) => void;
	historialDeSolicitudes: PublicationRequest[];
	order?: readonly SidebarCard[];
	scroll?: "page" | "own";
	reveal?: "title" | "card";
	historyLimit?: number;
	/** El `<aside>`, para quien necesite medirlo (el instrumento del playground). */
	element?: HTMLElement;
} = $props();

let citationFormat = $state<"apa" | "bibtex">("apa");
let copied = $state(false);

// La tarjeta sólo existe mientras hay algo que decir de la solicitud: pendiente, o rechazada (el
// dataset sigue privado). Una aprobada ya es un dataset público y no la muestra, para nadie — así las
// fichas públicas quedan iguales entre sí (decisión del autor, 2026-10-18); una cancelada o anulada
// tampoco tiene nada en curso. Es una lista positiva: un estado nuevo no dibuja la tarjeta hasta
// nombrarlo acá.
const tarjetaDeSolicitudVisible = $derived(
	solicitudVigente?.status === "pending" || solicitudVigente?.status === "rejected",
);

// El «Resumen» (ver `$lib/datasets/details`).
const summary = $derived(summaryFacts(dataset));
// Los términos sólo se ofrecen con un destino web: el catálogo guarda la dirección que alguien escribió.
const termsUrl = $derived(
	safeExternalUrl(licenseTermsUrl(dataset.license_id, dataset.license_url)),
);

const searchHref = (key: "license", value: string) =>
	`/search?${new URLSearchParams({ [key]: value })}`;

const orgHref = $derived(
	dataset.organization?.name
		? `/organization/${encodeURIComponent(dataset.organization.name)}`
		: null,
);

/** Con `reveal="card"` la tarjeta entera es el grupo que hace aparecer el botón del enlace. */
const tarjeta = $derived(reveal === "card" && "group/tarjeta");

// ─── Citation ───────────────────────────────────────────────────
const citationText = $derived(
	citationFormat === "apa" ? formatCitationAPA(dataset) : formatCitationBibTeX(dataset),
);

async function handleCopyCitation() {
	if (!citationText) return;
	const ok = await copyToClipboard(citationText);
	if (ok) {
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
}
</script>

{#snippet request()}
		<!-- La tarjeta del estado de la solicitud **encabeza la columna lateral** (variante C de
		     la posición de las solicitudes, elegida por el autor el 2026-10-19): la columna es pegajosa en
		     escritorio, así que el aprobador decide sin bajar. Antes era la segunda de la columna
		     principal, después de la información textual.
		     Muestra en qué está y, desde el 2026-10-14, también **deja decidirla** —cuando quien mira
		     administra la organización dueña, la solicitud está pendiente y no es suya—: la gobernanza
		     pide revisar **y** decidir, y el dataset está privado, así que no está en el catálogo y el
		     revisor no tiene otro camino hasta él. El control es el **mismo** de la cola
		     (`PublicationDecision`), así que las reglas no se duplican en ningún lado. La acción de
		     **pedir** o cancelar sigue en el hero, que es la del solicitante. -->
		{#if tarjetaDeSolicitudVisible && solicitudVigente}
			<Card class="p-6 sm:p-8">
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">
					Solicitud de publicación
				</p>
				<p
					class="mt-2 flex items-center gap-2 text-sm leading-relaxed text-foreground"
					data-testid="estado-solicitud"
				>
					<Inbox class="size-4 shrink-0 text-primary" aria-hidden="true" />
					{estadoDeLaSolicitud(solicitudVigente)}
				</p>
				{#if pendingRequestCount > 1}
					<p
						class="mt-1 text-xs text-muted-foreground"
						data-testid="pending-requests-count"
					>
						Hay {pendingRequestCount} solicitudes pendientes para este dataset.
					</p>
				{/if}
				{#if solicitudVigente.status === "pending" && puedeDecidirSolicitud}
					<PublicationDecision
						item={solicitudVigente}
						decide={decidir}
						readDataset={readStoredDataset}
						ondecided={reflejarDecision}
					/>
				{/if}
			</Card>
		{/if}
{/snippet}

{#snippet cite()}
		<!-- Cite card -->
		<Card
			id="cite"
			class={cn("scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] p-5", tarjeta)}
		>
			<div class="group/ancla flex h-4 items-center gap-2">
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">Citar como</p>
				<AnchorLink id="cite" title="Citar como" {reveal} />
			</div>
			<div class="mt-3 flex items-center gap-2">
				<button
					type="button"
					onclick={() => (citationFormat = "apa")}
					class={cn(
						"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
						citationFormat === "apa"
							? "bg-primary text-primary-foreground"
							: "border border-border bg-background text-muted-foreground hover:bg-accent",
					)}
				>
					APA
				</button>
				<button
					type="button"
					onclick={() => (citationFormat = "bibtex")}
					class={cn(
						"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
						citationFormat === "bibtex"
							? "bg-primary text-primary-foreground"
							: "border border-border bg-background text-muted-foreground hover:bg-accent",
					)}
				>
					BibTeX
				</button>
				<div class="flex-1"></div>
				<button
					type="button"
					onclick={handleCopyCitation}
					aria-label="Copiar cita"
					title="Copiar al portapapeles"
					class="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					{#if copied}
						<Check class="size-4 text-positive" />
					{:else}
						<Copy class="size-4" />
					{/if}
				</button>
			</div>
			<p class="mt-3 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
				{citationText}
			</p>
		</Card>
{/snippet}

{#snippet summaryCard()}
		<!-- Resumen: lo que responde «¿me sirve esto?». Reemplaza a «Detalles» (variante C de
		     `/dev/dataset-details`); el resto vive en «Información técnica». -->
		<Card
			id="summary"
			class={cn("scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] p-5", tarjeta)}
		>
			<div class="group/ancla flex h-4 items-center gap-2">
				<p class="text-xs font-medium uppercase tracking-wider text-destructive">Resumen</p>
				<AnchorLink id="summary" title="Resumen" {reveal} />
			</div>
			<dl class="mt-3 space-y-3">
				{#each summary as fact (fact.key)}
					<!-- `#license` es la fila «Términos» (el destino de los términos de uso) y, sin enlace a los
					     términos, la fila de la licencia. -->
					{@const licenciaAqui = fact.key === "license" && !termsUrl}
					<div
						id={licenciaAqui ? "license" : undefined}
						class={cn(
							"flex items-start gap-3",
							licenciaAqui &&
								"group/ancla scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))]",
						)}
					>
						<fact.icon class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
						<div class="min-w-0">
							<dt class="text-xs text-muted-foreground">{fact.label}</dt>
							<dd class="text-sm font-semibold leading-snug text-foreground">
								{#if fact.key === "license" && dataset.license_id}
									<!-- El nombre de la licencia filtra el catálogo (`/search?license=`). -->
									<a
										href={searchHref("license", dataset.license_id)}
										aria-label={`Ver datasets con licencia ${fact.value} en el catálogo`}
										class="relative inline-flex underline decoration-dotted underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-[''] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>{fact.value}</a
									>
								{:else}
									{fact.value}
								{/if}
							</dd>
						</div>
						{#if licenciaAqui}
							<div class="ml-auto flex h-4 shrink-0 items-center"><AnchorLink id="license" title="Licencia" /></div>
						{/if}
					</div>
					{#if fact.key === "license" && termsUrl}
						<!-- Los términos de la licencia son otro destino —un sitio externo— y tienen su propia fila
						     (variante L3 de `/dev/responsive-actions`, elegida por el autor el 2026-10-20): mezclarlos
						     con el nombre en una misma insignia dejaba dos destinos en un solo control. -->
						<div
							id="license"
							class="group/ancla flex scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] items-start gap-3"
						>
							<FileText class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
							<div class="min-w-0">
								<dt class="text-xs text-muted-foreground">Términos</dt>
								<dd class="text-sm">
									<a
										href={termsUrl}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={`Ver los términos de la licencia ${fact.value} (sitio externo, se abre en otra pestaña)`}
										class="relative inline-flex min-h-8 items-center gap-1 font-medium text-primary underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>Ver los términos<ExternalLink class="size-4" aria-hidden="true" /></a
									>
								</dd>
							</div>
							<div class="ml-auto flex h-4 shrink-0 items-center"><AnchorLink id="license" title="Términos" /></div>
						</div>
					{/if}
				{/each}
			</dl>
			<!-- Fila de pie (variante C de `/dev/card-links`): el enlace ocupa el ancho de la tarjeta
			     y llega a 44 px de alto. -->
			<a
				href="#technical-info"
				class="group -mx-5 -mb-5 mt-4 flex min-h-11 items-center justify-between gap-3 rounded-b-xl border-t border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
			>
				Ver la información técnica
				<ChevronRight
					class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
					aria-hidden="true"
				/>
			</a>
		</Card>
{/snippet}

{#snippet history()}
		<!-- Historial de solicitudes (variante H2 de `/dev/request-history`, elegida por el autor el
		     2026-10-20): tarjeta propia bajo «Resumen». Sólo existe si el catálogo devolvió filas. -->
		<RequestHistory rows={historialDeSolicitudes} limit={historyLimit} {reveal} />
{/snippet}

{#snippet organization()}
		<!-- Organization card -->
		{#if dataset.organization?.title}
			<Card
				id="organization"
				class={cn("scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] p-5", tarjeta)}
			>
				<div class="group/ancla flex h-4 items-center gap-2">
					<p class="text-xs font-medium uppercase tracking-wider text-destructive">Organización</p>
					<AnchorLink id="organization" title="Organización" {reveal} />
				</div>
				<div class="mt-3 flex items-start gap-3">
					<OrganizationLogo
						imageUrl={dataset.organization.image_url}
						name={dataset.organization.title}
					/>
					<div class="min-w-0 flex-1">
						<p class="font-heading text-sm font-bold text-foreground">
							{dataset.organization.title}
						</p>
						{#if dataset.organization.description}
							<p class="mt-1 line-clamp-3 text-xs text-muted-foreground">
								{dataset.organization.description}
							</p>
						{/if}
					</div>
				</div>
				{#if orgHref}
					<!-- Fila de pie (variante C de `/dev/card-links`). El texto no repite el título de la
					     organización: la tarjeta ya lo muestra arriba y un título largo partía el enlace. -->
					<a
						href={orgHref}
						class="group -mx-5 -mb-5 mt-4 flex min-h-11 items-center justify-between gap-3 rounded-b-xl border-t border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
					>
						Ver los datasets de la organización
						<ChevronRight
							class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
							aria-hidden="true"
						/>
					</a>
				{/if}
			</Card>
		{/if}
{/snippet}

<aside
	bind:this={element}
	class={cn(
		"min-w-0 space-y-6 transition-[top] duration-200 ease-out lg:sticky lg:top-[calc(var(--header-h)+1px+var(--sticky-air))]",
		scroll === "own" && OWN_SCROLL_CLASS,
	)}
>
	{#each order as card (card)}
		{#if card === "request"}
			{@render request()}
		{:else if card === "cite"}
			{@render cite()}
		{:else if card === "summary"}
			{@render summaryCard()}
		{:else if card === "history"}
			{@render history()}
		{:else if card === "organization"}
			{@render organization()}
		{/if}
	{/each}
</aside>
