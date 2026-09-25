<script lang="ts">
// Playground de la regla 8 — material de trabajo, NO se trackea, se borra al promover.
//
// Dos decisiones, una hoja:
//   A. Qué hace el breadcrumb en móvil (hoy trunca; hay tres alternativas).
//   B. Cómo se salta de un recurso a otro dentro del mismo dataset (hoy no se puede).
//
// Los datos son los REALES del catálogo de desarrollo (`observatorio-de-movilidad-urbana-cochabamba`,
// 5 recursos), así que los nombres largos son los que el usuario realmente ve.
//
// A1 importa el componente REAL, para que el «hoy» no pueda quedar desfasado.
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, FileText } from "@lucide/svelte";
import { DropdownMenu } from "bits-ui";
import Breadcrumb, { type BreadcrumbItem } from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";

const org = "Facultad de Ciencias y Tecnología";
const datasetTitle = "Observatorio de Movilidad Urbana — Cochabamba";

const resources = [
	{ format: "CSV", name: "Flujos vehiculares por punto de conteo (2019–2025)" },
	{ format: "XLSX", name: "Encuesta de origen-destino 2024" },
	{ format: "GeoJSON", name: "Rutas y paradas del transporte público (GeoJSON)" },
	{ format: "CSV", name: "Accidentalidad vial (2019–2025)" },
	{ format: "PDF", name: "Informe metodológico y diccionario de datos" },
];

/** El recurso abierto, como en la página real. */
const actual = resources[3];
const posicion = resources.indexOf(actual) + 1;

const items: BreadcrumbItem[] = [
	{ label: "Datasets", href: "/search" },
	{ label: org },
	{ label: datasetTitle, href: "/dataset/observatorio-movilidad" },
	{ label: actual.name },
];

