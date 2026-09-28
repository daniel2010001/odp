<script lang="ts">
// Hoja de revisión — **versionada** desde el 2026-09-24 (`fac7cd3`). No es un playground: es el
// instrumento de estas decisiones y se conserva, como `/dev/kind`, `/dev/copy`, `/dev/error` y
// `/dev/preview`. Se versionó también por una razón mecánica: una hoja sin versionar rompe la proyección
// del candidato de una compuerta de revisión.
//
// Tres decisiones, una hoja:
//   A. Qué hace el breadcrumb en móvil (hoy trunca; hay cuatro alternativas más A5, la propuesta elegida).
//   B. Cómo se salta de un recurso a otro dentro del mismo dataset (hoy no se puede).
//   C. La combinación elegida, en la página del recurso y en móvil.
//   D. Los dos TODO **de escritorio**, con una variable por marco: los marcos de A/B/C son de 375px y no
//      pueden mostrar un problema que sólo existe de `lg` para arriba.
////
// Los datos son los REALES del catálogo de desarrollo (`observatorio-de-movilidad-urbana-cochabamba`,
// 5 recursos), así que los nombres largos son los que el usuario realmente ve.
//
// A1 importa el componente REAL, para que el «hoy» no pueda quedar desfasado.
import {
	ArrowLeft,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Database,
	FileText,
} from "@lucide/svelte";
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
	// Con `role`, como la página real: es lo que rotula cada fila del desplegable del chip («Catálogo»,
	// «Dataset», «CSV»). Sin él, una lista de nombres largos no dice **qué es** cada cosa.
	{ label: "Datasets", href: "/search", role: "Catálogo" },
	{ label: org, role: "Organización" },
	{ label: datasetTitle, href: "/dataset/observatorio-movilidad", role: "Dataset" },
	{ label: actual.name, role: "Recurso" },
];

