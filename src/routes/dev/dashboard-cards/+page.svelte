<!--
	Hoja de revisión de la tarjeta de fila del dashboard — `/dev/dashboard-cards`.

	Decide **cómo se ofrece la acción «Editar»** en cada fila de «Mis datasets». Hoy es un botón de
	texto, hermano de la tarjeta y nunca anidado: un elemento interactivo dentro de un `<a>` es HTML
	inválido. La hoja pone las alternativas a la vista para elegir mirando.

	─── Qué es real y qué es copia ─────────────────────────────────────
	Real (se importa del repo):
	  · `formatDate` de `$lib/utils/ckan` y los iconos de `@lucide/svelte`.
	  · Los tokens de `src/app.css`: todas las clases salen de ahí, ninguna de un hex crudo.
	Copia (declarada acá, no importada):
	  · El markup de la fila, duplicado de `src/routes/dashboard/+page.svelte`: el `<li>`, el `<a>`
	    de la tarjeta, el ícono, el título, «N recursos · Actualizado el …», la insignia «Privado» y
	    el chevron. La convención del repo es duplicar la página, revisar y recién entonces promover.
	  · El permiso es un booleano por fila; en la página real sale de `orgsEditables`.
	El instrumento (`formatCardActionMeasurement`) es de la hoja, no de producto.

	─── Variantes e interruptores ──────────────────────────────────────
	Un interruptor por variante (regla 8): apagar una deja ver las otras sin perder el caso.
	  A · Botón de texto (hoy).
	  B · Botón sólo ícono, con `title` nativo y `aria-label`.
	  D · Acción revelada al pasar el cursor o al enfocar; la superficie de la tarjeta no cambia.
	  E · Igual que B, sin el chevron.
	  F · Igual que D, sin el chevron.
	La variante C (menú de tres puntos) **no se construye**: `src/lib/components/ui/dropdown-menu/`
	no existe y esta hoja no vendoriza componentes nuevos.

	─── El chevron es la objeción del autor ────────────────────────────
	El autor prefiere el botón sólo ícono (B) sobre el de texto, pero rechaza el `>`: se lee como una
	instrucción de «presione» sobre la tarjeta. E y F repiten B y D **quitando el chevron** para que
	la comparación sea explícita; el resto de la fila no cambia.

	─── Nota de la variante B ──────────────────────────────────────────
	El botón sólo ícono usa `title` nativo más `aria-label`. Un tooltip real exigiría vendorizar el
	Tooltip de bits-ui, que este repo no tiene.
-->
<script lang="ts">
import { ChevronRight, Database, Lock, Pencil } from "@lucide/svelte";
import { formatDate } from "$lib/utils/ckan";
import { type FormattedCardActionMeasurement, formatCardActionMeasurement } from "./measures";

interface Row {
	id: string;
	name: string;
	title: string;
	private: boolean;
	resources: number;
	modified: string;
	editable: boolean;
}

interface Preset {
	id: string;
	label: string;
	rows: Row[];
}

const NORMAL_TITLE = "Observatorio de Movilidad Urbana — Cochabamba";
const LONG_TITLE =
	"Registro histórico consolidado de flujos vehiculares, accidentalidad vial y cobertura del " +
	"transporte público del área metropolitana de Cochabamba (2019–2025)";

function row(overrides: Partial<Row> & Pick<Row, "id" | "name">): Row {
	return {
		title: NORMAL_TITLE,
		private: false,
		resources: 5,
		modified: "2025-06-10T08:30:00Z",
		editable: true,
		...overrides,
	};
}

const PRESETS: Preset[] = [
	{
		id: "con-permiso",
		label: "Con permiso",
		rows: [row({ id: "r1", name: "observatorio-movilidad" })],
	},
	{
		id: "sin-permiso",
		label: "Sin permiso",
		rows: [row({ id: "r1", name: "observatorio-movilidad", editable: false })],
	},
	{
		id: "titulo-largo",
		label: "Título largo",
		rows: [row({ id: "r1", name: "registro-historico", title: LONG_TITLE, resources: 12 })],
	},
	{
		id: "privado",
		label: "Privado",
		rows: [row({ id: "r1", name: "observatorio-movilidad", private: true })],
	},
	{
		id: "publico",
		label: "Público",
		rows: [row({ id: "r1", name: "observatorio-movilidad" })],
	},
	{
		id: "tres-filas",
		label: "Lista de tres filas",
		rows: [
			row({ id: "r1", name: "registro-historico", title: LONG_TITLE, resources: 12 }),
			row({ id: "r2", name: "accidentalidad-vial", private: true, resources: 1 }),
			row({ id: "r3", name: "transporte-publico", editable: false, resources: 3 }),
		],
	},
];

