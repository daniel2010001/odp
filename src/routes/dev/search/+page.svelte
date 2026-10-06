<!--
	Hoja de decisión del buscador — superficie sólo para desarrollo (`/dev/search`). Borrador: se
	retira al promover (ver el comentario de `+page.ts`).

	Responde dos preguntas mirando y **leyendo números**:

	· Q1 — dónde vive el *scroll snapping*: (a) `proximity` en el scroller de la página, (b)
	  `mandatory` en el scroller de la página, (c) un contenedor propio para la región de resultados.
	· Q2 — cuál es el disparador de la divulgación de los tags y formatos que el recorte esconde:
	  `off` (el `+N` pelado de hoy), `link-tooltip` (el `<a>` de la card dispara el tooltip) o
	  `title-link` (el título es el enlace y la divulgación es un `<button>` real).

	La hoja renderiza el **componente real** (`DatasetCard.svelte`) sobre la estructura real: el
	encabezado pegajoso lo pone el layout (`src/routes/+layout.svelte`), así que el documento **es**
	el scroller y (a)/(b) se demuestran de verdad. El panel de control es `fixed` y queda fuera del
	flujo, así que nunca es un punto de snap. El instrumento corre una sonda (`scrollTo(0, R)` con
	`R` entre dos bordes de card), lee el desplazamiento ya ajustado y trae su propio auto-test: si el
	control —con el snapping anulado por estilo en línea— también se ajusta, el instrumento se declara
	roto en el DOM. Mide geometría, no «sensación»: eso lo decide el autor mirando.
-->
<script lang="ts">
import { ChevronDown, Info, TriangleAlert } from "@lucide/svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import DatasetCard, { type CardDisclosure } from "$lib/components/search/DatasetCard.svelte";
import {
	adjustedCount,
	cardSnapMarginCss,
	countedRows,
	DISCLOSURE_FORMS,
	documentSnapType,
	type InstrumentReport,
	maxAbsDelta,
	modesAgree,
	type RestoreCheck,
	regionSnapClass,
	SNAPPING_MODES,
	type SnappingMode,
	snapTypeLabel,
	verdictIsFailure,
	verdictLabel,
} from "./decisions";
import { CASES, DEFAULT_CASE, getCase } from "./fixtures";
import { cardElementsOf, measureDom } from "./instrument";

interface SnapOption {
	id: SnappingMode;
	label: string;
	note: string;
}

const SNAP_OPTIONS: SnapOption[] = [
	{ id: "off", label: "Apagado (hoy)", note: "Sin snapping: el baseline." },
	{ id: "proximity", label: "(a) proximidad", note: "snap-y proximity en el documento." },
	{ id: "mandatory", label: "(b) obligatorio", note: "snap-y mandatory en el documento." },
	{ id: "contained", label: "(c) contenedor", note: "Scroll propio en la región de resultados." },
];

const DISCLOSURE_OPTIONS: { id: CardDisclosure; label: string; note: string }[] = [
	{ id: "off", label: "Hoy", note: "Recorte con `+N` pelado." },
	{ id: "link-tooltip", label: "(a) tooltip", note: "El `<a>` de la card es el disparador." },
	{ id: "title-link", label: "(b) botón", note: "Título enlazado + `<button>` real." },
];

const CASE_IDS = CASES.map((sheetCase) => sheetCase.id);

/** Valores aceptados por los parámetros de consulta. Ver `paramOr`. */
const OPEN_VALUES = ["1", "0"] as const;
const PANEL_VALUES = ["open", "collapsed"] as const;

/**
 * Lee un parámetro de la URL y cae al default si falta o no es un valor permitido. No lanza: una
 * URL vieja o un typo deja la hoja en su estado por defecto en vez de vaciarla.
 */
function paramOr<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	const raw = $page.url.searchParams.get(key);
	return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

// Estado inicial preseleccionado por la URL (`?snap=…&disclosure=…&open=…&case=…`) para poder
// abrir la hoja ya posicionada —un navegador headless no puede hacer clic— y para compartir un
// caso exacto. Sin parámetros, cada control queda en su default.
let snappingMode = $state<SnappingMode>(paramOr("snap", SNAPPING_MODES, "off"));
let disclosure = $state<CardDisclosure>(paramOr("disclosure", DISCLOSURE_FORMS, "off"));
let forceOpen = $state(paramOr("open", OPEN_VALUES, "0") === "1");
let caseId = $state(paramOr("case", CASE_IDS, DEFAULT_CASE) as string);
// El panel arranca **cerrado**: fijo y expandido cubre una card, y la hoja tiene que abrir en su
// tope. `?panel=open` lo despliega para poder leer los números sin un clic.
let panelCollapsed = $state(paramOr("panel", PANEL_VALUES, "collapsed") === "collapsed");

