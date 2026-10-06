// Lógica pura de la hoja `/dev/search`.
//
// La hoja existe para decidir dos cosas mirando y **leyendo números**: dónde vive el *scroll
// snapping* del buscador y cuál es el disparador de la divulgación de los tags. El instrumento mide
// el desplazamiento real sobre el navegador; jsdom no reproduce el ajuste, así que nada de esto
// toca el DOM. Acá viven el mapeo modo → estilos, la aritmética de la sonda y el veredicto, con
// lectores inyectables para poder fijar la conducta sin motor de layout.
//
// ─── Por qué una batería y no una sonda ──────────────────────────────
// Una sola sonda a mitad del hueco hacía que `proximity` y `mandatory` imprimieran el **mismo**
// número: Chrome también ajusta con `proximity` cuando el pedido cae cerca de un borde. Por eso la
// batería cubre 25/50/75/95 % de un hueco, un salto largo y —clave— **el punto más lejos de todo
// borde**, que es el único lugar donde los dos modos pueden diferir en principio. Si tampoco ahí se
// distinguen, eso es el hallazgo y se dice con palabras: no se fabrica una diferencia.
//
// ─── Qué NO se llama «esperado» ──────────────────────────────────────
// «El borde más cercano antes de la sonda» no es la regla del navegador: la medición real lo
// contradijo. En su lugar se informan los **dos bordes que rodean** el pedido y dónde aterrizó.
//
// ─── Pedidos acotados ────────────────────────────────────────────────
// Un pedido que excede el máximo scrolleable lo recorta el scroller. Eso **no** es «el navegador lo
// dejó quieto»: esas filas se marcan y quedan fuera del conteo de ajustes, para que el veredicto no
// se apoye en un pedido que el scroller no podía satisfacer.

export type SnappingMode = "off" | "proximity" | "mandatory" | "contained";
export type DisclosureForm = "off" | "link-tooltip" | "title-link";

export const SNAPPING_MODES: readonly SnappingMode[] = [
	"off",
	"proximity",
	"mandatory",
	"contained",
] as const;

export const DISCLOSURE_FORMS: readonly DisclosureForm[] = [
	"off",
	"link-tooltip",
	"title-link",
] as const;

/** Scroller que el modo activo usa de verdad. El instrumento dice cuál midió. */
export type ScrollerKind = "window" | "region";

export function scrollerFor(mode: SnappingMode): ScrollerKind {
	return mode === "contained" ? "region" : "window";
}

/**
 * `scroll-snap-type` en línea para el elemento documento (modos de página). `""` lo limpia.
 *
 * `off` y `contained` devuelven vacío a propósito: el modo `off` es el baseline de hoy y
 * `contained` no debe tocar el documento —si lo tocara, la hoja mostraría (b) tres veces.
 */
export function documentSnapType(mode: SnappingMode): string {
	switch (mode) {
		case "proximity":
			return "y proximity";
		case "mandatory":
			return "y mandatory";
		default:
			return "";
	}
}

/** Clases de la región de resultados. Vacío = la lista vive en el flujo del documento, como hoy. */
export function regionSnapClass(mode: SnappingMode): string {
	return mode === "contained" ? "snap-y snap-mandatory overflow-y-auto" : "";
}

/**
 * Valor CSS de `scroll-margin-top`: `--header-h` (fuente única del alto del encabezado) más el alto
 * medido de la barra pegajosa más el aire. Sin esto la card se fija debajo de la barra y se ve
 * cortada, que es la trampa declarada por el ítem.
 */
export function cardSnapMarginCss(barHeight: number, air = "1rem"): string {
	return `calc(var(--header-h) + ${barHeight}px + ${air})`;
}

/**
 * Etiqueta legible de un `scroll-snap-type` computado.
 *
 * Chrome **omite** la estrictitud cuando es `proximity` (es el default): el valor computado vuelve
 * como `y`, que en una hoja de decisión se lee como «sin proximidad». Se nombra explícito.
 */
export function snapTypeLabel(value: string): string {
	const normalized = value.trim();
	if (normalized === "" || normalized === "none") return "none";
	const [axis, strictness] = normalized.split(/\s+/);
	if (!strictness) return `${axis} proximity (implícito)`;
	return normalized;
}

