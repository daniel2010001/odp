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
	· La línea de diagnóstico sólo se renderiza en desarrollo: dice el estado y la ruta en español,
	  y cita el mensaje crudo del framework entre comillas.

	─── Ronda de revisión visual (WU-2, 2026-10-03) ────────────────────
	El autor pidió que las páginas de error dejen de verse planas y eligió la propuesta **tarjeta**.
	La hoja agrega, sin promover nada por sí misma:
	· un **panel de control** con presets de caso y un interruptor de tema claro/oscuro;
	· un **instrumento** que mide, sobre el nodo real ya renderizado y con `getComputedStyle`, el
	  contraste WCAG de cada elemento observable y el desborde horizontal. Los números no se escriben
	  a mano: salen del DOM y de `$lib/color/contrast`.
	La compuerta de producción está en `+page.ts`. Esta hoja es permanente y no un borrador para
	borrar al promover (ver el comentario de `+page.ts`).
-->
<script lang="ts">
import { Info } from "@lucide/svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { contrastRatio, parseCssColor, requiredRatio } from "$lib/color/contrast";
import ErrorPage, { errorState } from "$lib/components/error/ErrorPage.svelte";
import { resolveEffectiveBackground } from "./background";
import { formatMeasures, type SheetMeasures } from "./measures";

