<!--
	Tarjeta del listado de organizaciones (`/organizations`, S25 de `odd/tasks/prototype-presentation.md`).
	Parte de `OrganizationCard` y suma lo que la propuesta aprobada pidió:

	- **Cantidad y fecha**: los datasets y la fecha de la última actualización, que el catálogo ya entrega.
	- **Sigla** (Q13): junto al tipo, sólo si la organización la declara.
	- **Jerarquía** (Q6): «Depende de …» y «N unidades dependientes», sólo si el dato existe. Sin dato no
	  hay marca ni hueco.

	Como la tarjeta puede llevar enlaces propios, no es un único `<a>` (un enlace dentro de otro no es HTML
	válido): el título es el enlace y su `::after` cubre la tarjeta entera; los enlaces de la jerarquía
	quedan por encima con `relative z-10`.
-->
<script lang="ts">
import { CalendarDays, Database, Network } from "@lucide/svelte";
import Card from "$lib/components/ui/card/card.svelte";
import type { CkanOrganization } from "$lib/types/ckan";
import { formatDate } from "$lib/utils/ckan";
import OrganizationLogo from "./OrganizationLogo.svelte";
import { orgTypeInfo, orgTypeOf } from "./org-type";

interface OrgLink {
	name: string;
	title: string;
}

let {
	org,
	count,
	updated,
	acronym,
	parent,
	dependents = [],
}: {
	org: CkanOrganization;
	count: number;
	/** Fecha ISO de la última actualización; sin ella no se muestra. */
	updated?: string;
	/** Sigla declarada por la organización. */
	acronym?: string;
	parent?: OrgLink;
	dependents?: OrgLink[];
} = $props();

function hrefOf(target: { name: string }): string {
	return `/organization/${encodeURIComponent(target.name)}`;
}

const title = $derived(org.title || org.name);
const titleId = $derived(`org-title-${org.name}`);
const typeLabel = $derived(orgTypeInfo(orgTypeOf(org.title || "")).label);
</script>

<article aria-labelledby={titleId} class="group h-full" data-testid={`org-card-${org.name}`}>
	<Card
		class="relative flex h-full flex-col gap-4 p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-md"
	>
		<div class="flex flex-wrap items-center gap-2">
			<span
				class="inline-flex w-fit items-center rounded-md bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary"
			>
				{typeLabel}
			</span>
			{#if acronym}
				<span class="text-xs font-semibold tracking-wide text-muted-foreground" data-org-acronym
					>{acronym}</span
				>
			{/if}
		</div>

		<OrganizationLogo
			imageUrl={org.image_url}
			name={title}
			abbr={acronym}
			class="size-11 rounded-lg bg-primary font-heading text-xl font-bold text-primary-foreground"
		/>

		<div class="flex-1">
			<h3 id={titleId} class="font-heading text-xl font-bold text-primary">
				<a
					href={hrefOf(org)}
					class="rounded-sm no-underline underline-offset-2 transition-colors after:absolute after:inset-0 after:rounded-xl group-hover:text-primary/80 group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{title}
				</a>
			</h3>
			<p class="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
				{org.description || "Sin descripción"}
			</p>

			{#if parent}
				<p class="mt-3 text-xs text-muted-foreground">
					Depende de
					<a
						href={hrefOf(parent)}
						class="relative z-10 rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{parent.title}
					</a>
				</p>
			{/if}

			{#if dependents.length > 0}
				<div class="mt-3">
					<p class="flex items-center gap-1.5 text-xs font-semibold text-primary">
						<Network class="size-3.5" aria-hidden="true" />
						{dependents.length}
						{dependents.length === 1 ? "unidad dependiente" : "unidades dependientes"}
					</p>
					<ul class="mt-1.5 flex flex-wrap gap-1.5" aria-label="Unidades dependientes">
						{#each dependents as dependent (dependent.name)}
							<li>
								<a
									href={hrefOf(dependent)}
									title={dependent.title}
									class="relative z-10 inline-flex rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground transition-colors duration-200 hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									{dependent.title}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3"
		>
			{#if count > 0}
				<span class="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
					<Database class="size-4" aria-hidden="true" />
					{count} dataset{count === 1 ? "" : "s"}
				</span>
			{:else}
				<span class="flex items-center gap-1.5 text-[13px] text-muted-foreground">
					<Database class="size-4" aria-hidden="true" />
					Aún sin datasets publicados
				</span>
			{/if}
			{#if count > 0 && updated}
				<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<CalendarDays class="size-3.5" aria-hidden="true" />
					<span>Actualizado el <time datetime={updated}>{formatDate(updated)}</time></span>
				</span>
			{/if}
		</div>
	</Card>
</article>