let regionEl = $state<HTMLElement>();
let sheetRoot = $state<HTMLElement>();
// La barra pegajosa: su alto real entra en el `scroll-margin-top` de las cards. Se mide con
// `bind:this` + `clientHeight` (y se re-mide al redimensionar) en vez de `bind:clientHeight`, para
// no depender de una notificación asíncrona: si el primer auto-probe corre antes de que la altura
// esté lista, imprime un margen que no es el del CSS (medido: 96 px en vez de 164 px).
let barEl = $state<HTMLElement>();
let altoBarra = $state(0);

const activeCase = $derived(getCase(caseId));
const datasets = $derived(activeCase.datasets());

// El instrumento es inyectable: la prueba de componente pasa un reporte conocido y no depende del
// motor de layout. El segundo argumento avisa que el offset no se pudo restaurar.
let {
	instrument,
}: {
	instrument?: (
		mode: SnappingMode,
		onRestoreUnstable: (check: RestoreCheck) => void,
	) => InstrumentReport;
} = $props();

let report = $state<InstrumentReport | null>(null);
// `true` cuando, tras agotar los intentos, el navegador no deja volver al offset anterior.
let restoreUnstable = $state<RestoreCheck | null>(null);
// Descarta los avisos de restauración de una medición vieja (el chequo puede llegar frames después).
let measureToken = 0;

function runInstrument(
	mode: SnappingMode,
	onRestoreUnstable: (check: RestoreCheck) => void,
): InstrumentReport {
	if (instrument) return instrument(mode, onRestoreUnstable);
	return measureDom(
		{ mode, region: regionEl ?? null, cards: cardElementsOf(regionEl ?? null) },
		{ onRestoreUnstable },
	);
}

function measure(): void {
	// La altura se lee del DOM **ahora**, no del bind: si el binding quedó atrás, la var del CSS
	// mentiría y la card se fijaría debajo de la barra. Se fija la var con el valor medido antes de
	// sondear, para que el `scroll-margin-top` computado sea el que rige.
	const barHeight = barEl?.clientHeight ?? 0;
	if (barHeight !== altoBarra) altoBarra = barHeight;
	sheetRoot?.style.setProperty("--results-bar-h", `${barHeight}px`);

	const token = ++measureToken;
	restoreUnstable = null;
	report = runInstrument(snappingMode, (check) => {
		if (token === measureToken) restoreUnstable = check;
	});
}

// Mide el alto de la barra y lo re-mide al redimensionar. La sonda no corre hasta que este número
// exista: el margen impreso tiene que corresponder al CSS en efecto.
$effect(() => {
	const element = barEl;
	if (!element) return;
	const update = () => {
		altoBarra = element.clientHeight;
	};
	update();
	window.addEventListener("resize", update);
	return () => window.removeEventListener("resize", update);
});

// Aplica el snap al documento y mide en la misma pasada, para que el instrumento lea el estado real
// y no uno viejo. El `return` limpia el estilo del documento: dejarlo puesto haría que **todo el
// SPA** quede con snapping después de salir de `/dev/search`. La sonda espera a que la barra tenga
// alto medido; el instrumento inyectado (tests) puede correr siempre.
$effect(() => {
	const mode = snappingMode;
	document.documentElement.style.scrollSnapType = documentSnapType(mode);

	// Cambiar la forma o el caso cambia la geometría: hay que volver a medir.
	void disclosure;
	void forceOpen;
	void caseId;
	void altoBarra;

	// La altura se relee del DOM en cada pasada; el binding sólo dispara la re-medición al
	// redimensionar. Sin alto medido (jsdom), sólo el instrumento inyectado puede correr.
	const barHeight = barEl?.clientHeight ?? 0;
	if (instrument || barHeight > 0) {
		measure();
	}

	return () => {
		document.documentElement.style.scrollSnapType = "";
	};
});

const regionClass = $derived(
	[
		regionSnapClass(snappingMode),
		snappingMode === "contained" ? "max-h-[70vh] rounded-xl border border-border p-2" : "",
	]
		.filter(Boolean)
		.join(" "),
);

