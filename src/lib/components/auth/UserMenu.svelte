<script lang="ts">
import { ChevronDown, Inbox, LayoutDashboard, LogOut } from "@lucide/svelte";
import { goto } from "$app/navigation";
import { logout } from "$lib/api/auth";
import { createPortalClient } from "$lib/api/client";
import { createOrganizationApi } from "$lib/api/organizations";
import { auth } from "$lib/stores/auth";

let open = $state(false);
let root = $state<HTMLElement | undefined>(undefined);

// «Solicitudes» sólo para quien puede pedir o decidir una publicación: la superadministración, o
// quien tiene capacidad de `update_dataset` en alguna organización (editor o admin). Es la misma
// pregunta que hacen la ficha y el panel (`listUpdatableOrganizationIds`), no una regla propia.
// Fail closed: arranca en `false` y sólo una respuesta `known` con organizaciones lo cambia; la
// consulta en vuelo, `unknown` o un error dejan la entrada oculta.
let puedeVerSolicitudes = $state(false);

$effect(() => {
	const user = $auth.user;
	puedeVerSolicitudes = false;
	if (!user) return;
	if (user.sysadmin) {
		puedeVerSolicitudes = true;
		return;
	}
	// Si el usuario cambia mientras la consulta vuela, la respuesta vieja no pisa a la nueva.
	let vigente = true;
	createOrganizationApi(createPortalClient())
		.listUpdatableOrganizationIds()
		.then((resultado) => {
			if (vigente) puedeVerSolicitudes = resultado.state === "known" && resultado.ids.length > 0;
		})
		.catch(() => {});
	return () => {
		vigente = false;
	};
});

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
	close();
	// Revocación best-effort: nunca lanza, y el cliente limpia el estado igual.
	await logout();
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
		class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent hover:text-primary"
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
				Panel
			</a>
			{#if puedeVerSolicitudes}
				<a
					href="/dashboard/requests"
					role="menuitem"
					onclick={close}
					class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
				>
					<Inbox class="size-4" aria-hidden="true" />
					Solicitudes
				</a>
			{/if}
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
