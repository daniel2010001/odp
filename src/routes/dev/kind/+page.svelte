<!--
	Hoja de revisión del chip de tipo — superficie sólo para desarrollo (`/dev/kind`).

	Renderiza el **componente real** (`$lib/components/resource/ResourceKindChip.svelte`) en la matriz
	de etiquetas que el autor necesita comparar lado a lado, primero en fila y después en columna: los
	formatos del catálogo (`CSV`, `PDF`, `JSON`, `XLSX`, `GEOJSON`, `DOCX`, `PNG`), un archivo **sin
	formato** (que debe leer «Archivo») y un **enlace** (que debe leer «Enlace»). Lo que se aprueba acá
	es lo que se publica: la hoja no escribe las etiquetas a mano, las produce el componente.

	La segunda sección es una **comparación**: muestra cómo se veía antes —el enlace con su ícono de
	Lucide y las chips con ancho automático— y por eso **no** usa el componente real; sus chips están
	armadas a mano a propósito. Existe para ver el cambio, no para aprobarlo.

	La ruta no existe en producción: la compuerta está en `+page.ts`. Esta hoja es permanente (como
	`/dev/copy` y `/dev/error`) porque las variantes del chip no se producen a mano desde el catálogo.
-->
<script lang="ts">
import { Info, Link } from "@lucide/svelte";
import ResourceKindChip from "$lib/components/resource/ResourceKindChip.svelte";
import type { ResourceKind } from "$lib/resources/kind";

interface Sample {
	id: string;
	kind: ResourceKind;
	format?: string | null;
	/** Qué debe leer y por qué, para que el revisor no tenga que deducirlo. */
	note: string;
}

// Las etiquetas que el autor quiere comparar: los formatos del catálogo (GEOJSON es el más largo),
// un archivo sin formato y un enlace.
const SAMPLES: Sample[] = [
	{ id: "csv", kind: "file", format: "CSV", note: "Formato corto." },
	{ id: "pdf", kind: "file", format: "PDF", note: "Formato corto." },
	{ id: "json", kind: "file", format: "JSON", note: "Formato corto." },
	{ id: "xlsx", kind: "file", format: "XLSX", note: "Cuatro letras." },
	{
		id: "geojson",
		kind: "file",
		format: "GEOJSON",
		note: "El formato más largo del catálogo: con ancho automático era el que más corría el resto.",
	},
	{ id: "docx", kind: "file", format: "DOCX", note: "Cuatro letras." },
	{ id: "png", kind: "file", format: "PNG", note: "Formato corto." },
	{
		id: "sin-formato",
		kind: "file",
		format: null,
		note: "Sin formato: debe leer «Archivo», nunca quedar en blanco ni en inglés.",
	},
	{
		id: "enlace",
		kind: "link",
		format: "CSV",
		note: "Referencia externa: debe leer «Enlace» y no mostrar el formato declarado.",
	},
];

// La comparación: lo que se veía antes. No usa el componente real a propósito.
const LEGACY_FORMATS = ["CSV", "GEOJSON", "PDF"];
</script>

<svelte:head>
	<title>Hoja de revisión del chip de tipo — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
		<header>
			<h1 class="font-heading text-3xl font-bold text-primary">Hoja de revisión del chip de tipo</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Renderiza el componente real —<code class="font-mono text-xs"
					>src/lib/components/resource/ResourceKindChip.svelte</code
				>— para cada etiqueta que conviene comparar. Lo que se aprueba acá es lo que se publica:
				la hoja no escribe las etiquetas a mano y
				<code class="font-mono text-xs">dev-kind.test.ts</code> falla si deja de usarlo.
			</p>
		</header>

		<p
			data-testid="dev-only-note"
			class="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>
				Página sólo para desarrollo. En producción <code class="font-mono text-xs">/dev/kind</code
				> no existe (responde 404).
			</span>
		</p>

		<section class="mt-10" data-testid="kind-real" aria-labelledby="real-heading">
			<h2 id="real-heading" class="font-heading text-xl font-semibold text-foreground">
				El chip real, en una matriz de etiquetas
			</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				El componente real, tal como sale por la lista del dataset y por el encabezado de la
				ficha. Ancho uniforme: todas las etiquetas ocupan la misma caja, así lo que sigue queda
				alineado. El enlace no lleva ícono.
			</p>

			<h3 class="mt-5 font-heading text-sm font-semibold text-muted-foreground">En fila</h3>
			<div data-testid="kind-real-row" class="mt-2 flex flex-wrap items-center gap-2">
				{#each SAMPLES as sample (sample.id)}
					<ResourceKindChip kind={sample.kind} format={sample.format} />
				{/each}
			</div>

			<h3 class="mt-6 font-heading text-sm font-semibold text-muted-foreground">En columna</h3>
			<div data-testid="kind-real-column" class="mt-2 flex flex-col items-start gap-2">
				{#each SAMPLES as sample (sample.id)}
					<ResourceKindChip kind={sample.kind} format={sample.format} />
				{/each}
			</div>

			<ul class="mt-5 space-y-1 text-xs text-muted-foreground">
				{#each SAMPLES as sample (sample.id)}
					<li>
						<span class="font-semibold text-foreground">
							{sample.kind === "link"
								? "Enlace"
								: sample.format?.trim().toUpperCase() || "Archivo"}
						</span>
						— {sample.note}
					</li>
				{/each}
			</ul>
		</section>

		<section class="mt-12" data-testid="kind-legacy" aria-labelledby="legacy-heading">
			<h2 id="legacy-heading" class="font-heading text-xl font-semibold text-foreground">
				Cómo era antes (comparación, NO es el componente real)
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Esta sección existe sólo para ver qué cambió: las dos chips están armadas a mano y no
				salen del componente real, así que lo que se aprueba es la de arriba, no esta.
			</p>

			<div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div class="rounded-lg border border-border bg-card p-4">
					<h3 class="font-heading text-sm font-semibold text-card-foreground">
						El chip de enlace con su ícono
					</h3>
					<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
						El <code class="font-mono text-xs">Link</code> de Lucide hacía que el chip de enlace
						fuera más grande que el de formato.
					</p>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<span
							data-legacy-chip
							class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-bold text-muted-foreground"
						>
							<Link class="size-3.5" aria-hidden="true" />
							Enlace
						</span>
						<span
							data-legacy-chip
							class="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground"
						>
							CSV
						</span>
					</div>
				</div>

				<div class="rounded-lg border border-border bg-card p-4">
					<h3 class="font-heading text-sm font-semibold text-card-foreground">
						Las chips con ancho automático
					</h3>
					<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
						Sin <code class="font-mono text-xs">w-20</code>, cada etiqueta medía lo suyo y
						corría lo que venía después.
					</p>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						{#each LEGACY_FORMATS as format (format)}
							<span
								data-legacy-chip
								class="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground"
							>
								{format}
							</span>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<p
			class="mt-12 max-w-3xl rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground"
		>
			La hoja se queda: es una herramienta permanente, como <code class="font-mono text-xs"
				>/dev/copy</code
			> y <code class="font-mono text-xs">/dev/error</code>. Las variantes del chip no se pueden
			producir a mano desde el catálogo —un archivo sin formato o un enlace no se provocan a
			gusto— y además renderiza el componente real, así que no se desincroniza: si el chip cambia,
			esta hoja lo muestra.
		</p>
	</div>
</div>
