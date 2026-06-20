<script lang="ts">
import "../app.css";
import { Menu, Monitor, Moon, Sun, X } from "lucide-svelte";
import { onDestroy } from "svelte";
import ThemePlayground from "$lib/components/ThemePlayground.svelte";
import { theme } from "$lib/stores/theme";

let { children } = $props();

let mobileMenuOpen = $state(false);
let currentTheme: "light" | "dark" | "system" = $state("system");

const unsub = theme.subscribe((v) => {
	currentTheme = v;
});
onDestroy(unsub);

// Resolve what icon to show based on effective dark state
let isDark = $state(false);
$effect(() => {
	isDark =
		currentTheme === "dark" ||
		(currentTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
});

function toggleMobileMenu() {
	mobileMenuOpen = !mobileMenuOpen;
}

function closeMobileMenu() {
	mobileMenuOpen = false;
}
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<header class="bg-primary shadow-md">
		<nav class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
			<!-- Logo / Branding -->
			<a href="/" class="flex items-center gap-2" onclick={closeMobileMenu}>
				<span class="font-heading text-2xl font-semibold text-white tracking-tight">
					Datos UMSS
				</span>
			</a>

			<!-- Desktop Nav -->
			<div class="hidden items-center gap-4 md:flex">
				<a
					href="/search"
					class="text-sm font-medium text-white/90 transition-colors duration-200 hover:text-white"
				>
					Catálogo
				</a>
				<a
					href="/about"
					class="text-sm font-medium text-white/90 transition-colors duration-200 hover:text-white"
				>
					Acerca de
				</a>

				<!-- Theme toggle -->
				<button
					onclick={() => theme.cycle()}
					class="rounded-md p-2 text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
					aria-label="Cambiar tema: claro, oscuro o sistema"
					title={currentTheme === 'light' ? 'Modo claro' : currentTheme === 'dark' ? 'Modo oscuro' : 'Seguir sistema'}
				>
					{#if currentTheme === 'light'}
						<Sun class="size-5" />
					{:else if currentTheme === 'dark'}
						<Moon class="size-5" />
					{:else}
						<Monitor class="size-5" />
					{/if}
				</button>

				{#if false}
					<!-- TODO: cuando tengamos auth -->
					<a href="/dashboard" class="text-sm font-medium text-white/90 hover:text-white">
						Dashboard
					</a>
					<a href="/auth/logout" class="text-sm font-medium text-red-300 hover:text-red-200">
						Salir
					</a>
				{:else}
					<a
						href="/auth/login"
						class="rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#c20510] hover:shadow-md"
					>
						Iniciar Sesión
					</a>
				{/if}
			</div>

			<!-- Mobile Hamburger -->
			<button
				type="button"
				class="inline-flex items-center justify-center rounded-md p-2 text-white/90 hover:bg-white/10 hover:text-white md:hidden"
				onclick={toggleMobileMenu}
				aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
				aria-expanded={mobileMenuOpen}
			>
				{#if mobileMenuOpen}
					<X class="size-6" />
				{:else}
					<Menu class="size-6" />
				{/if}
			</button>
		</nav>

		<!-- Mobile Menu -->
		{#if mobileMenuOpen}
			<div class="border-t border-white/10 bg-primary md:hidden">
				<div class="space-y-1 px-4 py-3">
					<a
						href="/search"
						class="block rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
						onclick={closeMobileMenu}
					>
						Catálogo
					</a>
					<a
						href="/about"
						class="block rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
						onclick={closeMobileMenu}
					>
						Acerca de
					</a>

					<!-- Theme toggle (mobile) -->
					<button
						onclick={() => theme.cycle()}
						class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
					>
						{#if currentTheme === 'light'}
							<Sun class="size-4" />
							Modo claro
						{:else if currentTheme === 'dark'}
							<Moon class="size-4" />
							Modo oscuro
						{:else}
							<Monitor class="size-4" />
							Seguir sistema
						{/if}
					</button>

					<a
						href="/auth/login"
						class="mt-2 block rounded-lg bg-[#E30613] px-3 py-2 text-center text-sm font-semibold text-white"
						onclick={closeMobileMenu}
					>
						Iniciar Sesión
					</a>
				</div>
			</div>
		{/if}
	</header>

	<!-- Main content -->
	<main class="flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-border bg-card">
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
				<div class="text-center sm:text-left">
					<p class="text-sm font-medium text-primary">
						Universidad Mayor de San Simón
					</p>
					<p class="text-xs text-muted-foreground">
						Plataforma de Datos Abiertos
					</p>
				</div>
				<div class="flex items-center gap-4 text-xs text-muted-foreground">
					<a href="/about" class="hover:text-primary transition-colors duration-200">
						Acerca de
					</a>
					<a href="/search" class="hover:text-primary transition-colors duration-200">
						Catálogo
					</a>
				</div>
			</div>
			<div class="mt-6 border-t border-border pt-4 text-center">
				<p class="text-xs text-muted-foreground">
					© {new Date().getFullYear()} Universidad Mayor de San Simón. Todos los derechos reservados.
				</p>
			</div>
		</div>
	</footer>

	<!-- Theme Playground (dev only) -->
	{#if import.meta.env.DEV}
		<ThemePlayground />
	{/if}
</div>
