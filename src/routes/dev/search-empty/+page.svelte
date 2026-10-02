<!--
	Hoja de revisión temporal — `/dev/search-empty` (regla 8 de `AGENTS.md`).

	Qué se decide acá: el vacío del buscador como **una sola sección con saltos `#id`**. El expediente
	`odd/tasks/search-empty-anchors.md` fija el resto; la hoja tiene que responder dónde vive la fila de
	saltos, si lleva rótulo visible y **cómo se trata cada salto**. Ese último punto viene de la revisión
	del autor: dentro de la tarjeta del aviso, «Limpiar búsqueda y filtros» ya es un enlace de texto, así
	que una fila de saltos con el mismo tratamiento no se lee como destino. Las cinco variantes (V0–V4)
	se aplican a la fila entera para compararlas en contexto.

	Tres estados, uno por vez (los `id` no se pueden duplicar en el documento):

	  · «Hoy»      — el estado actual, tal cual: aviso `<p>`, tres tarjetas separadas, sin sección,
	                 sin `id` y sin saltos. Es el punto de comparación.
	  · «Lectura A»— `<section id="sin-resultados">` con el aviso como `<h2>`, la fila de saltos
	                 **dentro de la tarjeta del aviso**, debajo del mensaje.
	  · «Lectura B»— la misma sección, con la fila de saltos como **barra de la sección**, fuera de la
	                 tarjeta, justo encima de los tres bloques.

	Qué es real y qué es copia — a propósito, sin maquillaje:

	  · REALS: el encabezado del portal (vive en `src/routes/+layout.svelte`, `/dev/*` renderiza dentro
	    del layout) y los `DatasetCard` / `OrganizationCard`, que son los componentes de producción.
	  · COPIA: la tarjeta del aviso, los tres bloques y la fila de saltos están duplicados del vacío de
	    `src/routes/search/+page.svelte`. La ResultsBar también es una copia **con las mismas clases**,
	    más `data-dev-sticky`, que es el hook de medición de esta hoja y no existe en la página real.
	  · El botón «Limpiar búsqueda y filtros» es inerte acá: en la página real reinicia la búsqueda.

	Los datos son las fixtures del repo (`$lib/mock/data`), las mismas que la página usa en dev. En la
	promoción, los bloques existen sólo si sus datos llegaron: acá los presets hacen de cuenta de que
	llegaron (los tres bloques siempre tienen datos con las fixtures).

	La hoja se borra al promover la lectura elegida (regla 8), como la anterior de este mismo vacío.
