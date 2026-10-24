<!--
	Maqueta — Colecciones. PRD RF-21..RF-23.

	Pantalla sin funcionamiento, con datos de ejemplo (`./data.ts`): las colecciones reúnen datasets de
	varias organizaciones sin copiarlos. Cualquier usuario con sesión puede crear una (RF-21), así que el
	curador es una persona o una organización.

	Factibilidad en CKAN (S6): una colección es un `group` y su contenido, `group_member` (nativos; medido:
	`ckan.auth.user_create_groups = true`, cualquier usuario puede crearlas hoy). La visibilidad «Interna» y la
	aprobación por organización para publicarla (RF-23) **no son nativas**: un `group` de CKAN es siempre
	público; serían una extensión propia.
-->
<script lang="ts">
import {
	Building2,
	Database,
	FolderPlus,
	Globe,
	Library,
	Lock,
	Search,
	User,
} from "@lucide/svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { COLLECTIONS, collectionHref, curatorLabel, ownerOrgs } from "./data";

const selectClass =
	"h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const inputClass =
	"h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
</script>

<svelte:head>
	<title>Colecciones — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		<Breadcrumb items={[{ label: "Inicio", href: "/" }, { label: "Colecciones" }]} icon={Library} />

		<header class="mt-5 flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">Colecciones</h1>
				<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Reúna datasets de distintas organizaciones en un solo lugar, sin copiarlos: cada dataset se
					publica una vez, en su organización, y una colección sólo lo referencia.
				</p>
			</div>
			<Button>
				<FolderPlus class="size-4" aria-hidden="true" />
				Nueva colección
			</Button>
		</header>

		<Card class="mt-6 p-5">
			<div class="flex flex-wrap items-center gap-3">
				<label class="relative min-w-0 flex-1 basis-64">
					<span class="sr-only">Buscar colecciones</span>
					<Search
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input class="{inputClass} pl-9" placeholder="Buscar por nombre, descripción o curador" />
				</label>
				<select class={selectClass} aria-label="Visibilidad">
					<option>Todas las visibilidades</option>
					<option>Interna</option>
					<option>Pública</option>
				</select>
				<select class={selectClass} aria-label="Curador">
					<option>Todos los curadores</option>
					<option>Mis colecciones</option>
					<option>De organizaciones</option>
				</select>
			</div>
		</Card>

		<ul class="mt-6 grid gap-4 md:grid-cols-2" data-testid="collections-list">
			{#each COLLECTIONS as collection (collection.slug)}
				{@const orgs = ownerOrgs(collection)}
				<li>
					<a
						href={collectionHref(collection.slug)}
						class="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Card
							class="flex h-full flex-col p-6 transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-accent/30"
						>
							<div class="flex items-start justify-between gap-3">
								<h2 class="font-heading text-xl font-bold text-primary group-hover:underline">
									{collection.name}
								</h2>
								{#if collection.visibility === "Pública"}
									<span
										class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
									>
										<Globe class="size-3" aria-hidden="true" />
										Pública
									</span>
								{:else}
									<span
										class="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
									>
										<Lock class="size-3" aria-hidden="true" />
										Interna
									</span>
								{/if}
							</div>
							<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
								{collection.description}
							</p>
							<p class="mt-4 flex items-center gap-1.5 text-sm text-foreground">
								{#if collection.curator.kind === "org"}
									<Building2 class="size-4 shrink-0 text-primary" aria-hidden="true" />
								{:else}
									<User class="size-4 shrink-0 text-primary" aria-hidden="true" />
								{/if}
								<span class="text-muted-foreground">Curada por</span>
								<span class="min-w-0 truncate font-medium">{curatorLabel(collection.curator)}</span>
							</p>
							<div
								class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-sm text-muted-foreground"
							>
								<span class="inline-flex items-center gap-1.5" data-testid="collection-counts">
									<Database class="size-4" aria-hidden="true" />
									{collection.datasets.length} datasets de {orgs.length} organizaciones
								</span>
								<ul class="flex flex-wrap gap-1.5">
									{#each orgs as org (org.name)}
										<li
											class="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-semibold text-foreground"
											title={org.title}
										>
											{org.acronym}
										</li>
									{/each}
								</ul>
							</div>
						</Card>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</div>
