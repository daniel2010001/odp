<script lang="ts">
import { Check, ChevronDown } from "@lucide/svelte";
import { Select } from "bits-ui";

// Selector de una opción, sobre `Select` de bits-ui (teclado, tipeo para saltar, anuncio a lectores
// de pantalla). Un solo estilo para los tres campos del constructor: eje X, eje Y y tipo.
let {
	label,
	options,
	value = $bindable(""),
	disabled = false,
}: {
	label: string;
	options: { value: string; label: string }[];
	value?: string;
	disabled?: boolean;
} = $props();

const selected = $derived(options.find((o) => o.value === value));
const uid = $props.id();
</script>

<div class="flex min-w-0 flex-col gap-1.5">
	<span id="{uid}-label" class="text-sm font-medium text-foreground">{label}</span>
	<Select.Root type="single" bind:value items={options} {disabled}>
		<Select.Trigger
			aria-labelledby="{uid}-label"
			class="flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
		>
			<span class="truncate">{selected?.label ?? "Seleccione una opción"}</span>
			<ChevronDown class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		</Select.Trigger>
		<Select.Portal>
			<Select.Content
				sideOffset={4}
				class="z-50 max-h-72 min-w-[var(--bits-select-anchor-width)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
			>
				<Select.Viewport>
					{#each options as option (option.value)}
						<Select.Item
							value={option.value}
							label={option.label}
							class="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground motion-reduce:transition-none"
						>
							{#snippet children({ selected })}
								<span class="truncate">{option.label}</span>
								{#if selected}<Check class="size-4 shrink-0 text-primary" aria-hidden="true" />{/if}
							{/snippet}
						</Select.Item>
					{/each}
				</Select.Viewport>
			</Select.Content>
		</Select.Portal>
	</Select.Root>
</div>