let presetId = $state("con-permiso");
const preset = $derived(PRESETS.find((item) => item.id === presetId) ?? PRESETS[0]);

// ─── Variantes (un interruptor por variante) ────────────────────────
interface Variant {
	id: "a" | "b" | "d" | "e" | "f";
	label: string;
	description: string;
}

const VARIANTS: Variant[] = [
	{
		id: "a",
		label: "A · Botón de texto (hoy)",
		description:
			"El botón de texto de la página real: hermano del `<a>`, nunca anidado. Ocupa 36 px de alto y acompaña la fila.",
	},
	{
		id: "b",
		label: "B · Botón sólo ícono",
		description:
			"El mismo `<a>` con forma de botón de ícono, `size-9`, `title` nativo y `aria-label`. La etiqueta visible desaparece del layout.",
	},
	{
		id: "d",
		label: "D · Acción revelada al pasar el cursor o enfocar",
		description:
			"La acción está en el DOM pero en reposo queda oculta (`opacity-0`), y aparece con el cursor sobre la fila o con el foco del teclado. La superficie de la tarjeta no cambia.",
	},
	{
		id: "e",
		label: "E · Ícono sin chevron",
		description:
			"Igual que B: el `<a>` con forma de botón de ícono, `size-9`, `title` nativo y `aria-label`, pero sin el chevron. El `>` se leía como una instrucción de presionar.",
	},
	{
		id: "f",
		label: "F · Ícono sin chevron, revelado al cursor",
		description:
			"Igual que D: la acción está en el DOM, en reposo oculta (`opacity-0`) y aparece con el cursor sobre la fila o con el foco, pero sin el chevron.",
	},
];

let enabled = $state<Record<string, boolean>>({ a: true, b: true, d: true, e: true, f: true });
const visibleVariants = $derived(VARIANTS.filter((variant) => enabled[variant.id]));

function toggleVariant(id: string): void {
	enabled = { ...enabled, [id]: !enabled[id] };
}

const datasetCountLabel = (count: number) => (count === 1 ? "1 recurso" : `${count} recursos`);

// ─── Instrumento: el objetivo táctil de la acción ───────────────────
let sheetRoot = $state<HTMLElement>();
let measurements = $state<FormattedCardActionMeasurement[]>([]);

$effect(() => {
	void preset;
	void visibleVariants;
	void sheetRoot;

	if (!sheetRoot) {
		measurements = [];
		return;
	}

	const next: FormattedCardActionMeasurement[] = [];
	for (const variant of visibleVariants) {
		const action = sheetRoot.querySelector<HTMLElement>(
			`[data-testid="card-render-${variant.id}"] [data-testid^="edit-${variant.id}-"]`,
		);

		let width = 0;
		let height = 0;
		let opacity = 1;
		if (action) {
			const rect = action.getBoundingClientRect();
			width = rect.width;
			height = rect.height;
			const parsed = Number.parseFloat(getComputedStyle(action).opacity);
			if (!Number.isNaN(parsed)) opacity = parsed;
		}

		next.push(
			formatCardActionMeasurement({
				variant: variant.id,
				label: variant.label,
				width,
				height,
				opacity,
			}),
		);
	}
	measurements = next;
});
</script>

<svelte:head>
	<title>Hoja de revisión de las tarjetas del dashboard — UMSS</title>
</svelte:head>