const destinoStyle = $derived(`scroll-margin-top: ${cardSnapMarginCss(altoBarra)}`);

// Resumen del auto-test: si el control se ajusta, el instrumento está roto.
const maxControlDelta = $derived(report ? maxAbsDelta(report.controlRows) : 0);
const maxControlCount = $derived(report ? adjustedCount(report.controlRows) : 0);
const controlCounted = $derived(report ? countedRows(report.controlRows).length : 0);
// La fila de máxima distancia a todo borde y la comparación con el otro modo de página.
const farRow = $derived(report?.rows.find((row) => row.far) ?? null);
const farAgrees = $derived(
	report?.comparison && farRow ? modesAgree(farRow, report.comparison.reading) : false,
);

function px(value: number): string {
	return `${value.toFixed(1)} px`;
}

/** Número sin unidad para la tabla, que declara la unidad una sola vez en el encabezado. */
function num(value: number): string {
	return value.toFixed(1);
}

function controlClass(active: boolean): string {
	return `rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
		active
			? "border-primary bg-primary text-primary-foreground"
			: "border-input bg-background text-foreground hover:bg-accent"
	}`;
}

function selectSnap(mode: SnappingMode): void {
	snappingMode = mode;
	syncUrl();
}

function selectDisclosure(form: CardDisclosure): void {
	disclosure = form;
	syncUrl();
}

function toggleForceOpen(): void {
	forceOpen = !forceOpen;
	syncUrl();
}

function applyPreset(id: string): void {
	caseId = id;
	syncUrl();
}

/**
 * Refleja el panel en la URL con `replaceState`. El segundo argumento es `page.state` (shallow
 * routing, objeto serializable); pasar algo no clonable hace que `replaceState` lance.
 */
function syncUrl(): void {
	const params = new URLSearchParams({
		snap: snappingMode,
		disclosure,
		open: forceOpen ? "1" : "0",
		case: caseId,
		panel: panelCollapsed ? "collapsed" : "open",
	});
	replaceState(`/dev/search?${params.toString()}`, {});
}

const FILLER_CHIPS = [
	"CSV",
	"JSON",
	"PDF",
	"XLSX",
	"presupuesto",
	"estudiantes",
	"egresados",
	"investigación",
	"infraestructura",
	"acreditación",
];

const FILLER_ORGS = [
	{ name: "Facultad de Ciencias y Tecnología", count: 42 },
	{ name: "Vicerrectorado Académico", count: 31 },
	{ name: "Instituto de Investigaciones Sociales", count: 27 },
	{ name: "Departamento de Admisiones", count: 19 },
	{ name: "Facultad de Humanidades", count: 15 },
	{ name: "Departamento de Estadística", count: 11 },
];
</script>

<svelte:head>
	<title>Hoja de decisión del buscador — UMSS</title>
</svelte:head>

<div
	bind:this={sheetRoot}
	data-testid="search-sheet"
	class="min-h-screen bg-background font-sans text-foreground"
	style={`--results-bar-h: ${altoBarra}px`}