-->
<script lang="ts">
import { ArrowDown } from "@lucide/svelte";
import OrganizationCard from "$lib/components/organizations/OrganizationCard.svelte";
import DatasetCard from "$lib/components/search/DatasetCard.svelte";
import { getMockSearchResult, MOCK_DATASETS, MOCK_ORGS } from "$lib/mock/data";
import type { CkanFacet, CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { cn } from "$lib/utils";

// ─── Fixtures: las que la página real usa en dev ───────────────────
// «Mientras tanto, lo más reciente»: los tres primeros datasets, como `loadEmptyAssist()`.
const recientes: CkanPackage[] = MOCK_DATASETS.slice(0, 3);

// «Explorar por organización»: las tres con más datasets, de mayor a menor (`topByPackageCount`).
const organizaciones: CkanOrganization[] = [...MOCK_ORGS]
	.sort((a, b) => (b.package_count ?? 0) - (a.package_count ?? 0))
	.slice(0, 3);

// «Pruebe con»: misma derivación que `suggestionChips` de la página real (los tres formatos y las
// tres etiquetas más frecuentes del catálogo), leída de las fixtures en vez del catálogo.
const sugerencias: { label: string; href: string }[] = (() => {
	const facets: Record<string, CkanFacet> = getMockSearchResult().search_facets ?? {};
	const chips: { label: string; href: string }[] = [];
	const seen = new Set<string>();

	const take = (facet: CkanFacet | undefined, param: "format" | "tags") => {
		const items = [...(facet?.items ?? [])].sort((a, b) => b.count - a.count).slice(0, 3);
		for (const item of items) {
			if (!item.name) continue;
			const href = `/search?${param}=${encodeURIComponent(item.name)}`;
			if (seen.has(href)) continue;
			seen.add(href);
			chips.push({ label: item.display_name || item.name, href });
		}
	};

	take(facets.res_format, "format");
	take(facets.tags, "tags");
	return chips;
})();

const mensajeVacio = 'No encontramos datasets para "movilidad". Pruebe con otros términos.';

// ─── Control del playground ────────────────────────────────────────
type Lectura = "hoy" | "a" | "b";

const LECTURAS: { id: Lectura; label: string }[] = [
	{ id: "hoy", label: "Hoy — sin sección ni saltos" },
	{ id: "a", label: "Lectura A — saltos dentro del aviso" },
	{ id: "b", label: "Lectura B — barra de saltos de la sección" },
];
let lectura = $state<Lectura>("a");

type Bloques = { sugerencias: boolean; recientes: boolean; organizaciones: boolean };

// Presets: con los bloques encendidos y apagados se ejercitan los saltos parciales. Un salto a un
// bloque que no se renderiza sería un enlace muerto, así que la fila sólo ofrece los que existen.
const PRESETS: { id: string; label: string; set: Bloques }[] = [
	{
		id: "las-tres",
		label: "Las tres",
		set: { sugerencias: true, recientes: true, organizaciones: true },
	},
	{
		id: "solo-sugerencias",
		label: "Sólo sugerencias",
		set: { sugerencias: true, recientes: false, organizaciones: false },
	},
	{
		id: "solo-recientes",
		label: "Sólo lo reciente",
		set: { sugerencias: false, recientes: true, organizaciones: false },
	},
	{
		id: "solo-organizaciones",
		label: "Sólo organizaciones",
		set: { sugerencias: false, recientes: false, organizaciones: true },
	},
	{
		id: "ninguna",
		label: "Ninguna",
		set: { sugerencias: false, recientes: false, organizaciones: false },
	},
];

let bloques = $state<Bloques>({ ...PRESETS[0].set });

const igual = (a: Bloques, b: Bloques) =>
	a.sugerencias === b.sugerencias &&
	a.recientes === b.recientes &&
	a.organizaciones === b.organizaciones;

const presetActivo = $derived(PRESETS.find((p) => igual(p.set, bloques))?.id ?? null);
const hayBloques = $derived(bloques.sugerencias || bloques.recientes || bloques.organizaciones);

// La pregunta abierta del expediente: ¿la fila lleva un rótulo visible o sólo los enlaces?
let conRotulo = $state(true);

// ─── Tratamiento de los saltos ─────────────────────────────────────
// El autor rechazó el enlace de texto (V0): en la misma tarjeta, «Limpiar búsqueda y filtros» ya es
// `text-primary` + `hover:underline`, así que los saltos compiten con esa acción y no se leen como
// destinos. Las variantes suben el peso visual de la fila entera; el anillo de foco es común.
type Tratamiento = "v0" | "v1" | "v2" | "v3" | "v4";

const FOCO_SALTO =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const TRATAMIENTOS: { id: Tratamiento; label: string; clase: string; intencion: string }[] = [
	{
		id: "v0",
		label: "V0 — el actual",
		clase:
			"inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline",
		intencion:
			"Punto de comparación: el enlace de texto que ya usa «Limpiar búsqueda y filtros» en la misma tarjeta, sin señal de destino.",
	},
	{
		id: "v1",
		label: "V1 — subrayado siempre",
		clase:
			"inline-flex items-center gap-1 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary",
		intencion:
			"Sigue siendo texto, pero el subrayado permanente lo declara destino sin cambiar su peso visual.",
	},
	{
		id: "v2",
		label: "V2 — chip con borde",
		clase:
			"inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent",
		intencion:
			"Chip con borde, el lenguaje de «Pruebe con»: se despega del texto corrido sin leerse como una acción.",
	},
	{
		id: "v3",
		label: "V3 — botón secundario",
		clase:
			"inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent",
		intencion:
			"Botón secundario, el lenguaje de los botones del portal: el destino se lee como control, con más peso que el texto.",
	},
	{
		id: "v4",
		label: "V4 — píldora primaria",
		clase:
			"inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90",
		intencion:
			"Píldora primaria: lee los destinos como acciones principales y pasa a competir de frente con «Limpiar búsqueda y filtros».",
	},
];

let tratamiento = $state<Tratamiento>("v0");
const tratamientoActivo = $derived(
	TRATAMIENTOS.find((t) => t.id === tratamiento) ?? TRATAMIENTOS[0],
);

// Un salto que aterriza en silencio deja al lector sin saber dónde llegó. `:target` marca el bloque
// activo sólo si el navegador lo soporta (Tailwind 4 emite `&:target`); el interruptor lo muestra.
let resaltarDestino = $state(false);
const resalteDestino = $derived(
	resaltarDestino
		? "target:rounded-xl target:bg-accent/30 target:ring-1 target:ring-primary/30"
		: null,
);

// Sólo los saltos de bloques que existen. El texto visible es el mismo `<h3>` del bloque destino.
const saltos = $derived(
	[
		{ id: "pruebe-con", label: "Pruebe con", on: bloques.sugerencias },
		{ id: "recientes", label: "Mientras tanto, lo más reciente", on: bloques.recientes },
		{ id: "organizaciones", label: "Explorar por organización", on: bloques.organizaciones },
	].filter((s) => s.on),
);

// ─── Margen de scroll: el alto real de la barra, medido ────────────
// `scroll-mt-*` no existe en este repo y el alto de la barra no se hardcodea: `bind:clientHeight`
// lo mide y el valor entra en el `calc()` junto con el token `--header-h`.
let altoBarra = $state(0);
const margenScroll = $derived(`calc(var(--header-h) + ${altoBarra}px + 1rem)`);
const estiloDestino = $derived(`scroll-margin-top: ${margenScroll}`);

// ─── Instrumento: mide el aterrizaje en cada `hashchange` ──────────
// Espera a que el scroll se asiente (`scrollend`, con un timeout como respaldo) y recién ahí lee
// `getBoundingClientRect().top` del objetivo y el borde inferior del chrome pegajoso. Si el
// objetivo no está en el DOM (bloque apagado con el hash puesto), lo dice: es un enlace muerto.
type Medicion = {
	hash: string;
	targetId: string;
	targetTop: number | null;
	stickyBottom: number | null;
	ok: boolean | null;
	missing: boolean;
	at: string;
};

let medicion = $state<Medicion | null>(null);
let midiendo = $state(false);

function waitForScrollEnd(timeoutMs = 800): Promise<void> {
	return new Promise((resolve) => {
		let terminado = false;
		const finish = () => {
			if (terminado) return;
			terminado = true;
			window.removeEventListener("scrollend", finish);
			window.clearTimeout(timer);
			resolve();
		};
		// Respaldo: si el navegador no dispara `scrollend` (o el salto no scrollea porque el
		// objetivo ya estaba en su lugar), el timeout cierra la espera.
		const timer = window.setTimeout(finish, timeoutMs);
		window.addEventListener("scrollend", finish);
	});
}

let token = 0;

async function medirDespuesDelScroll() {
	const actual = ++token;
	midiendo = true;
	await waitForScrollEnd();
	if (actual !== token) return; // otro salto (o un clic) pisó esta medición
	medirAhora();
	midiendo = false;
}

function medirAhora() {
	const hash = window.location.hash;
	const targetId = hash ? decodeURIComponent(hash.slice(1)) : "";
	const destino = targetId ? document.getElementById(targetId) : null;
	const chrome = document.querySelector("[data-dev-sticky]");
	const stickyBottom = chrome ? Math.round(chrome.getBoundingClientRect().bottom) : null;
	const at = new Date().toLocaleTimeString("es-BO", { hour12: false });

	if (!destino) {
		medicion = {
			hash,
			targetId,
			targetTop: null,
			stickyBottom,
			ok: null,
			missing: targetId !== "",
			at,
		};
		return;
	}

	const targetTop = Math.round(destino.getBoundingClientRect().top);
	medicion = {
		hash,
		targetId,
		targetTop,
		stickyBottom,
		ok: stickyBottom === null ? null : targetTop >= stickyBottom,
		missing: false,
		at,
	};
}

$effect(() => {
	const onHashChange = () => void medirDespuesDelScroll();
	window.addEventListener("hashchange", onHashChange);
	// Si la hoja se abre ya con un hash en la URL, mide una vez al montar.
	if (window.location.hash) void medirDespuesDelScroll();
	return () => window.removeEventListener("hashchange", onHashChange);
});

// Cambiar de lectura o de preset mueve (o borra) las anclas: la medición anterior deja de ser válida.
$effect(() => {
	void lectura;
	void bloques;
	medicion = null;
});

// Veredicto derivado: acá el chequeo de `null` se hace una sola vez y con tipos estrechados, en
// vez de repetirlo —y de pelear con el estrechamiento— dentro de la plantilla.
const veredicto = $derived.by(() => {
	if (!medicion) return null;
	if (medicion.missing) {
		return { tone: "bad" as const, text: "Enlace muerto: no hay ningún elemento con ese id." };
	}
	if (medicion.targetTop === null || medicion.stickyBottom === null || medicion.ok === null) {
		return { tone: "bad" as const, text: "Sin chrome pegajoso que medir." };
	}
	const delta = medicion.targetTop - medicion.stickyBottom;
	return delta >= 0
		? { tone: "ok" as const, text: `\u2713 Aterrizó ${delta} px debajo del chrome.` }
		: { tone: "bad" as const, text: `\u2717 Quedó ${Math.abs(delta)} px tapado por el chrome.` };
});

const botonControl =
	"inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors";
const botonActivo = "border-primary bg-primary text-primary-foreground";
const botonInactivo = "border-input bg-background text-foreground hover:bg-accent";
</script>

<svelte:head>
	<title>Vacío del buscador — hoja de revisión · Datos UMSS</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8">
	<header class="border-b border-border pb-6">
		<p class="text-xs font-medium uppercase tracking-wider text-destructive">
			Hoja de revisión · sólo desarrollo
		</p>
		<h1 class="font-heading text-3xl font-bold text-primary">
			El vacío del buscador: una sección con saltos <span class="font-mono text-2xl">#id</span>
		</h1>
		<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
			El aviso y las tres salidas dentro de <strong>una misma sección</strong>, con enlaces que saltan
			a cada bloque. El encabezado del portal y la barra de resultados que se pega debajo son reales;
			el vacío y la barra son copias del código de la página, con las mismas clases. Elija una lectura,
			un tratamiento de salto y los bloques: el instrumento de la esquina informa dónde aterriza cada
			salto.
		</p>
	</header>

	<!-- Control del playground: dev-chrome, no UI de producto. -->
	<div class="mt-6 space-y-4 rounded-xl border border-dashed border-border bg-muted/40 p-4">
		<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
			Control de la hoja (no es UI de producto)
		</p>

		<div role="group" aria-label="Lectura" class="flex flex-wrap gap-2">
			{#each LECTURAS as opcion (opcion.id)}
				<button
					type="button"
					aria-pressed={lectura === opcion.id}
					onclick={() => (lectura = opcion.id)}
					class={cn(botonControl, lectura === opcion.id ? botonActivo : botonInactivo)}
				>
					{opcion.label}
				</button>
			{/each}
		</div>

		<div role="group" aria-label="Bloques visibles" class="flex flex-wrap items-center gap-2">
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				Bloques
			</span>
			{#each PRESETS as preset (preset.id)}
				<button
					type="button"
					aria-pressed={presetActivo === preset.id}
					onclick={() => (bloques = { ...preset.set })}
					class={cn(botonControl, presetActivo === preset.id ? botonActivo : botonInactivo)}
				>
					{preset.label}
				</button>
			{/each}
		</div>

		<div class="space-y-2">
			<div
				role="group"
				aria-label="Tratamiento de los saltos"
				class="flex flex-wrap items-center gap-2"
			>
				<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Saltos
				</span>
				{#each TRATAMIENTOS as opcion (opcion.id)}
					<button
						type="button"
						aria-pressed={tratamiento === opcion.id}
						onclick={() => (tratamiento = opcion.id)}
						class={cn(botonControl, tratamiento === opcion.id ? botonActivo : botonInactivo)}
					>
						{opcion.label}
					</button>
				{/each}
			</div>
			<p class="text-xs leading-relaxed text-muted-foreground">
				<span class="font-medium text-foreground">Intención:</span>
				{tratamientoActivo.intencion}
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				aria-pressed={conRotulo}
				onclick={() => (conRotulo = !conRotulo)}
				class={cn(
					"inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-3 text-xs font-medium transition-colors",
					conRotulo
						? "border-primary bg-primary/10 text-primary"
						: "border-border bg-background text-muted-foreground hover:bg-accent",
				)}
			>
				{conRotulo ? "✓" : "+"}
				Rótulo «Saltar a:»
			</button>
			<button
				type="button"
				aria-pressed={resaltarDestino}
				onclick={() => (resaltarDestino = !resaltarDestino)}
				class={cn(
					"inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-3 text-xs font-medium transition-colors",
					resaltarDestino
						? "border-primary bg-primary/10 text-primary"
						: "border-border bg-background text-muted-foreground hover:bg-accent",
				)}
			>
				{resaltarDestino ? "✓" : "+"}
				Resaltar el destino al llegar (<code class="font-mono">:target</code>)
			</button>
			<span class="text-xs text-muted-foreground">
				{#if lectura === "hoy"}
					Hoy no ofrece saltos: el aviso es un <code class="font-mono">&lt;p&gt;</code> y los bloques son
					tarjetas sueltas.
				{:else if saltos.length}
					Se ofrecen {saltos.length}
					{saltos.length === 1 ? "salto" : "saltos"}: {saltos.map((s) => s.label).join(" · ")}
				{:else}
					Ningún bloque visible: no hay destinos, así que la fila de saltos no se dibuja.
				{/if}
			</span>
		</div>
	</div>
</div>

<!--
	Snippets de la vista previa. Son copias del vacío de la página real, no el original: la página tiene
	este bloque inline (`src/routes/search/+page.svelte`), no extraído, y moverlo sería otro cambio.
-->

{#snippet navSaltos(clase: string)}
	<!-- Fila de saltos: anclas reales, no botones. El texto visible es el mismo `<h3>` del destino. -->
	<nav
		aria-label="Saltos a los bloques de esta sección"
		class={cn("flex flex-wrap items-center gap-x-4 gap-y-2", clase)}
	>
		{#if conRotulo}
			<span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				Saltar a:
			</span>
		{/if}
		{#each saltos as salto (salto.id)}
			<a href={`#${salto.id}`} class={cn(tratamientoActivo.clase, FOCO_SALTO)}>
				<ArrowDown class="size-4 shrink-0" aria-hidden="true" />
				{salto.label}
			</a>
		{/each}
	</nav>
{/snippet}

{#snippet tarjetaAviso(comoTitulo: boolean, conSaltosAdentro: boolean)}
	<div
		class="flex min-h-[24rem] flex-col items-center justify-center rounded-xl border border-border bg-card p-12 text-center"
	>
		{#if comoTitulo}
			<!-- En A y B el aviso se promueve a `<h2 id>`, que es el nombre accesible de la sección. -->
			<h2 id="sin-resultados-titulo" class="font-heading text-xl font-semibold text-primary">
				Sin resultados
			</h2>
		{:else}
			<p class="font-heading text-xl font-semibold text-primary">Sin resultados</p>
		{/if}
		<p class="mt-2 text-sm text-muted-foreground">{mensajeVacio}</p>
		{#if conSaltosAdentro && saltos.length}
			{@render navSaltos("mt-6 justify-center")}
		{/if}
		<!-- Copia inerte: en la página real este botón reinicia la búsqueda y los filtros. -->
		<button type="button" class="mt-4 text-sm font-medium text-primary hover:underline">
			Limpiar búsqueda y filtros
		</button>
	</div>
{/snippet}

{#snippet bloqueSugerencias(anclado: boolean)}
	<div
		id={anclado ? "pruebe-con" : undefined}
		style={anclado ? estiloDestino : undefined}
		class={cn("space-y-3", resalteDestino)}
	>
		<h3 class="font-heading text-lg font-semibold text-primary">Pruebe con</h3>
		<div class="flex flex-wrap gap-2">
			{#each sugerencias as chip (chip.href)}
				<a
					href={chip.href}
					class="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground transition-colors duration-200 hover:bg-accent"
				>
					{chip.label}
				</a>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet bloqueRecientes(anclado: boolean)}
	<div
		id={anclado ? "recientes" : undefined}
		style={anclado ? estiloDestino : undefined}
		class={cn("space-y-4", resalteDestino)}
	>
		<h3 class="font-heading text-lg font-semibold text-primary">
			Mientras tanto, lo más reciente
		</h3>
		{#each recientes as dataset (dataset.id)}
			<DatasetCard {dataset} />
		{/each}
	</div>
{/snippet}

{#snippet bloqueOrganizaciones(anclado: boolean)}
	<div
		id={anclado ? "organizaciones" : undefined}
		style={anclado ? estiloDestino : undefined}
		class={cn("space-y-4", resalteDestino)}
	>
		<h3 class="font-heading text-lg font-semibold text-primary">Explorar por organización</h3>
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each organizaciones as org (org.id)}
				<OrganizationCard
					org={org}
					count={org.package_count ?? 0}
					href={`/organization/${encodeURIComponent(org.name)}`}
				/>
			{/each}
		</div>
	</div>
{/snippet}

<!--
	Copia de la ResultsBar real (`src/routes/search/+page.svelte`): mismas clases, texto de una búsqueda
	sin resultados. `data-dev-sticky` es el hook de medición de esta hoja (no existe en la página real) y
	`bind:clientHeight` da el alto que entra en el `scroll-margin-top` de los destinos.
-->
{#snippet barraResultados()}
	<section
		data-dev-sticky
		bind:clientHeight={altoBarra}
		class="sticky top-[calc(var(--header-h)+1px)] z-20 border-b border-border bg-background/95 backdrop-blur transition-[top] duration-200 ease-out"
	>
		<div
			class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6 lg:px-8"
		>
			<p class="flex items-baseline gap-2">
				<span class="font-heading text-2xl font-bold text-foreground">0</span>
				<span class="text-sm text-muted-foreground">
					resultados para <span class="font-medium text-foreground">"movilidad"</span>
				</span>
			</p>

			<label class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
				<span class="hidden sm:inline">Ordenar:</span>
				<select
					aria-label="Ordenar"
					class="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				>
					<option>Más recientes</option>
					<option>Más antiguos</option>
					<option>A-Z</option>
					<option>Z-A</option>
					<option>Relevancia</option>
				</select>
			</label>
		</div>
	</section>
{/snippet}

{@render barraResultados()}

<!-- Vista previa -->
<div class="mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8">
	{#if lectura === "hoy"}
		<!-- Hoy: lo que hay en la página, sin sección, sin `id` y sin saltos. -->
		<div class="space-y-8">
			{@render tarjetaAviso(false, false)}
			{#if bloques.sugerencias}{@render bloqueSugerencias(false)}{/if}
			{#if bloques.recientes}{@render bloqueRecientes(false)}{/if}
			{#if bloques.organizaciones}{@render bloqueOrganizaciones(false)}{/if}
		</div>
	{:else}
		<!-- A y B: una sola `<section>` cuyo nombre accesible es el aviso; los bloques con `id`. -->
		<section id="sin-resultados" aria-labelledby="sin-resultados-titulo" class="space-y-8">
			{@render tarjetaAviso(true, lectura === "a")}
			{#if lectura === "b" && saltos.length}
				<!-- Barra de saltos de la sección: fuera de la tarjeta, encima de los bloques. -->
				{@render navSaltos("rounded-lg border border-border bg-muted/40 px-4 py-3")}
			{/if}
			{#if bloques.sugerencias}{@render bloqueSugerencias(true)}{/if}
			{#if bloques.recientes}{@render bloqueRecientes(true)}{/if}
			{#if bloques.organizaciones}{@render bloqueOrganizaciones(true)}{/if}
		</section>
	{/if}

	{#if !hayBloques}
		<p class="mt-6 text-center text-xs text-muted-foreground">
			Sin bloques visibles: no hay destinos, y una fila de saltos sin destinos sería un adorno.
		</p>
	{/if}

	<!-- Relleno: sin página larga el salto no scrollea y la medición no probaría nada. -->
	<div
		class="mt-12 flex h-[140vh] items-start justify-center rounded-xl border border-dashed border-border bg-muted/20 pt-8"
	>
		<p class="text-sm text-muted-foreground">
			Relleno — mantiene la hoja lo bastante larga para que cada salto tenga scroll de verdad.
		</p>
	</div>
</div>

<!--
	Instrumento: dev-chrome fijo (no scrollea con la medición) para poder leerlo justo después del salto.
	Informa el hash, el `id` del destino, el `top` medido, el borde inferior del chrome pegajoso y el
	veredicto. En la promoción no viaja: es andamiaje de la hoja.
-->
<aside
	class="fixed right-4 bottom-4 z-50 max-h-[70vh] w-[21rem] max-w-[calc(100vw-2rem)] overflow-auto rounded-xl border-2 border-dashed border-destructive/60 bg-background/95 p-4 text-xs shadow-lg backdrop-blur"
	aria-label="Instrumento de medición, sólo desarrollo"
>
	<p class="font-semibold uppercase tracking-wider text-destructive">
		Instrumento · sólo desarrollo
	</p>
	<p class="mt-1 leading-relaxed text-muted-foreground">
		Mide en cada <code class="font-mono">hashchange</code>: espera a que el scroll se asiente
		(<code class="font-mono">scrollend</code>, con timeout de respaldo) y lee el destino contra el
		chrome pegajoso <code class="font-mono">[data-dev-sticky]</code>.
	</p>

	{#if midiendo}
		<p class="mt-3 text-muted-foreground">Midiendo…</p>
	{:else if medicion}
		<dl class="mt-3 space-y-1">
			<div class="flex items-baseline justify-between gap-2">
				<dt class="text-muted-foreground">medido a las</dt>
				<dd class="font-mono">{medicion.at}</dd>
			</div>
			<div class="flex items-baseline justify-between gap-2">
				<dt class="text-muted-foreground">hash</dt>
				<dd class="font-mono">{medicion.hash || "—"}</dd>
			</div>
			<div class="flex items-baseline justify-between gap-2">
				<dt class="text-muted-foreground">id del destino</dt>
				<dd class="font-mono">{medicion.targetId || "—"}</dd>
			</div>
			<div class="flex items-baseline justify-between gap-2">
				<dt class="text-muted-foreground">top del destino</dt>
				<dd class="font-mono">{medicion.targetTop ?? "—"} px</dd>
			</div>
			<div class="flex items-baseline justify-between gap-2">
				<dt class="text-muted-foreground">borde inferior del chrome</dt>
				<dd class="font-mono">{medicion.stickyBottom ?? "—"} px</dd>
			</div>
			<div class="flex items-baseline justify-between gap-2">
				<dt class="text-muted-foreground">alto de la barra</dt>
				<dd class="font-mono">{altoBarra} px</dd>
			</div>
		</dl>

		{#if veredicto}
			<p
				class={cn(
					"mt-2 font-semibold",
					veredicto.tone === "ok" ? "text-primary" : "text-destructive",
				)}
			>
				{veredicto.text}
			</p>
		{/if}
		<p class="mt-1 text-muted-foreground">
			Margen aplicado a los destinos:
			<code class="font-mono">{margenScroll}</code>
		</p>
	{:else}
		<p class="mt-3 text-muted-foreground">
			Sin medición todavía. Pulse un salto en «Lectura A» o «Lectura B».
		</p>
	{/if}

	<button
		type="button"
		onclick={() => void medirDespuesDelScroll()}
		class="mt-3 inline-flex h-8 items-center rounded-md border border-dashed border-border bg-background px-3 font-medium text-muted-foreground transition-colors hover:bg-accent"
	>
		Medir ahora
	</button>
</aside>
