<!--
	Hoja de revisión de la página de error — superficie sólo para desarrollo (`/dev/error`).

	Muestra el **componente real** (`$lib/components/error/ErrorPage.svelte`) en sus cinco estados
	revisables, uno al lado del otro: 401, 403, 404, 500 y 503. No es una maqueta: la copia sale de
	`errorCopy`, así que lo que el autor aprueba es exactamente lo que se publica.

	Lo que la hoja tiene que dejar ver:
	· 401, 403 y 404 son un solo estado, letra por letra; no existe una variante «sin permiso» que
	  delate la existencia de un recurso privado (`src/lib/api/failure.ts` razona igual).
	· El reintento aparece sólo en el 5xx: reintentar *puede* cambiar un 5xx y *nunca* un 404.
	· Ningún estado ofrece iniciar sesión; ese camino vive en el encabezado del layout.
	· La línea de diagnóstico en inglés sólo se renderiza en desarrollo.

	La ruta no existe en producción: la compuerta está en `+page.ts`. Esta hoja es permanente y no un
	borrador para borrar al promover (ver el comentario de `+page.ts`).
-->
<script lang="ts">
import { Info } from "@lucide/svelte";
import ErrorPage, { errorState } from "$lib/components/error/ErrorPage.svelte";

interface Variant {
	status: number;
	/** Ruta fallida que el diagnóstico muestra y a la que apunta «Reintentar» en el 5xx. */
	path: string;
	/** Mensaje crudo del framework, en inglés, tal como lo recibiría el componente. */
	message: string;
	note: string;
}

const VARIANTS: Variant[] = [
	{
		status: 401,
		path: "/dashboard",
		message: "Unauthorized",
		note: "El catálogo respondió 401. Cae en el mismo estado que el 403 y el 404: el portal no puede afirmar que la causa sea la sesión del espectador.",
	},
	{
		status: 403,
		path: "/dataset/privado",
		message: "Access denied",
		note: "Acceso denegado. Es el caso que motivó la política: un espectador sin sesión recibe el mismo texto para un recurso privado y para uno inexistente, para no filtrar la existencia.",
	},
	{
		status: 404,
		path: "/no-existe",
		message: "Not Found",
		note: "Ruta inexistente. Es el que sí se puede provocar a mano escribiendo cualquier dirección desconocida.",
	},
	{
		status: 500,
		path: "/dev/error",
		message: "Internal Error",
		note: "Error del servidor. No se puede provocar a mano: por eso «Reintentar» apunta a esta misma hoja, que es la ruta que el revisor está mirando.",
	},
	{
		status: 503,
		path: "/dev/error",
		message: "Service Unavailable",
		note: "Servicio no disponible. Comparte estado con el 500 y tampoco se puede provocar a mano.",
	},
];
</script>

<svelte:head>
	<title>Hoja de revisión del error — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
		<header>
			<h1 class="font-heading text-3xl font-bold text-primary">Hoja de revisión del error</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Renderiza el componente real de la página de error —<code class="font-mono text-xs"
					>src/lib/components/error/ErrorPage.svelte</code
				>— en sus cinco estados revisables. La copia se obtiene de
				<code class="font-mono text-xs">errorCopy</code>, no se escribe a mano: lo que se lee acá
				es lo que se publica, y <code class="font-mono text-xs">dev-error.test.ts</code> falla si la
				hoja deja de cubrir un estado.
			</p>
		</header>

		<p
			data-testid="dev-only-note"
			class="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>
				Página sólo para desarrollo. En producción <code class="font-mono text-xs">/dev/error</code
				> no existe (responde 404), y por eso se mantiene: los estados 5xx no se pueden provocar
				desde el navegador. La línea de diagnóstico en inglés que aparece bajo cada variante tampoco
				se renderiza fuera de desarrollo.
			</span>
		</p>

		<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
			{#each VARIANTS as variant (variant.status)}
				<article
					data-testid={`error-variant-${variant.status}`}
					class="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
				>
					<header class="border-b border-border bg-muted px-4 py-3">
						<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<h2 class="font-heading text-base font-semibold text-card-foreground">
								Variante {variant.status}
							</h2>
							<p class="font-mono text-xs text-muted-foreground">
								{errorState(variant.status) === "client" ? "4xx" : "5xx"} · {variant.path}
							</p>
						</div>
						<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{variant.note}</p>
					</header>

					<div class="flex-1 bg-background">
						<ErrorPage status={variant.status} message={variant.message} path={variant.path} />
					</div>
				</article>
			{/each}
		</div>
	</div>
</div>
