<!--
	Hoja de revisión del hero del dataset — `/dev/dataset-hero`.

	Decide **dónde vive el botón «Copiar enlace»** en el hero de la página del dataset. La página
	real lo pone hoy `[copiar] [título] [Editar]` en una sola fila, y el autor rechazó ese
	tratamiento por quedar «pegado al título». La prescripción a comparar vive en
	`src/routes/dev/dataset-edit/+page.svelte` (sección 3): título, «Actualizado …» e insignias a la
	izquierda, acciones («Editar») como grupo a la derecha, con `flex flex-wrap items-start
	justify-between gap-4`.

	─── Qué es real y qué es copia ─────────────────────────────────────
	Real (se importa del repo):
	  · `cn` de `$lib/utils` y los iconos de `@lucide/svelte`.
	  · Los tokens de `src/app.css`: todas las clases salen de ahí, ninguna de un hex crudo.
	Copia (declarada acá, no importada):
	  · El markup del hero, duplicado de `src/routes/dataset/[id]/+page.svelte`: la fila del título,
	    «Actualizado …», la fila de insignias y el enlace «Editar». La convención del repo es que el
	    playground duplica la página real, el autor revisa y recién entonces se promueve (regla 8).
	  · La nota de permiso, duplicada de `dataset-edit`. El estado de permiso es un preset elegido a
	    mano; en la página real sale de `orgsEditables` contra el `owner_org` de CKAN.
	El instrumento (`formatHeroMeasurement`) es de la hoja, no de producto.

	─── Variantes e interruptores ──────────────────────────────────────
	Un interruptor por variante (regla 8): apagar una deja ver las otras sin perder el caso.
	  A · Copiar junto al título (hoy): la fila única que el autor rechazó.
	  B · Copiar en el grupo de acciones: la prescripción de `dataset-edit`.
	  C · Copiar en la fila de insignias: el hero queda sin botón propio.
	  D · B y C fusionadas (pedido del autor): el grupo de acciones viaja en la MISMA fila del título.
	  E · Sólo copiar, en la fila del título: el caso fijado en que la única acción es copiar.
	  F · Acciones a la altura de las insignias (pedido del autor): el título ocupa la primera fila
	      solo y a lo ancho, y debajo van las insignias a la izquierda y el grupo copiar + «Editar»
	      a la derecha. D y E dejan las acciones en la fila del título; F las baja a la fila de las
	      insignias para comparar ese reparto.

	─── El instrumento no miente sobre la fila ─────────────────────────
	La columna «Fila con» declara explícitamente con qué comparte fila el botón de copiar. Antes
	«Misma fila» lo comparaba contra el TÍTULO, y en F esa comparación no significa nada: las
	automáticas comparten la fila de las INSIGNIAS. La separación horizontal y vertical se sigue
	midiendo contra el título, que es la queja «pegado al título».

	─── Nota de la variante B ──────────────────────────────────────────
	El botón sólo ícono usa `title` nativo más `aria-label`. Un tooltip real exigiría vendorizar el
	Tooltip de bits-ui, que este repo no tiene: por eso no se construye esa variante.

	─── Por qué B envuelve y D no ──────────────────────────────────────
	La prescripción de `dataset-edit` usa `flex flex-wrap items-start justify-between gap-4`. Con un
	título largo la fila **envuelve**, y una línea de flex envuelta con un solo ítem **ignora
	`justify-between`**: el grupo de acciones cae en la línea siguiente alineado a la IZQUIERDA, lo
	contrario de lo que la prescripción dice. B envuelve porque su columna de texto no puede
	encogerse: con `flex-wrap` la columna toma el ancho de su contenido y empuja al grupo. Por eso B
	lleva `ml-auto`, que sostiene el borde derecho **aun después** de envolver. No se ve leyendo el
	código: apareció al renderizar el caso de título largo.
	D, en cambio, no envuelve: su fila no declara `flex-wrap`, la columna de texto lleva
	`flex-1 min-w-0` y el grupo `shrink-0`. Así el título se parte **dentro de su columna** y las
	acciones conservan la fila y el borde derecho. Ése es el mecanismo que D existe para fijar.
	E repite el reparto de D y fija el caso de sólo copiar, para verlo sin cambiar de preset.