// ─── Sonda ───────────────────────────────────────────────────────────

/** Lo mínimo que la sonda necesita del scroller medido: pedir y leer el desplazamiento. */
export interface ProbeScroller {
	scrollTo(top: number): void;
	readTop(): number;
}

export interface ProbeGeometry {
	/** Borde superior de cada card en coordenadas del scroller, en píxeles. */
	cardTops: number[];
	/** `scroll-margin-top` efectivo de la primera card, ya resuelto a píxeles. */
	firstCardMarginTop: number;
	/** Desplazamiento máximo del scroller medido (0 si no scrollea). */
	maxScroll: number;
	/** Alto visible del scroller, en píxeles (para el salto largo). */
	viewport: number;
}

export interface SnapTarget {
	/** Índice de la card en la lista; −1 cuando no hay ninguna. */
	index: number;
	/** Borde superior de la card, en coordenadas del scroller. */
	cardTop: number;
	/** Dónde cae la card: `cardTop − firstCardMarginTop`. */
	effectiveTop: number;
}

/** Un pedido de la batería, con las dos marcas que cambian cómo se lee. */
export interface ProbeOffset {
	/** El offset que se le pide al scroller (ya acotado al rango). */
	offset: number;
	/** El pedido original cayó fuera del rango scrolleable y el scroller lo acotó. */
	clamped: boolean;
	/** Es el punto de máxima distancia a todo borde: donde los modos pueden diferir. */
	far: boolean;
}

export interface ProbeReading {
	/** Lo que la sonda pidió (`R`). */
	requested: number;
	/** Lo que el scroller devolvió (`S`), ya ajustado por el navegador. */
	final: number;
	/** `requested − final`. Cero cuando el scroller no ajustó. */
	delta: number;
	/** El pedido original excedía el rango y fue acotado: no cuenta como ajuste. */
	clamped: boolean;
	/** Es la fila de máxima distancia a todo borde. */
	far: boolean;
}

export interface ProbeRow extends ProbeReading {
	/** Borde más cercano a donde aterrizó. */
	landed: SnapTarget;
	/** Último borde en o por debajo del pedido. */
	before: SnapTarget | null;
	/** Primer borde en o por encima del pedido. */
	after: SnapTarget | null;
}

/** Resultado de una comparación puntual contra el otro modo de página. */
export interface ModeComparison {
	mode: SnappingMode;
	reading: ProbeReading;
}

/** Estado de la restauración del scroll tras la sonda, para poder avisar si no se sostiene. */
export interface RestoreCheck {
	target: number;
	current: number;
}

/** Margen de tolerancia del auto-test y de la restauración, en píxeles. */
export const PROBE_TOLERANCE = 1;

export type ProbeVerdict = "broken" | "inconsistent" | "adjusted" | "no-adjustment";

export interface InstrumentReport {
	mode: SnappingMode;
	scroller: ScrollerKind;
	snapType: string;
	firstCardMarginTop: number;
	viewport: number;
	/** Las corridas de la batería en el modo activo. */
	rows: ProbeRow[];
	/** Las mismas corridas con el snapping anulado: el auto-test. */
	controlRows: ProbeRow[];
	/** El mismo punto lejano medido con el otro modo de página (sólo (a)/(b)). */
	comparison: ModeComparison | null;
	verdict: ProbeVerdict;
	/** `false` cuando no hubo geometría que medir (sin cards montadas). */
	measured: boolean;
}

/** Contexto que el instrumento ya leyó del DOM; acá sólo se compone el reporte. */
export interface ProbeContext {
	mode: SnappingMode;
	scroller: ScrollerKind;
	snapType: string;
}

/** Objetivos de snap ordenados por posición efectiva (ya con el margen restado). */
export function snapTargets(geometry: ProbeGeometry): SnapTarget[] {
	return geometry.cardTops
		.map((cardTop, index) => ({
			index,
			cardTop,
			effectiveTop: cardTop - geometry.firstCardMarginTop,
		}))
		.sort((a, b) => a.effectiveTop - b.effectiveTop);
}