interface Variant {
	status: number;
	/** Ruta fallida que el diagnóstico muestra y a la que apunta «Reintentar» en el 5xx. */
	path: string;
	/** Mensaje crudo del framework, en el idioma del framework, tal como lo recibiría el componente. */
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
		note: "Ruta inexistente. Es el que sí se puede provocar a mano escribiendo cualquier dirección desconocida. En la **ficha del dataset** —y en la del recurso— este rótulo **no** dice el número observado cuando el espectador no tiene sesión: dice «ERROR 403 o 404», porque la oración funde las dos lecturas y un rótulo que las distinga deshace lo que la oración hace. Acá se ve el caso de una ruta, que sí puede decir su número.",
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

// Valores aceptados por los parámetros de consulta que preseleccionan el panel. Ver `paramOr`.
const THEME_VALUES = ["claro", "oscuro"] as const;
const PATH_VALUES = ["con", "sin"] as const;

interface CasePreset {
	id: string;
	label: string;
	status: number;
	/** Si el 5xx lleva ruta, ofrece «Reintentar»; sin ruta, no lo inventa. */
	serverHasPath: boolean;
}

const CASE_PRESETS: CasePreset[] = [
	{ id: "404", label: "404 (cliente, sin reintento)", status: 404, serverHasPath: true },
	{ id: "500-path", label: "500 con ruta (con reintento)", status: 500, serverHasPath: true },
	{ id: "500-no-path", label: "500 sin ruta (sin reintento)", status: 500, serverHasPath: false },
	{ id: "503", label: "503", status: 503, serverHasPath: true },
];

/**
 * Lee un parámetro de la URL y cae al default si falta o no es uno de los valores permitidos. No
 * lanza: un valor inesperado (una URL vieja, un typo) deja la hoja en su estado por defecto en vez
 * de vaciarla.
 */
function paramOr<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	const raw = $page.url.searchParams.get(key);
	return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

// Estado inicial preseleccionado por la URL (`?theme=…&path=…`) para poder abrir la hoja ya
// posicionada —un navegador headless no puede hacer clic— y para volver a un estado exacto de la
// revisión. Sin parámetros, cada campo queda en su default y la hoja se comporta como siempre.
let theme = $state<"light" | "dark">(
	paramOr("theme", THEME_VALUES, "claro") === "oscuro" ? "dark" : "light",
);
let caseStatus = $state(404);
let serverHasPath = $state(paramOr("path", PATH_VALUES, "con") === "con");
let sheetRoot = $state<HTMLElement>();

interface ContrastRow {
	key: string;
	label: string;
	foreground: string;
	background: string;
	/** `true` si el fondo se compuso con un ancestro (el color resuelto no es el propio). */
	backgroundComposed: boolean;
	/** `background-color` intermedios que el parser no entendió. */
	backgroundUnreadable: string[];
	ratio: number | null;
	threshold: number | null;
	ok: boolean | null;
}

/**
 * Veredicto de una fila. Un fondo que no se pudo medir **nunca** puede dar `ok`: por eso
 * `no medible` gana sobre el `ok`/`falla` calculado con un color en el que no se puede confiar.
 */
function verdictOf(row: ContrastRow): string {
	if (row.backgroundUnreadable.length > 0) return "no medible";
	if (row.ok === null) return "—";
	return row.ok ? "ok" : "falla";
}

let rows = $state<ContrastRow[]>([]);
let measures = $state<SheetMeasures>({
	columnWidth: 0,
	cardScrollWidth: 0,
	cardClientWidth: 0,
	pageScrollWidth: 0,
	pageClientWidth: 0,
});

// El texto del instrumento sale de una función pura (`formatMeasures`), testeada con entradas
// conocidas; el `$derived` sólo la aplica a la última medida del árbol.
const formattedMeasures = $derived(formatMeasures(measures));

/** El 5xx sólo lleva ruta cuando el preset lo pide; el 4xx siempre la lleva. */
function pathFor(item: Variant): string | undefined {
	return errorState(item.status) === "server" && !serverHasPath ? undefined : item.path;
}

function applyPreset(preset: CasePreset): void {
	caseStatus = preset.status;
	serverHasPath = preset.serverHasPath;
	syncUrl();
	document
		.getElementById(`card-${preset.status}`)
		?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

/**
 * Refleja el estado del panel en la URL con `replaceState`.
 *
 * Segundo argumento = `page.state` (shallow routing): un objeto plano y serializable. Pasar la URL
 * u otro objeto no clonable hace que `replaceState` lance "could not be cloned" (el mismo caso
 * está documentado en `src/routes/search/+page.svelte`).
 */
function syncUrl(): void {
	const params = new URLSearchParams({
		theme: theme === "dark" ? "oscuro" : "claro",
		path: serverHasPath ? "con" : "sin",
	});
	replaceState(`/dev/error?${params.toString()}`, {});
}

function selectTheme(value: "light" | "dark"): void {
	theme = value;
	syncUrl();
}

/** Hex legible de un color ya en sRGB; el alfa se resuelve al componer fondos. */
function toHex(color: { r: number; g: number; b: number }): string {
	const channel = (value: number) =>
		Math.max(0, Math.min(255, Math.round(value)))
			.toString(16)
			.padStart(2, "0");
	return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

/** Mide el contraste de los elementos observables del componente ya renderizado. */
function measureContrast(root: HTMLElement): ContrastRow[] {
	const heading = root.querySelector<HTMLElement>("h1");
	const eyebrow = root.querySelector<HTMLElement>("p");
	const body =
		heading?.nextElementSibling instanceof HTMLElement ? heading.nextElementSibling : null;
	const anchors = Array.from(root.querySelectorAll<HTMLElement>("a"));

	const observables: { key: string; label: string; node: HTMLElement | null }[] = [
		{ key: "eyebrow", label: "Eyebrow", node: eyebrow },
		{ key: "heading", label: "Encabezado", node: heading },
		{ key: "body", label: "Cuerpo", node: body },
		{ key: "primary", label: "Acción primaria", node: anchors[0] ?? null },
		{ key: "secondary", label: "Acción secundaria", node: anchors[1] ?? null },
	];

	return observables.map(({ key, label, node }) => {
		if (!node) {
			return {
				key,
				label,
				foreground: "—",
				background: "—",
				backgroundComposed: false,
				backgroundUnreadable: [],
				ratio: null,
				threshold: null,
				ok: null,
			};
		}

		const computed = getComputedStyle(node);
		const foreground = parseCssColor(computed.color);
		const background = resolveEffectiveBackground(node);
		const backgroundRgba = parseCssColor(background.color) ?? { r: 255, g: 255, b: 255, a: 1 };
		const threshold = requiredRatio(
			Number.parseFloat(computed.fontSize) || 16,
			computed.fontWeight || "400",
		);
		const ratio = foreground ? contrastRatio(foreground, backgroundRgba) : null;

		return {
			key,
			label,
			foreground: foreground ? toHex(foreground) : "—",
			background: background.hex,
			backgroundComposed: background.composed,
			backgroundUnreadable: background.unreadable,
			ratio,
			threshold,
			ok: ratio === null ? null : ratio >= threshold,
		};
	});
}

// Recalcula el instrumento cuando cambia el tema o el caso. El DOM ya está actualizado cuando corre
// el efecto: los colores se leen del nodo real, no de constantes.
$effect(() => {
	void theme;
	void serverHasPath;

	if (!sheetRoot) return;

	const card = sheetRoot.querySelector<HTMLElement>(`[data-testid="error-render-${caseStatus}"]`);
	const root = card?.firstElementChild instanceof HTMLElement ? card.firstElementChild : null;
	rows = root ? measureContrast(root) : [];

	const cardShell = root?.firstElementChild instanceof HTMLElement ? root.firstElementChild : root;

	measures = {
		columnWidth: root?.getBoundingClientRect().width ?? 0,
		cardScrollWidth: cardShell?.scrollWidth ?? 0,
		cardClientWidth: cardShell?.clientWidth ?? 0,
		pageScrollWidth: document.documentElement.scrollWidth,
		pageClientWidth: document.documentElement.clientWidth,
	};
});
</script>

<svelte:head>
	<title>Hoja de revisión del error — UMSS</title>
</svelte:head>

<div
	data-testid="error-sheet"
	bind:this={sheetRoot}
	class:dark={theme === "dark"}
	class="min-h-screen bg-background font-sans text-foreground"
>
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
				desde el navegador. La línea de diagnóstico que aparece bajo cada tarjeta tampoco se
				renderiza fuera de desarrollo: dice el estado y la ruta en español, y cita el mensaje del
				framework en su idioma original, rotulado como suyo.
			</span>
		</p>

		<!-- ─── Panel de control ─────────────────────────────────────── -->
		<section
			data-testid="control-panel"
			class="mt-8 rounded-xl border border-border bg-card p-4 sm:p-6"
		>
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div>
					<h2 class="text-sm font-semibold text-card-foreground">Presets de caso</h2>
					<p class="mt-1 text-xs text-muted-foreground">
						Fijan el caso del revisor y bajan a la tarjeta correspondiente.
					</p>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each CASE_PRESETS as preset (preset.id)}
							<button
								type="button"
								data-testid={`preset-${preset.id}`}
								onclick={() => applyPreset(preset)}
								class="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<h2 class="text-sm font-semibold text-card-foreground">Tema</h2>
					<p class="mt-1 text-xs text-muted-foreground">
						Pone o quita la clase <code class="font-mono text-[11px]">dark</code> en la raíz de la
						hoja.
					</p>
					<div class="mt-3 flex gap-2">
						<button
							type="button"
							data-testid="theme-light"
							onclick={() => selectTheme("light")}
							class="rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors {theme ===
							'light'
								? 'bg-primary text-primary-foreground'
								: 'bg-background text-foreground hover:bg-accent'}"
						>
							Claro
						</button>
						<button
							type="button"
							data-testid="theme-dark"
							onclick={() => selectTheme("dark")}
							class="rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors {theme ===
							'dark'
								? 'bg-primary text-primary-foreground'
								: 'bg-background text-foreground hover:bg-accent'}"
						>
							Oscuro
						</button>
					</div>
				</div>
			</div>
		</section>

		<!-- ─── Las cinco tarjetas ───────────────────────────────────── -->
		<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
			{#each VARIANTS as item (item.status)}
				<article
					id={`card-${item.status}`}
					data-testid={`error-variant-${item.status}`}
					class="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
				>
					<header class="border-b border-border bg-muted px-4 py-3">
						<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<h2 class="font-heading text-base font-semibold text-card-foreground">
								Caso {item.status}
							</h2>
							<p class="font-mono text-xs text-muted-foreground">
								{errorState(item.status) === "client" ? "4xx" : "5xx"} · {item.path}
							</p>
						</div>
						<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{item.note}</p>
					</header>

					<div
						class="flex-1 bg-background"
						data-testid={`error-render-${item.status}`}
					>
						<ErrorPage status={item.status} message={item.message} path={pathFor(item)} />
					</div>
				</article>
			{/each}
		</div>

		<!-- ─── Instrumento de medición ──────────────────────────────── -->
		<section
			data-testid="instrument"
			class="mt-10 rounded-xl border border-border bg-card p-4 sm:p-6"
		>
			<h2 class="font-heading text-xl font-bold text-primary">Instrumento</h2>
			<p class="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
				Medición en vivo de la tarjeta del caso activo — tema
				<strong class="text-foreground">{theme === "dark" ? "oscuro" : "claro"}</strong>, caso
				<strong class="text-foreground">{caseStatus}</strong>—. Los colores se leen con
				<code class="font-mono text-[11px]">getComputedStyle</code> del nodo real y el ratio se
				calcula con <code class="font-mono text-[11px]">$lib/color/contrast</code>. Si un fondo
				intermedio no se puede interpretar, la fila dice <strong class="text-foreground"
					>no medible</strong
				>: el instrumento no inventa un aprobado con un color que no entendió.
			</p>

			<div class="mt-4 overflow-x-auto">
				<table class="w-full border-collapse text-sm">
					<thead>
						<tr class="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
							<th class="px-3 py-2 font-semibold">Elemento</th>
							<th class="px-3 py-2 font-semibold">Primer plano</th>
							<th class="px-3 py-2 font-semibold">Fondo efectivo</th>
							<th class="px-3 py-2 font-semibold">Ratio</th>
							<th class="px-3 py-2 font-semibold">Umbral</th>
							<th class="px-3 py-2 font-semibold">Veredicto</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.key)}
							<tr data-testid={`contrast-row-${row.key}`} class="border-b border-border/60">
								<td class="px-3 py-2 text-foreground">{row.label}</td>
								<td class="px-3 py-2">
									<span
										class="inline-flex items-center gap-2 font-mono text-xs text-foreground"
									>
										<span
											class="inline-block size-3 rounded-sm border border-border"
											style={`background-color: ${row.foreground}`}
										></span>
										<span data-testid={`contrast-foreground-${row.key}`}>{row.foreground}</span>
									</span>
								</td>
								<td class="px-3 py-2">
									<span
										class="inline-flex items-center gap-2 font-mono text-xs text-foreground"
									>
										<span
											class="inline-block size-3 rounded-sm border border-border"
											style={`background-color: ${row.background}`}
										></span>
										<span data-testid={`contrast-background-${row.key}`}>
											{row.backgroundUnreadable.length > 0
												? `no medible · ${row.backgroundUnreadable.join(", ")}`
												: row.backgroundComposed
													? `${row.background} · compuesto`
													: row.background}
										</span>
									</span>
								</td>
								<td
									data-testid={`contrast-ratio-${row.key}`}
									class="px-3 py-2 font-mono text-xs text-foreground"
								>
									{row.ratio === null ? "—" : row.ratio.toFixed(2)}
								</td>
								<td
									data-testid={`contrast-threshold-${row.key}`}
									class="px-3 py-2 font-mono text-xs text-muted-foreground"
								>
									{row.threshold === null ? "—" : `${row.threshold}:1`}
								</td>
								<td
									data-testid={`contrast-verdict-${row.key}`}
									class="px-3 py-2 text-xs font-semibold {row.backgroundUnreadable.length > 0
										? 'text-foreground italic'
										: row.ok === null
											? 'text-muted-foreground'
											: row.ok
												? 'text-primary'
												: 'text-destructive'}"
								>
									{verdictOf(row)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<h3 class="mt-6 text-sm font-semibold text-card-foreground">Medidas de layout</h3>
			<dl class="mt-2 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
				<div class="rounded-lg border border-border bg-background px-3 py-2">
					<dt class="text-muted-foreground">Ancho de la columna</dt>
					<dd data-testid="measure-column-width" class="font-mono text-foreground">
						{formattedMeasures.columnWidth}
					</dd>
				</div>
				<div class="rounded-lg border border-border bg-background px-3 py-2">
					<dt class="text-muted-foreground">Tarjeta · scroll / client</dt>
					<dd data-testid="measure-card-overflow" class="font-mono text-foreground">
						{formattedMeasures.cardOverflow}
					</dd>
				</div>
				<div class="rounded-lg border border-border bg-background px-3 py-2">
					<dt class="text-muted-foreground">Documento · scroll / client</dt>
					<dd data-testid="measure-document-overflow" class="font-mono text-foreground">
						{formattedMeasures.documentOverflow}
					</dd>
				</div>
			</dl>
		</section>
	</div>
</div>
