// Lógica pura de la hoja `/dev/search`, testeada sin navegador.
//
// El instrumento de la hoja mide *scroll snapping* sobre el DOM real, y jsdom **no** reproduce el
// ajuste del navegador: un número falso acá sería peor que ninguno. Por eso la aritmética vive en
// `decisions.ts`, sin DOM, y se prueba con lectores inyectados —uno que ajusta, uno que no— para
// fijar la conducta del veredicto, incluida la del control que también se ajusta (el instrumento se
// declara roto) y la del modo `off` que se ajusta igual (estado inconsistente).
//
// La batería cubre 25/50/75/95 % de un hueco, un salto largo y el punto de **máxima distancia a
// todo borde** (el único donde `proximity` y `mandatory` pueden diferir). Si la batería colapsara a
// una sola sonda, estos tests fallan. Las filas acotadas quedan fuera del conteo de ajustes.

import { describe, expect, it } from "vitest";
import {
	adjustedCount,
	buildReport,
	cardSnapMarginCss,
	countedRows,
	documentSnapType,
	type InstrumentReport,
	maxAbsDelta,
	maxDistanceOffset,
	modesAgree,
	nearestTarget,
	type ProbeGeometry,
	type ProbeScroller,
	probeOffsets,
	probeVerdict,
	regionSnapClass,
	runProbe,
	runProbeBattery,
	scrollerFor,
	snapTargets,
	snapTypeLabel,
	surroundingTargets,
	verdictLabel,
} from "./decisions";

/** Lector libre: `scrollTo` deja el scroll donde se pidió. Es el control sano (delta ≈ 0). */
function freeScroller(): ProbeScroller {
	let top = 0;
	return {
		scrollTo(requested: number): void {
			top = requested;
		},
		readTop: () => top,
	};
}

/**
 * Lector que imita al navegador con snapping: `scrollTo` termina en el objetivo efectivo más
 * cercano, nunca donde se pidió. Se usa también como control adversario: un control que ajusta
 * tiene que declarar el instrumento roto.
 */
function snappingScroller(geometry: ProbeGeometry): ProbeScroller {
	const targets = snapTargets(geometry);
	let top = 0;
	return {
		scrollTo(requested: number): void {
			top = nearestTarget(targets, requested).effectiveTop;
		},
		readTop: () => top,
	};
}

const GEOMETRY: ProbeGeometry = {
	cardTops: [0, 900, 1900, 3000, 4200, 6000],
	firstCardMarginTop: 164,
	maxScroll: 5200,
	viewport: 800,
};

describe("mapeo modo → presentación", () => {
	it("elige el scroller según el modo: `window` salvo el contenedor propio", () => {
		expect(scrollerFor("off")).toBe("window");
		expect(scrollerFor("proximity")).toBe("window");
		expect(scrollerFor("mandatory")).toBe("window");
		expect(scrollerFor("contained")).toBe("region");
	});

	it("aplica el snap de página sobre el documento sólo en los modos de página", () => {
		expect(documentSnapType("off")).toBe("");
		expect(documentSnapType("proximity")).toBe("y proximity");
		expect(documentSnapType("mandatory")).toBe("y mandatory");
		// El contenedor propio no toca el documento: si lo tocara, se vería como (b), no como (c).
		expect(documentSnapType("contained")).toBe("");
	});

	it("en `contained` el scroller propio vive en la región y en ningún otro modo", () => {
		expect(regionSnapClass("contained")).toContain("snap-y");
		expect(regionSnapClass("contained")).toContain("overflow-y-auto");
		expect(regionSnapClass("mandatory")).toBe("");
	});

	it("nombra la estrictitud que Chrome omite: `y` es `y proximity`", () => {
		expect(snapTypeLabel("y")).toBe("y proximity (implícito)");
		expect(snapTypeLabel("y mandatory")).toBe("y mandatory");
		expect(snapTypeLabel("x")).toBe("x proximity (implícito)");
		expect(snapTypeLabel("none")).toBe("none");
		expect(snapTypeLabel("")).toBe("none");
	});
});

