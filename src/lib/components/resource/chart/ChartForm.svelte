<script lang="ts">
import { Loader2 } from "@lucide/svelte";
import { untrack } from "svelte";
import type { ChartApi } from "$lib/api/charts";
import type { DatastoreField } from "$lib/api/datastore";
import { describeFailure } from "$lib/api/failure";
import {
	type ChartConfigErrors,
	type ChartData,
	type ChartType,
	foldCaseAvailable,
	MAX_CHART_GROUPS,
	NULL_GROUP_LABEL,
	type XBucket,
	xBucketsFor,
	xColumnsFor,
	type YAggregate,
	yColumnsFor,
} from "$lib/charts/contract";
import {
	type ChartDraft,
	canonicalConfigKey,
	canonicalDataKey,
	chartConfigFromDraft,
	emptyChartDraft,
	reconcileChartDraft,
} from "$lib/charts/form";
import { xAxisLabel, yAxisLabel } from "$lib/charts/labels";
import { adaptServerValidation } from "$lib/charts/validation";
import Button from "$lib/components/ui/button/button.svelte";
import ChartSelect from "./ChartSelect.svelte";
import ResourceChart, { type ChartStyle } from "./ResourceChart.svelte";

// El formulario con el que **quien publica** configura el gráfico de un recurso (S1, S7).
//
// Cuatro reglas que no son de estilo y que este componente sostiene:
//  · **La validación es la del contrato, no una copia.** Cada cambio pasa por `validateChartConfig` y el
//    mensaje sale en su campo; lo que el servidor rechace al previsualizar vuelve por
//    `adaptServerValidation` a la misma forma, así que un campo tiene un solo lugar donde se queja.
//  · **La vista previa tiene dos niveles** (L28, decisión 1). La presentación —tipo de gráfico, título y
//    descripción— se aplica al instante sobre los grupos que ya están dibujados, sin consulta. Las opciones
//    de datos piden los grupos solas, `PREVIEW_DEBOUNCE_MS` después del último cambio y sólo si la
//    configuración es válida; mientras calcula, el gráfico anterior sigue a la vista atenuado y anunciado
//    como ocupado. Una respuesta que llega tarde se descarta: manda la más nueva.
//  · **No se guarda lo que no se vio** (precisión de L11): «Guardar» se habilita sólo si los datos dibujados
//    son los de la configuración de datos vigente —`canonicalDataKey`, que no mira el tipo de gráfico—.
//  · **La agregación no es del navegador.** El formulario manda la configuración y dibuja los grupos que
//    vuelven; los ceros, los nulos y el tope de `MAX_CHART_GROUPS` los decide el servidor.
let {
	fields,
	api,
	resourceId,
	initialTitle = "",
	initialDescription = "",
	initialConfig,
}: {
	fields: DatastoreField[];
	api: Pick<ChartApi, "preview" | "createView">;
	resourceId: string;
	initialTitle?: string;
	initialDescription?: string;
	/** El borrador de arranque; el playground lo usa para abrir cada caso ya configurado. */
	initialConfig?: Partial<ChartDraft>;
} = $props();

const TYPE_OPTIONS: { value: ChartType; label: string }[] = [
	{ value: "bar", label: "Barras" },
	{ value: "line", label: "Líneas" },
	{ value: "pie", label: "Pastel" },
];

const BUCKET_LABELS: Record<XBucket, string> = {
	value: "Valor tal cual",
	number_step: "Rangos numéricos",
	year: "Año",
	quarter: "Trimestre",
	month: "Mes",
};

const AGG_OPTIONS: { value: YAggregate; label: string }[] = [
	{ value: "count", label: "Contar filas" },
	{ value: "count_distinct", label: "Contar valores distintos" },
	{ value: "sum", label: "Sumar" },
	{ value: "avg", label: "Promedio" },
	{ value: "min", label: "Mínimo" },
	{ value: "max", label: "Máximo" },
];

/**
 * Los dos estilos del gráfico, para comparar en el playground (L28, decisión 3). Vive al lado del gráfico y
 * no en el panel global porque es una variante de lo que se está mirando, no del caso de prueba.
 */
const STYLE_OPTIONS: { value: ChartStyle; label: string }[] = [
	{ value: "current", label: "Actual" },
	{ value: "new", label: "Nuevo" },
];

/** La pausa de las opciones de datos antes de pedir la vista previa (L28, decisión 1). */
const PREVIEW_DEBOUNCE_MS = 400;

const inputClass =
	"h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const uid = $props.id();

