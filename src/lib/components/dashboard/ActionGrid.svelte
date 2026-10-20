<!--
	La grilla de acciones del panel: una tarjeta por acción, con ícono, título, flecha, descripción y —cuando se
	conoce— una línea de estado (con un punto si hay algo pendiente). Columnas: 1 bajo 640 px, 2 desde `sm` y 4
	desde `xl`. Con más acciones la grilla simplemente baja de fila.
-->
<script lang="ts">
import { ArrowRight } from "@lucide/svelte";
import { cn } from "$lib/utils";
import type { DashboardAction } from "./actions";

interface Props {
	actions: DashboardAction[];
}

let { actions }: Props = $props();
</script>

<div data-action-grid="" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	{#each actions as action (action.id)}
		{@const Icon = action.icon}
		<a
			href={action.href}
			class={cn(
				"group flex items-start gap-4 rounded-xl border p-5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				action.tone === "primary"
					? "border-primary/30 bg-primary/5 hover:bg-primary/10"
					: "border-border bg-card hover:bg-accent/60",
			)}
		>
			<span
				class={cn(
					"inline-flex size-10 shrink-0 items-center justify-center rounded-full",
					action.tone === "primary"
						? "bg-primary text-primary-foreground"
						: "bg-primary/10 text-primary",
				)}
			>
				<Icon class="size-5" aria-hidden="true" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span class="font-heading text-base font-semibold text-primary">{action.title}</span>
					<ArrowRight
						class="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</span>
				<span class="mt-1 block text-xs leading-relaxed text-muted-foreground">
					{action.description}
				</span>
				{#if action.status}
					<span
						class="mt-3 flex items-center gap-2 border-t border-border/70 pt-2 text-xs font-medium text-foreground"
					>
						{#if action.badge}
							<span class="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true"></span>
						{/if}
						{action.status}
					</span>
				{/if}
			</span>
		</a>
	{/each}
</div>