describe("margen de scroll de las cards", () => {
	it("ata el margen a `--header-h`, al alto medido de la barra y al aire", () => {
		expect(cardSnapMarginCss(0)).toBe("calc(var(--header-h) + 0px + 1rem)");
		expect(cardSnapMarginCss(68)).toBe("calc(var(--header-h) + 68px + 1rem)");
	});
});

describe("bordes y objetivos de snap", () => {
	it("resta el `scroll-margin-top` del borde de la card y ordena por posición efectiva", () => {
		const targets = snapTargets(GEOMETRY);

		expect(targets.map((target) => target.effectiveTop)).toEqual([
			-164, 736, 1736, 2836, 4036, 5836,
		]);
		expect(targets[1].cardTop).toBe(900);
		expect(targets[1].index).toBe(1);
	});

	it("informa los dos bordes que rodean al pedido, no un «esperado»", () => {
		const targets = snapTargets(GEOMETRY);

		const middle = surroundingTargets(targets, 1200);
		expect(middle.before?.effectiveTop).toBe(736);
		expect(middle.after?.effectiveTop).toBe(1736);

		const below = surroundingTargets(targets, -500);
		expect(below.before).toBeNull();
		expect(below.after?.effectiveTop).toBe(-164);
	});

	it("encuentra el punto más lejos de todo borde (el hueco más grande)", () => {
		// Huecos: 0–736, 736–1736, 1736–2836, 2836–4036, 4036–5200. El mayor es 1200 (2836–4036).
		expect(maxDistanceOffset(GEOMETRY)).toBe(3436);
	});
});

describe("batería de la sonda", () => {
	it("corre seis offsets: 25/50/75/95 %, el salto largo y el punto más lejano", () => {
		const offsets = probeOffsets(GEOMETRY);

		expect(offsets.map((offset) => offset.offset)).toEqual([986, 1236, 1486, 1686, 1936, 3436]);
		expect(offsets).toHaveLength(6);
		// Sólo la última fila es la de máxima distancia a todo borde.
		expect(offsets.filter((offset) => offset.far)).toHaveLength(1);
		expect(offsets[5].far).toBe(true);
		// El punto clave: los pedidos caen entre bordes, nunca sobre uno.
		for (const offset of offsets.slice(0, 4)) {
			expect(offset.offset).toBeGreaterThan(736);
			expect(offset.offset).toBeLessThan(1736);
		}
	});

	it("marca como acotado el pedido que excede el máximo scrolleable", () => {
		const offsets = probeOffsets({
			cardTops: [0, 900, 1900, 3000, 4200, 6000],
			firstCardMarginTop: 164,
			maxScroll: 1000,
			viewport: 800,
		});

		expect(offsets.map((offset) => offset.offset)).toEqual([986, 1000, 1000, 1000, 1000, 368]);
		expect(offsets.map((offset) => offset.clamped)).toEqual([false, true, true, true, true, false]);
	});

	it("la fila acotada no cuenta como ajuste ni decide el veredicto", () => {
		// Un pedido acotado con delta enorme (por el recorte) no debe leerse como «el navegador ajustó».
		const clamped = { requested: 1000, final: 783, delta: 217, clamped: true, far: false };
		const snapped = { requested: 1236, final: 736, delta: 500, clamped: false, far: false };

		expect(adjustedCount([clamped])).toBe(0);
		expect(countedRows([clamped, snapped])).toHaveLength(1);
		expect(maxAbsDelta([clamped, snapped])).toBe(500);
		expect(probeVerdict("mandatory", [clamped], [clamped])).toBe("no-adjustment");
		expect(probeVerdict("mandatory", [snapped], [clamped])).toBe("adjusted");
	});

	it("un scroller libre deja los pedidos donde estaban: delta 0", () => {
		const rows = runProbeBattery(freeScroller(), probeOffsets(GEOMETRY));

		expect(rows).toHaveLength(6);
		expect(rows.every((row) => row.delta === 0)).toBe(true);
		expect(adjustedCount(rows)).toBe(0);
	});

	it("un scroller con snapping ajusta y el delta no es 0", () => {
		const rows = runProbeBattery(snappingScroller(GEOMETRY), probeOffsets(GEOMETRY));

		// 986→736, 1236→736, 1486→1736, 1686→1736, 1936→1736, 3436→2836.
		expect(rows.map((row) => row.final)).toEqual([736, 736, 1736, 1736, 1736, 2836]);
		expect(rows.map((row) => row.delta)).toEqual([250, 500, -250, -50, 200, 600]);
		expect(adjustedCount(rows)).toBe(6);
		expect(maxAbsDelta(rows)).toBe(600);
	});

	it("una sola sonda no alcanza para la batería: el colapso rompe este test", () => {
		expect(probeOffsets(GEOMETRY).length).toBeGreaterThanOrEqual(6);
	});
});

