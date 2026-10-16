<script lang="ts">
import { BarChart3 } from "@lucide/svelte";
import { untrack } from "svelte";
import type { DatastoreField } from "$lib/api/datastore";
import { eligibleXColumns, isNumericType, numericColumns } from "$lib/charts/columns";
import { buildPoints, type ChartType, hasRepeatedX } from "$lib/charts/points";
import ChartSelect from "./ChartSelect.svelte";
import ResourceChart from "./ResourceChart.svelte";

// Constructor de gráficos de una tabla del DataStore: el usuario elige eje X, eje Y y tipo.
//
// `aggregate` es la variante que el autor decide: qué hacer cuando un valor de X se repite en varias
// filas (barras y pastel). «choice» deja que el usuario lo decida con un interruptor; «sum» suma
// siempre; «none» grafica cada fila tal cual.
let {
	fields,
	records,
	total,
	aggregate = "choice",
	initialType = "bar",
}: {
	fields: DatastoreField[];
	records: Record<string, unknown>[];
	total: number;
	aggregate?: "choice" | "sum" | "none";
	initialType?: ChartType;
} = $props();

const xColumns = $derived(eligibleXColumns(fields));
const yColumns = $derived(numericColumns(fields, records));

const TYPE_OPTIONS: { value: ChartType; label: string }[] = [
	{ value: "bar", label: "Barras" },
	{ value: "line", label: "Líneas" },
	{ value: "pie", label: "Pastel" },
];

// Lo elegido por el usuario; lo efectivo cae a un valor válido si lo elegido ya no existe (cambió
// el recurso) o no se puede usar (X no puede ser también Y por defecto).
let xChoice = $state("");
let yChoice = $state("");
let type = $state<ChartType>(untrack(() => initialType));
let sumChoice = $state(false);

const x = $derived(
	xColumns.includes(xChoice)
		? xChoice
		: (xColumns.find((c) => !yColumns.includes(c)) ?? xColumns[0] ?? ""),
);
// Por defecto, una medida declarada numérica antes que una columna de texto con números (un año
// cargado como texto no es lo que se quiere graficar primero).
const declaredNumeric = $derived(
	new Set(fields.filter((f) => isNumericType(f.type)).map((f) => f.id)),
);
const y = $derived(
	yColumns.includes(yChoice)
		? yChoice
		: (yColumns.find((c) => c !== x && declaredNumeric.has(c)) ??
				yColumns.find((c) => c !== x) ??
				yColumns[0] ??
				""),
);

const repeated = $derived(x !== "" && hasRepeatedX(records, x));
const showSumSwitch = $derived(aggregate === "choice" && type !== "line" && repeated);
const aggregation = $derived(
	type === "line"
		? "none"
		: aggregate === "sum"
			? "sum"
			: aggregate === "choice" && sumChoice
				? "sum"
				: "none",
);

const built = $derived(buildPoints(records, { x, y, type, aggregate: aggregation }));
const toOptions = (cols: string[]) => cols.map((c) => ({ value: c, label: c }));
</script>

<section aria-labelledby="chart-builder-title" class="border-t border-border">
	<div class="flex items-center gap-2 px-4 pt-4">
		<BarChart3 class="size-5 text-primary" aria-hidden="true" />
		<h3 id="chart-builder-title" class="font-heading text-lg font-bold text-foreground">Gráfico</h3>
	</div>

	{#if yColumns.length === 0}
		<div class="px-6 py-8 text-center">
			<p class="font-heading text-base font-bold text-foreground">No es posible crear un gráfico</p>
			<p class="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
				Este recurso no tiene columnas numéricas que graficar. Descargue el archivo para analizarlo con otra herramienta.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
			<ChartSelect label="Eje horizontal" options={toOptions(xColumns)} bind:value={() => x, (v) => (xChoice = v)} />
			<ChartSelect label="Eje vertical" options={toOptions(yColumns)} bind:value={() => y, (v) => (yChoice = v)} />
			<ChartSelect label="Tipo de gráfico" options={TYPE_OPTIONS} bind:value={type} />
		</div>

		{#if showSumSwitch}
			<label class="flex cursor-pointer items-center gap-2 px-4 pb-3 text-sm text-foreground">
				<input type="checkbox" bind:checked={sumChoice} class="size-4 cursor-pointer accent-primary" />
				Sumar los valores que comparten la misma categoría
			</label>
		{/if}

		<div class="px-4 pb-2">
			{#if built.points.length === 0}
				<p class="py-10 text-center text-sm text-muted-foreground">
					Ninguna fila tiene un valor válido en «{y}». Elija otra columna para el eje vertical.
				</p>
			{:else}
				<ResourceChart points={built.points} {type} xLabel={x} yLabel={y} />
			{/if}
		</div>

		<p class="px-4 pb-2 text-xs text-muted-foreground">
			Se grafican {built.points.length} {built.points.length === 1 ? "valor" : "valores"}
			de las {records.length} filas cargadas{total > records.length ? ` (el recurso tiene ${total})` : ""}.
			{#if built.skipped > 0}
				{built.skipped} {built.skipped === 1 ? "fila quedó fuera" : "filas quedaron fuera"} por no tener un valor válido.
			{/if}
		</p>

		<details class="border-t border-border/60 px-4 py-3 text-sm">
			<summary class="cursor-pointer rounded-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
				Ver los datos del gráfico en una tabla
			</summary>
			<div class="mt-3 max-h-72 overflow-auto">
				<table class="w-full border-collapse text-left text-sm">
					<caption class="sr-only">Datos del gráfico: {y} por {x}</caption>
					<thead>
						<tr class="border-b border-border bg-muted/50">
							<th scope="col" class="px-3 py-2 font-semibold text-foreground">{x}</th>
							<th scope="col" class="px-3 py-2 font-semibold text-foreground">{y}</th>
						</tr>
					</thead>
					<tbody>
						{#each built.points as point}
							<tr class="border-b border-border/60 last:border-0">
								<td class="px-3 py-1.5 text-muted-foreground">{point.label}</td>
								<td class="px-3 py-1.5 text-muted-foreground">{point.value}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	{/if}
</section>