>
	<!-- ─── Panel de control (fijo, fuera del flujo: nunca es punto de snap) ─── -->
	<aside
		data-testid="control-panel"
		class="fixed right-2 bottom-2 z-50 w-[min(22rem,calc(100vw-1rem))] snap-none max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl sm:right-4 sm:bottom-4"
	>
		<div class="flex items-center justify-between gap-3">
			<h2 class="font-heading text-base font-bold text-primary">Panel de decisión</h2>
			<button
				type="button"
				data-testid="panel-toggle"
				aria-expanded={!panelCollapsed}
				onclick={() => {
					panelCollapsed = !panelCollapsed;
					syncUrl();
				}}
				class="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{panelCollapsed ? "Abrir" : "Cerrar"}
				<ChevronDown
					class="size-3.5 transition-transform motion-reduce:transition-none {panelCollapsed
						? 'rotate-180'
						: ''}"
					aria-hidden="true"
				/>
			</button>
		</div>

		{#if !panelCollapsed}
			<div class="mt-4 space-y-4">
				<div>
					<p class="text-xs font-semibold text-card-foreground">Snapping</p>
					<div class="mt-2 grid grid-cols-2 gap-2">
						{#each SNAP_OPTIONS as option (option.id)}
							<button
								type="button"
								data-testid={`snap-${option.id}`}
								aria-pressed={snappingMode === option.id}
								title={option.note}
								onclick={() => selectSnap(option.id)}
								class={controlClass(snappingMode === option.id)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<p class="text-xs font-semibold text-card-foreground">Divulgación de tags y formatos</p>
					<div class="mt-2 grid grid-cols-3 gap-2">
						{#each DISCLOSURE_OPTIONS as option (option.id)}
							<button
								type="button"
								data-testid={`disclosure-${option.id}`}
								aria-pressed={disclosure === option.id}
								title={option.note}
								onclick={() => selectDisclosure(option.id)}
								class={controlClass(disclosure === option.id)}
							>
								{option.label}
							</button>
						{/each}
					</div>
					<button
						type="button"
						data-testid="force-open"
						aria-pressed={forceOpen}
						onclick={toggleForceOpen}
						class="mt-2 w-full {controlClass(forceOpen)}"
					>
						Forzar abierto: {forceOpen ? "sí" : "no"}
					</button>
					<p class="mt-1 text-[11px] leading-snug text-muted-foreground">
						Fija el estado de divulgación sin puntero. Un adorno que sólo vive en hover no se puede
						revisar.
					</p>
				</div>

				<div>
					<p class="text-xs font-semibold text-card-foreground">Presets de caso</p>
					<div class="mt-2 grid grid-cols-2 gap-2">
						{#each CASES as preset (preset.id)}
							<button
								type="button"
								data-testid={`preset-${preset.id}`}
								aria-pressed={caseId === preset.id}
								title={preset.description}
								onclick={() => applyPreset(preset.id)}
								class={controlClass(caseId === preset.id)}
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<button
						type="button"
						data-testid="measure-now"
						onclick={measure}
						class="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						Medir ahora
					</button>
				</div>

				<!-- ─── Instrumento: números o nada ─── -->
				<section
					data-testid="instrument"
					class="rounded-lg border border-border bg-background p-3"
				>
					<h3 class="font-heading text-sm font-bold text-primary">Instrumento</h3>

					{#if report === null}
						{#if !instrument && altoBarra === 0}
							<p data-testid="instrument-waiting" class="mt-2 text-xs text-muted-foreground">
								Esperando la altura de la barra pegajosa para medir con el margen real del CSS…
							</p>
						{:else}
							<p class="mt-2 text-xs text-muted-foreground">Sin medición todavía.</p>
						{/if}
					{:else if !report.measured}
						<p data-testid="instrument-empty" class="mt-2 text-xs text-muted-foreground">
							No hay cards montadas que medir.
						</p>
					{:else}
						<dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
							<div>
								<dt class="text-muted-foreground">Scroller medido</dt>
								<dd data-testid="instrument-scroller" class="font-mono text-foreground">
									{report.scroller}
								</dd>
							</div>
							<div>
								<dt class="text-muted-foreground">scroll-margin-top</dt>
								<dd data-testid="instrument-margin" class="font-mono text-foreground">
									{px(report.firstCardMarginTop)}
								</dd>
							</div>
							<div class="col-span-2">
								<dt class="text-muted-foreground">scroll-snap-type computado</dt>
								<dd data-testid="instrument-snap-type" class="font-mono text-foreground">
									{snapTypeLabel(report.snapType)}
								</dd>
							</div>
						</dl>

						<table class="mt-2 w-full border-collapse text-[10px]" data-testid="instrument-table">
							<thead>
								<tr class="text-muted-foreground">
									<th class="pr-1 text-left font-semibold">R px</th>
									<th class="pr-1 text-left font-semibold">S px</th>
									<th class="pr-1 text-left font-semibold">Δ px</th>
									<th class="pr-1 text-left font-semibold">Aterr.</th>
									<th class="text-left font-semibold">Entre</th>
								</tr>
							</thead>
							<tbody class="font-mono text-foreground">
								{#each report.rows as row, index (index)}
									<tr
										data-testid={`instrument-row-${index}`}
										data-far={row.far}
										data-clamped={row.clamped}
									>
										<td class="pr-1">{num(row.requested)}{row.far ? " *" : ""}</td>
										<td class="pr-1">{num(row.final)}</td>
										<td class="pr-1">{num(row.delta)}{row.clamped ? " (acot.)" : ""}</td>
										<td class="pr-1">#{row.landed.index + 1} · {num(row.landed.effectiveTop)}</td>
										<td>
											{row.before ? num(row.before.effectiveTop) : "—"}–{row.after
												? num(row.after.effectiveTop)
												: "—"}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>

						{#if farRow}
							<p
								data-testid="instrument-far-note"
								class="mt-2 text-[11px] leading-snug text-muted-foreground"
							>
								<strong class="text-foreground">*</strong> Es el punto más lejos de todo borde (R
								{num(farRow.requested)}): el único lugar donde <strong class="text-foreground"
									>proximity</strong
								> y <strong class="text-foreground">mandatory</strong> pueden diferir en principio.
							</p>
						{/if}
						{#if report.comparison && farRow}
							<p
								data-testid="instrument-comparison"
								class="mt-1 text-[11px] leading-snug text-muted-foreground"
							>
								El mismo punto con <strong class="text-foreground">{report.comparison.mode}</strong>: R
								{num(farRow.requested)} → S {num(report.comparison.reading.final)}, Δ
								{num(report.comparison.reading.delta)}.
								{#if farAgrees}
									En este navegador y esta página, los dos modos dan el mismo resultado en el punto más
									lejano: ése es el hallazgo, no un error del instrumento.
								{:else}
									Los dos modos difieren en el punto más lejano: ésa es la diferencia que buscabas.
								{/if}
							</p>
						{/if}
						<p class="mt-1 text-[11px] leading-snug text-muted-foreground">
							«(acot.)» = el pedido excedió el máximo scrolleable y el scroller lo recortó; no cuenta
							como ajuste.
						</p>

						<p data-testid="instrument-control" class="mt-2 text-[11px] text-muted-foreground">
							Auto-test: delta máx <span class="font-mono text-foreground">{px(maxControlDelta)}</span>
							· ajustaron <span class="font-mono text-foreground">{maxControlCount}</span>/{controlCounted}
							filas del control.
						</p>

						<p
							data-testid="instrument-verdict"
							class="mt-2 text-xs font-bold {verdictIsFailure(report.verdict)
								? 'text-destructive'
								: 'text-primary'}"
						>
							{verdictLabel(report.verdict)}
						</p>
					{/if}

					<p class="mt-2 text-[11px] leading-snug text-muted-foreground">
						Mide <strong class="text-foreground">geometría</strong>, no si el ajuste
						<em>se siente</em> bien: eso lo decide el autor mirando. El auto-test repite la batería
						con el snapping anulado por estilo en línea sobre el elemento medido; si el control
						también se ajusta, el veredicto es
						<strong class="text-destructive">instrumento roto</strong> y no se opina sobre el modo.
					</p>
				</section>
			</div>
		{/if}
	</aside>

	<!-- ─── Nota de sólo desarrollo ─── -->
	<div class="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
		<p
			data-testid="dev-only-note"
			class="flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>
				Página sólo para desarrollo. En producción <code class="font-mono text-xs">/dev/search</code
				> responde 404. Es un <strong class="text-foreground">borrador</strong>: lo que se apruebe se
				promueve al buscador real y esta hoja se retira.
			</span>
		</p>
	</div>

	<!-- ─── Aviso: el modo no deja volver a la posición anterior ─── -->
	{#if restoreUnstable}
		<div class="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
			<p
				data-testid="restore-warning"
				class="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
			>
				<TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<span>
					El navegador no deja volver a la posición anterior con este modo: la página queda donde el
					ajuste la llevó. Es, en sí, evidencia de que
					<strong>este es el modo más propenso a sentirse roto</strong>.
				</span>
			</p>
		</div>
	{/if}

	<!-- ─── Hero (duplica el buscador real para que el scroll sea realista) ─── -->
	<section class="mt-6 border-b border-border bg-gradient-to-b from-primary/5 to-background">
		<div class="mx-auto max-w-7xl px-4 py-10 text-center sm:px-6 lg:px-8">
			<p class="text-xs font-semibold uppercase tracking-[0.14em] text-destructive">
				Hoja de decisión · snapping y tags
			</p>
			<h1
				class="mx-auto mt-4 max-w-3xl font-heading text-4xl font-bold leading-[1.1] text-foreground sm:text-5xl lg:text-[52px]"
			>
				Explore los datasets abiertos de la UMSS
			</h1>
			<p class="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
				La muestra de arriba tiene seis datasets deterministas; los números del instrumento salen de
				esta página, no de una constante.
			</p>
			<div class="mx-auto mt-8 w-full max-w-[720px]">
				<input
					type="search"
					aria-label="Buscar datasets (demostración, sin efecto)"
					placeholder="Busque por organización, etiquetas, formato..."
					class="h-14 w-full rounded-xl border-0 bg-card px-4 text-foreground shadow-lg placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				/>
			</div>
		</div>
	</section>

	<!-- ─── ResultsBar pegajosa: mismas clases que el buscador real ─── -->
	<section
		bind:this={barEl}
		data-testid="results-bar"
		class="sticky top-[calc(var(--header-h)+1px)] z-20 border-b border-border bg-background/95 backdrop-blur transition-[top] duration-200 ease-out"
	>
		<div
			class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6 lg:px-8"
		>
			<p class="flex items-baseline gap-2">
				<span class="font-heading text-2xl font-bold text-foreground">{datasets.length}</span>
				<span class="text-sm text-muted-foreground">datasets de la muestra</span>
			</p>
			<div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
				<span class="hidden sm:inline">Ordenar:</span>
				<span
					class="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground"
				>
					Más recientes
				</span>
			</div>
		</div>
	</section>

	<!-- ─── Cuerpo: aside pegajoso + región de resultados ─── -->
	<div class="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
		<div class="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
			<aside
				data-testid="filters-aside"
				class="mb-6 lg:mb-0 lg:self-start lg:sticky lg:top-40 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto"
			>
				<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
					<h2 class="text-sm font-bold uppercase tracking-[0.14em] text-destructive">Filtros</h2>
					<p class="mt-2 text-xs leading-relaxed text-muted-foreground">
						Panel de filtros duplicado del buscador real. Los controles son decorativos: la hoja mide
						el scroll, no filtra.
					</p>
					<div class="mt-4 space-y-3">
						{#each ["Formato", "Organización", "Etiquetas"] as group (group)}
							<div class="rounded-lg border border-border/70 p-3">
								<p class="text-xs font-semibold text-foreground">{group}</p>
								<div class="mt-2 space-y-1.5">
									{#each [1, 2, 3] as row (row)}
										<div class="h-4 rounded bg-muted"></div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</aside>

			<div class="min-w-0">
				<div bind:this={regionEl} data-testid="results-region" class={regionClass}>
					<div class="space-y-4">
						{#each datasets as dataset (dataset.id)}
							<div
								data-testid="sheet-card"
								class="snap-start scroll-mt-[calc(var(--header-h)+var(--results-bar-h)+1rem)]"
							>
								<DatasetCard {dataset} {disclosure} {forceOpen} />
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- ─── Secciones altas: hacen la página larga y realista ─── -->
	<div class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
		<section id="pruebe-con" style={destinoStyle} class="space-y-3 pt-12">
			<h2 class="font-heading text-2xl font-bold text-primary">Pruebe con</h2>
			<div class="flex flex-wrap gap-2">
				{#each FILLER_CHIPS as chip (chip)}
					<span
						class="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground"
					>
						{chip}
					</span>
				{/each}
			</div>
		</section>

		<section id="recientes" style={destinoStyle} class="space-y-4 pt-16">
			<h2 class="font-heading text-2xl font-bold text-primary">Mientras tanto, lo más reciente</h2>
			<div class="grid gap-6 lg:grid-cols-2">
				{#each datasets.slice(0, 4) as dataset (dataset.id)}
					<article class="rounded-xl border border-border bg-card p-6">
						<h3 class="font-heading text-lg font-bold text-primary">{dataset.title}</h3>
						<p class="mt-2 text-sm text-muted-foreground">{dataset.organization?.title}</p>
						<p class="mt-3 text-sm leading-relaxed text-muted-foreground">
							Tarjeta de relleno: no participa del instrumento, sólo da altura para que el scroll sea
							el de una página real.
						</p>
						<div class="mt-4 h-24 rounded-lg bg-muted"></div>
					</article>
				{/each}
			</div>
		</section>

		<section id="organizaciones" style={destinoStyle} class="space-y-4 pt-16">
			<h2 class="font-heading text-2xl font-bold text-primary">Explorar por organización</h2>
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each FILLER_ORGS as org (org.name)}
					<article class="flex flex-col gap-2 rounded-xl border border-border bg-card p-6">
						<h3 class="font-heading text-base font-bold text-primary">{org.name}</h3>
						<p class="text-sm text-muted-foreground">{org.count} datasets publicados</p>
						<div class="mt-2 h-20 rounded-lg bg-muted"></div>
					</article>
				{/each}
			</div>
		</section>
	</div>
</div>
