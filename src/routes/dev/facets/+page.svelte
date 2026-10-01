<!--
	Playground de la facet — superficie sólo para desarrollo (`/dev/facets`).

	El defecto: cuando la búsqueda interna de una faceta no encuentra nada, el componente real esconde
	**toda** la lista y deja sólo «Sin coincidencias para «X»», así que para volver a elegir hay que
	borrar el texto a mano. Esta hoja pone las tres salidas lado a lado, con la búsqueda **ya sembrada**
	con un texto que no existe para que se vea el estado sin escribir nada:

	- **A · Limpiar** — el aviso trae una acción que borra la búsqueda. Es el cambio más chico y la
	  recuperación queda a un clic, pero la lista sigue oculta mientras el texto esté ahí.
	- **B · Mostrar el resto** — el aviso **no** esconde nada: debajo van todas las opciones, atenuadas
	  y rotuladas «Todas las opciones», así se puede elegir otra sin borrar nada.
	- **C · A + B** — las dos cosas.

	La primera sección muestra el **componente real** (`$lib/components/search/FacetFilter.svelte`) para
	comparar con el comportamiento de hoy; ahí hay que escribir el texto a mano (probá «zzz»). Las tres
	variantes son **copias** de `FacetVariant.svelte` y están rotuladas como tales: lo que se aprueba
	acá se promueve al componente real y **esta hoja se borra** (regla 8 de `AGENTS.md`).
-->
<script lang="ts">
import FacetFilter from "$lib/components/search/FacetFilter.svelte";
import FacetVariant, { type Variant } from "./FacetVariant.svelte";

const ORGS = [
	{ name: "rectorado", display_name: "Rectorado", count: 3 },
	{ name: "fcyt", display_name: "Facultad de Ciencias y Tecnología", count: 9 },
	{ name: "fca", display_name: "Facultad de Ciencias Agrícolas", count: 4 },
	{ name: "fcs", display_name: "Facultad de Ciencias de la Salud", count: 2 },
	{ name: "direccion-investigacion", display_name: "Dirección de Investigación", count: 7 },
	{ name: "fce", display_name: "Facultad de Ciencias Económicas", count: 1 },
	{ name: "fcjpp", display_name: "Facultad de Ciencias Jurídicas y Políticas", count: 5 },
	{ name: "fap", display_name: "Facultad de Arquitectura y Planificación", count: 2 },
	{ name: "fhum", display_name: "Facultad de Humanidades", count: 6 },
	{ name: "fvet", display_name: "Facultad de Veterinaria", count: 1 },
	{ name: "dtic", display_name: "Dirección de Tecnologías de la Información", count: 2 },
	{ name: "biblioteca", display_name: "Biblioteca Central", count: 3 },
];

let selected = $state<string[]>([]);
const toggle = (name: string) =>
	(selected = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

const VARIANTS: { id: Variant; label: string; note: string }[] = [
	{
		id: "limpiar",
		label: "A · Limpiar",
		note: "El aviso trae «Limpiar». La lista sigue oculta hasta que se borre la búsqueda.",
	},
	{
		id: "mostrar",
		label: "B · Mostrar el resto",
		note: "No esconde nada: debajo del aviso van todas las opciones, atenuadas y rotuladas.",
	},
	{
		id: "ambos",
		label: "C · A + B",
		note: "El aviso con «Limpiar» y las opciones debajo.",
	},
];
</script>

<div class="mx-auto max-w-5xl space-y-8 px-4 py-10">
	<header class="space-y-2">
		<h1 class="font-heading text-2xl font-bold text-primary">Facet — estado sin coincidencias</h1>
		<p class="max-w-3xl text-sm leading-relaxed text-muted-foreground">
			Escribí una búsqueda que no exista (por ejemplo <code class="font-mono">zzz</code>) para ver qué
			pasa hoy y qué proponen las tres salidas.
		</p>
	</header>

	<section class="space-y-3">
		<h2 class="text-xs font-bold uppercase tracking-[0.14em] text-destructive">
			Hoy — el componente real
		</h2>
		<p class="text-sm text-muted-foreground">
			La lista entera desaparece y queda sólo el aviso: no hay forma de elegir otra opción sin borrar el
			texto.
		</p>
		<div class="rounded-lg border border-border bg-card p-4">
			<FacetFilter title="Organización" items={ORGS} {selected} onselect={toggle} />
		</div>
	</section>

	{#each VARIANTS as v (v.id)}
		<section class="space-y-3">
			<h2 class="text-xs font-bold uppercase tracking-[0.14em] text-destructive">{v.label}</h2>
			<p class="text-sm text-muted-foreground">{v.note}</p>
			<div class="rounded-lg border border-border bg-card p-4">
				<FacetVariant
					title="Organización"
					items={ORGS}
					{selected}
					onselect={toggle}
					variant={v.id}
					initialQuery="zzz"
				/>
				<p class="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
					Copia de la propuesta — no es el componente real.
				</p>
			</div>
		</section>
	{/each}
</div>
