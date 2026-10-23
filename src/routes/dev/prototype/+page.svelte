<!--
	Índice del prototipo — superficie sólo para desarrollo (`/dev/prototype`).

	Es el mapa que se recorre para capturar cada pantalla en Figma con html.to.design: primero las
	páginas construidas (enlazan a su ruta real) y después las pantallas nuevas (enlazan a su maqueta).
	El inventario vive en `screens.ts`; el plan, en `odd/tasks/prototype-presentation.md`.
-->
<script lang="ts">
import { ArrowUpRight } from "@lucide/svelte";
import { SCREENS } from "./screens";

const built = SCREENS.filter((s) => s.kind === "built");
const mock = SCREENS.filter((s) => s.kind === "mock");
</script>

<svelte:head>
	<title>Índice del prototipo — UMSS</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
	<header>
		<h1 class="font-heading text-3xl font-bold text-primary">Índice del prototipo</h1>
		<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
			Todas las pantallas que entran en el prototipo de la presentación, en el orden del recorrido.
			Cada una se abre y se captura en Figma.
		</p>
	</header>

	<section class="mt-10" data-testid="prototype-built">
		<h2 class="font-heading text-xl font-semibold text-primary">Pantallas construidas</h2>
		<p class="mt-1 text-sm text-muted-foreground">Se capturan tal cual, desde la página real.</p>
		<ul class="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
			{#each built as item (item.title)}
				<li class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
					<div>
						<a
							href={item.href}
							class="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
						>
							{item.title}
							<ArrowUpRight class="size-3.5" aria-hidden="true" />
						</a>
						{#if item.note}
							<p class="text-xs text-muted-foreground">{item.note}</p>
						{/if}
					</div>
					<span class="text-xs text-muted-foreground">{item.audience}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="mt-10" data-testid="prototype-mock">
		<h2 class="font-heading text-xl font-semibold text-primary">Pantallas nuevas</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Maquetas sin funcionamiento, con datos de ejemplo: muestran lo que el proyecto incluirá.
		</p>
		<ul class="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
			{#each mock as item (item.title)}
				<li class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
					<div>
						<div class="flex items-center gap-2">
							<a
								href={item.href}
								class="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
							>
								{item.title}
								<ArrowUpRight class="size-3.5" aria-hidden="true" />
							</a>
							{#if !item.ready}
								<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
									En preparación
								</span>
							{/if}
						</div>
						{#if item.note}
							<p class="text-xs text-muted-foreground">{item.note}</p>
						{/if}
					</div>
					<span class="text-xs text-muted-foreground">{item.audience}</span>
				</li>
			{/each}
		</ul>
	</section>
</div>
