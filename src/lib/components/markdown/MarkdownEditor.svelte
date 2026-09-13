<script lang="ts">
// Editor de markdown con barra de herramientas y vista previa (RF-39).
//
// El render vive en `$lib/utils/markdown` y es seguro **por construcción**: HTML crudo
// deshabilitado y URLs validadas con la política de la app. Por eso el `{@html}` de abajo es el
// único de la aplicación y no necesita sanitizador: inyecta HTML **generado por el parser**,
// nunca el que escribió el usuario.
import { Bold, Code, Eye, Heading2, Italic, Link, List, Pencil, Table } from "@lucide/svelte";
import { tick } from "svelte";
import { cn } from "$lib/utils";
import { renderMarkdown } from "$lib/utils/markdown";

let {
	value = $bindable(""),
	id,
	placeholder = "",
	describedby,
	invalid = false,
	onblur,
	class: className = "",
	rows = 4,
}: {
	value?: string;
	id: string;
	placeholder?: string;
	describedby?: string;
	invalid?: boolean;
	onblur?: () => void;
	class?: string;
	rows?: number;
} = $props();

let modo = $state<"escribir" | "previa">("escribir");
let area = $state<HTMLTextAreaElement | undefined>();
const html = $derived(renderMarkdown(value));

const modos = [
	{ id: "escribir" as const, label: "Escribir", icon: Pencil },
	{ id: "previa" as const, label: "Vista previa", icon: Eye },
];

/** Botones de ayuda: envuelven la selección (o insertan un marcador si no hay nada elegido). */
const herramientas = [
	{ label: "Negrita", icon: Bold, antes: "**", despues: "**", marcador: "texto" },
	{ label: "Cursiva", icon: Italic, antes: "*", despues: "*", marcador: "texto" },
	{ label: "Encabezado", icon: Heading2, antes: "## ", despues: "", marcador: "Título" },
	{ label: "Lista", icon: List, antes: "- ", despues: "", marcador: "Elemento" },
	{ label: "Enlace", icon: Link, antes: "[", despues: "](https://)", marcador: "texto" },
	{ label: "Código", icon: Code, antes: "`", despues: "`", marcador: "código" },
	{
		label: "Tabla",
		icon: Table,
		antes: "| Columna | Tipo |\n| - | - |\n| ",
		despues: " | texto |",
		marcador: "valor",
	},
];

async function insertar(antes: string, despues: string, marcador: string) {
	const el = area;
	if (!el) return;
	const inicio = el.selectionStart;
	const fin = el.selectionEnd;
	const elegido = value.slice(inicio, fin) || marcador;
	value = value.slice(0, inicio) + antes + elegido + despues + value.slice(fin);
	await tick();
	el.focus();
	el.setSelectionRange(inicio + antes.length, inicio + antes.length + elegido.length);
}
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex w-fit items-center gap-1 rounded-md border border-border bg-background p-0.5">
			{#each modos as opcion (opcion.id)}
				{@const Icon = opcion.icon}
				<button
					type="button"
					aria-pressed={modo === opcion.id}
					onclick={() => (modo = opcion.id)}
					class={cn(
						"inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						modo === opcion.id
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<Icon class="size-3.5" aria-hidden="true" />
					{opcion.label}
				</button>
			{/each}
		</div>

		{#if modo === "escribir"}
			<div class="flex w-fit flex-wrap items-center gap-0.5">
				{#each herramientas as herramienta (herramienta.label)}
					{@const Icon = herramienta.icon}
					<button
						type="button"
						title={herramienta.label}
						aria-label={herramienta.label}
						onclick={() => insertar(herramienta.antes, herramienta.despues, herramienta.marcador)}
						class="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<Icon class="size-3.5" aria-hidden="true" />
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if modo === "escribir"}
		<textarea
			id={id}
			bind:this={area}
			{rows}
			bind:value
			{placeholder}
			aria-describedby={describedby}
			aria-invalid={invalid ? "true" : undefined}
			{onblur}
			class={cn(
				className,
				// `field-sizing: content` hace que el textarea crezca con el contenido. Es **progressive
				// enhancement**: Safari lo soporta recién desde 26.2, así que `rows` y `min-height` siguen
				// siendo el piso y `max-height` evita que una descripción larga se coma la pantalla.
				"field-sizing-content max-h-80 min-h-24 resize-y overflow-y-auto",
			)}
		></textarea>
	{:else}
		<div
			class="markdown-body min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm"
		>
			{#if html}
				{@html html}
			{:else}
				<p class="text-sm text-muted-foreground">Todavía no hay nada que previsualizar.</p>
			{/if}
		</div>
	{/if}

	<p class="pl-[var(--label-offset)] text-xs text-muted-foreground">
		Admite negrita, cursiva, listas, enlaces y tablas. El HTML se muestra como texto.
	</p>
</div>
