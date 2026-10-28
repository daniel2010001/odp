<!--
	Instrumento del playground (AGENTS.md, regla 8): mide, en la ventana actual, el alto de la columna lateral
	contra el alto que le queda debajo del encabezado cuando ya está pegada, y cuántos píxeles quedan fuera de
	la vista. El alto disponible sale de los mismos tokens que el pegado (`--header-h-min`, `--sticky-air`, en
	`src/app.css`), no de números escritos acá. Se vuelve a medir al cambiar el tamaño de la ventana o de
	cualquier tarjeta, y cuando cambia el caso o una variante (`version`).
-->
<script lang="ts">
import { tick } from "svelte";

let {
	element,
	scroll,
	version,
}: {
	element: HTMLElement | undefined;
	scroll: "page" | "own";
	/** Cambia cuando cambia algo que mueve las tarjetas (caso, orden, historial). */
	version: string;
} = $props();

interface Measure {
	viewportW: number;
	viewportH: number;
	headerMin: number;
	air: number;
	available: number;
	content: number;
	outOfView: number;
	visible: string[];
	hidden: string[];
}

let m = $state<Measure | null>(null);

/** Un largo de CSS (`4rem`, `12px`) a píxeles. */
function toPx(value: string, rootFont: number): number {
	const n = Number.parseFloat(value);
	if (Number.isNaN(n)) return 0;
	return value.trim().endsWith("rem") ? n * rootFont : n;
}

function measure(): void {
	if (!element || typeof window === "undefined") return;
	const root = getComputedStyle(document.documentElement);
	const rootFont = Number.parseFloat(root.fontSize) || 16;
	const headerMin = toPx(root.getPropertyValue("--header-h-min"), rootFont);
	const air = toPx(root.getPropertyValue("--sticky-air"), rootFont);
	const viewportH = window.innerHeight;
	const available = Math.max(0, viewportH - headerMin - 1 - 2 * air);
	const content = element.scrollHeight;
	const top = element.getBoundingClientRect().top - element.scrollTop;
	const visible: string[] = [];
	const hidden: string[] = [];
	for (const card of Array.from(element.children)) {
		const title = card.querySelector("p")?.textContent?.trim() ?? "";
		const bottom = card.getBoundingClientRect().bottom - top;
		(bottom <= available ? visible : hidden).push(title);
	}
	m = {
		viewportW: window.innerWidth,
		viewportH,
		headerMin,
		air,
		available: Math.round(available),
		content: Math.round(content),
		outOfView: Math.max(0, Math.round(content - available)),
		visible,
		hidden,
	};
}

$effect(() => {
	void version;
	void scroll;
	const el = element;
	if (!el) return;
	void tick().then(measure);
	window.addEventListener("resize", measure);
	let observer: ResizeObserver | undefined;
	if (typeof ResizeObserver !== "undefined") {
		observer = new ResizeObserver(() => measure());
		observer.observe(el);
		for (const card of Array.from(el.children)) observer.observe(card);
	}
	return () => {
		window.removeEventListener("resize", measure);
		observer?.disconnect();
	};
});
</script>

<div data-testid="aside-instrument" class="text-xs text-muted-foreground">
	<p class="font-semibold text-foreground">Medición en esta ventana</p>
	<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
		<dt>Ventana</dt>
		<dd class="text-foreground" data-measure="viewport">
			{m ? `${m.viewportW} × ${m.viewportH} px` : "—"}
		</dd>
		<dt>Alto del panel</dt>
		<dd class="text-foreground" data-measure="content">{m ? `${m.content} px` : "—"}</dd>
		<dt>Alto disponible</dt>
		<dd class="text-foreground" data-measure="available">
			{#if m}
				{m.available} px
				<span class="text-muted-foreground"
					>(= {m.viewportH} − {m.headerMin} de encabezado − 1 − 2 × {m.air} de aire)</span
				>
			{:else}
				—
			{/if}
		</dd>
		<dt>Fuera de la vista</dt>
		<dd class="font-semibold text-foreground" data-measure="out-of-view">
			{#if m}
				{m.outOfView} px
				{#if m.outOfView > 0}
					<span class="font-normal text-muted-foreground">
						{scroll === "own"
							? "— se alcanzan desplazando el panel, sin mover la página."
							: "— hay que bajar la página para verlos."}
					</span>
				{/if}
			{:else}
				—
			{/if}
		</dd>
		<dt>A la vista</dt>
		<dd class="text-foreground" data-measure="visible">
			{m ? (m.visible.length > 0 ? m.visible.join(" · ") : "ninguna tarjeta completa") : "—"}
		</dd>
		{#if m && m.hidden.length > 0}
			<dt>Debajo</dt>
			<dd class="text-foreground" data-measure="hidden">{m.hidden.join(" · ")}</dd>
		{/if}
	</dl>
	{#if m && m.viewportW < 1024}
		<p class="mt-2">Con menos de 1024 px de ancho la columna no se pega: las dos variantes se ven igual.</p>
	{/if}
</div>
