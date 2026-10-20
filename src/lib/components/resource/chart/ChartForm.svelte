<script lang="ts">
import { Loader2 } from "@lucide/svelte";
import { type Snippet, untrack } from "svelte";
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
	MAX_VIEW_DESCRIPTION_LENGTH,
	MAX_VIEW_TITLE_LENGTH,
	reconcileChartDraft,
	validateViewText,
	yAggregatesFor,
} from "$lib/charts/form";
import { xAxisLabel, yAxisLabel } from "$lib/charts/labels";
import { defaultRangeStep, FALLBACK_STEP } from "$lib/charts/step";
import { adaptServerValidation } from "$lib/charts/validation";
import Button from "$lib/components/ui/button/button.svelte";
import { cn } from "$lib/utils";
import ChartSelect from "./ChartSelect.svelte";
import ResourceChart from "./ResourceChart.svelte";

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
	viewId,
	onsaved,
	oncancel,
	readColumnRange,
}: {
	fields: DatastoreField[];
	api: Pick<ChartApi, "preview" | "createView" | "updateView">;
	resourceId: string;
	initialTitle?: string;
	initialDescription?: string;
	/** El borrador de arranque; en la página de edición, la configuración guardada de la vista. */
	initialConfig?: Partial<ChartDraft>;
	/** La vista que se edita. Sin ella, «Guardar» crea una vista nueva. */
	viewId?: string;
	/** Se llama una vez que el catálogo guardó la vista: la página decide a dónde ir. */
	onsaved?: () => void;
	/** «Cancelar»: la página decide a dónde volver; el formulario no guarda nada. */
	oncancel?: () => void;
	/**
	 * El mínimo y el máximo de una columna numérica, o `null` si no se pudieron leer. Con ellos se propone el
	 * paso de «Rangos numéricos» (L49); sin esta función, o si falla, el paso por defecto es `1`.
	 */
	readColumnRange?: (column: string) => Promise<{ min: number; max: number } | null>;
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

/** La pausa de las opciones de datos antes de pedir la vista previa (L28, decisión 1). */
const PREVIEW_DEBOUNCE_MS = 400;

const inputClass =
	"h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const uid = $props.id();

const DATA_INTRO =
	"Qué se agrupa y qué se mide. El gráfico se actualiza solo al terminar de cambiar estas opciones.";
const PRESENTATION_INTRO =
	"Cómo se ve lo que ya está calculado. Estos cambios se aplican al instante.";

/**
 * Dónde se pega el gráfico: debajo del encabezado del portal, cuyo alto sale del token
 * `--header-h` (`src/app.css`), más el aire que usan el resto de los pegados.
 */
const STICKY_TOP = "lg:top-[calc(var(--header-h)+1px+var(--sticky-air))]";

let title = $state(untrack(() => initialTitle));
let description = $state(untrack(() => initialDescription));
// Como en el formulario del dataset: el error de un campo de texto se muestra al dejarlo o al intentar
// guardar, no mientras se escribe por primera vez.
let titleTouched = $state(false);
let descriptionTouched = $state(false);
let saveAttempted = $state(false);
let titleInput = $state<HTMLInputElement | null>(null);
let descriptionInput = $state<HTMLTextAreaElement | null>(null);
// `untrack`: es el valor de arranque, no una derivación — si el anfitrión remonta con otro caso, se remonta
// el componente (la página lo hace con `{#key}`). Se reconcilia una vez, al crearlo.
let draft = $state<ChartDraft>(
	untrack(() => reconcileChartDraft({ ...emptyChartDraft(fields), ...initialConfig }, fields)),
);

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
	const before = view;
	draft = reconcileChartDraft({ ...before, ...change }, fields);
	// Al pasar a «Rangos numéricos» con el paso vacío, el campo no se abre en error: se propone uno.
	if (before.x_bucket !== "number_step" && view.x_bucket === "number_step" && view.x_step === "") {
		void prefillStep(view.x_field);
	}
}

/** Mientras se lee el rango de la columna, el paso vacío no se marca como error: ya se está llenando. */
let stepPending = $state(false);

/**
 * El paso por defecto (L49): un número redondo para unos 10 rangos entre el mínimo y el máximo de la
 * columna, o `1` si no se pudo leer o no hay rango. Nunca pisa un paso que el publicador ya escribió, ni
 * llega a una agrupación o columna que ya cambiaron.
 */
