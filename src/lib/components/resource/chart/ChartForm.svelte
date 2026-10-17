<script lang="ts">
import { Loader2, Play } from "@lucide/svelte";
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
	chartConfigFromDraft,
	emptyChartDraft,
	reconcileChartDraft,
} from "$lib/charts/form";
import { xAxisLabel, yAxisLabel } from "$lib/charts/labels";
import { adaptServerValidation } from "$lib/charts/validation";
import Button from "$lib/components/ui/button/button.svelte";
import ChartSelect from "./ChartSelect.svelte";
import ResourceChart from "./ResourceChart.svelte";

// El formulario con el que **quien publica** configura el gráfico de un recurso (S1, S7).
//
// Tres reglas que no son de estilo y que este componente sostiene:
//  · **La validación es la del contrato, no una copia.** Cada cambio pasa por `validateChartConfig` y el
//    mensaje sale en su campo; lo que el servidor rechace al previsualizar vuelve por
//    `adaptServerValidation` a la misma forma, así que un campo tiene un solo lugar donde se queja.
//  · **No se guarda lo que no se vio** (precisión de L11): «Guardar» se habilita sólo si la vista previa
//    de **esta** configuración —la clave canónica, no una parecida— terminó bien.
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
 * Lo que devolvió la última vista previa, atado a la **clave canónica** de la configuración que la pidió:
 * si el publicador cambia algo, el resultado deja de mostrarse como vigente sin necesidad de borrarlo.
 */
type Preview =
	| { kind: "idle" }
	| { kind: "loading"; key: string }
	| { kind: "ok"; key: string; data: ChartData }
	| {
			kind: "rejected";
			key: string | null;
			errors: ChartConfigErrors;
			notices: string[];
			technical: string[];
	  }
	| { kind: "failed"; key: string | null; title: string; message: string; code: string };

let preview = $state<Preview>({ kind: "idle" });
let saving = $state(false);
/** La configuración y el texto que se guardaron, para no seguir diciendo «guardada» después de un cambio. */
let saved = $state<string | null>(null);
let saveFailure = $state<{ snapshot: string; title: string; message: string } | null>(null);

const validation = $derived(chartConfigFromDraft(view, fields));
const currentKey = $derived(canonicalConfigKey(validation.config));

const previewErrors = $derived(
	preview.kind === "rejected" && preview.key === currentKey ? preview.errors : {},
);
const errors = $derived<ChartConfigErrors>({ ...validation.errors, ...previewErrors });

const shown = $derived(preview.kind === "ok" && preview.key === currentKey ? preview.data : null);
const canPreview = $derived(validation.valid && preview.kind !== "loading");
const canSave = $derived(shown !== null && !saving);

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

async function runPreview() {
	if (!validation.valid || !validation.config) return;
	const config = validation.config;
	const key = canonicalConfigKey(config) ?? "";
	preview = { kind: "loading", key };
	try {
		const data = await api.preview(resourceId, config);
		preview = { kind: "ok", key, data };
	} catch (err) {
		const adapted = adaptServerValidation(err);
		if (adapted) {
			preview = {
				kind: "rejected",
				key,
				errors: adapted.errors,
				notices: adapted.notices,
				technical: adapted.technical,
			};
			return;
		}
		const failure = describeFailure(err, "resource", "unknown");
		preview = {
			kind: "failed",
			key,
			title: failure.title,
			message: failure.message,
			code: failure.code,
		};
	}
}

async function save() {
	if (!validation.valid || !validation.config) return;
	const config = validation.config;
	const savingSnapshot = snapshot;
	saving = true;
	saveFailure = null;
	try {
		await api.createView(resourceId, title, description, config);
		saved = savingSnapshot;
	} catch (err) {
		const adapted = adaptServerValidation(err);
		if (adapted) {
			preview = {
				kind: "rejected",
				key: currentKey,
				errors: adapted.errors,
				notices: adapted.notices,
				technical: adapted.technical,
			};
		} else {
			const failure = describeFailure(err, "resource", "unknown");
			saveFailure = {
				snapshot: savingSnapshot,
				title: failure.title,
				message: failure.message,
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

<div class="space-y-6">
	<!-- ── Qué se grafica ─────────────────────────────────────────── -->
	<section aria-labelledby="{uid}-config" class="space-y-4">
		<div>
			<h2 id="{uid}-config" class="font-heading text-lg font-bold text-foreground">
				Qué se grafica
			</h2>
			<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
				Elija cómo agrupar el eje horizontal y qué medir en el vertical. Los visitantes del
				recurso verán el gráfico tal como quede guardado.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="flex flex-col gap-1.5">
				<ChartSelect
					label="Tipo de gráfico"
					options={TYPE_OPTIONS}
					bind:value={() => view.chart_type, (value) => setDraft({ chart_type: value as ChartType })}
				/>
				{@render fieldError("chart_type")}
			</div>

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

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

	<!-- ── Vista previa y guardado ─────────────────────────────────── -->
	<section aria-labelledby="{uid}-preview" class="space-y-4 border-t border-border pt-5">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 id="{uid}-preview" class="font-heading text-lg font-bold text-foreground">
					Vista previa
				</h2>
				<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
					Revise el gráfico antes de guardarlo. Se calcula con los datos cargados del recurso.
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button type="button" variant="outline" disabled={!canPreview} onclick={runPreview}>
					<Play class="size-4" aria-hidden="true" />
					Vista previa
				</Button>
				<Button type="button" disabled={!canSave} onclick={save}>
					{saving ? "Guardando…" : "Guardar"}
				</Button>
			</div>
		</div>

		{#if !validation.valid}
			<p class="text-sm text-muted-foreground">
				Complete la configuración para poder ver la vista previa. Los campos con un problema están
				marcados arriba.
			</p>
		{/if}

		{#if preview.kind === "loading"}
			<p class="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
				<Loader2 class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
				Calculando la vista previa…
			</p>
		{:else if shown !== null}
			{#if shown.groups.length === 0}
				<div class="rounded-lg border border-dashed border-border px-4 py-10 text-center">
					<p class="font-heading text-base font-bold text-foreground">Sin datos para este gráfico</p>
					<p class="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
						Ninguna fila del recurso tiene un valor que se pueda agrupar con esta configuración.
						Pruebe con otra columna o con otra agrupación.
					</p>
				</div>
			{:else}
				<div class="rounded-lg border border-border p-3">
					<ResourceChart
						groups={shown.groups}
						chartType={shown.config.chart_type}
						bucket={shown.config.x_bucket}
						step={shown.config.x_step}
						{xLabel}
						{yLabel}
					/>
				</div>
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
		{:else if preview.kind === "rejected" && preview.key === currentKey}
			<div class="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
				<p class="text-sm font-medium text-foreground">
					El catálogo rechazó esta configuración. Revise los campos marcados.
				</p>
				{#each preview.notices as notice (notice)}
					<p class="text-xs leading-relaxed text-muted-foreground">{notice}</p>
				{/each}
				{#if preview.technical.length > 0}
					<p class="font-mono text-xs text-muted-foreground">
						Detalle técnico: {preview.technical.join(" · ")}
					</p>
				{/if}
			</div>
		{:else if preview.kind === "failed" && preview.key === currentKey}
			<div class="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
				<p class="text-sm font-medium text-foreground">{preview.title}</p>
				<p class="text-xs leading-relaxed text-muted-foreground">{preview.message}</p>
				<p class="text-xs text-muted-foreground">Código {preview.code}</p>
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
	</section>
</div>
