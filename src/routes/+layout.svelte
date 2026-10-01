<script lang="ts">
import "../app.css";
import { Menu, Monitor, Moon, Sun, X } from "@lucide/svelte";
import { onDestroy } from "svelte";
import UserMenu from "$lib/components/auth/UserMenu.svelte";
import ThemePlayground from "$lib/components/ThemePlayground.svelte";
import { isAuthenticated } from "$lib/stores/auth";
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

// ─── El encabezado se achica cuando la página deja el tope ────────────
// El estado va en el **documento**, no en el `<header>`: `--header-h` la leen también los pegados que
// son hermanos del encabezado —la barra del panel, la del buscador, los laterales del dataset y del
// asistente—, y una variable puesta en el encabezado no baja a sus hermanos.
//
// El disparador es un centinela de 1px al tope, no un listener de scroll: el observer avisa cuando el
// tope sale de vista y no hay trabajo por frame. `rootMargin` positivo corre el borde superior del
// root hacia arriba, que es lo que da el umbral: no se achica al primer pixel, se achica después de
// `SHRINK_AFTER_PX`.
const SHRINK_AFTER_PX = 48;

let headerSentinel: HTMLDivElement | undefined = $state();

$effect(() => {
	if (!headerSentinel) return;
	if (typeof IntersectionObserver === "undefined") return;

	const sentinel = headerSentinel;
	const observer = new IntersectionObserver(
		([entry]) => {
			document.documentElement.toggleAttribute("data-header-shrunk", !entry.isIntersecting);
		},
		{ rootMargin: `${SHRINK_AFTER_PX}px 0px 0px 0px` },
	);

	observer.observe(sentinel);

	return () => {
		observer.disconnect();
		// El atributo es del documento: si no se limpia, sobrevive a la navegación y el encabezado
		// arranca achicado en la página siguiente.
		document.documentElement.removeAttribute("data-header-shrunk");
	};
});
</script>

