<!--
	Sección «Aparece en las colecciones» de la ficha de un dataset (PRD RF-22). La comparten la maqueta
	`/dev/prototype/dataset-collections` y la ficha real en modo prototipo (`$lib/prototype/mode.ts`).

	Recibe las colecciones **ya filtradas** por quien mira (`canSee`, Q10): la sección no decide visibilidad.
	Se comparte con `#collections`, como las demás secciones de la ficha (`Section`, S27).
-->
<script lang="ts">
import { Building2, Library, User } from "@lucide/svelte";
import Section from "$lib/components/section/Section.svelte";
import { collectionHref, curatorLabel, type MockCollection } from "./data";
import VisibilityBadge from "./VisibilityBadge.svelte";

let { collections, orgTitle }: { collections: MockCollection[]; orgTitle: string } = $props();
</script>

<Section id="collections" label="Colecciones" class="p-6 sm:p-8" data-testid="dataset-collections">
	<h2 class="mt-1 font-heading text-xl font-bold text-primary">
		Aparece en las colecciones
		<span class="font-normal text-muted-foreground">({collections.length})</span>
	</h2>
	<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
		Este dataset se publica una sola vez, en {orgTitle}. Las colecciones lo referencian sin
		copiarlo: siempre muestran esta misma versión.
	</p>

	{#if collections.length === 0}
		<p class="mt-4 text-sm text-muted-foreground">Este dataset todavía no está en ninguna colección.</p>
	{:else}
		<ul class="mt-4 space-y-2">
			{#each collections as collection (collection.slug)}
				<li>
					<a
						href={collectionHref(collection.slug)}
						class="group flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors duration-200 hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						data-testid="dataset-collection"
					>
						<Library class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
						<span class="min-w-0 flex-1">
							<span class="block font-medium text-primary group-hover:underline">
								{collection.name}
							</span>
							<span
								class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
							>
								<span class="inline-flex items-center gap-1.5">
									{#if collection.curator.kind === "org"}
										<Building2 class="size-3.5" aria-hidden="true" />
									{:else}
										<User class="size-3.5" aria-hidden="true" />
									{/if}
									Curada por
									<span class="text-foreground" data-testid="collection-curator"
										>{curatorLabel(collection.curator)}</span
									>
								</span>
								<span>{collection.datasets.length} datasets</span>
							</span>
						</span>
						<VisibilityBadge visibility={collection.visibility} />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</Section>