let title = $state(untrack(() => initialTitle));
let description = $state(untrack(() => initialDescription));
// `untrack`: es el valor de arranque, no una derivación — si el anfitrión remonta con otro caso, se remonta
// el componente (el playground lo hace con `{#key}`). Se reconcilia una vez, al crearlo.
let draft = $state<ChartDraft>(
	untrack(() => reconcileChartDraft({ ...emptyChartDraft(fields), ...initialConfig }, fields)),
);
/** El estado con el que abrió, para que «Cancelar» tenga a dónde volver mientras el formulario vive acá. */
const initialDraft = untrack(() => draft);
const initialText = untrack(() => ({ title, description }));

/** El estilo que el autor evalúa; arranca en «Nuevo» para que sea lo primero que ve. */
let chartStyle = $state<ChartStyle>("new");

/**
 * El borrador **ya reconciliado** con las columnas vigentes. Es una derivación y no un efecto que reescribe
 * el estado: lo que la columna o la agrupación nueva ya no admite se descarta en el mismo render que el
 * cambio, sin una segunda vuelta. Si el anfitrión cambia los `fields` después de montar, la corrección entra
 * igual, sin escribir estado desde un efecto (Svelte 5 lo desaconseja y era el origen del retraso, L21).
 */
const view = $derived(reconcileChartDraft(draft, fields));

/**
 * La única puerta de escritura del borrador: cada cambio se reconcilia antes de guardarse, así que nunca
 * queda un estado que la columna elegida no permita. El paso se normaliza a texto porque el `<input
 * type="number">` entrega un número (o `null`) y el borrador lo guarda como texto.
 */
function setDraft(change: Partial<ChartDraft>) {
	draft = reconcileChartDraft({ ...view, ...change }, fields);
}

/**
 * Lo último que el servidor dibujó, atado a la **clave de datos** de la configuración que lo pidió. No se
 * borra al cambiar una opción: el gráfico anterior sigue a la vista —atenuado— hasta que llega el nuevo, y
 * así el publicador no mira un hueco mientras escribe.
 */
let drawn = $state<{ key: string; data: ChartData } | null>(null);
let previewStatus = $state<"idle" | "loading" | "ok" | "rejected" | "failed">("idle");
let rejection = $state<{
	key: string;
	errors: ChartConfigErrors;
	notices: string[];
	technical: string[];
} | null>(null);
let failure = $state<{ key: string; title: string; message: string; code: string } | null>(null);
/** El número del último pedido: una respuesta con un número viejo se descarta (L28, decisión 1). */
let requestSeq = 0;

let saving = $state(false);
/** La configuración y el texto que se guardaron, para no seguir diciendo «guardada» después de un cambio. */
let saved = $state<string | null>(null);
let saveFailure = $state<{ snapshot: string; title: string; message: string } | null>(null);

const validation = $derived(chartConfigFromDraft(view, fields));
const currentKey = $derived(canonicalConfigKey(validation.config));
/** La identidad de los datos que hay que pedir: todo menos el tipo de gráfico. */
const currentDataKey = $derived(canonicalDataKey(validation.config));
const drawnKey = $derived(drawn?.key ?? null);
/** ¿Lo que está dibujado corresponde a las opciones de datos que se ven ahora? */
const chartMatches = $derived(drawn !== null && drawnKey === currentDataKey);

const previewErrors = $derived(
	rejection !== null && rejection.key === currentDataKey ? rejection.errors : {},
);
const errors = $derived<ChartConfigErrors>({ ...validation.errors, ...previewErrors });

const busy = $derived(previewStatus === "loading");
/** El gráfico de una configuración que ya no está en pantalla: se muestra, pero atenuado y dicho. */
const outdated = $derived(drawn !== null && !chartMatches);
const shown = $derived(drawn?.data ?? null);

const canSave = $derived(chartMatches && !saving);

const snapshot = $derived(JSON.stringify([title, description, currentKey]));
const justSaved = $derived(saved !== null && saved === snapshot);
const saveError = $derived(
	saveFailure !== null && saveFailure.snapshot === snapshot ? saveFailure : null,
);

// Las opciones que el borrador habilita en este momento: la agrupación depende del tipo de la columna, el
// eje Y del cálculo, y el interruptor de mayúsculas de las dos cosas.
const selectedField = $derived(fields.find((field) => field.id === view.x_field));
const bucketOptions = $derived(
	(selectedField ? xBucketsFor(selectedField.type) : ["value" as XBucket]).map((bucket) => ({
		value: bucket,
		label: BUCKET_LABELS[bucket],
	})),
);
const yOptions = $derived(yColumnsFor(fields, view.y_agg));
const showFoldCase = $derived(foldCaseAvailable(selectedField, view.x_bucket));

