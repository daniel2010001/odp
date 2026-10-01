<!--
	Página de error del portal — la capa de presentación.

	┌─ Tiene DOS estados, nunca tres ────────────────────────────────────┐
	│ Toda la familia 4xx (401, 403, 404, …) renderiza el mismo         │
	│ encabezado y el mismo cuerpo. Distinguir «la dirección no existe»  │
	│ de «usted no tiene permiso» filtraría la existencia del recurso,   │
	│ exactamente lo que `src/lib/api/failure.ts` decidió no hacer: el   │
	│ texto de autorización de un espectador sin sesión nombra las dos   │
	│ lecturas como alternativas y no confirma ninguna. Este componente  │
	│ no lee la sesión —no importa nada de `$lib/session`— y por eso     │
	│ tampoco puede hacer la distinción que la política prohíbe.         │
	└────────────────────────────────────────────────────────────────────┘
	┌─ Nunca ofrece iniciar sesión ──────────────────────────────────────┐
	│ Un enlace «Iniciar sesión» dentro del estado de error le          │
	│ confirmaría al espectador que el recurso existe. El camino al      │
	│ login vive en el encabezado del layout, que no lleva información   │
	│ sobre lo solicitado. Es la misma decisión que `failureActions`     │
	│ documenta.                                                         │
	└────────────────────────────────────────────────────────────────────┘
	┌─ El reintento sólo existe en el 5xx ───────────────────────────────┐
	│ Reintentar *puede* cambiar un 5xx y *nunca* puede cambiar un 404:  │
	│ por eso el 4xx no lo ofrece. Sin ruta fallida tampoco se inventa   │
	│ un destino —un reintento a la home no reintenta nada—, así que la  │
	│ acción aparece sólo cuando el llamador pasa `path`.                │
	└────────────────────────────────────────────────────────────────────┘

	La copia congelada se expone en el bloque `module` para que la hoja de revisión
	(`src/routes/dev/error`) muestre el componente real sin repetir una cadena a mano. El diagnóstico
	en inglés del framework se imprime sólo con `import.meta.env.DEV`: nunca llega a producción.
-->

<script lang="ts" module>
/** Los dos —y sólo dos— estados de la página de error. */
export type ErrorState = "client" | "server";

/** La copia que el estado renderiza. */
export interface ErrorCopy {
	/** Texto del `<title>` del documento. */
	title: string;
	/** Encabezado principal (`<h1>`). */
	heading: string;
	/** Párrafo que explica qué puede hacer el espectador. */
	body: string;
}

/**
 * Clasifica el estado HTTP en uno de los dos estados de la página.
 *
 * Todo el rango 4xx es un único estado de cliente. Cualquier otro valor —un 5xx, pero también un
 * estado no observado como `0` o un 3xx— cae del lado del servidor: el portal no puede afirmar
 * que la página faltó, así que no lo afirma.
 */
export function errorState(status: number): ErrorState {
	return status >= 400 && status < 500 ? "client" : "server";
}

/** Devuelve la copia del estado que le toca al estado HTTP. */
export function errorCopy(status: number): ErrorCopy {
	return errorState(status) === "client" ? CLIENT_ERROR_COPY : SERVER_ERROR_COPY;
}

const CLIENT_ERROR_COPY: ErrorCopy = {
	title: "Página no disponible — UMSS",
	heading: "No se pudo abrir esta página",
	// Una sola oración para las dos lecturas: la dirección puede no existir, o el espectador
	// puede no tener permiso. El texto no confirma ninguna de las dos.
	body: "Puede que la dirección no exista o que usted no tenga permiso para verla. Vuelva al catálogo para buscar los datos que necesita.",
};

const SERVER_ERROR_COPY: ErrorCopy = {
	title: "Error del servidor — UMSS",
	heading: "Algo falló de nuestro lado",
	// Cierto para 5xx y para un transporte sin respuesta: el problema no está en el equipo del
	// espectador y lo único útil es volver a intentar.
	body: "No pudimos completar la operación. El problema está en el servidor, no en su equipo: intente nuevamente en unos minutos.",
};

// Mismas clases de token que el par primario/secundario del asistente de creación
// (`src/routes/dashboard/datasets/new/+page.svelte`): los `ui/button` vendorizados renderizan un
// `<button>` y estas acciones son navegaciones reales, así que son anclas con los mismos tokens.
const PRIMARY_ACTION =
	"inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto";
const SECONDARY_ACTION =
	"inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto";
</script>

<script lang="ts">
	import { FileQuestion, RotateCw, TriangleAlert } from "@lucide/svelte";

	let {
		status,
		message,
		path,
	}: { status: number; message?: string; path?: string } = $props();

	const state = $derived(errorState(status));
	const copy = $derived(errorCopy(status));

	// Diagnóstico de desarrollo: estado observado, ruta y el mensaje crudo del framework (en
	// inglés). Se renderiza sólo con `import.meta.env.DEV`.
	const diagnostic = $derived(
		[String(status), path, message]
			.filter((part) => part !== undefined && part !== "")
			.join(" · "),
	);
</script>

<svelte:head>
	<title>{copy.title}</title>
</svelte:head>

<div class="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
	<p class="text-xs font-semibold uppercase tracking-wider text-destructive">ERROR {status}</p>

	{#if state === "client"}
		<FileQuestion class="mt-6 size-10 text-muted-foreground" aria-hidden="true" />
	{:else}
		<TriangleAlert class="mt-6 size-10 text-destructive" aria-hidden="true" />
	{/if}

	<h1 class="mt-4 font-heading text-3xl font-bold text-primary sm:text-4xl">{copy.heading}</h1>

	<p class="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">{copy.body}</p>

	<div class="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
		{#if state === "client"}
			<a href="/search" class={PRIMARY_ACTION}>Volver al catálogo</a>
			<a href="/" class={SECONDARY_ACTION}>Ir a la página de inicio</a>
		{:else}
			{#if path}
				<a href={path} class={PRIMARY_ACTION}>
					<RotateCw class="size-4" aria-hidden="true" />
					Reintentar
				</a>
			{/if}
			<a href="/search" class={SECONDARY_ACTION}>Volver al catálogo</a>
		{/if}
	</div>

	{#if import.meta.env.DEV}
		<p class="mt-6 font-mono text-[11px] text-muted-foreground/70">{diagnostic}</p>
	{/if}
</div>