-->
<script lang="ts">
import { Building2, Check, Link2, Pencil, ShieldAlert } from "@lucide/svelte";
import { cn } from "$lib/utils";
import { type FormattedHeroMeasurement, formatHeroMeasurement } from "./measures";

// ─── Presets de caso (copia: el permiso real es un dato de CKAN, no un preset) ───
type PermState = "puede-editar" | "no-puede-editar" | "permiso-fallo";

interface Preset {
	id: string;
	label: string;
	permState: PermState;
	longTitle: boolean;
	isPrivate: boolean;
}

const PRESETS: Preset[] = [
	{
		id: "puede-editar",
		label: "Puede editar / público",
		permState: "puede-editar",
		longTitle: false,
		isPrivate: false,
	},
	{
		id: "no-puede-editar",
		label: "No puede editar",
		permState: "no-puede-editar",
		longTitle: false,
		isPrivate: false,
	},
	{
		id: "permiso-fallo",
		label: "Falló la verificación de permiso",
		permState: "permiso-fallo",
		longTitle: false,
		isPrivate: false,
	},
	{
		id: "titulo-largo",
		label: "Título muy largo",
		permState: "puede-editar",
		longTitle: true,
		isPrivate: false,
	},
	{
		id: "privado",
		label: "Privado",
		permState: "puede-editar",
		longTitle: false,
		isPrivate: true,
	},
	{
		id: "publico",
		label: "Público",
		permState: "puede-editar",
		longTitle: false,
		isPrivate: false,
	},
];

const NORMAL_TITLE = "Observatorio de Movilidad Urbana — Cochabamba";
const LONG_TITLE =
	"Registro histórico consolidado de flujos vehiculares, accidentalidad vial y cobertura del " +
	"transporte público del área metropolitana de Cochabamba (2019–2025)";
const ORG = "Facultad de Ciencias y Tecnología";
const UPDATED = "18 de junio de 2025";

// ─── Variantes (un interruptor por variante) ────────────────────────
interface Variant {
	id: "a" | "b" | "c" | "d" | "e" | "f";
	label: string;
	description: string;
}

const VARIANTS: Variant[] = [
	{
		id: "a",
		label: "A · Copiar junto al título (hoy)",
		description:
			"La fila única de la página real. El botón de copiar queda pegado a la primera letra del título: es el tratamiento que el autor rechazó.",
	},
	{
		id: "b",
		label: "B · Copiar en el grupo de acciones",
		description:
			"Título, «Actualizado …» e insignias a la izquierda; copiar y «Editar» como grupo a la derecha. El título respira y las acciones se leen como una unidad.",
	},
	{
		id: "c",
		label: "C · Copiar en la fila de insignias",
		description:
			"El hero no lleva botón propio: copiar baja a la fila de insignias, junto a las etiquetas de estado y visibilidad.",
	},
	{
		id: "d",
		label: "D · B y C fusionadas",
		description:
			"Fusión pedida por el autor: el título a la izquierda y el grupo copiar + «Editar» a la derecha en la MISMA fila. La columna de texto lleva `flex-1 min-w-0` y el grupo `shrink-0`, así que el título se parte dentro de su columna y el grupo nunca cae a una línea propia. Las insignias quedan bajo el título.",
	},
	{
		id: "e",
		label: "E · Sólo copiar, en la fila del título",
		description:
			"Mismo reparto que D, fijado al caso en que la única acción disponible es copiar. El botón queda deliberadamente solo en la fila del título, no como un grupo al que le falta una pieza. Se fija el caso para poder compararlo con D sin cambiar de preset.",
	},
	{
		id: "f",
		label: "F · Acciones a la altura de las insignias",
		description:
			"El título ocupa la primera fila solo y a lo ancho. Debajo, las insignias a la izquierda y el grupo copiar + «Editar» a la derecha, con `flex flex-wrap items-center justify-between gap-3`. Compara D y E contra bajar las acciones a la fila de las insignias.",
	},
];

let presetId = $state("puede-editar");
const preset = $derived(PRESETS.find((item) => item.id === presetId) ?? PRESETS[0]);
const title = $derived(preset.longTitle ? LONG_TITLE : NORMAL_TITLE);

