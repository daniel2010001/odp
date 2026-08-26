<script lang="ts">
import { onMount } from "svelte";
import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { login as apiLogin } from "$lib/api/auth";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { loginSchema } from "$lib/schemas/auth";
import { auth, isAuthenticated } from "$lib/stores/auth";

let username = $state("");
let password = $state("");
let loading = $state(false);
let error = $state<string | null>(null);
let fieldErrors = $state<{ username?: string; password?: string }>({});

onMount(() => {
	if (get(isAuthenticated)) {
		void goto("/dashboard");
	}
});

async function handleSubmit(event: SubmitEvent) {
	event.preventDefault();
	error = null;
	fieldErrors = {};

	const parsed = loginSchema.safeParse({ username, password });
	if (!parsed.success) {
		const next: { username?: string; password?: string } = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path[0];
			if (key === "username" || key === "password") {
				next[key] = issue.message;
			}
		}
		fieldErrors = next;
		return;
	}

	loading = true;
	try {
		const session = await apiLogin(parsed.data.username, parsed.data.password);
		auth.login(session.token, session.user);
		const returnTo = get(page).url.searchParams.get("returnTo");
		await goto(returnTo || "/dashboard");
	} catch (err) {
		error = err instanceof Error ? err.message : "No se pudo iniciar sesión.";
		loading = false;
	}
}
</script>

<svelte:head>
	<title>Iniciar Sesión — UMSS</title>
</svelte:head>

<div class="mx-auto max-w-md px-4 py-12 sm:px-6 lg:px-8">
	<h1 class="font-heading text-3xl font-bold text-primary">Iniciar Sesión</h1>
	<p class="mt-2 text-sm text-muted-foreground">
		Ingresá con tu cuenta de CKAN para acceder al panel.
	</p>

	<Card class="mt-6 p-6">
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-1.5">
				<label for="username" class="text-sm font-medium text-primary">
					Nombre de usuario
				</label>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					bind:value={username}
					aria-invalid={fieldErrors.username ? "true" : undefined}
					class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				/>
				{#if fieldErrors.username}
					<p class="text-xs text-destructive">{fieldErrors.username}</p>
				{/if}
			</div>

			<div class="space-y-1.5">
				<label for="password" class="text-sm font-medium text-primary">Contraseña</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					bind:value={password}
					aria-invalid={fieldErrors.password ? "true" : undefined}
					class="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				/>
				{#if fieldErrors.password}
					<p class="text-xs text-destructive">{fieldErrors.password}</p>
				{/if}
			</div>

			{#if error}
				<div
					role="alert"
					class="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
				>
					{error}
				</div>
			{/if}

			<Button type="submit" disabled={loading} class="w-full">
				{loading ? "Iniciando sesión..." : "Iniciar Sesión"}
			</Button>
		</form>
	</Card>

	<p class="mt-4 text-center text-sm text-muted-foreground">
		¿No podés ingresar? Contactá al administrador de tu organización.
	</p>
</div>
