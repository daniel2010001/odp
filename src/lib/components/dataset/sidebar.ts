// Las tarjetas de la columna lateral de la ficha del dataset (`DatasetSidebar.svelte`) y sus variantes.

export type SidebarCard = "request" | "cite" | "summary" | "history" | "organization";

/**
 * El orden de la ficha hoy: la solicitud encabeza la columna (variante C de la posición de las solicitudes,
 * 2026-10-19), después «Citar como», «Resumen», el historial (variante H2 de `/dev/request-history`, bajo
 * «Resumen») y la organización.
 */
export const CURRENT_SIDEBAR_ORDER: readonly SidebarCard[] = [
	"request",
	"cite",
	"summary",
	"history",
	"organization",
];

/**
 * El desplazamiento propio de la columna (variante «Scroll propio» de `/dev/dataset-panel`, S17 de
 * `odd/tasks/prototype-presentation.md`). Sigue pegajosa y su alto máximo es la ventana menos lo que queda
 * por encima del pegado: el encabezado **achicado** (`--header-h-min`, el estado en que está cuando la
 * columna ya se pegó), su borde de 1 px y el aire arriba y abajo (`--sticky-air`). Es la misma fórmula de
 * las facetas del buscador (`src/routes/search/+page.svelte`) y el mismo mecanismo de las vistas previas
 * (`src/lib/components/resource/PreviewWindow.svelte` y `ResourcePreview.svelte`: un alto en `dvh`, que
 * sigue a la pantalla, menos el encabezado); sin el piso de 360 px de las vistas, porque un piso más alto
 * que la ventana dejaría el final de la columna fuera del alcance.
 *
 * `overscroll-contain` no le pasa el desplazamiento a la página al llegar al final; `scrollbar-gutter`
 * reserva el ancho de la barra para que la columna no cambie de ancho al aparecer («Ver más» del
 * historial); el margen negativo con el mismo relleno deja ver la sombra de las tarjetas sin moverlas.
 * Sólo desde `lg`, que es donde la columna es pegajosa. Clases literales: Tailwind sólo genera las que lee.
 */
export const OWN_SCROLL_CLASS =
	"lg:max-h-[calc(100dvh-var(--header-h-min)-1px-2*var(--sticky-air))] lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable] lg:[scrollbar-width:thin] lg:-mx-1 lg:px-1 lg:pb-1";
