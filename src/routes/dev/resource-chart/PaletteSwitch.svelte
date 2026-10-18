<!--
	Interruptor «Paleta» y su instrumento (regla 8 de `AGENTS.md`). Va al lado del gráfico, junto al interruptor
	de estilo, porque cambia lo que el gráfico pinta. El instrumento mide, para cada color de la paleta elegida,
	el contraste contra `--background` en claro y en oscuro (WCAG 1.4.11: ≥ 3:1 para objetos gráficos).
	Los cuadros usan `var(--chart-n)`: si pintan el color de la paleta, el gráfico también.
-->
<script lang="ts">
import { GRAPHICAL_OBJECT_MIN_CONTRAST } from "$lib/charts/contrast";
import { PALETTES, type Palette, type PaletteId, paletteContrast } from "$lib/charts/palettes";

let { selected, onselect }: { selected: Palette; onselect: (id: PaletteId) => void } = $props();

const uid = $props.id();
const rows = $derived([
	{ mode: "Claro", ratios: paletteContrast(selected, "light") },
	{ mode: "Oscuro", ratios: paletteContrast(selected, "dark") },
]);
</script>

<div class="space-y-3 rounded-md border border-border bg-background p-3">
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
		<p id="{uid}-label" class="text-xs font-medium text-foreground">Paleta</p>
		<div
			role="group"
			aria-labelledby="{uid}-label"
			class="inline-flex flex-wrap rounded-md border border-input bg-background p-0.5"
		>
			{#each PALETTES as option (option.id)}
				<button
					type="button"
					aria-pressed={selected.id === option.id}
					onclick={() => onselect(option.id)}
					class="cursor-pointer rounded-sm px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none {selected.id ===
					option.id
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
	<p class="text-xs leading-relaxed text-muted-foreground">{selected.note}</p>

	<table class="w-full text-xs">
		<caption class="pb-1 text-left font-medium text-foreground">
			Contraste contra el fondo (mínimo {GRAPHICAL_OBJECT_MIN_CONTRAST}:1)
		</caption>
		<thead class="sr-only">
			<tr>
				<th scope="col">Modo</th>
				{#each [1, 2, 3, 4, 5] as n (n)}<th scope="col">Color {n}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.mode)}
				<tr>
					<th scope="row" class="pr-2 text-left font-medium text-muted-foreground">{row.mode}</th>
					{#each row.ratios as ratio, index (index)}
						{@const fails = ratio < GRAPHICAL_OBJECT_MIN_CONTRAST}
						<td class="py-1 pr-2">
							<span class="flex items-center gap-1.5">
								<span
									class="size-4 shrink-0 rounded-sm border border-border"
									style="background: var(--chart-{index + 1})"
									aria-hidden="true"
								></span>
								<span class="font-mono {fails ? 'font-bold text-destructive' : 'text-foreground'}">
									{ratio.toFixed(2)}
								</span>
								{#if fails}<span class="text-destructive">bajo 3:1</span>{/if}
							</span>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="text-xs leading-relaxed text-muted-foreground">
		Los cuadros muestran el modo activo del portal; la medida de ambos modos es la de la tabla.
	</p>
</div>