export function nearestTarget(targets: SnapTarget[], offset: number): SnapTarget {
	if (targets.length === 0) return { index: -1, cardTop: 0, effectiveTop: 0 };

	let best = targets[0];
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const target of targets) {
		const distance = Math.abs(target.effectiveTop - offset);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = target;
		}
	}
	return best;
}

/** Los dos bordes que rodean al pedido: el último ≤ y el primero ≥. No hay «esperado». */
export function surroundingTargets(
	targets: SnapTarget[],
	offset: number,
): { before: SnapTarget | null; after: SnapTarget | null } {
	let before: SnapTarget | null = null;
	let after: SnapTarget | null = null;
	for (const target of targets) {
		if (target.effectiveTop <= offset) before = target;
		if (target.effectiveTop >= offset && after === null) after = target;
	}
	return { before, after };
}

/**
 * El offset del rango scrolleable que **maximiza la distancia al borde más cercano**: el punto
 * medio del hueco más grande entre borde y borde (los extremos 0 y `maxScroll` cuentan como bordes).
 * Es el único lugar donde `proximity` y `mandatory` pueden diferir en principio.
 */
export function maxDistanceOffset(geometry: ProbeGeometry): number {
	const points = [
		0,
		...snapTargets(geometry)
			.map((target) => target.effectiveTop)
			.filter((top) => top > 0 && top < geometry.maxScroll),
		geometry.maxScroll,
	].sort((a, b) => a - b);

	let bestStart = points[0] ?? 0;
	let bestGap = 0;
	for (let index = 1; index < points.length; index += 1) {
		const gap = points[index] - points[index - 1];
		if (gap > bestGap) {
			bestGap = gap;
			bestStart = points[index - 1];
		}
	}
	return bestStart + bestGap / 2;
}

function clampToRange(offset: number, geometry: ProbeGeometry): number {
	return Math.max(0, Math.min(offset, geometry.maxScroll));
}

/**
 * La batería: 25/50/75/95 % de la distancia entre los dos primeros bordes positivos, un salto largo
 * de ~1.5 alturas de viewport y el punto de máxima distancia a todo borde. Cae **entre** bordes a
 * propósito: un pedido justo sobre un borde no probaría nada porque el scroller no tendría adónde
 * moverse.
 */
export function probeOffsets(geometry: ProbeGeometry): ProbeOffset[] {
	const targets = snapTargets(geometry).filter((target) => target.effectiveTop > 0);
	const first = targets[0]?.effectiveTop ?? 0;
	const second =
		targets[1]?.effectiveTop ?? Math.min(geometry.maxScroll, first + geometry.viewport);
	const gap = Math.max(0, second - first);

	const fractions = [0.25, 0.5, 0.75, 0.95];
	const offsets: ProbeOffset[] = fractions.map((fraction) => {
		const raw = first + gap * fraction;
		return {
			offset: clampToRange(raw, geometry),
			clamped: raw > geometry.maxScroll || raw < 0,
			far: false,
		};
	});

	const longJump = first + 1.5 * geometry.viewport;
	offsets.push({
		offset: clampToRange(longJump, geometry),
		clamped: longJump > geometry.maxScroll || longJump < 0,
		far: false,
	});

	offsets.push({ offset: maxDistanceOffset(geometry), clamped: false, far: true });

	return offsets;
}

/** Corre una sonda: pide y lee el desplazamiento. El scroller decide si ajusta o no. */
export function runProbe(scroller: ProbeScroller, requested: number): ProbeReading {
	scroller.scrollTo(requested);
	const final = scroller.readTop();
	return { requested, final, delta: requested - final, clamped: false, far: false };
}

/** Corre la batería completa, sin restaurar: la restauración es del llamador (DOM o scroller). */
export function runProbeBattery(scroller: ProbeScroller, offsets: ProbeOffset[]): ProbeReading[] {
	return offsets.map((offset) => ({
		...runProbe(scroller, offset.offset),
		clamped: offset.clamped,
		far: offset.far,
	}));
}

/** Ata las lecturas a la geometría: dónde aterrizó y qué bordes rodean cada pedido. */
export function toRows(readings: ProbeReading[], geometry: ProbeGeometry): ProbeRow[] {
	const targets = snapTargets(geometry);
	return readings.map((reading) => ({
		...reading,
		landed: nearestTarget(targets, reading.final),
		...surroundingTargets(targets, reading.requested),
	}));
}