describe("comparación entre modos", () => {
	it("acuerda sólo cuando el aterrizaje y el ajuste coinciden", () => {
		const proximity = { requested: 3436, final: 2836, delta: 600, clamped: false, far: true };
		const mandatory = { requested: 3436, final: 2836, delta: 600, clamped: false, far: true };
		const different = { requested: 3436, final: 4036, delta: -600, clamped: false, far: true };

		expect(modesAgree(proximity, mandatory)).toBe(true);
		expect(modesAgree(proximity, different)).toBe(false);
	});
});

describe("reporte y veredicto", () => {
	const context = { mode: "mandatory", scroller: "window", snapType: "y mandatory" } as const;
	const active = runProbe(snappingScroller(GEOMETRY), 1236);
	const clean = runProbe(freeScroller(), 1236);
	const brokenControl = runProbe(snappingScroller(GEOMETRY), 1236);

	it("reporta el pedido, el final, el delta, el aterrizaje y los bordes", () => {
		const report: InstrumentReport = buildReport(context, GEOMETRY, [active], [clean]);

		expect(report.rows[0].requested).toBe(1236);
		expect(report.rows[0].final).toBe(736);
		expect(report.rows[0].delta).toBe(500);
		expect(report.rows[0].before?.effectiveTop).toBe(736);
		expect(report.rows[0].after?.effectiveTop).toBe(1736);
		expect(report.rows[0].landed.effectiveTop).toBe(736);
		expect(report.firstCardMarginTop).toBe(164);
		expect(report.scroller).toBe("window");
		expect(report.snapType).toBe("y mandatory");
		expect(report.verdict).toBe("adjusted");
	});

	it("guarda la comparación con el otro modo cuando se la pasan", () => {
		const comparison = {
			mode: "proximity" as const,
			reading: { requested: 3436, final: 2836, delta: 600, clamped: false, far: true },
		};
		const report = buildReport(context, GEOMETRY, [active], [clean], comparison);

		expect(report.comparison?.mode).toBe("proximity");
		expect(report.comparison?.reading.final).toBe(2836);
	});

	it("control que se ajusta → instrumento roto, sin veredicto sobre el modo", () => {
		expect(probeVerdict("mandatory", [active], [brokenControl])).toBe("broken");
		expect(probeVerdict("proximity", [clean], [brokenControl])).toBe("broken");
		expect(probeVerdict("contained", [active], [brokenControl])).toBe("broken");
	});

	it("modo `off` que se ajusta → estado inconsistente", () => {
		expect(probeVerdict("off", [active], [clean])).toBe("inconsistent");
	});

	it("modo activo que se ajusta con control limpio → ajuste", () => {
		expect(probeVerdict("mandatory", [active], [clean])).toBe("adjusted");
		expect(probeVerdict("proximity", [active], [clean])).toBe("adjusted");
		expect(probeVerdict("contained", [active], [clean])).toBe("adjusted");
	});

	it("modo activo que no se ajusta con control limpio → sin ajuste", () => {
		expect(probeVerdict("proximity", [clean], [clean])).toBe("no-adjustment");
		expect(probeVerdict("off", [clean], [clean])).toBe("no-adjustment");
	});

	it("el veredicto roto gana sobre el modo y se nombra sin medias tintas", () => {
		const report = buildReport(context, GEOMETRY, [active], [brokenControl]);

		expect(report.verdict).toBe("broken");
		expect(verdictLabel("broken")).toBe("instrumento roto");
		expect(verdictLabel("inconsistent")).toBe("estado inconsistente");
		expect(verdictLabel("adjusted")).toBe("el scroll se ajustó");
		expect(verdictLabel("no-adjustment")).toBe("sin ajuste");
	});
});
