<script lang="ts">
import { ArrowRight, Database } from "lucide-svelte";
import Card from "$lib/components/ui/card/card.svelte";
import type { CkanOrganization } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import OrganizationLogo from "./OrganizationLogo.svelte";

let {
	org,
	count,
	href = `/organization/${org.name}`,
	badge,
	class: className = "",
}: {
	org: CkanOrganization;
	count: number;
	href?: string;
	badge?: string;
	class?: string;
} = $props();

const title = $derived(org.title || org.name);
const description = $derived(org.description || "Sin descripción");

const badgeLabel = $derived.by(() => {
	if (badge) return badge;
	const t = (org.title || "").toLowerCase();
	if (t.includes("facultad")) return "Facultad";
	if (t.includes("rectorado")) return "Rectorado";
	if (t.includes("dirección") || t.includes("direccion")) return "Dirección";
	if (t.includes("instituto") || t.includes("centro")) return "Instituto";
	return "Unidad";
});
</script>

<a href={href} class="group block h-full no-underline">
	<Card
		class={cn(
			"flex h-full flex-col gap-4 p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-md",
			className,
		)}
	>
		<span
			class="inline-flex w-fit items-center rounded-md bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary"
		>
			{badgeLabel}
		</span>

		<OrganizationLogo
			imageUrl={org.image_url}
			name={title}
			class="size-11 rounded-lg bg-primary font-heading text-xl font-bold text-primary-foreground"
		/>

		<div class="flex-1">
			<h3
				class="font-heading text-xl font-bold text-primary underline-offset-2 transition-colors group-hover:text-primary/80 group-hover:underline"
			>
				{title}
			</h3>
			<p class="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">{description}</p>
		</div>

		<div class="flex items-center justify-between border-t border-border pt-3">
			<span class="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
				<Database class="size-4" />
				{count} dataset{count === 1 ? "" : "s"}
			</span>
			<ArrowRight
				class="size-4 text-destructive transition-transform duration-200 group-hover:translate-x-0.5"
			/>
		</div>
	</Card>
</a>
