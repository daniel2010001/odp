// Auto-test de la sonda DOM de `/dev/search`, con un navegador simulado.
//
// jsdom no reproduce scroll snapping, pero sí se puede simular: se monta un documento con su
// `window.scrollTo`/`scrollY` o una región con su `scrollTop`/`scrollTo`, y el scroller ajusta al
// borde más cercano **sólo mientras el snapping no está anulado por estilo en línea**. Así la
// restauración se vuelve determinista: si `measureDom` deja de restaurar, el scroll queda en el
// último punto de la sonda y la aserción falla. Además se simula el navegador que **vuelve a
// ajustar** después de re-habilitar el snapping (el caso que dejaba la hoja a mitad de página): con
// los intentos agotados, el instrumento tiene que avisar por callback.

import { afterEach, describe, expect, it, vi } from "vitest";
import { measureDom } from "./instrument";

const CARD_TOPS = [0, 900, 1900, 3000, 4200, 6000];
const MARGIN = 164;
const VIEWPORT = 800;
const SCROLL_HEIGHT = 6000;
const BOUNDARIES = CARD_TOPS.map((top) => top - MARGIN).filter((top) => top > 0);

function nearestBoundary(offset: number): number {
	let best = BOUNDARIES[0];
	let distance = Number.POSITIVE_INFINITY;
	for (const boundary of BOUNDARIES) {
		const candidate = Math.abs(boundary - offset);
		if (candidate < distance) {
			distance = candidate;
			best = boundary;
		}
	}
	return best;
}

function rectObject(top: number): DOMRect {
	return {
		top,
		left: 0,
		right: 0,
		bottom: 0,
		width: 0,
		height: 0,
		x: 0,
		y: top,
		toJSON: () => ({}),
	} as DOMRect;
}

function makeCards(cardTop: (absoluteTop: number) => number, margin = MARGIN) {
	return CARD_TOPS.map((absoluteTop) => {
		const card = document.createElement("div");
		card.style.scrollMarginTop = `${margin}px`;
		card.getBoundingClientRect = () => rectObject(cardTop(absoluteTop));
		return card;
	});
}

const originalWindow = {
	scrollTo: window.scrollTo,
	scrollY: Object.getOwnPropertyDescriptor(window, "scrollY"),
	innerHeight: Object.getOwnPropertyDescriptor(window, "innerHeight"),
};

afterEach(() => {
	window.scrollTo = originalWindow.scrollTo;
	if (originalWindow.scrollY) {
		Object.defineProperty(window, "scrollY", originalWindow.scrollY);
	}
	if (originalWindow.innerHeight) {
		Object.defineProperty(window, "innerHeight", originalWindow.innerHeight);
	}
	Reflect.deleteProperty(document.documentElement, "scrollHeight");
	document.documentElement.style.scrollSnapType = "";
});

/** Instala un documento con snapping que ajusta al borde más cercano salvo que el estilo lo anule. */
function installWindowBrowser(scrollHeight = SCROLL_HEIGHT) {
	let scrollTop = 0;
	const cards = makeCards((absoluteTop) => absoluteTop - scrollTop);
	const region = document.createElement("div");
	for (const card of cards) region.append(card);

	Object.defineProperty(document.documentElement, "scrollHeight", {
		get: () => scrollHeight,
		configurable: true,
	});
	Object.defineProperty(window, "innerHeight", { get: () => VIEWPORT, configurable: true });
	Object.defineProperty(window, "scrollY", { get: () => scrollTop, configurable: true });

	window.scrollTo = ((options?: ScrollToOptions | number, y?: number) => {
		const requested = typeof options === "object" ? (options.top ?? 0) : (y ?? 0);
		const snapType = document.documentElement.style.scrollSnapType;
		const snapping = snapType !== "" && snapType !== "none";
		scrollTop = snapping ? nearestBoundary(requested) : requested;
	}) as typeof window.scrollTo;

	return {
		cards,
		region,
		read: () => scrollTop,
		/** Imita al navegador que, al re-habilitar el snapping, vuelve a ajustar. */
		snapNow: () => {
			scrollTop = nearestBoundary(scrollTop);
		},
	};
}