/**
 * Cantidad de filas con ajuste real. Las filas acotadas quedan afuera: su delta es del recorte, no
 * del snapping.
 */
export function adjustedCount(rows: ProbeReading[], tolerance = PROBE_TOLERANCE): number {
	return rows.filter((row) => !row.clamped && Math.abs(row.delta) > tolerance).length;
}

/** Filas que cuentan para el veredicto: todas menos las acotadas. */
export function countedRows(rows: ProbeReading[]): ProbeReading[] {
	return rows.filter((row) => !row.clamped);
}

/** Mayor delta absoluto entre las filas que cuentan. */
export function maxAbsDelta(rows: ProbeReading[]): number {
	return countedRows(rows).reduce((max, row) => Math.max(max, Math.abs(row.delta)), 0);
}

/** ¿Los dos modos aterrizan en el mismo punto con el mismo ajuste? */
export function modesAgree(
	active: ProbeReading,
	comparison: ProbeReading,
	tolerance = PROBE_TOLERANCE,
): boolean {
	return (
		Math.abs(active.final - comparison.final) <= tolerance &&
		Math.abs(active.delta - comparison.delta) <= tolerance
	);
}

/**
 * Veredicto del instrumento.
 *
 * El orden importa: cualquier fila del control que ajuste declara el instrumento **roto** y no se
 * opina sobre el modo; un modo `off` que igual ajusta es **inconsistente**; recién con el control
 * limpio se concluye si el modo ajusta o no. Las filas acotadas no participan.
 */
export function probeVerdict(
	mode: SnappingMode,
	active: ProbeReading[],
	control: ProbeReading[],
	tolerance = PROBE_TOLERANCE,
): ProbeVerdict {
	// Defensivo y **no alcanzable hoy por el DOM**: el auto-test anula el snapping sobre el mismo
	// elemento que lo lleva, así que el control no debería ajustar. La rama existe para el caso en
	// que el elemento del snapping y el medido diverjan; queda cubierta por lecturas inyectadas y
	// no se finge un camino real.
	if (countedRows(control).some((row) => Math.abs(row.delta) > tolerance)) return "broken";
	if (mode === "off" && countedRows(active).some((row) => Math.abs(row.delta) > tolerance))
		return "inconsistent";
	if (countedRows(active).some((row) => Math.abs(row.delta) > tolerance)) return "adjusted";
	return "no-adjustment";
}

export function verdictLabel(verdict: ProbeVerdict): string {
	switch (verdict) {
		case "broken":
			return "instrumento roto";
		case "inconsistent":
			return "estado inconsistente";
		case "adjusted":
			return "el scroll se ajustó";
		case "no-adjustment":
			return "sin ajuste";
	}
}

/** El veredicto roto o inconsistente se pinta en rojo; el resto es informativo. */
export function verdictIsFailure(verdict: ProbeVerdict): boolean {
	return verdict === "broken" || verdict === "inconsistent";
}

/** Compone el reporte final: ata las lecturas a la geometría y calcula el veredicto. */
export function buildReport(
	context: ProbeContext,
	geometry: ProbeGeometry,
	readings: ProbeReading[],
	controlReadings: ProbeReading[],
	comparison: ModeComparison | null = null,
): InstrumentReport {
	const rows = toRows(readings, geometry);
	const controlRows = toRows(controlReadings, geometry);
	return {
		mode: context.mode,
		scroller: context.scroller,
		snapType: context.snapType,
		firstCardMarginTop: geometry.firstCardMarginTop,
		viewport: geometry.viewport,
		rows,
		controlRows,
		comparison,
		verdict: probeVerdict(context.mode, rows, controlRows),
		measured: true,
	};
}

/** Reporte sin medición: la hoja no encontró cards que medir. No inventa un veredicto. */
export function emptyReport(mode: SnappingMode): InstrumentReport {
	return {
		mode,
		scroller: scrollerFor(mode),
		snapType: "",
		firstCardMarginTop: 0,
		viewport: 0,
		rows: [],
		controlRows: [],
		comparison: null,
		verdict: "no-adjustment",
		measured: false,
	};
}
