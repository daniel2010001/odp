<!--
	Interruptor del playground: un par (o más) de botones excluyentes. Va en la sección que cambia, no en
	el panel (AGENTS.md, regla 8), con el borde punteado que lo separa del producto. Copia del de
	`/dev/search-bar` (ya promovido y borrado): cada playground se borra al promoverse, así que ninguno depende
	del otro.
-->
<script lang="ts" generics="T extends string">
let {
	label,
	options,
	value,
	onchange,
	testid,
}: {
	label: string;
	options: { value: T; label: string }[];
	value: T;
	onchange: (value: T) => void;
	testid?: string;
} = $props();
</script>

<div class="flex flex-wrap items-center gap-2" role="group" aria-label={label} data-testid={testid}>
	<span class="text-xs font-medium text-muted-foreground">{label}</span>
	{#each options as option (option.value)}
		<button
			type="button"
			aria-pressed={value === option.value}
			onclick={() => onchange(option.value)}
			class="cursor-pointer rounded-lg border border-input px-3 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {value ===
			option.value
				? 'bg-primary text-primary-foreground'
				: 'bg-background text-foreground hover:bg-accent'}"
		>
			{option.label}
		</button>
	{/each}
</div>
