// Puente DOM del instrumento de `/dev/search`.
//
// `decisions.ts` tiene la aritmética y no toca el DOM; acá se lee el scroller real y se corre la
// batería. Tres reglas viven acá y las tres vienen de mediciones que desmintieron una versión
// anterior:
//
// · **Restaurar y verificar en frames siguientes.** La sonda mueve el scroller; la restauración
//   síncrona alcanza para que nada se pinte en el punto de la sonda, pero al re-habilitar el
//   snapping el navegador vuelve a ajustar (medido: `mandatory` deja `data-header-shrunk`). Por eso
//   se re-afirma el offset guardado en uno o dos frames, y si aun así no se sostiene se avisa: es
//   evidencia de que `mandatory` es el modo más propenso a sentirse roto.
// · **El auto-test anula por estilo en línea sobre el elemento medido**, no cambiando el modo.
// · **El punto más lejano se mide también con el otro modo de página**, porque dentro de un hueco
//   chico `proximity` y `mandatory` coinciden y la comparación no probaría nada.
//
// jsdom no reproduce el ajuste del navegador, por eso los tests de componente inyectan el
// instrumento; la sonda DOM se prueba con un scroller simulado (ver `instrument.test.ts`).

import {
	buildReport,
	documentSnapType,
	emptyReport,
	type InstrumentReport,
	type ModeComparison,
	type ProbeGeometry,
	type ProbeOffset,
	type ProbeReading,
	type ProbeScroller,
	probeOffsets,
	type RestoreCheck,
	runProbeBattery,
	type ScrollerKind,
	type SnappingMode,
	scrollerFor,
} from "./decisions";

export interface DomInstrumentContext {
	mode: SnappingMode;
	/** Región de resultados: scroller propio en `contained`, contenedor de las cards en el resto. */
	region: HTMLElement | null;
	/** Cards en orden de documento. */
	cards: HTMLElement[];
}

export interface DomInstrumentOptions {
	/** Programa un callback en el próximo frame. Inyectable para tests deterministas. */
	schedule?: (callback: () => void) => void;
	/** Se llama si, agotados los intentos, el scroll no volvió al offset guardado. */
	onRestoreUnstable?: (check: RestoreCheck) => void;
	/** Cuántas veces se re-afirma la posición antes de rendirse. */
	restoreAttempts?: number;
}

/** Diferencia tolerada al verificar que el scroll volvió donde estaba. */
const RESTORE_TOLERANCE = 2;

function readMarginTop(card: HTMLElement | undefined): number {
	if (!card) return 0;
	const value = Number.parseFloat(getComputedStyle(card).scrollMarginTop);
	return Number.isFinite(value) ? value : 0;
}

/** Coordenadas del documento para los modos de página. */
function windowGeometry(cards: HTMLElement[]): ProbeGeometry {
	return {
		cardTops: cards.map((card) => card.getBoundingClientRect().top + window.scrollY),
		firstCardMarginTop: readMarginTop(cards[0]),
		maxScroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
		viewport: window.innerHeight,
	};
}

/**
 * Coordenadas del contenido de la región para el modo `contained`.
 *
 * El rect de la región es su **caja de borde**; el origen del scroll es su **caja de padding**, así
 * que hay que descontar el borde (`clientTop`). El padding **no** se descuenta: ya está dentro de la
 * geometría del contenido que refleja el rect de cada card, y restarlo otra vez correría cada borde
 * 8px de más. Medido: `contained` reportaba 70 con el borde sin descontar y el navegador aterrizaba
 * en 69.
 */
export function regionGeometry(region: HTMLElement, cards: HTMLElement[]): ProbeGeometry {
	const scrollerTop = region.scrollTop;
	const paddingBoxTop = region.getBoundingClientRect().top + region.clientTop;
	return {
		cardTops: cards.map((card) => card.getBoundingClientRect().top - paddingBoxTop + scrollerTop),
		firstCardMarginTop: readMarginTop(cards[0]),
		maxScroll: Math.max(0, region.scrollHeight - region.clientHeight),
		viewport: region.clientHeight,
	};
}

function geometryOf(kind: ScrollerKind, element: HTMLElement, cards: HTMLElement[]): ProbeGeometry {
	return kind === "region" ? regionGeometry(element, cards) : windowGeometry(cards);
}

function scrollerOf(kind: ScrollerKind, region: HTMLElement | null): ProbeScroller {
	if (kind === "region" && region) {
		return {
			// `behavior: "instant"` anula el `scroll-behavior: smooth` de `app.css`: sin esto el
			// desplazamiento anima y la lectura inmediata devolvería la posición vieja.
			scrollTo: (top: number) => region.scrollTo({ top, left: 0, behavior: "instant" }),
			readTop: () => region.scrollTop,
		};
	}
	return {
		scrollTo: (top: number) => window.scrollTo({ top, left: 0, behavior: "instant" }),
		readTop: () => window.scrollY,
	};
}

