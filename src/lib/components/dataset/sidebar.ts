// Las tarjetas de la columna lateral de la ficha del dataset (`DatasetSidebar.svelte`): su orden, su
// desplazamiento propio y la vuelta arriba de ese desplazamiento. Son las variantes que el autor aprobó en el
// playground `/dev/dataset-panel` (S17 y S18 de `odd/tasks/prototype-presentation.md`).

export type SidebarCard = "request" | "cite" | "summary" | "history" | "organization";

/**
 * El orden de la columna (variante «Propuesta»): primero lo que le concierne a quien tiene algo que hacer (la
 * solicitud), después lo que responde «¿me sirve esto?» (Resumen) y de quién es (Organización), y recién
 * entonces cómo citarlo; el historial, el único que crece sin tope y el único que el visitante no ve, va al
 * final. Una tarjeta que no tiene nada que mostrar no se dibuja.
 */
export const SIDEBAR_ORDER: readonly SidebarCard[] = [
	"request",
	"summary",
	"organization",
	"cite",
	"history",
];

/**
 * El desplazamiento propio de la columna (variante «Scroll propio»). Sigue pegajosa y su alto máximo es la
 * ventana menos lo que queda por encima del pegado: el encabezado **achicado** (`--header-h-min`, el estado en
 * que está cuando la columna ya se pegó), su borde de 1 px y el aire arriba y abajo (`--sticky-air`). Es la
 * misma fórmula de las facetas del buscador (`src/routes/search/+page.svelte`) y el mismo mecanismo de las
 * vistas previas (`src/lib/components/resource/PreviewWindow.svelte` y `ResourcePreview.svelte`: un alto en
 * `dvh`, que sigue a la pantalla, menos el encabezado); sin el piso de 360 px de las vistas, porque un piso
 * más alto que la ventana dejaría el final de la columna fuera del alcance.
 *
 * `overscroll-contain` no le pasa el desplazamiento a la página al llegar al final; `scrollbar-gutter`
 * reserva el ancho de la barra para que la columna no cambie de ancho al aparecer («Ver más» del
 * historial); el margen negativo con el mismo relleno deja ver la sombra de las tarjetas sin moverlas.
 *
 * La barra (S18) es fina y **transparente en reposo**; aparece, con el color del texto secundario, al pasar
 * el cursor o al enfocar algo dentro de la columna, y sin cursor (táctil) queda siempre visible, como el botón
 * del enlace. Sigue ahí para la rueda, el teclado y el tacto: sólo se oculta el dibujo. Sin degradado al pie: taparía el texto de la última tarjeta visible y lo dejaría bajo
 * 4.5:1; la tarjeta cortada en el borde ya dice que hay más abajo.
 *
 * Sólo desde `lg`, que es donde la columna es pegajosa. Clases literales: Tailwind sólo genera las que lee.
 */
export const OWN_SCROLL_CLASS =
	"lg:max-h-[calc(100dvh-var(--header-h-min)-1px-2*var(--sticky-air))] lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable] lg:[scrollbar-width:thin] lg:[scrollbar-color:transparent_transparent] lg:hover:[scrollbar-color:var(--muted-foreground)_transparent] lg:focus-within:[scrollbar-color:var(--muted-foreground)_transparent] lg:[@media(hover:none)]:[scrollbar-color:var(--muted-foreground)_transparent] lg:-mx-1 lg:px-1 lg:pb-1";

/** Si la columna está pegada: es `sticky` y su borde superior llegó a su `top`. */
function isStuck(aside: HTMLElement): boolean {
	const style = getComputedStyle(aside);
	const top = Number.parseFloat(style.top);
	if (style.position !== "sticky" || Number.isNaN(top)) return false;
	return aside.getBoundingClientRect().top <= top + 1;
}

/**
 * El manejador del desplazamiento de la página que devuelve la columna arriba (S18): si la persona la bajó,
 * vuelve a 0 cuando la página vuelve al tope o cuando la columna deja de estar pegada. Sólo en esas
 * transiciones —no en cada desplazamiento—, para no moverla mientras se la usa. Con movimiento reducido la
 * vuelta es instantánea.
 */
export function panelScrollReset(aside: HTMLElement): () => void {
	let lastY = window.scrollY;
	let wasStuck = isStuck(aside);
	return () => {
		const y = window.scrollY;
		const stuck = isStuck(aside);
		const reachedTop = y <= 0 && lastY > 0;
		const unstuck = wasStuck && !stuck;
		lastY = y;
		wasStuck = stuck;
		if (aside.scrollTop === 0 || !(reachedTop || unstuck)) return;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		aside.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
	};
}