const marco = "rounded-md border border-border bg-card p-3";
const etiqueta = "text-muted-foreground";
</script>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-8 border-b border-border pb-6">
		<p class="text-xs font-medium uppercase tracking-wider text-destructive">
			Hoja de revisión · sólo desarrollo
		</p>
		<h1 class="font-heading text-3xl font-bold text-primary">Navegación: breadcrumb y salto de recurso</h1>
		<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
			Dos decisiones sobre los mismos datos reales (5 recursos). Los desplegables funcionan: hacé clic.
			Todo lo móvil está en marcos de <span class="font-mono text-xs">375px</span>.
		</p>
	</header>

	<h2 class="font-heading text-2xl font-bold text-foreground">A. El breadcrumb en móvil</h2>
	<div class="mt-4 flex gap-5 overflow-x-auto pb-4">
		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">A1. Truncado (lo de hoy)</div>
			<div class={marco}>
				<Breadcrumb {items} />
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				Una línea, y los cuatro items siguen ahí —el texto completo y los enlaces— aunque se recorte lo
				pintado. Es lo que está implementado.
			</p>
		</div>

		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">A2. Sólo el padre, con rol</div>
			<div class={marco}>
				<nav aria-label="Breadcrumb">
					<a
						href="/dataset/observatorio-movilidad"
						class="inline-flex min-w-0 items-center gap-1.5 text-sm {etiqueta} hover:text-foreground"
					>
						<ArrowLeft class="size-4 shrink-0" aria-hidden="true" />
						<span class="truncate">Dataset</span>
					</a>
				</nav>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				Lo más corto y lo más legible: el rótulo dice el <em>rol</em>, no el nombre. Pierde el recorrido
				(quién es el padre, de qué organización) y el «Volver a…» largo.
			</p>
		</div>

		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">A3. El padre + el árbol adentro</div>
			<div class={marco}>
				<nav aria-label="Breadcrumb">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="inline-flex min-w-0 items-center gap-1.5 text-sm {etiqueta} hover:text-foreground"
						>
							<ArrowLeft class="size-4 shrink-0" aria-hidden="true" />
							<span class="truncate">{datasetTitle}</span>
							<ChevronDown class="size-3.5 shrink-0" aria-hidden="true" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content class="z-50 min-w-64 rounded-md border border-border bg-popover p-1 shadow-md" sideOffset={6}>
							{#each items as item, index (item.label)}
								<DropdownMenu.Item
									class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
								>
									<span class="w-20 shrink-0 text-[11px] {etiqueta}">
										{["Catálogo", "Organización", "Dataset", "Recurso"][index]}
									</span>
									{#if index === items.length - 1}
										<span class="truncate font-medium text-foreground">{item.label}</span>
									{:else}
										<a href={item.href ?? "#"} class="truncate">{item.label}</a>
									{/if}
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</nav>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				Una acción visible (volver al dataset) y el recorrido completo a un toque, con el rol de cada
				nivel. Consume el ancho de una miga, no de cuatro.
			</p>
		</div>

		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">A4. Extremos + «…» con el árbol</div>
			<div class={marco}>
				<nav aria-label="Breadcrumb">
					<ol class="flex items-center gap-1 text-sm">
						<li class="flex items-center gap-1">
							<a href="/search" class={etiqueta}>Datasets</a>
						</li>
						<li class="flex items-center gap-1">
							<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
							<DropdownMenu.Root>
								<DropdownMenu.Trigger
									class="inline-flex size-6 items-center justify-center rounded-md border border-border {etiqueta}"
									aria-label="Mostrar el recorrido"
								>
									…
								</DropdownMenu.Trigger>
								<DropdownMenu.Content class="z-50 min-w-64 rounded-md border border-border bg-popover p-1 shadow-md" sideOffset={6}>
									{#each items.slice(1, -1) as item, index (item.label)}
										<DropdownMenu.Item
											class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
										>
											<span class="w-20 shrink-0 text-[11px] {etiqueta}">
												{["Organización", "Dataset"][index]}
											</span>
											<a href={item.href ?? "#"} class="truncate">{item.label}</a>
										</DropdownMenu.Item>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</li>
						<li class="flex items-center gap-1">
							<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
							<span class="truncate font-medium text-foreground" aria-current="page">{actual.name}</span>
						</li>
					</ol>
				</nav>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				El patrón «collapsed» de shadcn: los extremos quedan visibles y lo del medio se abre. Mantiene
				el arranque del recorrido («Datasets»), que A3 pierde.
			</p>
		</div>
	</div>

	<h2 class="mt-10 font-heading text-2xl font-bold text-foreground">B. Saltar de un recurso a otro</h2>
	<p class="mt-1 max-w-3xl text-sm leading-relaxed {etiqueta}">
		Hoy no hay forma: para pasar de «Accidentalidad vial» a «Informe metodológico» hay que volver al
		dataset y encontrar la tarjeta. <strong>No hace falta ningún request nuevo</strong>: la página del
		recurso ya carga el dataset y sus recursos.
	</p>

	<div class="mt-4 flex gap-5 overflow-x-auto pb-4">
		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">B1. El dataset del breadcrumb abre la lista</div>
			<div class={marco}>
				<nav aria-label="Breadcrumb">
					<ol class="flex items-center gap-1 text-sm">
						<li class="flex items-center gap-1">
							<a href="/search" class={etiqueta}>Datasets</a>
						</li>
						<li class="flex items-center gap-1">
							<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
							<DropdownMenu.Root>
								<DropdownMenu.Trigger class="inline-flex items-center gap-1 {etiqueta}">
									<span class="max-w-32 truncate">{datasetTitle}</span>
									<ChevronDown class="size-3.5 shrink-0" aria-hidden="true" />
								</DropdownMenu.Trigger>
								<DropdownMenu.Content class="z-50 min-w-72 rounded-md border border-border bg-popover p-1 shadow-md" sideOffset={6}>
									<DropdownMenu.GroupHeading class="px-2 py-1.5 text-[11px] uppercase tracking-wider {etiqueta}">
										Recursos de este dataset
									</DropdownMenu.GroupHeading>
									{#each resources as resource, index (resource.name)}
										<DropdownMenu.Item
											class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
										>
											<span class="w-14 shrink-0 font-mono text-[10px] {etiqueta}">{resource.format}</span>
											<a
												href={`/dataset/observatorio-movilidad/resource/${index + 1}`}
												class="truncate"
											>
												{resource.name}
											</a>
										</DropdownMenu.Item>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</li>
						<li class="flex items-center gap-1">
							<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
							<span class="truncate font-medium text-foreground" aria-current="page">{actual.name}</span>
						</li>
					</ol>
				</nav>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				Cero elementos nuevos en pantalla: el salto vive donde el usuario ya mira. El breadcrumb deja
				de ser sólo un recorrido y pasa a ser también un selector.
			</p>
		</div>

		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">B2. «Recurso 4 de 5» en el encabezado</div>
			<div class={marco}>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class="inline-flex items-center gap-1.5 text-xs {etiqueta}">
						<FileText class="size-3.5 shrink-0" aria-hidden="true" />
						Recurso {posicion} de {resources.length}
						<ChevronDown class="size-3.5 shrink-0" aria-hidden="true" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="z-50 min-w-72 rounded-md border border-border bg-popover p-1 shadow-md" sideOffset={6}>
						{#each resources as resource, index (resource.name)}
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
							>
								<span class="w-4 shrink-0 font-mono text-[10px] {etiqueta}">{index + 1}</span>
								<a
									href={`/dataset/observatorio-movilidad/resource/${index + 1}`}
									class="truncate"
								>
									{resource.name}
								</a>
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				Explícito y descubrible: dice qué es (un selector de recurso) y cuántos hay. Ocupa lugar en el
				encabezado, que ya tiene chips, título y acciones.
			</p>
		</div>

		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">B3. Anterior y siguiente</div>
			<div class={marco}>
				<div class="flex items-center gap-2 text-sm">
					<button type="button" class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs {etiqueta}">
						<ChevronLeft class="size-3.5" aria-hidden="true" />
						<span class="max-w-24 truncate">{resources[2].name}</span>
					</button>
					<span class="shrink-0 font-mono text-[10px] {etiqueta}">{posicion}/{resources.length}</span>
					<button type="button" class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs {etiqueta}">
						<span class="max-w-24 truncate">{resources[4].name}</span>
						<ChevronRight class="size-3.5" aria-hidden="true" />
					</button>
				</div>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				Lo mejor para recorrer el dataset en orden, que es el uso más común (revisar uno tras otro).
				No sirve para saltar al último de doce.
			</p>
		</div>

		<div class="w-full max-w-3xl shrink-0">
			<div class="mb-2 text-sm font-medium">B4. Lista lateral del dataset (escritorio)</div>
			<div class={marco}>
				<ul class="space-y-1 text-sm">
					{#each resources as resource, index (resource.name)}
						<li>
							<a
								href={`/dataset/observatorio-movilidad/resource/${index + 1}`}
								class="flex items-center gap-2 rounded-md px-2 py-1.5 {index + 1 === posicion
									? 'bg-accent font-medium text-foreground'
									: etiqueta + ' hover:bg-accent'}"
								aria-current={index + 1 === posicion ? "page" : undefined}
							>
								<span class="w-4 shrink-0 font-mono text-[10px]">{index + 1}</span>
								<span class="w-14 shrink-0 font-mono text-[10px]">{resource.format}</span>
								<span class="truncate">{resource.name}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				El más útil para comparar dentro de un dataset —se ve todo, con formato y posición— pero el
				aside en móvil es una columna que empuja el contenido, así que suele ir colapsado o sólo en
				<em>lg</em>.
			</p>
		</div>
	</div>

	<section class="mt-8 rounded-xl border border-border bg-card p-5">
		<h2 class="font-heading text-lg font-semibold">Cómo mirarlas</h2>
		<ul class="mt-2 list-disc space-y-1.5 pl-5 text-sm {etiqueta}">
			<li>
				<strong>A:</strong> la pregunta de fondo es si el breadcrumb tiene que ser <em>completo</em> o
				<em>suficiente</em>. A1 conserva todo (recortado a la vista); A2 y A3 dicen sólo cómo volver;
				A4 es el término medio de shadcn.
			</li>
			<li>
				<strong>B:</strong> B1 y B3 se pueden combinar sin ruido (el salto donde ya se mira + avanzar en
				orden); B2 es el más explícito y el que más lugar pide; B4 sólo tiene sentido de <em>lg</em> para
				arriba.
			</li>
			<li>
				Ninguna de las ocho toca el modelo de datos: los recursos ya vienen con el dataset y con su
				<em>position</em>, que es lo que ordena B3 y B4.
			</li>
		</ul>
	</section>
</div>
