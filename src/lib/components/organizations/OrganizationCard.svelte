<script lang="ts">
import { Database } from "lucide-svelte";
import Card from "$lib/components/ui/card/card.svelte";
import type { CkanOrganization } from "$lib/types/ckan";
import { cn } from "$lib/utils";
import OrganizationLogo from "./OrganizationLogo.svelte";

let {
	org,
	count,
	class: className = "",
}: {
	org: CkanOrganization;
	count: number;
	class?: string;
} = $props();

const title = $derived(org.title || org.name);
const description = $derived(org.description || "Sin descripción");
</script>

<a href={`/organization/${org.name}`} class="group block no-underline">
	<Card
		class={cn(
			"cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-md",
			className,
		)}
	>
		<div class="flex items-start gap-4 p-4">
			<OrganizationLogo imageUrl={org.image_url} name={title} />

			<div class="min-w-0 flex-1 space-y-1">
				<h3
					class="font-heading text-base font-semibold text-primary underline-offset-2 transition-colors group-hover:text-primary/80 group-hover:underline"
				>
					{title}
				</h3>

				<p class="text-sm text-muted-foreground line-clamp-2">{description}</p>

				<div class="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
					<Database class="size-3" />
					<span>{count} dataset{count === 1 ? "" : "s"}</span>
				</div>
			</div>
		</div>
	</Card>
</a>