<!-- ─── Snippets compartidos ─────────────────────────────────────────── -->
{#snippet rowCard(variantId: string, item: Row, index: number)}
	<li
		data-testid={`row-${variantId}-${index}`}
		class="flex items-center gap-2 {variantId === "d" || variantId === "f" ? "group/row" : ""}"
	>
		<!-- Copia del `<a>` de la tarjeta real. El grupo `group` es el del enlace; el `group/row` de
		     las variantes D y F vive en el `<li>` para poder revelar la acción sin tocar esta superficie. -->
		<a
			href={`/dataset/${item.name}`}
			data-testid={`card-link-${variantId}-${index}`}
			class="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-4 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
		>
			<span
				class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary"
			>
				<Database class="size-4" aria-hidden="true" />
			</span>
			<span class="min-w-0 flex-1">
				<span
					class="line-clamp-2 break-words text-sm font-medium text-foreground group-hover:text-primary"
				>
					{item.title}
				</span>
				<span class="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
					{datasetCountLabel(item.resources)} · Actualizado el {formatDate(item.modified)}
				</span>
			</span>
			{#if item.private}
				<span
					class="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
				>
					<Lock class="size-3" aria-hidden="true" />
					Privado
				</span>
			{/if}
			{#if variantId !== "e" && variantId !== "f"}
				<ChevronRight
					class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
					aria-hidden="true"
				/>
			{/if}
		</a>

		<!-- Fail closed: sin permiso afirmativo no hay enlace. La acción es hermana del `<a>`, nunca
		     anidada, en todas las variantes. -->
		{#if item.editable}
			{#if variantId === "a"}
				<a
					href={`/dashboard/datasets/${item.name}/edit`}
					data-testid={`edit-${variantId}-${index}`}
					class="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<Pencil class="size-4" aria-hidden="true" />
					Editar
				</a>
			{:else if variantId === "b" || variantId === "e"}
				<a
					href={`/dashboard/datasets/${item.name}/edit`}
					data-testid={`edit-${variantId}-${index}`}
					aria-label="Editar dataset"
					title="Editar"
					class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<Pencil class="size-4" aria-hidden="true" />
				</a>
			{:else}
				<a
					href={`/dashboard/datasets/${item.name}/edit`}
					data-testid={`edit-${variantId}-${index}`}
					aria-label="Editar dataset"
					title="Editar"
					class="pointer-events-none inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<Pencil class="size-4" aria-hidden="true" />
				</a>
			{/if}
		{/if}
	</li>
{/snippet}

<div
	data-testid="dashboard-cards-sheet"
	bind:this={sheetRoot}
	class="min-h-screen bg-background font-sans text-foreground"
>
	<div class="mx-auto max-w-4xl px-4 py-10 sm:px-6">
		<header>
			<h1 class="font-heading text-3xl font-bold text-primary">
				Hoja de revisión de las tarjetas del dashboard
			</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Compara cómo se ofrece la acción «Editar» en cada fila de «Mis datasets». La fila es una
				<strong class="font-semibold text-foreground">copia declarada</strong> de
				<code class="font-mono text-xs">src/routes/dashboard/+page.svelte</code>: los tokens son los
				reales de <code class="font-mono text-xs">src/app.css</code>, pero el markup no se importa.
			</p>
			<p class="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				El autor prefiere el botón sólo ícono sobre el de texto, pero el chevron se lee como una
				instrucción de «presione»: ésa es su objeción. Las variantes E y F repiten B y D
				<strong class="font-semibold text-foreground">quitando el chevron</strong>, para que la
				comparación sea explícita.
			</p>
			<p
				class="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
			>
				La variante «menú de tres puntos» no se construye:
				<code class="font-mono text-xs">src/lib/components/ui/dropdown-menu/</code> no existe en este
				repo y esta hoja no vendoriza componentes nuevos. El botón sólo ícono usa
				<code class="font-mono text-xs">title</code> nativo más
				<code class="font-mono text-xs">aria-label</code>; un tooltip real exigiría vendorizar el
				Tooltip de bits-ui.
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
						Fijan el permiso, el largo del título, la visibilidad y el número de filas.
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

		<!-- ─── Las variantes de la fila ─────────────────────────────── -->
		<div class="mt-8 space-y-6">
			{#each VARIANTS as variant (variant.id)}
				{#if enabled[variant.id]}
					<article
						data-testid={`card-variant-${variant.id}`}
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

						<div data-testid={`card-render-${variant.id}`} class="px-4 py-4 sm:px-6">
							<ul class="space-y-1">
								{#each preset.rows as item, index (item.id)}
									{@render rowCard(variant.id, item, index)}
								{/each}
							</ul>
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
				Mide la caja de la acción «Editar» de cada variante sobre el nodo ya renderizado y compara
				el lado menor contra los <strong class="font-semibold text-foreground">44 px</strong> de
				WCAG 2.5.5. También imprime la opacidad en reposo: la variante D debería dar 0 hasta que el
				cursor o el foco la revelen. Sin motor de layout (jsdom) las cifras dan <code
					class="font-mono text-[11px]">—</code
				>.
			</p>

			<div class="mt-4 overflow-x-auto">
				<table class="w-full border-collapse text-sm">
					<thead>
						<tr
							class="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"
						>
							<th class="px-3 py-2 font-semibold">Variante</th>
							<th class="px-3 py-2 font-semibold">Objetivo</th>
							<th class="px-3 py-2 font-semibold">Táctil (mín. 44 px)</th>
							<th class="px-3 py-2 font-semibold">En reposo</th>
						</tr>
					</thead>
					<tbody>
						{#each measurements as row (row.variant)}
							<tr data-testid={`instrument-row-${row.variant}`} class="border-b border-border/60">
								<td class="px-3 py-2 text-foreground">{row.label}</td>
								<td class="px-3 py-2 font-mono text-xs text-muted-foreground">{row.target}</td>
								<td class="px-3 py-2 text-foreground">{row.touch}</td>
								<td class="px-3 py-2 text-foreground">{row.visibility}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>
</div>
