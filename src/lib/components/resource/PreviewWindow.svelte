<script lang="ts">
// La «ventana» de una vista: la tarjeta de la vista previa, con el mismo encabezado para toda vista (tabla,
// gráfico, PDF, imagen, texto). El encabezado mide 41 px con o sin botones (`min-h` + `h-7`): el alto de cada
// vista descuenta ese número. Lleva el id de la vista —el fragmento que la enlaza— y `scroll-mt` = encabezado
// ACHICADO (`--header-h-min`, el estado en que queda al llegar) + 1 px de borde + aire (`--sticky-air`) + la
// barra de pestañas (`--tabs-h`, que pone el contenedor), así al llegar por un enlace las pestañas quedan a la
// vista.
// Los dos botones siguen UNA regla: bajo 24 rem de contenedor quedan sólo en ícono (mismo nombre accesible y
// tooltip). Sin `id` (la nota de un enlace externo o de un tipo sin vista previa) no hay nada que enlazar ni
// que ajustar: sólo el encabezado.
import { Maximize2 } from "@lucide/svelte";
import type { Snippet } from "svelte";
import { ACCION_BASE } from "$lib/components/dataset/action-class";
import Card from "$lib/components/ui/card/card.svelte";
import { CopyButton } from "$lib/components/ui/copy-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";
import { cn } from "$lib/utils";
import { fitContainer } from "./preview-views";

let {
	id,
	label,
	link = "",
	children,
}: {
	id?: string;
	label?: string;
	/** La URL completa de esta vista, la que copia «Copiar enlace». */
	link?: string;
	children: Snippet;
} = $props();

let windowEl = $state<HTMLElement>();

// ¿El texto está colapsado ahora? Sólo el CSS lo sabe (la consulta de contenedor): se lee el `display` real.
let collapsed = $state(false);
function track(node: HTMLElement) {
	const run = () => {
		const text = node.querySelector<HTMLElement>("[data-label]");
		collapsed = !text || getComputedStyle(text).display === "none";
	};
	run();
	if (typeof ResizeObserver === "undefined") return {};
	const observer = new ResizeObserver(run);
	observer.observe(node);
	const container = node.closest<HTMLElement>(".\\@container");
	if (container) observer.observe(container);
	return { destroy: () => observer.disconnect() };
}
</script>

{#snippet fitButton({ props }: { props: Record<string, unknown> })}
	<button
		{...props}
		type="button"
		onclick={() => windowEl && fitContainer(windowEl)}
		aria-label="Ajustar a la pantalla"
		class={cn(ACCION_BASE, "h-7 size-7 shrink-0 justify-center gap-0 px-0 text-xs @[24rem]:w-auto @[24rem]:gap-2 @[24rem]:px-2.5")}
		use:track
	>
		<Maximize2 class="size-3.5" aria-hidden="true" />
		<span data-label class="hidden @[24rem]:inline">Ajustar a la pantalla</span>
	</button>
{/snippet}

<div
	{id}
	bind:this={windowEl}
	class="scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air)+var(--tabs-h,0px))] rounded-xl"
>
	<Card class="overflow-hidden border-primary/20">
		<div class="flex min-h-[41px] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-5 py-1.5">
			<p class="text-xs font-medium uppercase tracking-wider text-destructive">Vista previa{label ? ` · ${label}` : ""}</p>
			{#if id}
				<div class="flex items-center gap-2">
					<CopyButton
						text={link}
						label="Copiar enlace de la vista"
						visibleLabel="Copiar enlace"
						copiedLabel="Enlace copiado"
						form="label"
						icon="link"
						size="sm"
						collapseBelow="24rem"
					/>
					<Tooltip>
						<TooltipTrigger child={fitButton} />
						{#if collapsed}
							<TooltipContent>Ajustar a la pantalla</TooltipContent>
						{/if}
					</Tooltip>
				</div>
			{/if}
		</div>
		<!-- Todas las vistas con id comparten UN alto: llenan la pantalla bajo el encabezado (140px = 65 + 41 + 2 + 2 × 16,
		     menos la barra de pestañas). Un contenido más chico queda arriba dentro de la ventana; uno más grande se
		     desplaza dentro de ella (cada vista pone su propio tope). La nota sin id no se estira. -->
		<div class={id ? "min-h-[max(360px,calc(100dvh-140px-var(--tabs-h,0px)))]" : undefined}>
			{@render children()}
		</div>
	</Card>
</div>