const xOptions = $derived(xColumnsFor(fields).map((id) => ({ value: id, label: id })));
const yColumnOptions = $derived(yOptions.map((id) => ({ value: id, label: id })));

const xLabel = $derived(
	xAxisLabel(
		view.x_bucket === "" ? "value" : view.x_bucket,
		view.x_field,
		validation.config?.x_step,
	),
);
const yLabel = $derived(yAxisLabel(view.y_agg, view.y_agg === "count" ? undefined : view.y_field));

/**
 * Pide la vista previa de la configuración vigente. El número del pedido es lo que hace que una respuesta
 * lenta no pise a una nueva: la que no es la última se descarta entera, sin tocar el estado.
 */
async function requestPreview() {
	const config = validation.config;
	if (!config) return;
	const key = canonicalDataKey(config) ?? "";
	const seq = ++requestSeq;
	previewStatus = "loading";
	rejection = null;
	failure = null;
	try {
		const data = await api.preview(resourceId, config);
		if (seq !== requestSeq) return;
		drawn = { key, data };
		previewStatus = "ok";
	} catch (err) {
		if (seq !== requestSeq) return;
		const adapted = adaptServerValidation(err);
		if (adapted) {
			rejection = {
				key,
				errors: adapted.errors,
				notices: adapted.notices,
				technical: adapted.technical,
			};
			previewStatus = "rejected";
			return;
		}
		const described = describeFailure(err, "resource", "unknown");
		failure = {
			key,
			title: described.title,
			message: described.message,
			code: described.code,
		};
		previewStatus = "failed";
	}
}

/**
 * Las dos velocidades de la vista previa (L28, decisión 1), en un solo efecto que sólo mira la **clave de
 * datos** y lo dibujado:
 *  · al abrir se pide enseguida, porque no hay nada que agrupar ni un gráfico anterior que mirar;
 *  · después, cada cambio de datos reprograma la pausa, así que varios cambios seguidos piden una sola vez.
 *
 * `untrack` en las dos llamadas es deliberado: `requestPreview` lee la configuración y el título, y sin eso
 * un cambio de presentación volvería a disparar el efecto y pediría datos que no cambiaron.
 */
let started = false;
$effect(() => {
	const key = currentDataKey;
	if (key === null) return; // configuración incompleta: no hay nada que pedir
	if (drawnKey === key) return; // ya está dibujado con estos datos

	if (!started) {
		started = true;
		untrack(() => void requestPreview());
		return;
	}

	const timer = setTimeout(() => untrack(() => void requestPreview()), PREVIEW_DEBOUNCE_MS);
	return () => clearTimeout(timer);
});

/** Vuelve al estado con el que abrió. En la página real esto será una navegación de vuelta al recurso. */
function cancel() {
	draft = { ...initialDraft };
	title = initialText.title;
	description = initialText.description;
}

async function save() {
	const config = validation.config;
	if (!config || !chartMatches) return;
	const savingSnapshot = snapshot;
	saving = true;
	saveFailure = null;
	try {
		await api.createView(resourceId, title, description, config);
		saved = savingSnapshot;
	} catch (err) {
		const adapted = adaptServerValidation(err);
		if (adapted) {
			rejection = {
				key: currentDataKey ?? "",
				errors: adapted.errors,
				notices: adapted.notices,
				technical: adapted.technical,
			};
		} else {
			const described = describeFailure(err, "resource", "unknown");
			saveFailure = {
				snapshot: savingSnapshot,
				title: described.title,
				message: described.message,
			};
		}
	} finally {
		saving = false;
	}
}
</script>

