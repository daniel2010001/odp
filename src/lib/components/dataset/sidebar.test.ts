// Pruebas de `panelScrollReset` (S18 de `odd/tasks/prototype-presentation.md`): la columna lateral tiene su
// propio desplazamiento y, si la persona lo bajó, vuelve arriba cuando la página vuelve al tope o la columna
// deja de estar pegada. Sólo en esas transiciones: un desplazamiento de la página que no las cruza no toca la
// columna, para no moverla mientras se la usa.

import { afterEach, describe, expect, it, vi } from "vitest";
import { panelScrollReset } from "./sidebar";

const STICKY_TOP = 97;
const matchMedia = window.matchMedia;

/** Una columna pegajosa con `scrollTop` y posición controlables; `scrollTo` se espía. */
function makeAside(scrollTop: number) {
	const aside = document.createElement("aside");
	aside.style.position = "sticky";
	aside.style.top = `${STICKY_TOP}px`;
	let rectTop = STICKY_TOP;
	Object.defineProperty(aside, "scrollTop", { value: scrollTop, writable: true });
	aside.getBoundingClientRect = () => ({ top: rectTop }) as DOMRect;
	const scrollTo = vi.fn();
	aside.scrollTo = scrollTo as typeof aside.scrollTo;
	return {
		aside,
		scrollTo,
		/** Lo que el navegador haría al desplazar la página: mueve la columna si no está pegada. */
		at(y: number, top = STICKY_TOP) {
			Object.defineProperty(window, "scrollY", { value: y, configurable: true });
			rectTop = top;
		},
	};
}

afterEach(() => {
	window.matchMedia = matchMedia;
	Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

describe("panelScrollReset", () => {
	it("cuando la página vuelve al tope, la columna vuelve arriba con desplazamiento suave", () => {
		const { aside, scrollTo, at } = makeAside(240);
		const onScroll = panelScrollReset(aside);
		at(800);
		onScroll();
		expect(scrollTo).not.toHaveBeenCalled();

		at(0);
		onScroll();
		expect(scrollTo).toHaveBeenCalledTimes(1);
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
	});

	it("cuando la columna deja de estar pegada, vuelve arriba aunque la página no llegue al tope", () => {
		const { aside, scrollTo, at } = makeAside(240);
		const onScroll = panelScrollReset(aside);
		at(800);
		onScroll();

		at(300, STICKY_TOP + 40);
		onScroll();
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
	});

	it("con movimiento reducido la vuelta es instantánea", () => {
		window.matchMedia = ((q: string) => ({
			...matchMedia(q),
			matches: q.includes("reduce"),
		})) as typeof window.matchMedia;
		const { aside, scrollTo, at } = makeAside(240);
		const onScroll = panelScrollReset(aside);
		at(800);
		onScroll();
		at(0);
		onScroll();
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
	});

	it("un desplazamiento que no cruza el tope ni despega la columna no la mueve", () => {
		const { aside, scrollTo, at } = makeAside(240);
		const onScroll = panelScrollReset(aside);
		at(800);
		onScroll();
		at(600);
		onScroll();
		at(900);
		onScroll();
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("una columna despegada que se usa no se mueve con la página: sólo la transición la reinicia", () => {
		// En el tope, la columna no está pegada; si la persona la baja y después desplaza un poco la página
		// (sin llegar a pegarla), la columna sigue donde la dejó.
		const { aside, scrollTo, at } = makeAside(240);
		at(0, STICKY_TOP + 400);
		const onScroll = panelScrollReset(aside);
		at(40, STICKY_TOP + 360);
		onScroll();
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("si la columna ya está arriba no hace nada", () => {
		const { aside, scrollTo, at } = makeAside(0);
		const onScroll = panelScrollReset(aside);
		at(800);
		onScroll();
		at(0);
		onScroll();
		expect(scrollTo).not.toHaveBeenCalled();
	});
});