async function prefillStep(column: string) {
	stepPending = true;
	let step = FALLBACK_STEP;
	try {
		const range = (await readColumnRange?.(column)) ?? null;
		if (range) step = defaultRangeStep(range.min, range.max);
	} catch {
		// Una lectura fallida no es un error del formulario: cae al paso de siempre.
	}
	stepPending = false;
	if (view.x_bucket === "number_step" && view.x_field === column && view.x_step === "") {
		setDraft({ x_step: String(step) });
	}
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
const errors = $derived<ChartConfigErrors>({
	...validation.errors,
	...previewErrors,
	...(stepPending ? { x_step: undefined } : {}),
});

const busy = $derived(previewStatus === "loading");
/** El gráfico de una configuración que ya no está en pantalla: se muestra, pero atenuado y dicho. */
const outdated = $derived(drawn !== null && !chartMatches);
const shown = $derived(drawn?.data ?? null);

const canSave = $derived(chartMatches && !saving);

const textErrors = $derived(validateViewText(title, description));
const titleError = $derived(titleTouched || saveAttempted ? textErrors.title : undefined);
const descriptionError = $derived(
	descriptionTouched || saveAttempted ? textErrors.description : undefined,
);

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
const aggOptions = $derived.by(() => {
	const available = yAggregatesFor(fields);
	return AGG_OPTIONS.filter((option) => available.includes(option.value));
});
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
			logTechnical(adapted.technical);
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

/** Lo que el servidor dijo al rechazar: no es copy de la interfaz, sólo se deja para quien diagnostica. */
function logTechnical(technical: string[]) {
	if (import.meta.env.DEV && technical.length > 0) {
		console.warn("El catálogo rechazó la configuración del gráfico:", technical.join(" · "));
	}
}

async function save() {
	const config = validation.config;
	if (!config || !chartMatches) return;
	if (textErrors.title || textErrors.description) {
		// No se manda lo que el servidor rechazaría: se marca el campo y se lleva el foco al primero.
		saveAttempted = true;
		(textErrors.title ? titleInput : descriptionInput)?.focus();
		return;
	}
	const cleanTitle = title.trim();
	const cleanDescription = description.trim();
	const savingSnapshot = snapshot;
	saving = true;
	saveFailure = null;
	try {
		if (viewId) {
			await api.updateView(viewId, { title: cleanTitle, description: cleanDescription, config });
		} else {
			await api.createView(resourceId, cleanTitle, cleanDescription, config);
		}
		saved = savingSnapshot;
		onsaved?.();
	} catch (err) {
		const adapted = adaptServerValidation(err);
		if (adapted) {
			rejection = {
				key: currentDataKey ?? "",
				errors: adapted.errors,
				notices: adapted.notices,
				technical: adapted.technical,
			};
			logTechnical(adapted.technical);
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

{#snippet counter(value: string, max: number, id: string)}
	<!-- El contador «X/Y» del formulario del dataset: neutro, aviso desde el 80 % del tope y error al pasarse. -->
	{@const length = value.trim().length}
	<span
		{id}
		aria-live="polite"
		class={cn(
			"shrink-0 text-[11px] font-normal tabular-nums",
			length > max
				? "font-semibold text-destructive"
				: length >= max * 0.8
					? "text-destructive/70"
					: "text-muted-foreground",
		)}
	>
		{length}/{max}
	</span>
{/snippet}

{#snippet fieldError(key: keyof ChartConfigErrors)}
	{#if errors[key]}
		<p id="{uid}-{key}-error" class="text-xs leading-relaxed text-destructive">{errors[key]}</p>
	{/if}
{/snippet}

{#snippet dataBody()}
	<div class="flex flex-col gap-4">
		<!--
			Un selector con una sola opción no es una pregunta: no se muestra, y esa opción queda elegida
			sola (L37, punto 6). Vuelve a aparecer cuando otra elección le da más de una. El error de su
			campo se sigue mostrando aunque el selector no esté.
		-->
		<div class="flex flex-col gap-1.5">
			{#if xOptions.length > 1}
				<ChartSelect
					label="Columna del eje horizontal"
					options={xOptions}
					bind:value={() => view.x_field, (value) => setDraft({ x_field: value })}
				/>
			{/if}
			{@render fieldError("x_field")}
		</div>

		<div class="flex flex-col gap-1.5">
			{#if bucketOptions.length > 1}
				<ChartSelect
					label="Agrupación del eje horizontal"
					options={bucketOptions}
					bind:value={() => view.x_bucket, (value) => setDraft({ x_bucket: value as XBucket })}
				/>
			{/if}
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
			{#if aggOptions.length > 1}
				<ChartSelect
					label="Cálculo del eje vertical"
					options={aggOptions}
					bind:value={() => view.y_agg, (value) => setDraft({ y_agg: value as YAggregate })}
				/>
			{/if}
			{@render fieldError("y_agg")}
		</div>

		{#if view.y_agg !== "count"}
			<div class="flex flex-col gap-1.5">
				{#if yColumnOptions.length > 1}
					<ChartSelect
						label="Columna del eje vertical"
						options={yColumnOptions}
						bind:value={() => view.y_field, (value) => setDraft({ y_field: value })}
					/>
				{/if}
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
{/snippet}

{#snippet presentationBody()}
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<ChartSelect
				label="Tipo de gráfico"
				options={TYPE_OPTIONS}
				bind:value={() => view.chart_type, (value) => setDraft({ chart_type: value as ChartType })}
			/>
			{@render fieldError("chart_type")}
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="flex items-baseline justify-between gap-2">
				<label for="{uid}-title" class="text-sm font-medium text-foreground">
					Título de la vista <span class="text-destructive" aria-hidden="true">*</span>
				</label>
				{@render counter(title, MAX_VIEW_TITLE_LENGTH, `${uid}-title-count`)}
			</div>
			<input
				id="{uid}-title"
				type="text"
				bind:this={titleInput}
				bind:value={title}
				onblur={() => (titleTouched = true)}
				required
				aria-invalid={titleError ? "true" : undefined}
				aria-describedby={titleError ? `${uid}-title-count ${uid}-title-error` : `${uid}-title-count`}
				placeholder="Salario promedio por turno"
				class={inputClass}
			/>
			{#if titleError}
				<p id="{uid}-title-error" class="text-xs leading-relaxed text-destructive">{titleError}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="flex items-baseline justify-between gap-2">
				<label for="{uid}-description" class="text-sm font-medium text-foreground">
					Descripción de la vista
					<span class="font-normal text-muted-foreground">(opcional)</span>
				</label>
				{@render counter(description, MAX_VIEW_DESCRIPTION_LENGTH, `${uid}-description-count`)}
			</div>
			<textarea
				id="{uid}-description"
				rows="3"
				bind:this={descriptionInput}
				bind:value={description}
				onblur={() => (descriptionTouched = true)}
				aria-invalid={descriptionError ? "true" : undefined}
				aria-describedby={descriptionError
					? `${uid}-description-count ${uid}-description-error`
					: `${uid}-description-count`}
				placeholder="Promedio del salario mensual según el turno del docente."
				class={cn(inputClass, "h-auto min-h-20 resize-y leading-relaxed")}
			></textarea>
			{#if descriptionError}
				<p id="{uid}-description-error" class="text-xs leading-relaxed text-destructive">
					{descriptionError}
				</p>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet sectionShell(
	key: "data" | "presentation",
	title: string,
	intro: string,
	body: Snippet,
)}
	<section
		aria-labelledby="{uid}-{key}"
		class="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
	>
		<!-- El encabezado de la tarjeta de filtros del buscador: mayúsculas coral y una línea debajo. -->
		<div class="space-y-2 border-b border-border pb-3">
			<h2 id="{uid}-{key}" class="text-sm font-bold uppercase tracking-[0.14em] text-destructive">
				{title}
			</h2>
			<p class="text-sm leading-relaxed text-muted-foreground">{intro}</p>
		</div>
		{@render body()}
	</section>
{/snippet}

<!--
	Dos columnas (L28, decisión 2; tarjetas separadas, L47 y L49): a la izquierda el gráfico grande, que se queda
	a la vista mientras se configura, y a la derecha el panel con una tarjeta por sección —Datos y
	Presentación— y las acciones fuera de las tarjetas, apiladas como las del formulario del dataset. No hay
	un contenedor común ni scroll interno. En el teléfono se apilan —primero el panel—, sin scroll horizontal.
-->
<div class="flex flex-col gap-6 lg:flex-row-reverse lg:items-start lg:gap-8">
	<div class="w-full min-w-0 space-y-6 lg:w-[340px] lg:shrink-0">
		{@render sectionShell("data", "Datos", DATA_INTRO, dataBody)}
		{@render sectionShell("presentation", "Presentación", PRESENTATION_INTRO, presentationBody)}

		<div class="grid gap-2" data-testid="chart-actions">
			<Button type="button" class="w-full" disabled={!canSave} onclick={save}>
				{saving ? "Guardando…" : "Guardar"}
			</Button>
			<Button type="button" variant="outline" class="w-full" onclick={() => oncancel?.()}>
				Cancelar
			</Button>
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
				<!--
					Lo que dijo el servidor no se muestra: llega en inglés y no es copy de la interfaz (L37, punto 8).
					Queda en la consola de desarrollo, para quien diagnostica.
				-->
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
		class={cn(
			"min-w-0 space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm transition-[top] duration-200 ease-out lg:sticky lg:flex-1",
			STICKY_TOP,
		)}
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
