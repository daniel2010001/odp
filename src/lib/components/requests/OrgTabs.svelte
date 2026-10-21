<!--
	Las organizaciones como pestañas, con la forma de las vistas del recurso (`ResourceCharts`): `Tabs` de bits-ui,
	línea inferior, la activa en azul, «Todas» primero y, en cada una, la insignia de sus pendientes (ninguna si no
	tiene; «Todas», la suma). `leading` es el conteo «N solicitudes»: arriba del desplegable o de las pestañas y, desde 64 rem, al
	extremo izquierdo de la fila. Bajo 32 rem de contenedor (el
	mismo punto en que esa página pasa a su desplegable «Vista») las pestañas no caben en una línea y pasan a un
	desplegable. Con una sola organización no se dibuja nada: una pestaña que no filtra es ruido.
	`trailing` es lo que acompaña a las pestañas (el control de estado) y tiene tres formas según el contenedor:
	bajo 32 rem se apila bajo el desplegable de organización, a todo el ancho; de 32 a 64 rem va bajo las pestañas,
	a la derecha (con 4 organizaciones las pestañas llenan el ancho y un «Mostrar» a su lado las partía en tres
	líneas); desde 64 rem comparte la fila con ellas, centrado en el texto de las pestañas sin llegar a su línea.
	Las pestañas y `trailing` forman una barra pegada bajo el encabezado desde 32 rem (`top` = `--header-h` + el borde de 1px, como
	la barra de resultados de la búsqueda; bajo 32 rem son dos controles apilados, 109 px que no valen la pena): fondo opaco, la línea inferior en el propio elemento pegado.
	El fondo de la barra es opaco (tapa las filas que pasan por debajo) y por eso se nota: tiene que ser el de la superficie donde
	está (`surface`). Sobre una tarjeta, `bg-background` es una franja de otro tono —en oscuro, muy visible—.
	La clase del disparador es la de `ResourceCharts` (`triggerClass`, que no se exporta): si ésa cambia, cambia ésta.
-->
<script lang="ts">
import { Check, ChevronDown } from "@lucide/svelte";
import { Select, Tabs } from "bits-ui";
import type { Snippet } from "svelte";
import { cn } from "$lib/utils";
import {
	hasOrganizationTabs,
	type OrganizationTab,
	pendingBadgeLabel,
	TODAS_LAS_ORGANIZACIONES,
} from "./requests-model";
import { barraPegada, type Surface, surfaceClass } from "./sticky-bar";

let {
	tabs,
	value,
	onchange,
	leading,
	trailing,
	barHeight = $bindable(0),
	surface = "background",
	children,
}: {
	tabs: OrganizationTab[];
	/** La organización activa, o `null` para «Todas». */
	value: string | null;
	onchange: (org: string | null) => void;
	/** Lo que va al extremo izquierdo de la fila, antes de las pestañas (el conteo de solicitudes). */
	leading?: Snippet;
	/** Lo que comparte la fila con las pestañas, a su derecha. */
	trailing?: Snippet;
	/** Alto de la barra pegada (pestañas + `trailing`); 0 mientras no se pega. */
	barHeight?: number;
	/** La superficie donde está la barra: su fondo es opaco y tiene que ser el de ella (`card` o el lienzo). */
	surface?: Surface;
	children: Snippet;
} = $props();

const triggerClass =
	"inline-flex h-12 cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary motion-reduce:transition-none";

const active = $derived(value ?? TODAS_LAS_ORGANIZACIONES);
const activeTab = $derived(tabs.find((t) => t.id === active) ?? tabs[0]);
/** «Todas (4 pendientes)»; sin pendientes, sólo el nombre. */
const withPending = (t: OrganizationTab) =>
	t.pending > 0 ? `${t.label} (${pendingBadgeLabel(t.pending)})` : t.label;
const choose = (id: string) => onchange(id === TODAS_LAS_ORGANIZACIONES ? null : id);
</script>

{#if !hasOrganizationTabs(tabs)}
	{@render children()}
{:else}
	<div class="@container">
		<Tabs.Root value={active} onValueChange={choose}>
			<div
				data-testid="barra-pestanas"
				use:barraPegada={(alto) => (barHeight = alto)}
				class="flex flex-col gap-2 border-b border-border {surfaceClass(surface)} pb-3 transition-[top] duration-200 ease-out motion-reduce:transition-none @lg:sticky @lg:top-[calc(var(--header-h)+1px)] @lg:z-20 @lg:gap-0 @5xl:flex-row @5xl:items-start @5xl:justify-between @5xl:gap-x-4 @5xl:pb-0"
			>
				{#if leading}
					<div class="@5xl:flex @5xl:h-12 @5xl:shrink-0 @5xl:items-center">{@render leading()}</div>
				{/if}
				<div class="hidden min-w-0 @lg:block @5xl:flex-1 @lg:border-b @lg:border-border @5xl:border-b-0">
				<Tabs.List class="-mb-px flex min-w-0 flex-wrap gap-1" aria-label="Organización">
					{#each tabs as t (t.id)}
						<Tabs.Trigger value={t.id} title={t.label} class="{triggerClass} max-w-64">
							<span class="truncate">{t.label}</span>
							{#if t.pending > 0}
								<span
									data-testid="insignia"
									aria-label={pendingBadgeLabel(t.pending)}
									class={cn(
										"rounded-full border px-1.5 text-xs font-semibold tabular-nums",
										active === t.id
											? "border-primary/30 bg-primary/10 text-primary"
											: "border-border bg-muted text-muted-foreground",
									)}>{t.pending}</span
								>
							{/if}
						</Tabs.Trigger>
					{/each}
				</Tabs.List>
				</div>
				<div class="@lg:hidden">
					<Select.Root
						type="single"
						value={active}
						onValueChange={choose}
						items={tabs.map((t) => ({ value: t.id, label: withPending(t) }))}
					>
						<Select.Trigger
							aria-label="Organización"
							class="flex h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
						>
							<span class="truncate">{withPending(activeTab)}</span>
							<ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						</Select.Trigger>
						<Select.Portal>
							<Select.Content
								sideOffset={4}
								class="z-50 max-h-72 min-w-[var(--bits-select-anchor-width)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
							>
								<Select.Viewport>
									{#each tabs as t (t.id)}
										<Select.Item
											value={t.id}
											label={withPending(t)}
											class="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground motion-reduce:transition-none"
										>
											{#snippet children({ selected })}
												<span>{withPending(t)}</span>
												{#if selected}<Check class="size-4 shrink-0 text-primary" aria-hidden="true" />{/if}
											{/snippet}
										</Select.Item>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
				</div>
				{#if trailing}
					<div class="@lg:flex @lg:justify-end @lg:pt-3 @5xl:mt-[5px] @5xl:shrink-0 @5xl:pt-0">{@render trailing()}</div>
				{/if}
			</div>
			{#each tabs as t (t.id)}
				<Tabs.Content value={t.id} class="pt-4">
					{#if active === t.id}{@render children()}{/if}
				</Tabs.Content>
			{/each}
		</Tabs.Root>
	</div>
{/if}