/** Corre `fn` con el snapping anulado por estilo en línea sobre el elemento medido. */
function withSnappingOff<T>(element: HTMLElement, fn: () => T): T {
	const previous = element.style.scrollSnapType;
	element.style.scrollSnapType = "none";
	try {
		return fn();
	} finally {
		element.style.scrollSnapType = previous;
	}
}

/**
 * Mide el mismo punto lejano con el otro modo de página. Sin esto la comparación queda dentro de un
 * hueco chico, donde `proximity` y `mandatory` coinciden por geometría y no dicen nada.
 */
function compareOtherPageMode(
	element: HTMLElement,
	scroller: ProbeScroller,
	offsets: ProbeOffset[],
	mode: SnappingMode,
): ModeComparison | null {
	if (mode !== "proximity" && mode !== "mandatory") return null;
	const far = offsets.find((offset) => offset.far);
	if (!far) return null;

	const other: SnappingMode = mode === "proximity" ? "mandatory" : "proximity";
	const previous = element.style.scrollSnapType;
	element.style.scrollSnapType = documentSnapType(other);
	try {
		return { mode: other, reading: runProbeBattery(scroller, [far])[0] };
	} finally {
		element.style.scrollSnapType = previous;
	}
}

/**
 * Re-afirma la posición guardada en los próximos frames. Si el navegador vuelve a ajustar al
 * re-habilitar el snapping, cada intento anula el snapping para devolver el scroll y lo restaura;
 * si aun así no se sostiene, se avisa por callback para que la hoja lo diga en pantalla.
 */
function verifyRestore(
	element: HTMLElement,
	scroller: ProbeScroller,
	start: number,
	options: DomInstrumentOptions,
): void {
	const schedule = options.schedule ?? defaultSchedule;
	let attemptsLeft = options.restoreAttempts ?? 2;

	const check = () => {
		if (Math.abs(scroller.readTop() - start) <= RESTORE_TOLERANCE) return;
		if (attemptsLeft > 0) {
			attemptsLeft -= 1;
			withSnappingOff(element, () => scroller.scrollTo(start));
			schedule(check);
			return;
		}
		options.onRestoreUnstable?.({ target: start, current: scroller.readTop() });
	};

	schedule(check);
}

function defaultSchedule(callback: () => void): void {
	if (typeof requestAnimationFrame === "function") {
		requestAnimationFrame(() => callback());
		return;
	}
	setTimeout(callback, 16);
}

export function measureDom(
	context: DomInstrumentContext,
	options: DomInstrumentOptions = {},
): InstrumentReport {
	const { mode, region, cards } = context;
	const kind = scrollerFor(mode);
	const element = kind === "region" ? region : document.documentElement;

	if (!element || cards.length === 0) return emptyReport(mode);

	const scroller = scrollerOf(kind, region);
	const offsets = probeOffsets(geometryOf(kind, element, cards));
	const start = scroller.readTop();

	// El control corre con el snapping anulado; la batería activa, con el snapping real. La
	// restauración va en el `finally`, también sin snapping, para que el viewport no quede en el
	// punto de la sonda ni aunque una corrida falle.
	let readings: ProbeReading[] = [];
	let controlReadings: ProbeReading[] = [];
	let comparison: ModeComparison | null = null;
	try {
		controlReadings = withSnappingOff(element, () => runProbeBattery(scroller, offsets));
		readings = runProbeBattery(scroller, offsets);
		comparison = compareOtherPageMode(element, scroller, offsets, mode);
	} finally {
		withSnappingOff(element, () => scroller.scrollTo(start));
	}

	// Se relee la geometría después de restaurar: el encabezado pegajoso se achica al bajar y el
	// `scroll-margin-top` efectivo cambia con él. El número impreso es el del CSS en efecto.
	const geometry = geometryOf(kind, element, cards);
	const snapType = getComputedStyle(element).scrollSnapType || "none";

	verifyRestore(element, scroller, start, options);

	return buildReport(
		{ mode, scroller: kind, snapType },
		geometry,
		readings,
		controlReadings,
		comparison,
	);
}

/** Las cards que el instrumento mide: los envoltorios con el punto de snap. */
export function cardElementsOf(region: HTMLElement | null): HTMLElement[] {
	if (!region) return [];
	return Array.from(region.querySelectorAll<HTMLElement>('[data-testid="sheet-card"]'));
}