/** El grupo extra del chip: los hermanos del recurso abierto. El actual va **sin `href`**, como en la página. */
const relatedGroup = {
	heading: "Recursos de este dataset",
	items: resources.map((resource, index) => ({
		label: resource.name,
		role: resource.format,
		href:
			index + 1 === posicion ? undefined : `/dataset/observatorio-movilidad/resource/${index + 1}`,
	})),
};

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
			Tres decisiones sobre los mismos datos reales (5 recursos). Los desplegables funcionan: al
			hacer clic se abren.
			Lo de móvil está en marcos de <span class="font-mono text-xs">375px</span>; lo de escritorio, en
			marcos de <span class="font-mono text-xs">1100px</span> (sección D).
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

	<h2 class="mt-10 font-heading text-2xl font-bold text-foreground">
		A5. Tu propuesta: la ruta <em>actual</em> con su ícono, y el árbol adentro
	</h2>
	<p class="mt-1 max-w-3xl text-sm leading-relaxed {etiqueta}">
		En vez de una flecha de «volver», el breadcrumb muestra <strong>dónde estás</strong> —el ícono dice de
		qué tipo de cosa se trata— y el desplegable lleva al resto del recorrido. Dos contextos, porque el
		chip cambia con el nivel.
	</p>
	<div class="mt-4 flex gap-5 overflow-x-auto pb-4">
		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">En la página del <em>dataset</em></div>
			<div class={marco}>
				<nav aria-label="Breadcrumb">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm hover:bg-accent"
						>
							<Database class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span class="truncate font-medium text-foreground">{datasetTitle}</span>
							<ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md"
							sideOffset={6}
						>
							<div class="px-2 py-1.5 text-[11px] uppercase tracking-wider {etiqueta}">
								Recorrido
							</div>
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
							>
								<span class="w-24 shrink-0 text-[11px] {etiqueta}">Catálogo</span>
								<a href="/search" class="truncate">Datasets</a>
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
							>
								<span class="w-24 shrink-0 text-[11px] {etiqueta}">Organización</span>
								<span class="truncate">{org}</span>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</nav>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				El chip dice «este es el dataset» con el ícono <em>Database</em>, y el desplegable muestra de dónde
				viene. No hay acción de volver: volver es el botón del navegador.
			</p>
		</div>

		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">En la página del <em>recurso</em></div>
			<div class={marco}>
				<nav aria-label="Breadcrumb">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm hover:bg-accent"
						>
							<FileText class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
							<span class="truncate font-medium text-foreground">{actual.name}</span>
							<ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md"
							sideOffset={6}
						>
							<div class="px-2 py-1.5 text-[11px] uppercase tracking-wider {etiqueta}">
								Recorrido
							</div>
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
							>
								<span class="w-24 shrink-0 text-[11px] {etiqueta}">Catálogo</span>
								<a href="/search" class="truncate">Datasets</a>
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
							>
								<span class="w-24 shrink-0 text-[11px] {etiqueta}">Organización</span>
								<span class="truncate">{org}</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
							>
								<span class="w-24 shrink-0 text-[11px] {etiqueta}">Dataset</span>
								<a href="/dataset/observatorio-movilidad" class="truncate">{datasetTitle}</a>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</nav>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				El mismo chip, ahora con el ícono <em>FileText</em>: el recorrido crece un nivel y el chip no cambia
				de tamaño. El nombre del archivo se recorta, no envuelve.
			</p>
		</div>

		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">A6. «…» + la página actual (tu pedido)</div>
			<div class={marco}>
				<nav aria-label="Breadcrumb">
					<ol class="flex items-center gap-1 text-sm">
						<li class="flex items-center gap-1">
							<DropdownMenu.Root>
								<DropdownMenu.Trigger
									class="inline-flex size-6 items-center justify-center rounded-md border border-border {etiqueta}"
									aria-label="Mostrar el recorrido"
								>
									…
								</DropdownMenu.Trigger>
								<DropdownMenu.Content
									class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md"
									sideOffset={6}
								>
									{#each items.slice(0, -1) as item (item.label)}
										{#if item.href}
											<DropdownMenu.Item
												class="rounded-sm p-0 outline-none data-[highlighted]:bg-accent"
											>
												<a
													href={item.href}
													class="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
												>
													<span class="w-24 shrink-0 text-[11px] {etiqueta}">
														{item.role}
													</span>
													<span class="truncate">{item.label}</span>
												</a>
											</DropdownMenu.Item>
										{:else}
											<div class="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
												<span class="w-24 shrink-0 text-[11px] {etiqueta}">{item.role}</span>
												<span class="truncate {etiqueta}">{item.label}</span>
											</div>
										{/if}
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</li>
						<li class="flex items-center gap-1">
							<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
							<span class="truncate font-medium text-foreground" aria-current="page"
								>{actual.name}</span
							>
						</li>
					</ol>
				</nav>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				El aspecto de A4 —migas de texto y un botón chico de <code>…</code>, no un chip-promedio— con
				<strong>un solo extremo visible: la página actual</strong>. El recorrido entero queda a un clic, con
				su rótulo de nivel, y la fila visible no compite con nada. Es el pedido: A4 sin los dos extremos.
				Detalle de la revisión de E7 incorporado: un ancestro <strong>sin destino</strong> no se ofrece
				como fila de menú (sería una fila que no hace nada), va como texto.
			</p>
		</div>

		<div class="w-[375px] shrink-0">
			<div class="mb-2 text-sm font-medium">A7. El estilo de A6, con ícono y título ancho (lo que pediste)</div>
			<div class={marco}>
				<nav aria-label="Breadcrumb">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="inline-flex min-w-0 max-w-full items-center gap-2 py-1 text-sm {etiqueta} hover:text-foreground"
						>
							<FileText class="size-4 shrink-0" aria-hidden="true" />
							<span class="truncate font-medium text-foreground">{actual.name}</span>
							<ChevronDown class="size-4 shrink-0" aria-hidden="true" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md"
							sideOffset={6}
						>
							<div class="px-2 py-1.5 text-[11px] uppercase tracking-wider {etiqueta}">Recorrido</div>
							{#each items.slice(0, -1) as item (item.label)}
								{#if item.href}
									<DropdownMenu.Item class="rounded-sm p-0 outline-none data-[highlighted]:bg-accent">
										<a href={item.href} class="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
											<span class="w-24 shrink-0 text-[11px] {etiqueta}">{item.role}</span>
											<span class="truncate">{item.label}</span>
										</a>
									</DropdownMenu.Item>
								{:else}
									<div class="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
										<span class="w-24 shrink-0 text-[11px] {etiqueta}">{item.role}</span>
										<span class="truncate {etiqueta}">{item.label}</span>
									</div>
								{/if}
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</nav>
			</div>
			<p class="mt-2 text-xs leading-relaxed {etiqueta}">
				Toma de A5 lo que te servía —<strong>el ícono</strong> y <strong>el título completo como zona de
				toque</strong>, que es lo que hace fácil acertarle en móvil— y de A6 el estilo: <strong>nada de
				chip</strong>, sin borde ni fondo de botón, con los íconos a <code>size-4</code> y relleno vertical
				en vez del botón chico de <code>…</code>. El disparador es la fila entera del título. Si el subtítulo
				te parece demasiado «desnudo» para un nivel de navegación, el punto medio es un borde inferior en
				<code>hover</code> y no un fondo permanente.
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
								<DropdownMenu.Content class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md" sideOffset={6}>
									<div class="px-2 py-1.5 text-[11px] uppercase tracking-wider {etiqueta}">
										Recursos de este dataset
									</div>
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
					<DropdownMenu.Content class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md" sideOffset={6}>
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
		<h2 class="font-heading text-lg font-semibold">C. Los dos juntos, en la página del recurso (móvil)</h2>
		<p class="mt-1 max-w-3xl text-sm leading-relaxed {etiqueta}">
			La combinación que elegiste: el breadcrumb como chip de contexto (A5) y el selector de recurso en el
			encabezado (B2). Así queda todo en 375px, con el título y el chip de formato reales.
		</p>
		<div class="mt-4 w-[375px] max-w-full rounded-md border border-border bg-card p-3">
			<nav aria-label="Breadcrumb" class="mb-3">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm hover:bg-accent"
					>
						<FileText class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
						<span class="truncate font-medium text-foreground">{actual.name}</span>
						<ChevronDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md"
						sideOffset={6}
					>
						<DropdownMenu.Item
							class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
						>
							<span class="w-24 shrink-0 text-[11px] {etiqueta}">Dataset</span>
							<a href="/dataset/observatorio-movilidad" class="truncate">{datasetTitle}</a>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</nav>
			<div class="flex flex-wrap items-center gap-2">
				<span class="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold {etiqueta}">CSV</span>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class="inline-flex items-center gap-1.5 text-xs {etiqueta} hover:text-foreground">
						Recurso {posicion} de {resources.length}
						<ChevronDown class="size-3.5 shrink-0" aria-hidden="true" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						class="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-1 shadow-md"
						sideOffset={6}
					>
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
			<h1 class="mt-2 font-heading text-2xl font-bold leading-tight text-primary">{actual.name}</h1>
		</div>
		<p class="mt-3 max-w-3xl text-xs leading-relaxed {etiqueta}">
			Lo que hay que mirar: con dos desplegables en la misma pantalla, el del <strong>chip</strong> lleva al
			recorrido («¿dónde estoy?») y el de <strong>«Recurso 4 de 5»</strong> a los hermanos («¿qué más hay?»). Son
			dos preguntas distintas, y por eso conviven sin confundirse.
		</p>
	</section>

	<section class="mt-8 rounded-xl border border-border bg-card p-5">
		<h2 class="font-heading text-lg font-semibold">
			D. En escritorio (≥1024px): los dos TODO, una variable por marco
		</h2>
		<p class="mt-1 max-w-3xl text-sm leading-relaxed {etiqueta}">
			Los marcos de A, B y C miden <span class="font-mono text-xs">375px</span>, y los dos TODO anotados
			(2026-09-24) son <strong>de escritorio</strong>: «los botones de anterior/siguiente se ven chicos y
			pasan desapercibidos» y «en escritorio no hay forma de ver ni saltar a los demás recursos del
			dataset». Un marco de móvil no puede mostrar ninguno de los dos, así que hasta ahora la hoja no
			respondía la pregunta que dice responder. <strong>D1 a D3</strong> van a ancho real con una sola
			variable cambiada por marco; <strong>D4 a D6</strong> son las variantes de la ronda de revisión del
			autor (2026-09-25): el nivel del disparador, el salto separado del breadcrumb, y el nombre completo.
		</p>
		<div class="mt-4 flex gap-5 overflow-x-auto pb-4">
			<div class="w-[1100px] shrink-0">
				<div class="mb-2 text-sm font-medium">D1. Hoy, en escritorio — el componente REAL</div>
				<div class={marco}>
					<div class="flex items-center justify-between gap-4">
						<Breadcrumb {items} icon={FileText} related={relatedGroup} />
						<div class="flex shrink-0 items-center gap-1">
							<span class="mr-1 font-mono text-[10px] {etiqueta}">
								Recurso {posicion} de {resources.length}
							</span>
							<a
								href={`/dataset/observatorio-movilidad/resource/${posicion - 1}`}
								aria-label={`Recurso anterior: ${resources[posicion - 2].name}`}
								title={resources[posicion - 2].name}
								class="rounded-md p-1.5 {etiqueta} transition-colors hover:bg-accent hover:text-foreground"
							>
								<ChevronLeft class="size-4" aria-hidden="true" />
							</a>
							<a
								href={`/dataset/observatorio-movilidad/resource/${posicion + 1}`}
								aria-label={`Recurso siguiente: ${resources[posicion].name}`}
								title={resources[posicion].name}
								class="rounded-md p-1.5 {etiqueta} transition-colors hover:bg-accent hover:text-foreground"
							>
								<ChevronRight class="size-4" aria-hidden="true" />
							</a>
						</div>
					</div>
				</div>
				<p class="mt-2 text-xs leading-relaxed {etiqueta}">
					Los dos TODO en una sola imagen. <strong>El salto:</strong> el recorrido de escritorio es una
					lista sin desplegable, porque el grupo de hermanos vive en el chip del componente, que es
					<em>lg:hidden</em> — de <em>lg</em> para arriba no existe. <strong>La presencia:</strong> los dos
					controles son dos íconos de 16px, sin borde y sin rótulo; el único texto es el contador en 10px.
					El marcado de esos dos controles está <em>copiado</em> de la página real (todavía no es un
					componente), así que puede quedar desfasado: es el único marco de esta hoja que no importa lo
					real.
				</p>
			</div>
			<div class="w-[1100px] shrink-0">
				<div class="mb-2 text-sm font-medium">
					D2. Sólo el salto: el grupo de hermanos, en el recorrido de escritorio
				</div>
				<div class={marco}>
					<div class="flex items-center justify-between gap-4">
						<nav aria-label="Breadcrumb">
							<ol class="flex items-center gap-1 text-sm">
								<li><a href="/search" class={etiqueta}>Catálogo</a></li>
								<li class="flex items-center gap-1">
									<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											class="inline-flex items-center gap-1 {etiqueta} hover:text-foreground"
										>
											<span class="max-w-64 truncate">{datasetTitle}</span>
											<ChevronDown class="size-3.5 shrink-0" aria-hidden="true" />
										</DropdownMenu.Trigger>
										<DropdownMenu.Content
											class="z-50 min-w-96 rounded-md border border-border bg-popover p-1 shadow-md"
											sideOffset={6}
										>
											<div class="px-2 py-1.5 text-[11px] uppercase tracking-wider {etiqueta}">
												Recursos de este dataset
											</div>
											{#each resources as resource, index (resource.name)}
												{@const esActual = index + 1 === posicion}
												<DropdownMenu.Item
													class="rounded-sm p-0 outline-none data-[highlighted]:bg-accent"
													aria-current={esActual ? "page" : undefined}
												>
													{#if esActual}
														<span
															class="flex w-full items-center gap-2 px-2 py-1.5 text-sm font-medium text-foreground"
														>
															<span class="w-14 shrink-0 font-mono text-[10px] {etiqueta}">
																{resource.format}
															</span>
															<span class="truncate">{resource.name}</span>
														</span>
													{:else}
														<a
															href={`/dataset/observatorio-movilidad/resource/${index + 1}`}
															class="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
														>
															<span class="w-14 shrink-0 font-mono text-[10px] {etiqueta}">
																{resource.format}
															</span>
															<span class="truncate">{resource.name}</span>
														</a>
													{/if}
												</DropdownMenu.Item>
											{/each}
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</li>
								<li class="flex items-center gap-1">
									<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
									<span class="truncate font-medium text-foreground" aria-current="page"
										>{actual.name}</span
									>
								</li>
							</ol>
						</nav>
						<div class="flex shrink-0 items-center gap-1">
							<span class="mr-1 font-mono text-[10px] {etiqueta}">
								Recurso {posicion} de {resources.length}
							</span>
							<span class="rounded-md p-1.5 {etiqueta}" aria-hidden="true">
								<ChevronLeft class="size-4" />
							</span>
							<span class="rounded-md p-1.5 {etiqueta}" aria-hidden="true">
								<ChevronRight class="size-4" />
							</span>
						</div>
					</div>
				</div>
				<p class="mt-2 text-xs leading-relaxed {etiqueta}">
					La implementación más chica de las dos: el grupo de hermanos <strong>ya existe</strong> en el
					desplegable del chip, así que esto no agrega interfaz nueva —la mueve a donde el recorrido de
					escritorio ya mira—. De paso borra la asimetría de <em>lg:hidden</em>, que hoy deja
					<strong>dos DOMs</strong> para la misma navegación (lo señaló la revisión de E7,
					<code>review-c918f32f7c87a968</code>, <code>R3-002</code>). Los dos controles quedan igual que
					hoy: acá cambia <strong>una sola cosa</strong>.
				</p>
			</div>
			<div class="w-[1100px] shrink-0">
				<div class="mb-2 text-sm font-medium">
					D3. Sólo la presencia: anterior/siguiente como control con nombre
				</div>
				<div class={marco}>
					<div class="flex items-center justify-between gap-4">
						<Breadcrumb {items} icon={FileText} related={relatedGroup} />
						<div class="flex shrink-0 items-center gap-2">
							<a
								href={`/dataset/observatorio-movilidad/resource/${posicion - 1}`}
								aria-label={`Recurso anterior: ${resources[posicion - 2].name}`}
								class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs {etiqueta} hover:bg-accent hover:text-foreground"
							>
								<ChevronLeft class="size-3.5 shrink-0" aria-hidden="true" />
								<span class="max-w-24 truncate">{resources[posicion - 2].name}</span>
							</a>
							<span class="shrink-0 font-mono text-[10px] {etiqueta}">
								{posicion}/{resources.length}
							</span>
							<a
								href={`/dataset/observatorio-movilidad/resource/${posicion + 1}`}
								aria-label={`Recurso siguiente: ${resources[posicion].name}`}
								class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs {etiqueta} hover:bg-accent hover:text-foreground"
							>
								<span class="max-w-24 truncate">{resources[posicion].name}</span>
								<ChevronRight class="size-3.5 shrink-0" aria-hidden="true" />
							</a>
						</div>
					</div>
				</div>
				<p class="mt-2 text-xs leading-relaxed {etiqueta}">
					El control dice qué hace y a dónde va: borde, nombre del destino y el contador siempre visible
					(en la implementación de hoy el contador está oculto por debajo de <em>sm</em>, así que en móvil
					no hay ni contador). <strong>Nota de semántica:</strong> el marco B3 de esta hoja usa
					<code>&lt;button&gt;</code> para algo que navega; acá van <code>&lt;a href&gt;</code>, que es lo
					correcto y lo que la implementación ya usa.
				</p>
			</div>

			<div class="w-[1100px] shrink-0">
				<div class="mb-2 text-sm font-medium">
					D4. El vs que pediste: el desplegable de hermanos en la miga del RECURSO
				</div>
				<div class={marco}>
					<div class="flex items-center justify-between gap-4">
						<nav aria-label="Breadcrumb">
							<ol class="flex items-center gap-1 text-sm">
								<li><a href="/search" class={etiqueta}>Catálogo</a></li>
								<li class="flex items-center gap-1">
									<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
									<span class="max-w-64 truncate {etiqueta}">{datasetTitle}</span>
								</li>
								<li class="flex items-center gap-1">
									<ChevronRight class="size-3.5 shrink-0 {etiqueta}" aria-hidden="true" />
									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											class="inline-flex min-w-0 items-center gap-1 font-medium text-foreground hover:text-primary"
										>
											<span class="max-w-72 truncate">{actual.name}</span>
											<ChevronDown class="size-3.5 shrink-0" aria-hidden="true" />
										</DropdownMenu.Trigger>
										<DropdownMenu.Content
											class="z-50 min-w-96 rounded-md border border-border bg-popover p-1 shadow-md"
											sideOffset={6}
										>
											<div class="px-2 py-1.5 text-[11px] uppercase tracking-wider {etiqueta}">
												Recursos de este dataset
											</div>
											{#each resources as resource, index (resource.name)}
												{@const esActual = index + 1 === posicion}
												<DropdownMenu.Item
													class="rounded-sm p-0 outline-none data-[highlighted]:bg-accent"
													aria-current={esActual ? "page" : undefined}
												>
													{#if esActual}
														<span
															class="flex w-full items-center gap-2 px-2 py-1.5 text-sm font-medium text-foreground"
														>
															<span class="w-14 shrink-0 font-mono text-[10px] {etiqueta}">
																{resource.format}
															</span>
															<span class="truncate">{resource.name}</span>
														</span>
													{:else}
														<a
															href={`/dataset/observatorio-movilidad/resource/${index + 1}`}
															class="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
														>
															<span class="w-14 shrink-0 font-mono text-[10px] {etiqueta}">
																{resource.format}
															</span>
															<span class="truncate">{resource.name}</span>
														</a>
													{/if}
												</DropdownMenu.Item>
											{/each}
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</li>
							</ol>
						</nav>
						<div class="flex shrink-0 items-center gap-1">
							<span class="mr-1 font-mono text-[10px] {etiqueta}">
								Recurso {posicion} de {resources.length}
							</span>
							<span class="rounded-md p-1.5 {etiqueta}" aria-hidden="true">
								<ChevronLeft class="size-4" />
							</span>
							<span class="rounded-md p-1.5 {etiqueta}" aria-hidden="true">
								<ChevronRight class="size-4" />
							</span>
						</div>
					</div>
				</div>
				<p class="mt-2 text-xs leading-relaxed {etiqueta}">
					<strong>A favor:</strong> los hermanos <em>son</em> del nivel del recurso, así que el disparador
					queda en el nivel que ordena. <strong>En contra:</strong> la miga actual pasa a ser un control, y
					<code>aria-current="page"</code> convive con un botón que abre un menú — la página deja de ser un
					destino para ser un selector. En D2 el disparador es un ancestro, o sea un lugar al que
					<em>sí</em> se puede volver. La comparación completa está en la respuesta, no en el marco.
				</p>
			</div>

			<div class="w-[1100px] shrink-0">
				<div class="mb-2 text-sm font-medium">
					D5. El salto en su PROPIA fila, con rótulo (tu objeción principal)
				</div>
				<div class={marco}>
					<div class="border-b border-border/70 pb-2">
						<Breadcrumb {items} icon={FileText} related={relatedGroup} />
					</div>
					<div class="flex items-center justify-between gap-4 pt-2">
						<div class="flex items-center gap-2">
							<span
								class="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold {etiqueta}"
								>PDF</span
							>
							<span class="font-mono text-[10px] {etiqueta}">4 de 5</span>
						</div>
						<div class="flex items-center gap-2">
							<a
								href={`/dataset/observatorio-movilidad/resource/${posicion - 1}`}
								aria-label={`Recurso anterior: ${resources[posicion - 2].name}`}
								title={resources[posicion - 2].name}
								class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs {etiqueta} hover:bg-accent hover:text-foreground"
							>
								<ChevronLeft class="size-3.5 shrink-0" aria-hidden="true" />
								<span>Anterior</span>
							</a>
							<a
								href={`/dataset/observatorio-movilidad/resource/${posicion + 1}`}
								aria-label={`Recurso siguiente: ${resources[posicion].name}`}
								title={resources[posicion].name}
								class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs {etiqueta} hover:bg-accent hover:text-foreground"
							>
								<span>Siguiente</span>
								<ChevronRight class="size-3.5 shrink-0" aria-hidden="true" />
							</a>
						</div>
					</div>
				</div>
				<p class="mt-2 text-xs leading-relaxed {etiqueta}">
					Responde a las dos objeciones juntas. <strong>La fila:</strong> el breadcrumb y el salto dejan de
					compartir línea, así que ninguno le roba el foco al otro. <strong>El texto:</strong> el botón dice
					<em>Anterior</em>/<em>Siguiente</em> —corto, estable, siempre entendible— y el nombre del destino
					va en <code>title</code> y <code>aria-label</code>, que es exactamente lo que la implementación de
					hoy ya hace. Así el botón <strong>no crece con nombres largos</strong> y tampoco queda un
					<em>truncate</em> que no se entiende.
				</p>
			</div>

			<div class="w-[1100px] shrink-0">
				<div class="mb-2 text-sm font-medium">
					D6. El nombre completo al pasar el mouse (prototipo, NO la implementación)
				</div>
				<div class="{marco} flex items-start gap-8">
					<div class="group relative shrink-0 pt-1">
						<span class="block max-w-40 truncate text-sm {etiqueta}">
							{actual.name}
						</span>
						<div
							class="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-max max-w-md rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md group-hover:block"
						>
							{actual.name}
						</div>
					</div>
					<p class="max-w-2xl text-xs leading-relaxed {etiqueta}">
						Esto es <strong>sólo la idea, hecha en CSS</strong>, para que se vea: el nombre recortado se
						completa al pasar el mouse. <strong>No es la implementación</strong> —y le falta el camino de
						teclado a propósito—: para que el foco lo revele hace falta un elemento enfocable, y el primer
						intento de esta hoja le puso <code>tabindex="0"</code> a un <code>&lt;span&gt;</code>, que es
						justo lo que <code>svelte-check</code> marca como violación
						(<code>a11y_no_noninteractive_tabindex</code>). El primitivo real —el <code>Tooltip</code> de
						bits-ui— trae ese manejo.
						Lo que el repositorio hace hoy en estos casos es el atributo <code>title</code> nativo —el menú
						de búsqueda (<code>FacetFilter.svelte:113</code>) y los dos botones de la página del recurso—:
						aparece lento, no existe en táctil y no se puede estilar. La alternativa real es
						<strong>vendorizar el <code>Tooltip</code> de bits-ui</strong>, que el <code>AGENTS.md</code>
						lista como el primitivo a usar antes de escribir comportamiento a mano:
						<strong>todavía no está en el repositorio</strong>, hay que agregarlo (es un componente nuevo,
						con su propio ciclo).
					</p>
				</div>
			</div>
		</div>
	</section>

	<section class="mt-8 rounded-xl border border-border bg-card p-5">
		<h2 class="font-heading text-lg font-semibold">Cómo mirarlas</h2>
		<ul class="mt-2 list-disc space-y-1.5 pl-5 text-sm {etiqueta}">
			<li>
				<strong>A:</strong> la pregunta de fondo es si el breadcrumb tiene que ser <em>completo</em> o
				<em>suficiente</em>. A1 conserva todo (recortado a la vista); A2 y A3 dicen sólo cómo volver;
				A4 es el término medio de shadcn; <strong>A5</strong> es el chip (ruta actual + árbol adentro),
				<strong>A6</strong> es su aspecto sin el chip-promedio y con un solo extremo visible, y
				<strong>A7</strong> combina lo que el autor pidió: el estilo de A6 con el ícono y el título como
				zona de toque.
			</li>
			<li>
				<strong>B:</strong> B1 y B3 se pueden combinar sin ruido (el salto donde ya se mira + avanzar en
				orden); B2 es el más explícito y el que más lugar pide; B4 sólo tiene sentido de <em>lg</em> para
				arriba.
			</li>
			<li>
				<strong>D:</strong> los dos TODO de escritorio. <strong>D2 es la implementación</strong> del salto
				—el grupo ya existe en el chip, así que es moverlo, no crearlo, y de paso quita los dos DOMs—;
				<strong>D3 es la presencia</strong> de anterior/siguiente, que es un problema distinto (alcance
				contra visibilidad) y se combina con D2 sin conflicto. <strong>D4</strong> es el vs del nivel del
				disparador (miga del dataset contra miga del recurso); <strong>D5</strong> separa el salto del
				breadcrumb y le pone rótulo, que es la respuesta a «el breadcrumb se come al salto» y al problema
				del texto en D3; <strong>D6</strong> muestra la idea del nombre completo, con la advertencia de que
				la implementación real exige vendorizar el <code>Tooltip</code>.
			</li>
			<li>
				Ninguna de estas variantes toca el modelo de datos: los recursos ya vienen con el dataset y con su
				<em>position</em>, que es lo que ordena B3, B4 y D2.
			</li>
		</ul>
	</section>
</div>