/** Igual, pero sobre la región de resultados: es el scroller de `contained`. */
function installRegionBrowser(scrollHeight = SCROLL_HEIGHT) {
	let scrollTop = 0;
	const cards = makeCards((absoluteTop) => absoluteTop - scrollTop);
	const region = document.createElement("div");
	for (const card of cards) region.append(card);

	region.getBoundingClientRect = () => rectObject(0);
	Object.defineProperty(region, "clientHeight", { get: () => VIEWPORT, configurable: true });
	Object.defineProperty(region, "scrollHeight", { get: () => scrollHeight, configurable: true });
	Object.defineProperty(region, "scrollTop", {
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value;
		},
		configurable: true,
	});
	region.scrollTo = ((options?: ScrollToOptions | number, y?: number) => {
		const requested = typeof options === "object" ? (options.top ?? 0) : (y ?? 0);
		const snapType = region.style.scrollSnapType;
		const snapping = snapType !== "" && snapType !== "none";
		scrollTop = snapping ? nearestBoundary(requested) : requested;
	}) as typeof region.scrollTo;

	return {
		cards,
		region,
		read: () => scrollTop,
		snapNow: () => {
			scrollTop = nearestBoundary(scrollTop);
		},
	};
}

/** Scheduler inmediato: el chequeo de restauración corre al toque y no deja callbacks pendientes. */
const immediate = (callback: () => void): void => callback();

describe("sonda DOM — la batería y su restauración", () => {
	it("en modos de página corre las seis filas y restaura el documento a su punto de partida", () => {
		const { cards, region, read } = installWindowBrowser();
		document.documentElement.style.scrollSnapType = "y mandatory";

		const report = measureDom({ mode: "mandatory", region, cards }, { schedule: immediate });

		// Si la restauración se quitara, el scroll quedaría en el último ajuste de la batería.
		expect(read()).toBe(0);
		expect(report.rows).toHaveLength(6);
		expect(report.rows.some((row) => row.far)).toBe(true);
		expect(report.rows.every((row) => !row.clamped)).toBe(true);
		expect(report.controlRows.every((row) => row.delta === 0)).toBe(true);
		expect(report.comparison?.mode).toBe("proximity");
		expect(report.verdict).toBe("adjusted");
	});

	it("en `contained` restaura el scroll de la región, no el del documento", () => {
		const { cards, region, read } = installRegionBrowser();
		document.documentElement.style.scrollSnapType = "";

		const report = measureDom({ mode: "contained", region, cards }, { schedule: immediate });

		expect(read()).toBe(0);
		expect(report.scroller).toBe("region");
		expect(report.rows).toHaveLength(6);
		// La comparación entre modos de página no aplica al contenedor propio.
		expect(report.comparison).toBeNull();
	});

	it("parte de un scroll ya avanzado y lo devuelve exacto", () => {
		const { cards, region, read } = installWindowBrowser();
		document.documentElement.style.scrollSnapType = "";
		// Sin snapping el usuario pudo haber quedado en cualquier posición; la sonda no debe robarla.
		window.scrollTo(0, 4321);

		measureDom({ mode: "off", region, cards }, { schedule: immediate });

		expect(read()).toBe(4321);
	});

	it("marca acotados los pedidos que el scroller no puede satisfacer", () => {
		const { cards, region } = installRegionBrowser(1000);
		region.style.scrollSnapType = "y mandatory";

		const report = measureDom({ mode: "contained", region, cards }, { schedule: immediate });

		expect(report.rows.some((row) => row.clamped)).toBe(true);
		// El veredicto no se apoya en las filas acotadas.
		expect(report.verdict).not.toBe("broken");
	});
});

describe("sonda DOM — la restauración que no se sostiene", () => {
	it("re-afirma y, si el navegador vuelve a ajustar, avisa por callback", () => {
		const { cards, region, snapNow } = installWindowBrowser();
		document.documentElement.style.scrollSnapType = "y mandatory";

		const frames: Array<() => void> = [];
		const unstable = vi.fn();
		measureDom(
			{ mode: "mandatory", region, cards },
			{
				schedule: (callback) => frames.push(callback),
				onRestoreUnstable: unstable,
				restoreAttempts: 1,
			},
		);

		// El navegador re-ajusta antes de cada chequeo: el intento no alcanza y hay que avisar.
		while (frames.length > 0) {
			const callback = frames.shift() as () => void;
			snapNow();
			callback();
		}

		expect(unstable).toHaveBeenCalledTimes(1);
		expect(unstable.mock.calls[0][0]).toEqual({ target: 0, current: 736 });
	});

	it("no avisa cuando la posición se sostiene", () => {
		const { cards, region } = installWindowBrowser();
		document.documentElement.style.scrollSnapType = "y mandatory";

		const unstable = vi.fn();
		const report = measureDom(
			{ mode: "mandatory", region, cards },
			{ schedule: immediate, onRestoreUnstable: unstable },
		);

		expect(report.rows).toHaveLength(6);
		expect(unstable).not.toHaveBeenCalled();
	});
});
