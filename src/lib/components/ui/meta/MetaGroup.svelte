<!--
	Un grupo de la ficha técnica (estilo 3b, compartido por la página del dataset y la del recurso): el
	título va afuera de la tarjeta pequeña, con una línea fina; 8 px del título a la tarjeta. Las filas llevan
	la etiqueta arriba y el valor debajo; el botón de copiar (etiqueta que pasa a ícono si la fila no da)
	queda al extremo, centrado en la primera línea del valor: su contenedor mide `1lh`.
	La separación entre grupos (32 px) la pone quien los apila, con `space-y-8`.
-->
<script lang="ts">
import { CopyButton } from "$lib/components/ui/copy-button";
import { cn } from "$lib/utils";
import type { MetaGroupData } from "./types";

let { id, title, rows }: MetaGroupData = $props();
</script>

<div role="group" aria-labelledby="meta-{id}">
	<div class="mb-2 flex items-center gap-3">
		<h3 id="meta-{id}" class="text-xs font-bold uppercase tracking-wide text-foreground">
			{title}
		</h3>
		<span class="h-px flex-1 bg-border" aria-hidden="true"></span>
	</div>
	<div class="overflow-hidden rounded-lg border border-border">
		<dl class="divide-y divide-border/60">
			{#each rows as row (row.label)}
				<div class="min-w-0 px-4 py-3">
					<dt class="text-xs text-muted-foreground">{row.label}</dt>
					<dd class="mt-1 flex items-start justify-between gap-2 @container">
						<span
							class={cn(
								"block min-w-0 flex-1 text-foreground [overflow-wrap:anywhere]",
								row.mono ? "font-mono text-xs" : "text-sm font-medium",
							)}>{row.value}</span
						>
						{#if row.copy}
							<div class={cn("flex h-[1lh] shrink-0 items-center", row.mono ? "text-xs" : "text-sm")}>
								<CopyButton
									text={row.value}
									label={row.copy}
									visibleLabel="Copiar"
									form="label"
									size="sm"
									collapseBelow="24rem"
								/>
							</div>
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	</div>
</div>
