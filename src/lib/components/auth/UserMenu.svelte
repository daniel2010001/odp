<script lang="ts">
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { logout } from "$lib/api/auth";
import { auth } from "$lib/stores/auth";

let open = $state(false);
let root = $state<HTMLElement | undefined>(undefined);

function toggle() {
	open = !open;
}

function close() {
	open = false;
}

function onDocumentClick(event: MouseEvent) {
	if (root && !root.contains(event.target as Node)) {
		close();
	}
}

function onDocumentKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		close();
	}
}

$effect(() => {
	if (!open) return;
	document.addEventListener("click", onDocumentClick);
	document.addEventListener("keydown", onDocumentKeydown);
	return () => {
		document.removeEventListener("click", onDocumentClick);
		document.removeEventListener("keydown", onDocumentKeydown);
	};
});

async function handleLogout() {
	const token = get(auth).token;
	close();
	// Revocación best-effort: nunca lanza, y el cliente limpia el estado igual.
	if (token) await logout(token);
	auth.logout();
	await goto("/");
}
</script>

<div class="relative" bind:this={root}>
	<button
		type="button"
		onclick={toggle}
		aria-haspopup="menu"
		aria-expanded={open}
		class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors duration-200 hover:bg-white/10 hover:text-white"
	>
		<span>{$auth.user?.display_name || $auth.user?.name || "Cuenta"}</span>
		<ChevronDown class="size-4" aria-hidden="true" />
	</button>

	{#if open}
		<div
			role="menu"
			class="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-card p-1 text-card-foreground shadow-md"
		>
			<a
				href="/dashboard"
				role="menuitem"
				onclick={close}
				class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				<LayoutDashboard class="size-4" aria-hidden="true" />
				Dashboard
			</a>
			<button
				type="button"
				role="menuitem"
				onclick={handleLogout}
				class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
			>
				<LogOut class="size-4" aria-hidden="true" />
				Cerrar sesión
			</button>
		</div>
	{/if}
</div>
