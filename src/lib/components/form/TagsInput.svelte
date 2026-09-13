<script lang="ts">
// Campo de etiquetas con combobox (bits-ui `Command`), extraído del playground verificado de
// `/dashboard/datasets/new`. Las reglas de CKAN viven en `$lib/schemas/dataset` (`tagProblem`),
// que es la única fuente de verdad: este componente no reimplementa charset ni largos.
import { Plus, Tag, X } from "@lucide/svelte";
import { Command } from "bits-ui";
import { tagProblem } from "$lib/schemas/dataset";
import { cn } from "$lib/utils";

interface Props {
	value?: string[];
	suggestions?: string[];
	id?: string;
	invalid?: boolean;
	describedby?: string;
	placeholder?: string;
}

let {
	value = $bindable([]),
	suggestions = [],
	id,
	invalid = false,
	describedby,
	placeholder,
}: Props = $props();

let tagInput = $state("");
let tagAbierto = $state(false);
// Motivo que se anuncia en vivo (aria-live) cuando se intenta agregar una etiqueta inválida.
let mensajeError = $state<string | null>(null);

interface OpcionTag {
	tipo: "sugerencia" | "crear";
	valor: string;
}

const sugerencias = $derived.by(() => {
	const q = tagInput.trim().toLocaleLowerCase();
	return suggestions
		.filter((t) => !value.includes(t))
		.filter((t) => !q || t.toLocaleLowerCase().includes(q))
		.slice(0, 6);
});

const opciones = $derived.by(() => {
	const list: OpcionTag[] = sugerencias.map((t) => ({ tipo: "sugerencia", valor: t }));
	const q = tagInput.trim();
	const yaEsta = value.some((t) => t.toLocaleLowerCase() === q.toLocaleLowerCase());
	if (q && !yaEsta && !sugerencias.some((t) => t.toLocaleLowerCase() === q.toLocaleLowerCase())) {
		list.push({ tipo: "crear", valor: q });
	}
	return list;
});

const tagListaAbierta = $derived(tagAbierto && opciones.length > 0);

function agregarEtiqueta(valor: string) {
	const v = valor.trim();
	if (!v) return;
	const problema = tagProblem(v);
	if (problema) {
		mensajeError = problema;
		return;
	}
	if (!value.some((t) => t.toLocaleLowerCase() === v.toLocaleLowerCase())) {
		value = [...value, v];
	}
	tagInput = "";
	tagAbierto = false;
	mensajeError = null;
}

function quitarEtiqueta(valor: string) {
	value = value.filter((t) => t !== valor);
}

// bits-ui `Command` se ocupa de las flechas y de Enter (selecciona la opción activa). Acá quedan
// Escape (cerrar), Backspace con el campo vacío (quitar el último badge) y Enter sobre una entrada
// inválida sin sugerencias (mostrar el motivo, porque el botón de crear está deshabilitado).
function onTagKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		tagAbierto = false;
	} else if (event.key === "Backspace" && !tagInput && value.length > 0) {
		quitarEtiqueta(value[value.length - 1] ?? "");
	} else if (event.key === "Enter") {
		const q = tagInput.trim();
		const problema = q ? tagProblem(q) : null;
		if (problema && sugerencias.length === 0) {
			mensajeError = problema;
		}
	}
}

function onInput() {
	tagAbierto = true;
	mensajeError = null;
}
</script>

<div class="space-y-1.5">
	{#if value.length > 0}
		<ul class="flex flex-wrap gap-1.5">
			{#each value as etiqueta (etiqueta)}
				<li>
					<span
						class="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
					>
						{etiqueta}
						<button
							type="button"
							aria-label={`Quitar etiqueta ${etiqueta}`}
							onclick={() => quitarEtiqueta(etiqueta)}
							class="rounded-full text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<X class="size-3" aria-hidden="true" />
						</button>
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	<Command.Root shouldFilter={false} loop class="relative">
		<Command.Input
			{id}
			{placeholder}
			bind:value={tagInput}
			oninput={onInput}
			onkeydown={onTagKeydown}
			onfocus={() => (tagAbierto = true)}
			onblur={() => (tagAbierto = false)}
			aria-invalid={invalid ? "true" : undefined}
			aria-describedby={describedby}
			class={cn(
				"w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				invalid ? "border-destructive" : "border-input",
			)}
		/>

		{#if tagListaAbierta}
			<div
				class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover py-1 shadow-md"
				role="presentation"
				onmousedown={(event) => event.preventDefault()}
			>
				<Command.List class="max-h-56 overflow-auto">
					<Command.Viewport>
						{#each opciones as opcion (opcion.tipo + opcion.valor)}
							<Command.Item
								value={opcion.tipo === "crear" ? "__crear__" : opcion.valor}
								disabled={opcion.tipo === "crear" && tagProblem(opcion.valor) !== null}
								onSelect={() => agregarEtiqueta(opcion.valor)}
								class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
							>
								{#if opcion.tipo === "sugerencia"}
									<Tag class="size-3.5 text-muted-foreground" aria-hidden="true" />
									<span class="truncate">{opcion.valor}</span>
								{:else}
									<Plus class="size-3.5 text-primary" aria-hidden="true" />
									<span class="truncate">
										Agregar <strong class="font-semibold">«{opcion.valor}»</strong>
									</span>
								{/if}
							</Command.Item>
						{/each}
					</Command.Viewport>
				</Command.List>
			</div>
		{/if}
	</Command.Root>

	{#if mensajeError}
		<p class="text-xs text-destructive" aria-live="polite">{mensajeError}</p>
	{/if}
</div>
