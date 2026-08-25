<script lang="ts">
import { ArrowRight, ShieldCheck } from "lucide-svelte";
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { currentUser, isAuthenticated, isSuperAdmin } from "$lib/stores/auth";

onMount(() => {
	if (!get(isAuthenticated)) {
		void goto("/auth/login");
	}
});
</script>

<svelte:head>
	<title>Panel — UMSS</title>
</svelte:head>

{#if $isAuthenticated}
	<div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">
				¡Hola, {$currentUser?.display_name || $currentUser?.name}!
			</h1>
			{#if $isSuperAdmin}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/30"
				>
					<ShieldCheck class="size-3.5" aria-hidden="true" />
					Administrador
				</span>
			{/if}
		</div>

		<p class="mt-3 text-muted-foreground">
			Este es tu panel personal. Desde acá vas a poder gestionar los datasets de tu
			organización.
		</p>

		<div class="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
			<h2 class="font-heading text-lg font-semibold text-primary">Publicación de datasets</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				La publicación de datasets estará disponible próximamente. Mientras tanto, podés
				explorar el catálogo existente.
			</p>
			<a
				href="/search"
				class="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c20510]"
			>
				Explorar el catálogo
				<ArrowRight class="size-4" aria-hidden="true" />
			</a>
		</div>
	</div>
{/if}
