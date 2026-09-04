<script lang="ts">
import { Search, X } from "lucide-svelte";
import { untrack } from "svelte";
import { cn } from "$lib/utils";

let {
	value = "",
	placeholder = "Buscar datasets...",
	submitLabel = "",
	class: className = "",
	onsubmit,
	onclear,
}: {
	value?: string;
	placeholder?: string;
	submitLabel?: string;
	class?: string;
	/** Submit por Enter o clic en el botón "Buscar". */
	onsubmit?: (value: string) => void;
	/** El campo quedó vacío (X o backspace hasta vaciarlo). */
	onclear?: () => void;
} = $props();

let inputEl: HTMLInputElement | undefined = $state();
// Inicializamos con el valor del prop; el $effect sincroniza cambios externos
let localValue = $state(value);

// Sync externo → interno
// `untrack` evita que la escritura de `localValue` dentro del efecto lo
// re-dispare (bucle) y resete el input mientras el usuario escribe.
$effect(() => {
	if (value !== untrack(() => localValue)) {
		localValue = value;
	}
});

function handleInput(e: Event) {
	const target = e.target as HTMLInputElement;
	localValue = target.value;
	// Sin búsqueda en vivo: solo avisamos cuando el usuario vació el campo
	// (backspace hasta el final) para que el padre pueda resetear.
	if (localValue === "") {
		onclear?.();
	}
}

function handleSubmit(e: Event) {
	e.preventDefault();
	onsubmit?.(localValue);
}

function clear() {
	localValue = "";
	onclear?.();
	inputEl?.focus();
}

// Keyboard shortcut: Cmd/Ctrl+K to focus
function handleKeydown(e: KeyboardEvent) {
	if ((e.metaKey || e.ctrlKey) && e.key === "k") {
		e.preventDefault();
		inputEl?.focus();
	}
	if (e.key === "Escape") {
		inputEl?.blur();
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

<form role="search" onsubmit={handleSubmit} class={cn('relative', className)}>
	<Search
		class="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-primary"
	/>

	<input
		bind:this={inputEl}
		type="search"
		placeholder={placeholder}
		value={localValue}
		oninput={handleInput}
		aria-label="Buscar datasets"
		class="h-12 w-full rounded-lg border border-border bg-background pl-10 {submitLabel ? 'pr-36' : 'pr-20'} text-sm text-primary shadow-sm placeholder:text-muted-foreground transition-all duration-200 focus-visible:outline-none focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	/>

	<div class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
		{#if localValue}
			<button
				type="button"
				onclick={clear}
				aria-label="Limpiar búsqueda"
				class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-primary"
			>
				<X class="size-4" />
			</button>
		{/if}
		{#if submitLabel}
			<button
				type="submit"
				class="flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md"
			>
				{submitLabel}
			</button>
		{:else}
			<kbd
				class="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline"
			>
				⌘K
			</kbd>
		{/if}
	</div>
</form>
