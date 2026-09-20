<!--
	Playground (regla 8 de AGENTS.md) — slice B de `v0-portal-honesty`.

	Propuesta de revisión de la parte visible del slice B. A propósito duplica **sólo las regiones que
	cambian** (la oferta de publicación, la barra pegajosa, el estado vacío de datasets, los tres
	estados de la tarjeta de organizaciones y el aviso de sesión expirada del login); el resto del
	dashboard ya fue aprobado en `v0` y no se vuelve a proponer. Cuando el autor lo apruebe, esto se
	promueve a `src/routes/dashboard/+page.svelte` y a `src/routes/auth/login/+page.svelte`, y este
	archivo se borra.

	Qué mirar:
	- «Sesión viva con organizaciones»: se ofrece «Publicar dataset» (grilla + barra pegajosa) y el
	  estado vacío de datasets conserva su CTA.
	- «Sesión viva sin organizaciones» y «Cargando organizaciones»: **no se promete** publicar —la
	  grilla, la barra pegajosa y el CTA desaparecen—; el estado vacío de datasets explica que publicar
	  exige una organización, y el de organizaciones mantiene su copy real (o sus esqueletos de carga).
	- Panel B: el aviso de sesión expirada reutiliza el bloque `role="alert"` del login.
-->
<script lang="ts">
import { ArrowRight, Building2, Database, Inbox, Plus } from "@lucide/svelte";
import OrganizationLogo from "$lib/components/organizations/OrganizationLogo.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { SESSION_EXPIRED_MESSAGE } from "$lib/session";
import type { CkanOrganization } from "$lib/types/ckan";
import { cn } from "$lib/utils";

// ─── Control del playground ──────────────────────────────────────────
// Tres estados simulados. No es UI de producto: sólo cambia qué regiones se proponen.
type Estado = "conOrganizaciones" | "sinOrganizaciones" | "cargando";

let estado = $state<Estado>("conOrganizaciones");

const opciones: { value: Estado; label: string }[] = [
	{ value: "conOrganizaciones", label: "Sesión viva con organizaciones" },
	{ value: "sinOrganizaciones", label: "Sesión viva sin organizaciones" },
	{ value: "cargando", label: "Cargando organizaciones" },
];

// La oferta (grilla + barra + CTA) sólo existe cuando la sesión está viva y ya se sabe que hay al
// menos una organización. Sin organizaciones no se ofrece publicar; mientras carga, no se promete
// nada.
const mostrarOferta = $derived(estado === "conOrganizaciones");
const orgsLoading = $derived(estado === "cargando");

// ─── Datos de ejemplo (estáticos) ────────────────────────────────────
// Mismo shape que la página real: en la promoción, la lista sale de `organization_list_for_user`.
const actions = [
	{
		title: "Publicar dataset",
		description: "Cree un dataset y suba sus recursos con el asistente.",
		href: "/dashboard/datasets/new",
		icon: Database,
	},
];

const organizations: CkanOrganization[] = [
	{
		id: "org-fcyt",
		name: "facultad-ciencia-tecnologia",
		title: "Facultad de Ciencias y Tecnología",
		description: "Datos académicos y de investigación de la FCyT.",
		created: "2024-01-01T00:00:00.000000",
		state: "active",
		package_count: 8,
		capacity: "editor",
		extras: [{ key: "sigla", value: "FCyT" }],
	},
	{
		id: "org-dicyt",
		name: "direccion-investigacion",
		title: "Dirección de Investigación, Ciencia y Tecnología",
		description: "Convocatorias, proyectos y producción científica.",
		created: "2024-01-01T00:00:00.000000",
		state: "active",
		package_count: 3,
		capacity: "admin",
		extras: [{ key: "sigla", value: "DICyT" }],
	},
];

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

// Copy del estado vacío de «Mis datasets». La frase extra sólo aparece cuando no hay organizaciones:
// sin organización no se puede publicar, y el CTA no debe ofrecerse (D3).
const datasetsEmptyCopy = $derived(
	mostrarOferta
		? "Aún no ha creado ningún dataset. El asistente lo guía paso a paso."
		: "Aún no ha creado ningún dataset. El asistente lo guía paso a paso. Publicar un dataset requiere pertenecer a una organización.",
);
</script>

<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
	<header>
		<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">
			Playground — slice B
		</h1>
		<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
			Previsualización de las regiones que cambian. Elija el estado simulado y revise que la oferta de
			publicación aparezca y desaparezca donde corresponde.
		</p>
	</header>

	<!-- Control de previsualización: dev-chrome, no UI de producto. -->
	<div class="mt-6 rounded-xl border border-dashed border-border bg-muted/40 p-4">
		<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
			Control del playground (no es UI de producto)
		</p>
		<div role="group" aria-label="Estado simulado" class="mt-3 flex flex-wrap gap-2">
			{#each opciones as opcion (opcion.value)}
				<button
					type="button"
					aria-pressed={estado === opcion.value}
					onclick={() => (estado = opcion.value)}
					class={cn(
						"inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						estado === opcion.value
							? "border-primary bg-primary text-primary-foreground"
							: "border-input bg-background text-foreground hover:bg-accent",
					)}
				>
					{opcion.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- ─── Panel A — Acciones del panel ──────────────────────────────── -->
	<section aria-labelledby="panel-a-heading" class="mt-10">
		<h2 id="panel-a-heading" class="font-heading text-2xl font-bold text-primary">
			A — Acciones del panel
		</h2>
		<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
			La grilla de acciones y la barra pegajosa sólo se muestran con la oferta disponible.
		</p>

		{#if mostrarOferta}
			<!-- Acciones (copiado de src/routes/dashboard/+page.svelte) -->
			<section aria-labelledby="actions-heading" class="mt-8">
				<h2
					id="actions-heading"
					class="text-xs font-medium uppercase tracking-wider text-destructive"
				>
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
			</section>

			<!-- Barra pegajosa: representación estática. En el panel real es `fixed` y se pega al hacer
			     scroll; acá se muestra sin la posición fija para que sea revisable en el playground. -->
			<div class="mt-6">
				<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					Barra pegajosa (representación estática)
				</p>
				<div
					class="mt-2 flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur"
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
						0
					</span>
				</div>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					Los datasets que usted creó.
				</p>

				<Card class="mt-4 p-2">
					<div class="p-8 text-center">
						<Inbox class="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
						<p class="mt-2 text-sm font-medium text-foreground">Publique su primer dataset</p>
						<p class="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
							{datasetsEmptyCopy}
						</p>
						{#if mostrarOferta}
							<a
								href="/dashboard/datasets/new"
								class="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Plus class="size-4" aria-hidden="true" />
								Publicar dataset
							</a>
						{/if}
					</div>
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
					{:else if estado === "sinOrganizaciones"}
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
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</Card>
			</section>
		</div>
	</section>

	<!-- ─── Panel B — Aviso de sesión expirada ────────────────────────── -->
	<section aria-labelledby="panel-b-heading" class="mt-12">
		<h2 id="panel-b-heading" class="font-heading text-2xl font-bold text-primary">
			B — Aviso de sesión expirada
		</h2>
		<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
			Bloque del login: reutiliza el mismo `role="alert"` de error. En la página real vive dentro del
			bloque condicional de error del formulario; acá se muestra siempre para revisarlo.
		</p>

		<Card class="mt-4 max-w-md p-6">
			<div
				role="alert"
				class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
			>
				{SESSION_EXPIRED_MESSAGE}
			</div>
		</Card>
	</section>
</div>