<div class="flex min-h-screen flex-col">
	<!-- Centinela del tope: su salida de la vista es lo que achica el encabezado. Mide 1px y el margen
	     negativo lo compensa, así que no ocupa lugar ni mueve el layout. -->
	<div bind:this={headerSentinel} data-header-sentinel aria-hidden="true" class="-mb-px h-px"></div>

	<!-- Header -->
	<!-- El alto sale del token `--header-h` (`src/app.css`, única fuente). `data-site-header` es el
	     hook que mide el observer de la barra pegajosa del panel, para no depender de una constante. -->
	<header class="sticky top-0 z-40 border-b border-border bg-card shadow-sm" data-site-header>
		<nav
			class="mx-auto flex h-[var(--header-h)] max-w-7xl items-center justify-between px-4 transition-[height] duration-200 ease-out sm:px-6 lg:px-8"
		>
			<!-- Logo / Branding -->
			<a href="/" class="flex flex-col justify-center leading-tight" onclick={closeMobileMenu}>
				<span class="font-heading text-2xl font-bold tracking-tight text-primary">
					Datos UMSS
				</span>
				<span class="text-xs text-muted-foreground">Plataforma de Datos Abiertos</span>
			</a>

			<!-- Desktop Nav -->
			<div class="hidden items-center gap-8 md:flex">
				<div class="flex items-center gap-1">
					<a
						href="/search"
						class="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent hover:text-primary"
					>
						Catálogo
					</a>
					<a
						href="/organizations"
						class="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent hover:text-primary"
					>
						Organizaciones
					</a>
					<a
						href="/about"
						class="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-accent hover:text-primary"
					>
						Acerca de
					</a>
				</div>

				<div class="flex items-center gap-3">
					<!-- Theme toggle -->
					<button
						onclick={() => theme.cycle()}
						class="rounded-md p-2 text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-primary"
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

					{#if $isAuthenticated}
						<UserMenu />
					{:else}
						<a
							href="/auth/login"
							class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md"
						>
							Iniciar Sesión
						</a>
					{/if}
				</div>
			</div>

			<!-- Mobile Hamburger -->
			<button
				type="button"
				class="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent hover:text-primary md:hidden"
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
			<div class="border-t border-border bg-card md:hidden">
				<div class="space-y-1 px-4 py-3">
					<a
						href="/search"
						class="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary"
						onclick={closeMobileMenu}
					>
						Catálogo
					</a>
					<a
						href="/organizations"
						class="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary"
						onclick={closeMobileMenu}
					>
						Organizaciones
					</a>
					<a
						href="/about"
						class="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary"
						onclick={closeMobileMenu}
					>
						Acerca de
					</a>

					<!-- Theme toggle (mobile) -->
					<button
						onclick={() => theme.cycle()}
						class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary"
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

					{#if $isAuthenticated}
						<div class="mt-2">
							<UserMenu />
						</div>
					{:else}
						<a
							href="/auth/login"
							class="mt-2 block rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground"
							onclick={closeMobileMenu}
						>
							Iniciar Sesión
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- Main content -->
	<main class="flex-1">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="bg-footer text-footer-foreground">
		<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
			<div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Brand -->
				<div class="space-y-4">
					<p class="font-heading text-2xl font-bold text-footer-foreground">Datos UMSS</p>
					<p class="max-w-xs text-sm leading-relaxed text-footer-foreground/80">
						Universidad Mayor de San Simón — Plataforma de Datos Abiertos. Conjuntos de datos
						académicos y administrativos bajo principios FAIR.
					</p>
				</div>

				<!-- Platform -->
				<div>
					<p class="font-heading text-base font-bold text-footer-foreground">Plataforma</p>
					<ul class="mt-3 space-y-2 text-sm text-footer-foreground/80">
						<li>
							<a href="/search" class="transition-colors duration-200 hover:text-footer-foreground">
								Catálogo
							</a>
						</li>
						<li>
							<a
								href="/organizations"
								class="transition-colors duration-200 hover:text-footer-foreground"
							>
								Organizaciones
							</a>
						</li>
						<li>
							<a href="/about" class="transition-colors duration-200 hover:text-footer-foreground">
								Acerca de
							</a>
						</li>
						<li>
							<a
								href="/dashboard"
								class="transition-colors duration-200 hover:text-footer-foreground"
							>
								Dashboard
							</a>
						</li>
					</ul>
				</div>

				<!-- Data -->
				<div>
					<p class="font-heading text-base font-bold text-footer-foreground">Datos</p>
					<ul class="mt-3 space-y-2 text-sm text-footer-foreground/80">
						<li>
							<a href="/search" class="transition-colors duration-200 hover:text-footer-foreground">
								Explorar datasets
							</a>
						</li>
						<li>
							<a
								href="/organizations"
								class="transition-colors duration-200 hover:text-footer-foreground"
							>
								Por organización
							</a>
						</li>
						<li>
							<a href="/about" class="transition-colors duration-200 hover:text-footer-foreground">
								Sobre la plataforma
							</a>
						</li>
					</ul>
				</div>

				<!-- Contact -->
				<div>
					<p class="font-heading text-base font-bold text-footer-foreground">Contacto</p>
					<ul class="mt-3 space-y-2 text-sm text-footer-foreground/80">
						<li>Cochabamba, Bolivia</li>
						<li>
							<a
								href="mailto:datos@umss.edu.bo"
								class="transition-colors duration-200 hover:text-footer-foreground"
							>
								datos@umss.edu.bo
							</a>
						</li>
					</ul>
				</div>
			</div>

			<div
				class="mt-10 flex flex-col items-center justify-between gap-2 border-t border-footer-foreground/20 pt-6 sm:flex-row"
			>
				<p class="text-xs text-footer-foreground/70">
					© {new Date().getFullYear()} Universidad Mayor de San Simón. Todos los derechos reservados.
				</p>
				<p class="text-xs text-footer-foreground/70">Plataforma de Datos Abiertos · SvelteKit + CKAN</p>
			</div>
		</div>
	</footer>

	<!-- Theme Playground (dev only) -->
	{#if import.meta.env.DEV}
		<ThemePlayground />
	{/if}
</div>
