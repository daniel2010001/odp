<script lang="ts">
import type { ResourceKind } from "$lib/resources/kind";
import { cn } from "$lib/utils";

// El chip de tipo de recurso, uno solo para todas las superficies (la lista del dataset y el
// encabezado de la ficha). La regla que decide qué muestra vive en `$lib/resources/kind.ts`; acá
// vive cómo se ve, para que no se bifurque entre pantallas.
//
// Dos decisiones del autor, y las dos son la razón de este componente:
// · el chip de enlace NO lleva ícono —con el `Link` de Lucide quedaba más grande que el de formato—;
// · el ancho es uniforme (`w-20`), así etiquetas de distinto largo ocupan la misma caja y lo que
//   sigue en la fila no se corre (`CSV` vs. `GEOJSON`).
let {
	kind,
	format = null,
	class: className = "",
}: {
	kind: ResourceKind;
	format?: string | null;
	class?: string;
} = $props();

// Un enlace es un enlace: muestra «Enlace» y no conserva el formato declarado. Un archivo muestra su
// formato recortado y en mayúsculas; sin formato dice «Archivo» —nunca el rótulo inglés de antes—.
const label = $derived.by(() => {
	if (kind === "link") return "Enlace";
	const trimmed = format?.trim().toUpperCase();
	return trimmed ? trimmed : "Archivo";
});

// Mismos tokens para las dos variantes; sólo la intensidad del fondo las distingue, como ya estaban.
const variantClass = $derived(
	kind === "link"
		? "border-border bg-muted/50 text-muted-foreground"
		: "border-border bg-muted text-muted-foreground",
);
</script>

<span
	class={cn(
		"inline-flex w-20 shrink-0 items-center justify-center gap-1.5 truncate rounded-md border px-2.5 py-1 text-xs font-bold",
		variantClass,
		className,
	)}
>
	{label}
</span>
