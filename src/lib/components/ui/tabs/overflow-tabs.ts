// Funciones y clases de `OverflowTabs`: el reparto «prioridad+» de las pestañas y las clases de cada punto de cambio.
// Nada acá toca el DOM; el componente mide y llama.

import type { Component } from "svelte";

/** Una pestaña de `OverflowTabs`. */
export interface OverflowItem {
	id: string;
	label: string;
	/** Conteo opcional (insignia en la pestaña, número en el menú). Sin conteo, sin insignia. */
	count?: number;
	icon?: Component;
}

/** Separación entre pestañas (`gap-1`). */
export const TAB_GAP = 4;

export interface FitInput {
	/** Ancho natural de cada pestaña, en el orden de la barra. */
	widths: number[];
	/** Índice de la pestaña activa, o -1 si no hay. Siempre queda visible. */
	active: number;
	/** Ancho disponible para las pestañas y el botón «Más». */
	available: number;
	/** Ancho del botón «Más (n)». */
	moreWidth: number;
	gap?: number;
}

export interface FitResult {
	/** Índices visibles, en el orden original. */
	visible: number[];
	/** Índices que van al menú «Más», en el orden original. */
	hidden: number[];
}

/**
 * Reparte las pestañas entre la fila y el menú «Más». Entran en orden las que caben; la activa se queda visible
 * aunque su lugar natural esté más allá (conserva su posición relativa y desplaza a la última). Si ni la activa sola
 * cabe, igual queda visible: la pestaña se trunca.
 */
export function fitTabs({
	widths,
	active,
	available,
	moreWidth,
	gap = TAB_GAP,
}: FitInput): FitResult {
	const n = widths.length;
	const all = widths.map((_, i) => i);
	const need = (indices: number[], withMore: boolean) => {
		const items = indices.length + (withMore ? 1 : 0);
		const sum = indices.reduce((acc, i) => acc + widths[i], 0) + (withMore ? moreWidth : 0);
		return sum + gap * Math.max(0, items - 1);
	};
	if (n === 0 || need(all, false) <= available) return { visible: all, hidden: [] };
	const keepActive = active >= 0 && active < n;
	for (let k = n - 1; k >= 0; k--) {
		const first = all.slice(0, k);
		const visible = keepActive && active >= k ? [...first, active] : first;
		if (need(visible, true) <= available) return split(all, visible);
	}
	return split(all, keepActive ? [active] : []);
}

function split(all: number[], visible: number[]): FitResult {
	const shown = new Set(visible);
	return {
		visible: all.filter((i) => shown.has(i)),
		hidden: all.filter((i) => !shown.has(i)),
	};
}

/** El texto de una pestaña en el desplegable: «Todas (4)». */
export const labelWithCount = (
	item: OverflowItem,
	countLabel: (n: number) => string = String,
): string => (item.count === undefined ? item.label : `${item.label} (${countLabel(item.count)})`);

// ─── Dónde cambia la barra ────────────────────────────────────────

/**
 * El ancho de CONTENEDOR desde el que la barra muestra las pestañas; por debajo, el desplegable. Tailwind sólo ve
 * clases escritas completas, así que cada punto de cambio tiene su tabla:
 *  · `32rem` — el de siempre (las vistas del recurso).
 *  · `611px` — la cola de solicitudes: la ventana menos el margen de la página (2 × 24), el relleno de la tarjeta
 *    (2 × 20) y su borde (2 × 1) deja 610 px con 700 de ventana (desplegable) y 611 con 701 (pestañas). Es la
 *    medida de una ventana sin barra de desplazamiento clásica; con una de 15 px el cambio llega a los 716.
 */
export type MobileBelow = "32rem" | "611px";

export interface FormClasses {
	/** Alto del campo cuando comparte fila con las pestañas (36 px); debajo mide 44 px. */
	wideFieldH: string;
	/** Hace visible lo que bajo el punto está sólo para lectores de pantalla («Mostrar:»). */
	wideLabel: string;
	/** La barra: apilada con el desplegable y, desde el punto, una sola fila alineada arriba. */
	bar: string;
	/** El extremo izquierdo (`leading`): sobre el desplegable y, desde el punto, en la fila. */
	lead: string;
	/** El lado de lo que va a la derecha (`trailing`). */
	trailing: string;
	/** El desplegable de la forma angosta. */
	selectOnly: string;
	/** Las pestañas de la forma ancha. */
	tabsOnly: string;
	/** La barra pegada bajo el encabezado, sólo en la forma ancha. */
	sticky: string;
}

// Bajo 18 rem de contenedor el desplegable y lo que lo acompaña se apilan (cabe uno por fila).
const STACK = "@max-[18rem]:basis-full";

export const FORMS: Record<MobileBelow, FormClasses> = {
	"32rem": {
		wideFieldH: "@lg:h-9",
		wideLabel: "@lg:not-sr-only",
		bar: "flex-wrap items-center gap-2 pb-3 @lg:flex-nowrap @lg:items-start @lg:gap-x-4 @lg:pb-0",
		lead: "basis-full @lg:flex @lg:h-12 @lg:basis-auto @lg:shrink-0 @lg:items-center",
		trailing: `${STACK} @lg:mt-[5px] @lg:shrink-0`,
		selectOnly: "@lg:hidden",
		tabsOnly: "hidden @lg:block",
		sticky:
			"@lg:sticky @lg:top-[calc(var(--header-h)+1px)] @lg:z-20 transition-[top] duration-200 ease-out motion-reduce:transition-none",
	},
	"611px": {
		wideFieldH: "@min-[611px]:h-9",
		wideLabel: "@min-[611px]:not-sr-only",
		bar: "flex-wrap items-center gap-2 pb-3 @min-[611px]:flex-nowrap @min-[611px]:items-start @min-[611px]:gap-x-4 @min-[611px]:pb-0",
		lead: "basis-full @min-[611px]:flex @min-[611px]:h-12 @min-[611px]:basis-auto @min-[611px]:shrink-0 @min-[611px]:items-center",
		trailing: `${STACK} @min-[611px]:mt-[5px] @min-[611px]:shrink-0`,
		selectOnly: "@min-[611px]:hidden",
		tabsOnly: "hidden @min-[611px]:block",
		sticky:
			"@min-[611px]:sticky @min-[611px]:top-[calc(var(--header-h)+1px)] @min-[611px]:z-20 transition-[top] duration-200 ease-out motion-reduce:transition-none",
	},
};

/**
 * El campo de la forma angosta —el desplegable de la pestaña y «Mostrar»— con UNA sola clase: misma altura (44 px),
 * borde, radio, tipografía, relleno y lugar del chevron. Lo usan `OverflowTabs` (botón) y `StatusSelect`
 * (`<select>` nativo sin flecha propia), para que se vean idénticos.
 */
export const FIELD_CLASS =
	"h-11 min-w-0 cursor-pointer rounded-md border border-input bg-background pl-3 pr-9 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

/** El chevron de ese campo, a la derecha y centrado. */
export const FIELD_CHEVRON_CLASS =
	"pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground";