let enabled = $state<Record<string, boolean>>({
	a: true,
	b: true,
	c: true,
	d: true,
	e: true,
	f: true,
});
const visibleVariants = $derived(VARIANTS.filter((variant) => enabled[variant.id]));

function toggleVariant(id: string): void {
	enabled = { ...enabled, [id]: !enabled[id] };
}

let copiedVariant = $state<string | null>(null);
// El temporizador del acuse se guarda para poder **cancelarlo**: sin eso el callback dispara
// después del desmontaje (hallazgo `R3-COPY` de la compuerta `review-5667c785ed46242e`).
let copyTimer: ReturnType<typeof setTimeout> | null = null;

// La copia es sólo visual en la hoja: no hay portapapeles que usar en jsdom. Lo que se revisa es
// el tratamiento, no la integración con `navigator.clipboard`. El acuse se anuncia por
// `aria-label` y no sólo por el ícono: un cambio de color no le dice nada a un lector de pantalla.
function handleCopy(variantId: string): void {
	copiedVariant = variantId;
	if (copyTimer !== null) clearTimeout(copyTimer);
	copyTimer = setTimeout(() => {
		if (copiedVariant === variantId) copiedVariant = null;
		copyTimer = null;
	}, 2000);
}

$effect(() => () => {
	if (copyTimer !== null) clearTimeout(copyTimer);
});

// ─── Instrumento: la separación título ↔ copiar ─────────────────────
let sheetRoot = $state<HTMLElement>();
let measurements = $state<FormattedHeroMeasurement[]>([]);

// Con qué comparte fila el botón de copiar. Se resuelve subiendo por el DOM desde el botón hasta
// el primer contenedor que contiene al título o a las insignias: así F —cuyas acciones y
// insignias son hermanas dentro de la misma fila— se reporta como «insignias» sin depender del
// motor de layout, que en jsdom no existe. Si un contenedor tiene a los dos, gana el título: es
// el caso de A, B, D y E, donde las acciones viven en la fila del título.
function resolveRowWith(
	copy: HTMLElement,
	title: HTMLElement,
	badges: HTMLElement,
): "título" | "insignias" | "—" {
	let node: HTMLElement | null = copy.parentElement;
	while (node) {
		if (node.contains(title)) return "título";
		if (node.contains(badges)) return "insignias";
		node = node.parentElement;
	}
	return "—";
}

// El instrumento tiene que re-medirse cuando cambia el ancho: el caso que esta hoja existe para
// evaluar —la fila que envuelve con un título largo— depende del ancho, así que una medición de
// una sola vez queda rancia (hallazgo `R3-RESIZE`).
let resizeTick = $state(0);

$effect(() => {
	const onResize = () => {
		resizeTick += 1;
	};
	window.addEventListener("resize", onResize);
	return () => window.removeEventListener("resize", onResize);
});

$effect(() => {
	// Dependencias del efecto: el caso, las variantes encendidas, la raíz montada y el ancho.
	void preset;
	void visibleVariants;
	void sheetRoot;
	void resizeTick;

	if (!sheetRoot) {
		measurements = [];
		return;
	}

	const next: FormattedHeroMeasurement[] = [];
	for (const variant of visibleVariants) {
		const render = sheetRoot.querySelector<HTMLElement>(
			`[data-testid="hero-render-${variant.id}"]`,
		);
		const titleNode = render?.querySelector<HTMLElement>(
			`[data-testid="hero-title-${variant.id}"]`,
		);
		const copyNode = render?.querySelector<HTMLElement>(`[data-testid="hero-copy-${variant.id}"]`);
		const badgesNode = render?.querySelector<HTMLElement>(
			`[data-testid="hero-badges-${variant.id}"]`,
		);
		if (!render || !titleNode || !copyNode) continue;

		const titleRect = titleNode.getBoundingClientRect();
		const copyRect = copyNode.getBoundingClientRect();
		const gapX = Math.max(copyRect.left - titleRect.right, titleRect.left - copyRect.right, 0);
		const gapY = Math.max(copyRect.top - titleRect.bottom, titleRect.top - copyRect.bottom, 0);
		const rowWith = badgesNode ? resolveRowWith(copyNode, titleNode, badgesNode) : "—";

		next.push(
			formatHeroMeasurement({
				variant: variant.id,
				label: variant.label,
				titleWidth: titleRect.width,
				titleHeight: titleRect.height,
				gapX,
				gapY,
				rowWith,
			}),
		);
	}
	measurements = next;
});
</script>

