<!--
	Playground del editor de gráficos (`/dev/chart-editor`) — regla 8 de `AGENTS.md`, P6a (L37, puntos 5, 7 y 10).

	Duplica `…/charts/new` (`ChartEditorPage` → `ChartForm`) con el **componente real** sobre un doble de la API
	de gráficos (`fake-api.ts`). El panel global es **liviano**: sólo los presets de caso. Cada variante de
	disposición se cambia en la franja «Disposición del editor», pegada a la tarjeta que cambian, y se guarda
	en la URL (`lado`, `separacion`, `panel`) sin remontar el formulario.

	La hoja es material de revisión y se borra al promover la disposición elegida: la compuerta de producción
	está en `+page.ts`.
-->
<script lang="ts">
import { FileText } from "@lucide/svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import ChartForm, {
	type PanelSide,
	type PanelStyle,
	type SectionDivider,
} from "$lib/components/resource/chart/ChartForm.svelte";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { cn } from "$lib/utils";
import { createFakeChartApi } from "./fake-api";
import { PRESET_IDS, PRESETS, type PresetId } from "./fixtures";

interface Option<T extends string> {
	id: T;
	label: string;
}

const SIDES: Option<PanelSide>[] = [
	{ id: "left", label: "Izquierda (hoy)" },
	{ id: "right", label: "Derecha" },
];
const DIVIDERS: Option<SectionDivider>[] = [
	{ id: "line", label: "Línea (hoy)" },
	{ id: "cards", label: "Una tarjeta por sección" },
	{ id: "steps", label: "Pasos numerados" },
];
const STYLES: Option<PanelStyle>[] = [
	{ id: "column", label: "Columna (hoy)" },
	{ id: "accordion", label: "Acordeón" },
	{ id: "sidebar", label: "Como los filtros del buscador" },
];

/** Lee un parámetro de la URL y cae al valor de hoy si falta o no es uno de los permitidos. */
function paramOr<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	const raw = $page.url.searchParams.get(key);
	return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

let presetId = $state<PresetId>(paramOr("caso", PRESET_IDS, "planilla"));
let side = $state<PanelSide>(
	paramOr(
		"lado",
		SIDES.map((o) => o.id),
		"left",
	),
);
let divider = $state<SectionDivider>(
	paramOr(
		"separacion",
		DIVIDERS.map((o) => o.id),
		"line",
	),
);
let style = $state<PanelStyle>(
	paramOr(
		"panel",
		STYLES.map((o) => o.id),
		"column",
	),
);

const preset = $derived(PRESETS.find((item) => item.id === presetId) ?? PRESETS[0]);
const api = createFakeChartApi();

/** Todos los interruptores vigentes en la URL: cambiar uno no cambia lo que la hoja guarda, sólo dónde está. */
function syncUrl() {
	const params = new URLSearchParams({
		caso: presetId,
		lado: side,
		separacion: divider,
		panel: style,
	});
	replaceState(`/dev/chart-editor?${params.toString()}`, {});
}

function pickPreset(id: PresetId) {
	presetId = id;
	syncUrl();
}
function pickSide(id: PanelSide) {
	side = id;
	syncUrl();
}
function pickDivider(id: SectionDivider) {
	divider = id;
	syncUrl();
}
function pickStyle(id: PanelStyle) {
	style = id;
	syncUrl();
}
</script>

<svelte:head>
	<title>Editor de gráficos (playground) — UMSS</title>
</svelte:head>

{#snippet toggle<T extends string>(
	label: string,
	options: Option<T>[],
	current: T,
	pick: (id: T) => void,
)}
	<div class="flex flex-col gap-1.5">
		<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
		<div role="group" aria-label={label} class="flex flex-wrap gap-2">
			{#each options as option (option.id)}
				<button
					type="button"
					aria-pressed={current === option.id}
					onclick={() => pick(option.id)}
					class={cn(
						"cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
						current === option.id
							? "border-primary bg-primary text-primary-foreground"
							: "border-border bg-background text-foreground hover:bg-accent",
					)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

<div>
	<!-- Panel global: sólo los presets de caso. -->
	<div class="border-b border-border bg-muted/40">
		<div class="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
			<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
				{@render toggle("Caso", PRESETS, presetId, pickPreset)}
				<p class="max-w-xl text-xs leading-relaxed text-muted-foreground" data-testid="preset-note">
					{preset.note}
				</p>
			</div>
		</div>
	</div>

	<div class="border-b border-border bg-card">
		<div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
			<Breadcrumb
				items={[
					{ label: "Datasets", href: "/search", role: "Catálogo" },
					{ label: "Planilla docente", role: "Dataset" },
					{ label: "Nuevo gráfico", role: "Gráfico" },
				]}
				icon={FileText}
			/>
		</div>
	</div>

	<section class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
		<header>
			<p class="text-xs font-medium uppercase tracking-wider text-destructive">Gráfico</p>
			<h1 class="mt-1 font-heading text-3xl font-bold text-primary">Nuevo gráfico</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Configure qué se agrupa y qué se mide. Quienes visiten el recurso verán el gráfico ya
				calculado con los datos de la tabla.
			</p>
		</header>

		<Card class="p-5 lg:overflow-visible" data-testid="editor-card">
			<!-- Las variantes de disposición viven dentro de la tarjeta que cambian. -->
			<div
				class="mb-5 flex flex-wrap gap-x-8 gap-y-4 border-b border-dashed border-border pb-5"
				data-testid="layout-variants"
			>
				{@render toggle("Lado del panel", SIDES, side, pickSide)}
				{@render toggle("Separación entre Datos y Presentación", DIVIDERS, divider, pickDivider)}
				{@render toggle("Estilo del panel", STYLES, style, pickStyle)}
			</div>

			{#key presetId}
				<ChartForm
					fields={preset.fields}
					{api}
					resourceId="recurso-demo"
					initialTitle={preset.title}
					initialDescription={preset.description}
					initialConfig={preset.config}
					panelSide={side}
					sectionDivider={divider}
					panelStyle={style}
				/>
			{/key}
		</Card>
	</section>
</div>