{#snippet fieldError(key: keyof ChartConfigErrors)}
	{#if errors[key]}
		<p id="{uid}-{key}-error" class="text-xs leading-relaxed text-destructive">{errors[key]}</p>
	{/if}
{/snippet}

<!--
	Dos columnas (L28, decisión 2): a la izquierda las opciones —Datos y Presentación, con las acciones al
	pie—, a la derecha el gráfico grande, que se queda a la vista mientras se configura. En el teléfono se
	apilan, sin scroll horizontal.
-->
<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
	<div class="w-full min-w-0 space-y-6 lg:w-[340px] lg:shrink-0">
		<!-- ── Datos ───────────────────────────────────────────────── -->
		<section aria-labelledby="{uid}-data" class="space-y-4">
			<div>
				<h2 id="{uid}-data" class="font-heading text-lg font-bold text-foreground">Datos</h2>
				<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
					Qué se agrupa y qué se mide. El gráfico se actualiza solo al terminar de cambiar estas
					opciones.
				</p>
			</div>

			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<ChartSelect
						label="Columna del eje horizontal"
						options={xOptions}
						bind:value={() => view.x_field, (value) => setDraft({ x_field: value })}
					/>
					{@render fieldError("x_field")}
				</div>

				<div class="flex flex-col gap-1.5">
					<ChartSelect
						label="Agrupación del eje horizontal"
						options={bucketOptions}
						bind:value={() => view.x_bucket, (value) => setDraft({ x_bucket: value as XBucket })}
					/>
					{@render fieldError("x_bucket")}
				</div>

				{#if view.x_bucket === "number_step"}
					<label class="flex flex-col gap-1.5">
						<span class="text-sm font-medium text-foreground">Tamaño del rango</span>
						<input
							type="number"
							min="0"
							step="any"
							inputmode="decimal"
							bind:value={() => view.x_step, (value) => setDraft({ x_step: value === null ? "" : String(value) })}
							aria-invalid={errors.x_step ? "true" : undefined}
							aria-describedby={errors.x_step ? `${uid}-x_step-error` : undefined}
							class={inputClass}
						/>
						{@render fieldError("x_step")}
					</label>
				{/if}

				<div class="flex flex-col gap-1.5">
					<ChartSelect
						label="Cálculo del eje vertical"
						options={AGG_OPTIONS}
						bind:value={() => view.y_agg, (value) => setDraft({ y_agg: value as YAggregate })}
					/>
					{@render fieldError("y_agg")}
				</div>

				{#if view.y_agg !== "count"}
					<div class="flex flex-col gap-1.5">
						<ChartSelect
							label="Columna del eje vertical"
							options={yColumnOptions}
							bind:value={() => view.y_field, (value) => setDraft({ y_field: value })}
						/>
						{@render fieldError("y_field")}
					</div>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				{#if showFoldCase}
					<label class="flex cursor-pointer items-start gap-2 text-sm text-foreground">
						<input
							type="checkbox"
							bind:checked={() => view.x_fold_case, (checked) => setDraft({ x_fold_case: checked })}
							class="mt-0.5 size-4 cursor-pointer accent-primary"
						/>
						<span>
							Unificar mayúsculas y minúsculas
							<span class="block text-xs text-muted-foreground">
								«Cochabamba» y «cochabamba» pasan a ser el mismo grupo.
							</span>
						</span>
					</label>
				{:else}
					{@render fieldError("x_fold_case")}
				{/if}

				<label class="flex cursor-pointer items-start gap-2 text-sm text-foreground">
					<input
						type="checkbox"
						bind:checked={() => view.include_null, (checked) => setDraft({ include_null: checked })}
						class="mt-0.5 size-4 cursor-pointer accent-primary"
					/>
					<span>
						Mostrar las filas sin dato como un grupo propio
						<span class="block text-xs text-muted-foreground">
							Aparecen al final, rotuladas «{NULL_GROUP_LABEL}».
						</span>
					</span>
				</label>
			</div>
		</section>

		<!-- ── Presentación ────────────────────────────────────────── -->
		<section aria-labelledby="{uid}-presentation" class="space-y-4 border-t border-border pt-5">
			<div>
				<h2 id="{uid}-presentation" class="font-heading text-lg font-bold text-foreground">
					Presentación
				</h2>
				<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
					Cómo se ve lo que ya está calculado. Estos cambios se aplican al instante.
				</p>
			</div>

			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<ChartSelect
						label="Tipo de gráfico"
						options={TYPE_OPTIONS}
						bind:value={() => view.chart_type, (value) => setDraft({ chart_type: value as ChartType })}
					/>
					{@render fieldError("chart_type")}
				</div>

				<label class="flex flex-col gap-1.5">
					<span class="text-sm font-medium text-foreground">Título de la vista</span>
					<input
						type="text"
						bind:value={title}
						placeholder="Salario promedio por turno"
						class={inputClass}
					/>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-sm font-medium text-foreground">Descripción de la vista</span>
					<input
						type="text"
						bind:value={description}
						placeholder="Promedio del salario mensual según el turno del docente."
						class={inputClass}
					/>
				</label>
			</div>
		</section>

		<div class="flex flex-wrap gap-2 border-t border-border pt-5">
			<Button type="button" disabled={!canSave} onclick={save}>
				{saving ? "Guardando…" : "Guardar"}
			</Button>
			<Button type="button" variant="outline" onclick={cancel}>Cancelar</Button>
		</div>

		{#if !validation.valid}
			<p class="text-sm leading-relaxed text-muted-foreground">
				Complete la configuración para ver el gráfico. Los campos con un problema están marcados
				arriba.
			</p>
		{/if}

		{#if rejection !== null && rejection.key === currentDataKey}
			<div class="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
				<p class="text-sm font-medium text-foreground">
					El catálogo rechazó esta configuración. Revise los campos marcados.
				</p>
				{#each rejection.notices as notice (notice)}
					<p class="text-xs leading-relaxed text-muted-foreground">{notice}</p>
				{/each}
				{#if rejection.technical.length > 0}
					<p class="font-mono text-xs text-muted-foreground">
						Detalle técnico: {rejection.technical.join(" · ")}
					</p>
				{/if}
			</div>
		{/if}

		{#if failure !== null && failure.key === currentDataKey}
			<div class="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
				<p class="text-sm font-medium text-foreground">{failure.title}</p>
				<p class="text-xs leading-relaxed text-muted-foreground">{failure.message}</p>
				<p class="text-xs text-muted-foreground">Código {failure.code}</p>
			</div>
		{/if}

		{#if justSaved}
			<p class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground" role="status">
				Vista guardada.
			</p>
		{/if}

		{#if saveError}
			<div class="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2" role="alert">
				<p class="text-sm font-medium text-foreground">{saveError.title}</p>
				<p class="text-xs leading-relaxed text-muted-foreground">{saveError.message}</p>
			</div>
		{/if}
	</div>

	<!-- ── El gráfico ──────────────────────────────────────────────── -->
	<section
		aria-labelledby="{uid}-chart"
		aria-busy={busy}
		class="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-6 lg:flex-1"
	>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 id="{uid}-chart" class="font-heading text-lg font-bold text-foreground">
					Vista previa
				</h2>
				<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
					Se calcula con los datos cargados del recurso.
				</p>
			</div>

			<div
				role="group"
				aria-label="Estilo del gráfico"
				class="inline-flex rounded-md border border-input bg-background p-0.5"
			>
				{#each STYLE_OPTIONS as option (option.value)}
					<button
						type="button"
						aria-pressed={chartStyle === option.value}
						onclick={() => (chartStyle = option.value)}
						class="cursor-pointer rounded-sm px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none {chartStyle ===
						option.value
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		{#if busy}
			<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
				<Loader2 class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
				Actualizando el gráfico…
			</p>
		{:else if outdated}
			<p class="text-sm leading-relaxed text-muted-foreground" role="status">
				Los datos del gráfico no corresponden todavía a las opciones elegidas.
			</p>
		{/if}

		{#if shown !== null}
			<div
				class="transition-opacity duration-200 motion-reduce:transition-none {busy || outdated
					? 'opacity-50'
					: 'opacity-100'}"
			>
				{#if chartMatches && shown.groups.length === 0}
					<div class="rounded-lg border border-dashed border-border px-4 py-10 text-center">
						<p class="font-heading text-base font-bold text-foreground">
							Sin datos para este gráfico
						</p>
						<p class="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
							Ninguna fila del recurso tiene un valor que se pueda agrupar con esta
							configuración. Pruebe con otra columna o con otra agrupación.
						</p>
					</div>
				{:else}
					<!-- La presentación es la vigente —el tipo cambia al instante—; los grupos son los de la vista
					     previa, que es la que la clave de datos compara. -->
					<ResourceChart
						groups={shown.groups}
						chartType={view.chart_type}
						bucket={shown.config.x_bucket}
						step={shown.config.x_step}
						{xLabel}
						{yLabel}
						variant={chartStyle}
					/>
				{/if}
			</div>

			{#if chartMatches}
				<p class="text-xs leading-relaxed text-muted-foreground">
					{shown.groups.length}
					{shown.groups.length === 1 ? "grupo" : "grupos"}
					sobre {shown.total_rows}
					{shown.total_rows === 1 ? "fila" : "filas"} de la tabla.
					{#if shown.config.include_null === false}
						Las filas sin dato no se cuentan en los grupos.
					{/if}
				</p>
				{#if shown.truncated}
					<p class="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground">
						La tabla produce más de {MAX_CHART_GROUPS} grupos: el gráfico muestra los primeros
						{MAX_CHART_GROUPS}. Elija una agrupación que junte más filas por grupo para ver la
						serie completa.
					</p>
				{/if}
			{/if}
		{:else if !busy}
			<div class="rounded-lg border border-dashed border-border px-4 py-10 text-center">
				<p class="font-heading text-base font-bold text-foreground">Todavía no hay un gráfico</p>
				<p class="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
					Elija una columna y un cálculo en las opciones de datos: el gráfico aparece solo.
				</p>
			</div>
		{/if}
	</section>
</div>