<svelte:head>
	<title>Hoja de revisión del hero del dataset — UMSS</title>
</svelte:head>

<!-- ─── Snippets compartidos ─────────────────────────────────────────── -->
{#snippet copyButton(variantId: string)}
	<button
		type="button"
		data-testid={`hero-copy-${variantId}`}
		aria-label={copiedVariant === variantId ? "Enlace copiado" : "Copiar enlace del dataset"}
		title="Copiar enlace"
		onclick={() => handleCopy(variantId)}
		class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		{#if copiedVariant === variantId}
			<Check class="size-4 text-emerald-600" aria-hidden="true" />
		{:else}
			<Link2 class="size-4" aria-hidden="true" />
		{/if}
	</button>
{/snippet}

{#snippet editLink(variantId: string)}
	<!-- Copia del enlace «Editar» de la página real. -->
	<a
		href="/dashboard/datasets/observatorio-de-movilidad-urbana-cochabamba/edit"
		data-testid={`hero-edit-${variantId}`}
		class="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		<Pencil class="size-4" aria-hidden="true" />
		Editar
	</a>
{/snippet}

{#snippet badges()}
	<span
		class="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
	>
		<Building2 class="size-3.5" aria-hidden="true" />
		{ORG}
	</span>
	<span
		class="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
	>
		<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
		Activo
	</span>
	<span
		class={cn(
			"inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
			preset.isPrivate
				? "border-destructive/20 bg-destructive/10 text-destructive"
				: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
		)}
	>
		{preset.isPrivate ? "Privado" : "Público"}
	</span>
{/snippet}

{#snippet permissionNote()}
	<!-- Copia de la nota de permiso de `dataset-edit`. -->
	<div
		class="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
		role="status"
		aria-live="polite"
	>
		<ShieldAlert class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		<p class="text-xs leading-relaxed text-muted-foreground">
			<strong class="font-semibold text-foreground"
				>No se pudo verificar si puede editar este dataset.</strong
			>
			La consulta a CKAN no respondió. Recargue la página para intentarlo de nuevo; esto no significa
			que usted no tenga permiso.
		</p>
	</div>
{/snippet}

<div
	data-testid="dataset-hero-sheet"
	bind:this={sheetRoot}
	class="min-h-screen bg-background font-sans text-foreground"
>
	<div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
		<header>
			<h1 class="font-heading text-3xl font-bold text-primary">
				Hoja de revisión del hero del dataset
			</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Compara dónde vive el botón «Copiar enlace» en el hero de la página del dataset. El hero es
				una <strong class="font-semibold text-foreground">copia declarada</strong> de
				<code class="font-mono text-xs">src/routes/dataset/[id]/+page.svelte</code>: los tokens son
				los reales de <code class="font-mono text-xs">src/app.css</code>, pero el markup no se importa
				—la convención del repo es duplicar la página, revisarla y recién entonces promoverla—.
			</p>
		</header>

		<!-- ─── Panel de control ─────────────────────────────────────── -->
		<section
			data-testid="control-panel"
			class="mt-8 rounded-xl border border-border bg-card p-4 sm:p-6"
		>
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div>
					<h2 class="text-sm font-semibold text-card-foreground">Presets de caso</h2>
					<p class="mt-1 text-xs text-muted-foreground">
						Fijan el estado de permiso, la visibilidad y el largo del título. El caso privado y el
						público comparten el resto, para aislar la diferencia de la insignia.
					</p>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each PRESETS as item (item.id)}
							<button
								type="button"
								data-testid={`preset-${item.id}`}
								aria-pressed={presetId === item.id}
								onclick={() => (presetId = item.id)}
								class="rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {presetId ===
								item.id
									? 'bg-primary text-primary-foreground'
									: 'bg-background text-foreground hover:bg-accent'}"
							>
								{item.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<h2 class="text-sm font-semibold text-card-foreground">Variantes</h2>
					<p class="mt-1 text-xs text-muted-foreground">
						Un interruptor por variante: apáguelo para comparar de a dos sin perder el caso.
					</p>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each VARIANTS as variant (variant.id)}
							<button
								type="button"
								role="switch"
								aria-checked={enabled[variant.id]}
								data-testid={`variant-switch-${variant.id}`}
								onclick={() => toggleVariant(variant.id)}
								class="rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {enabled[
									variant.id
								]
									? 'bg-primary text-primary-foreground'
									: 'bg-background text-foreground hover:bg-accent'}"
							>
								{variant.label}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<!-- ─── Las variantes del hero ───────────────────────────────── -->
		<div class="mt-8 space-y-6">
			{#each VARIANTS as variant (variant.id)}
				{#if enabled[variant.id]}
					<article
						data-testid={`hero-variant-${variant.id}`}
						class="overflow-hidden rounded-lg border border-border bg-card"
					>
						<header class="border-b border-border bg-muted px-4 py-3 sm:px-6">
							<h2 class="font-heading text-base font-semibold text-card-foreground">
								{variant.label}
							</h2>
							<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
								{variant.description}
							</p>
						</header>

						<div data-testid={`hero-render-${variant.id}`} class="bg-background px-4 py-6 sm:px-6">
							<div class="mx-auto max-w-4xl">
								{#if variant.id === "a"}
									<!-- Copia de la fila única de la página real. -->
									<div data-testid="hero-row-a" class="flex flex-wrap items-center gap-3">
										{@render copyButton("a")}
										<h1
											data-testid="hero-title-a"
											class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl"
										>
											{title}
										</h1>
										{#if preset.permState === "puede-editar"}
											{@render editLink("a")}
										{/if}
									</div>
									<p class="mt-3 text-sm text-muted-foreground">Actualizado {UPDATED} · {ORG}</p>
									<div
										data-testid="hero-badges-a"
										class="mt-4 flex flex-wrap items-center gap-2"
									>
										{@render badges()}
									</div>
								{:else if variant.id === "b"}
									<!-- Prescripción de `dataset-edit`: acciones como grupo a la derecha. -->
									<div class="flex flex-wrap items-start justify-between gap-4">
										<div class="min-w-0">
											<h1
												data-testid="hero-title-b"
												class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl"
											>
												{title}
											</h1>
											<p class="mt-2 text-sm text-muted-foreground">
												Actualizado {UPDATED} · {ORG}
											</p>
											<div
												data-testid="hero-badges-b"
												class="mt-3 flex flex-wrap items-center gap-2"
											>
												{@render badges()}
											</div>
										</div>
										<div
											data-testid="hero-actions-b"
											class="ml-auto flex shrink-0 items-center gap-2"
										>
											{@render copyButton("b")}
											{#if preset.permState === "puede-editar"}
												{@render editLink("b")}
											{/if}
										</div>
									</div>
								{:else if variant.id === "c"}
									<!-- Copiar baja a la fila de insignias. -->
									<div class="flex flex-wrap items-start justify-between gap-4">
										<div class="min-w-0">
											<h1
												data-testid="hero-title-c"
												class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl"
											>
												{title}
											</h1>
											<p class="mt-2 text-sm text-muted-foreground">
												Actualizado {UPDATED} · {ORG}
											</p>
											<div
												data-testid="hero-badges-c"
												class="mt-3 flex flex-wrap items-center gap-2"
											>
												{@render badges()}
												{@render copyButton("c")}
											</div>
										</div>
										<div
											data-testid="hero-actions-c"
											class="flex shrink-0 items-center gap-2"
										>
											{#if preset.permState === "puede-editar"}
												{@render editLink("c")}
											{/if}
										</div>
									</div>
								{:else if variant.id === "d"}
									<!-- D · Fusión de B y C: una sola fila; el título se parte dentro de su columna. -->
									<div data-testid="hero-row-d" class="flex items-start gap-4">
										<div class="min-w-0 flex-1">
											<h1
												data-testid="hero-title-d"
												class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl"
											>
												{title}
											</h1>
											<p class="mt-2 text-sm text-muted-foreground">
												Actualizado {UPDATED} · {ORG}
											</p>
											<div
												data-testid="hero-badges-d"
												class="mt-3 flex flex-wrap items-center gap-2"
											>
												{@render badges()}
											</div>
										</div>
										<div
											data-testid="hero-actions-d"
											class="flex shrink-0 items-center gap-2"
										>
											{@render copyButton("d")}
											{#if preset.permState === "puede-editar"}
												{@render editLink("d")}
											{/if}
										</div>
									</div>
								{:else if variant.id === "e"}
									<!-- E · Mismo reparto que D, fijado al caso de sólo copiar. -->
									<div data-testid="hero-row-e" class="flex items-start gap-4">
										<div class="min-w-0 flex-1">
											<h1
												data-testid="hero-title-e"
												class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl"
											>
												{title}
											</h1>
											<p class="mt-2 text-sm text-muted-foreground">
												Actualizado {UPDATED} · {ORG}
											</p>
											<div
												data-testid="hero-badges-e"
												class="mt-3 flex flex-wrap items-center gap-2"
											>
												{@render badges()}
											</div>
										</div>
										<div
											data-testid="hero-actions-e"
											class="flex shrink-0 items-center gap-2"
										>
											{@render copyButton("e")}
										</div>
									</div>
								{:else}
									<!-- F · El título ocupa la primera fila solo; insignias y acciones comparten la de abajo. -->
									<div>
										<h1
											data-testid="hero-title-f"
											class="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl"
										>
											{title}
										</h1>
										<p class="mt-2 text-sm text-muted-foreground">
											Actualizado {UPDATED} · {ORG}
										</p>
										<div
											data-testid="hero-badges-row-f"
											class="mt-3 flex flex-wrap items-center justify-between gap-3"
										>
											<div
												data-testid="hero-badges-f"
												class="flex flex-wrap items-center gap-2"
											>
												{@render badges()}
											</div>
											<div data-testid="hero-actions-f" class="flex items-center gap-2">
												{@render copyButton("f")}
												{#if preset.permState === "puede-editar"}
													{@render editLink("f")}
												{/if}
											</div>
										</div>
									</div>
								{/if}

								{#if preset.permState === "permiso-fallo"}
									{@render permissionNote()}
								{/if}
							</div>
						</div>
					</article>
				{/if}
			{/each}
		</div>

		<!-- ─── Instrumento de medición ──────────────────────────────── -->
		<section
			data-testid="instrument"
			class="mt-10 rounded-xl border border-border bg-card p-4 sm:p-6"
		>
			<h2 class="font-heading text-xl font-bold text-primary">Instrumento</h2>
			<p class="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
				Mide la caja del título y su separación hasta el botón de copiar enlace, sobre el nodo ya
				renderizado. Es el número de la queja «pegado al título»: en la fila única la separación es
				la del <code class="font-mono text-[11px]">gap-3</code>, y en las variantes B, C, D y E el botón
				se aleja del título. La columna «Fila con» dice con qué comparte fila el botón —el título o
				las insignias—, que es lo que «Misma fila» daba por sentado y no era cierto en F. Sin motor de
				layout (jsdom) las cifras de separación dan 0; el texto se arma con
				<code class="font-mono text-[11px]">formatHeroMeasurement</code>.
			</p>

			<div class="mt-4 overflow-x-auto">
				<table class="w-full border-collapse text-sm">
					<thead>
						<tr
							class="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"
						>
							<th class="px-3 py-2 font-semibold">Variante</th>
							<th class="px-3 py-2 font-semibold">Título (ancho × alto)</th>
							<th class="px-3 py-2 font-semibold">Separación horizontal</th>
							<th class="px-3 py-2 font-semibold">Separación vertical</th>
							<th class="px-3 py-2 font-semibold">Fila con</th>
						</tr>
					</thead>
					<tbody>
						{#each measurements as row (row.variant)}
							<tr data-testid={`instrument-row-${row.variant}`} class="border-b border-border/60">
								<td class="px-3 py-2 text-foreground">{row.label}</td>
								<td class="px-3 py-2 font-mono text-xs text-muted-foreground">{row.title}</td>
								<td class="px-3 py-2 font-mono text-xs text-muted-foreground">{row.gapX}</td>
								<td class="px-3 py-2 font-mono text-xs text-muted-foreground">{row.gapY}</td>
								<td
									data-testid={`instrument-row-with-${row.variant}`}
									class="px-3 py-2 text-foreground"
								>
									{row.rowWith}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>
</div>
