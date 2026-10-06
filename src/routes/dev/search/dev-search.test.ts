// Tests de la hoja `/dev/search`.
//
// El instrumento mide el DOM real en el navegador, pero jsdom **no** reproduce el ajuste del
// *scroll snapping*: un número medido acá sería falso. Por eso estos tests inyectan el instrumento
// por prop con un reporte conocido y sólo afirman que la hoja **refleja** el estado y **imprime**
// el reporte; la verificación de números reales es la corrida en navegador.
//
// La batería es de seis filas (25/50/75/95 %, salto largo y el punto más lejano). Si el instrumento
// colapsara a una sola sonda, esta prueba falla. El aviso de restauración se prueba llamando al
// callback inyectado, que es exactamente lo que haría el instrumento DOM cuando el navegador no
// deja volver a la posición anterior.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import SearchSheet from "./+page.svelte";
import type { InstrumentReport, ProbeRow, RestoreCheck, SnappingMode } from "./decisions";

const CARD_COUNT = 6;

// El stub de `$app/stores` expone `page` como store escribible; el tipo real de SvelteKit es de sólo
// lectura y se fija con un cast limitado al test (mismo patrón que `dev-error.test.ts`).
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function setUrl(search: string): void {
	pageStore.set({ params: {}, url: new URL(`http://localhost/dev/search${search}`) });
}

function target(index: number, effectiveTop: number): ProbeRow["landed"] {
	return { index, cardTop: effectiveTop + 164, effectiveTop };
}

function row(
	requested: number,
	final: number,
	landedIndex: number,
	landedTop: number,
	before: number,
	after: number,
	options: { far?: boolean; clamped?: boolean } = {},
): ProbeRow {
	return {
		requested,
		final,
		delta: requested - final,
		clamped: options.clamped ?? false,
		far: options.far ?? false,
		landed: target(landedIndex, landedTop),
		before: target(landedIndex, before),
		after: target(landedIndex + 1, after),
	};
}

// Seis filas: 25/50/75/95 % de un hueco de 1000 px (736 → 1736), un salto largo y el punto más lejano.
const FIXTURE_ROWS: ProbeRow[] = [
	row(986, 736, 1, 736, 736, 1736),
	row(1236, 736, 1, 736, 736, 1736),
	row(1486, 1736, 2, 1736, 736, 1736),
	row(1686, 1736, 2, 1736, 736, 1736),
	row(1936, 1736, 2, 1736, 1736, 2836),
	row(3436, 2836, 3, 2836, 2836, 4036, { far: true }),
];

const FIXTURE_REPORT: InstrumentReport = {
	mode: "mandatory",
	scroller: "window",
	snapType: "y mandatory",
	firstCardMarginTop: 164,
	viewport: 800,
	rows: FIXTURE_ROWS,
	controlRows: FIXTURE_ROWS.map((item) => ({ ...item, final: item.requested, delta: 0 })),
	comparison: {
		mode: "proximity",
		reading: { requested: 3436, final: 2836, delta: 600, clamped: false, far: true },
	},
	verdict: "adjusted",
	measured: true,
};

function withInstrument(report: InstrumentReport = FIXTURE_REPORT): {
	props: {
		instrument: (
			mode: SnappingMode,
			onRestoreUnstable: (check: RestoreCheck) => void,
		) => InstrumentReport;
	};
} {
	return { props: { instrument: () => report } };
}

function region(): HTMLElement {
	return screen.getByTestId("results-region");
}

function cards(): HTMLElement[] {
	return screen.getAllByTestId("sheet-card");
}

// El store persiste entre tests: cada uno arranca en una URL que despliega el panel (los controles y
// la lectura viven ahí) y con el estilo del documento limpio, porque el `$effect` de la hoja escribe
// ahí.
beforeEach(() => {
	setUrl("?panel=open");
	document.documentElement.style.scrollSnapType = "";
});

describe("hoja de búsqueda — modos de snapping", () => {
	it("arranca apagado: sin snap en el documento y sin scroller propio en la región", () => {
		render(SearchSheet, withInstrument());

		expect(document.documentElement.style.scrollSnapType).toBe("");
		expect(region()).not.toHaveClass("snap-y");
		expect(region()).not.toHaveClass("overflow-y-auto");
	});

	it("`proximity` aplica el snap al documento", async () => {
		render(SearchSheet, withInstrument());

		await fireEvent.click(screen.getByTestId("snap-proximity"));

		await waitFor(() => expect(document.documentElement.style.scrollSnapType).toBe("y proximity"));
		expect(region()).not.toHaveClass("snap-y");
	});

	it("`mandatory` aplica el snap al documento", async () => {
		render(SearchSheet, withInstrument());

		await fireEvent.click(screen.getByTestId("snap-mandatory"));

		await waitFor(() => expect(document.documentElement.style.scrollSnapType).toBe("y mandatory"));
	});

	it("`contained` mueve el snap a la región y libera el documento", async () => {
		render(SearchSheet, withInstrument());

		await fireEvent.click(screen.getByTestId("snap-contained"));

		await waitFor(() => {
			expect(region()).toHaveClass("snap-y");
			expect(region()).toHaveClass("overflow-y-auto");
			expect(document.documentElement.style.scrollSnapType).toBe("");
		});
	});

	it("cada una de las seis cards es un punto de snap", () => {
		render(SearchSheet, withInstrument());

		const wrappers = cards();
		expect(wrappers).toHaveLength(CARD_COUNT);
		for (const wrapper of wrappers) {
			expect(wrapper).toHaveClass("snap-start");
			expect(wrapper.className).toContain("scroll-mt-[calc(var(--header-h)");
		}
	});

	it("limpia el snap del documento al desmontar", async () => {
		const { unmount } = render(SearchSheet, withInstrument());

		await fireEvent.click(screen.getByTestId("snap-mandatory"));
		await waitFor(() => expect(document.documentElement.style.scrollSnapType).toBe("y mandatory"));

		unmount();
		expect(document.documentElement.style.scrollSnapType).toBe("");
	});
});

describe("hoja de búsqueda — divulgación de tags y formatos", () => {
	it("la forma `off` no monta ningún disparador de divulgación", () => {
		render(SearchSheet, withInstrument());

		expect(within(region()).queryAllByRole("button")).toHaveLength(0);
		expect(within(region()).getAllByText("+5")).toHaveLength(CARD_COUNT);
	});

	it("`title-link` monta el `<button>` real y despliega la región", async () => {
		render(SearchSheet, withInstrument());

		await fireEvent.click(screen.getByTestId("disclosure-title-link"));

		const button = within(region()).getAllByRole("button", { name: /ocultos/i })[0];
		expect(button).toHaveAttribute("aria-expanded", "false");

		await fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "true");
		expect(within(region()).getAllByText(/#docentes/).length).toBeGreaterThan(0);
	});

	it("`link-tooltip` hace del enlace de la card el disparador", async () => {
		render(SearchSheet, withInstrument());

		await fireEvent.click(screen.getByTestId("disclosure-link-tooltip"));

		const link = within(region()).getAllByRole("link")[0];
		expect(link).toHaveAttribute("data-tooltip-trigger");
		expect(link).not.toHaveAttribute("type");
	});

	it("`forceOpen` fija el estado de divulgación sin puntero", async () => {
		render(SearchSheet, withInstrument());

		await fireEvent.click(screen.getByTestId("disclosure-title-link"));
		await fireEvent.click(screen.getByTestId("force-open"));

		const button = within(region()).getAllByRole("button", { name: /ocultar|ocultos/i })[0];
		expect(button).toHaveAttribute("aria-expanded", "true");

		const regionId = button.getAttribute("aria-controls");
		const disclosure = document.getElementById(regionId ?? "");
		expect(disclosure).not.toBeNull();
		expect(disclosure?.hasAttribute("hidden")).toBe(false);
	});
});

describe("hoja de búsqueda — presets de caso", () => {
	it("cambian el set determinista de fixtures", async () => {
		render(SearchSheet, withInstrument());

		expect(within(region()).getAllByText("+5")).toHaveLength(CARD_COUNT);
		expect(within(region()).getAllByText("+2 más")).toHaveLength(CARD_COUNT);

		await fireEvent.click(screen.getByTestId("preset-tags3-format1"));
		await waitFor(() => expect(within(region()).queryByText("+5")).toBeNull());
		expect(within(region()).queryByText(/^\+\d/)).toBeNull();
		expect(cards()).toHaveLength(CARD_COUNT);

		await fireEvent.click(screen.getByTestId("preset-no-tags"));
		await waitFor(() => expect(within(region()).queryByText(/^#/)).toBeNull());
		expect(cards()).toHaveLength(CARD_COUNT);
	});
});

describe("hoja de búsqueda — estado preseleccionado por la URL", () => {
	it("?snap=contained preselecciona el contenedor propio", () => {
		setUrl("?snap=contained");
		render(SearchSheet, withInstrument());

		expect(region()).toHaveClass("snap-y");
		expect(document.documentElement.style.scrollSnapType).toBe("");
	});

	it("?disclosure=title-link&open=1 preselecciona la divulgación forzada", () => {
		setUrl("?disclosure=title-link&open=1");
		render(SearchSheet, withInstrument());

		const button = within(region()).getAllByRole("button", { name: /ocultar|ocultos/i })[0];
		expect(button).toHaveAttribute("aria-expanded", "true");
	});

	it("?case=tags3-format1 preselecciona el set de fixtures", () => {
		setUrl("?case=tags3-format1");
		render(SearchSheet, withInstrument());

		expect(within(region()).queryByText(/^\+\d/)).toBeNull();
		expect(cards()).toHaveLength(CARD_COUNT);
	});

	it("un valor inválido cae al default sin romper la hoja", () => {
		setUrl("?snap=nope&disclosure=nope&open=nope&case=nope");
		render(SearchSheet, withInstrument());

		expect(document.documentElement.style.scrollSnapType).toBe("");
		expect(region()).not.toHaveClass("snap-y");
		expect(cards()).toHaveLength(CARD_COUNT);
	});
});

describe("hoja de búsqueda — instrumento", () => {
	it("imprime la tabla de seis filas del reporte inyectado, no un número del DOM", () => {
		render(SearchSheet, withInstrument());

		expect(screen.getByTestId("instrument-scroller").textContent?.trim()).toBe("window");
		expect(screen.getByTestId("instrument-margin").textContent?.trim()).toBe("164.0 px");
		expect(screen.getByTestId("instrument-snap-type").textContent?.trim()).toBe("y mandatory");

		expect(screen.getAllByTestId(/^instrument-row-/)).toHaveLength(6);
		const first = screen.getByTestId("instrument-row-0");
		expect(first).toHaveTextContent("986.0");
		expect(first).toHaveTextContent("250.0");
		expect(first).toHaveTextContent("736.0");

		expect(screen.getByTestId("instrument-verdict").textContent?.trim()).toBe(
			"el scroll se ajustó",
		);
		expect(screen.getByTestId("instrument-control").textContent).toContain("0.0 px");
		expect(screen.getByTestId("instrument-control").textContent).toContain("0/6");
	});

	it("marca la fila más lejana y la compara con el otro modo de página", () => {
		render(SearchSheet, withInstrument());

		const farRow = screen.getByTestId("instrument-row-5");
		expect(farRow).toHaveAttribute("data-far", "true");
		expect(screen.getByTestId("instrument-far-note")).toHaveTextContent(/más lejos/i);

		const comparison = screen.getByTestId("instrument-comparison");
		expect(comparison).toHaveTextContent("proximity");
		expect(comparison).toHaveTextContent(/mismo resultado/i);
	});

	it("pinta el veredicto roto cuando el control también se ajusta", () => {
		const broken: InstrumentReport = {
			...FIXTURE_REPORT,
			controlRows: FIXTURE_ROWS.map((item) => ({ ...item, delta: -100 })),
			verdict: "broken",
		};
		render(SearchSheet, withInstrument(broken));

		const verdict = screen.getByTestId("instrument-verdict");
		expect(verdict.textContent?.trim()).toBe("instrumento roto");
		expect(verdict).toHaveClass("text-destructive");
		expect(screen.getByTestId("instrument-control").textContent).toContain("100.0 px");
		expect(screen.getByTestId("instrument-control").textContent).toContain("6/6");
	});

	it("marca las filas acotadas y no las cuenta como ajuste", () => {
		const clamped: InstrumentReport = {
			...FIXTURE_REPORT,
			rows: FIXTURE_ROWS.map((item, index) => (index === 1 ? { ...item, clamped: true } : item)),
			controlRows: FIXTURE_ROWS.map((item, index) => ({
				...item,
				clamped: index === 1,
				final: item.requested,
				delta: 0,
			})),
		};
		render(SearchSheet, withInstrument(clamped));

		const clampedRow = screen.getByTestId("instrument-row-1");
		expect(clampedRow).toHaveAttribute("data-clamped", "true");
		expect(clampedRow).toHaveTextContent("acot.");
		// El denominador del control excluye la fila acotada: 0/5, no 0/6.
		expect(screen.getByTestId("instrument-control").textContent).toContain("0/5");
	});

	it("nombra la estrictitud que Chrome omite en el `scroll-snap-type`", () => {
		render(SearchSheet, withInstrument({ ...FIXTURE_REPORT, snapType: "y" }));

		expect(screen.getByTestId("instrument-snap-type").textContent?.trim()).toBe(
			"y proximity (implícito)",
		);
	});

	it("dice que midió la región en el modo `contained`", () => {
		setUrl("?snap=contained&panel=open");
		render(
			SearchSheet,
			withInstrument({ ...FIXTURE_REPORT, mode: "contained", scroller: "region" }),
		);

		expect(screen.getByTestId("instrument-scroller").textContent?.trim()).toBe("region");
	});

	it("no mide antes de conocer el alto de la barra pegajosa", () => {
		// En jsdom `clientHeight` es 0 y no hay instrumento inyectado: la sonda no debe correr y el
		// margen impreso no puede ser uno calculado con una barra de alto 0.
		render(SearchSheet);

		expect(screen.getByTestId("instrument-waiting")).toBeInTheDocument();
		expect(screen.queryByTestId("instrument-margin")).toBeNull();
	});

	it("vuelve a medir al cambiar de modo", async () => {
		const instrument = vi.fn((_mode: SnappingMode) => FIXTURE_REPORT);
		render(SearchSheet, { props: { instrument } });

		expect(instrument).toHaveBeenCalled();
		await fireEvent.click(screen.getByTestId("snap-mandatory"));
		await waitFor(() => expect(instrument).toHaveBeenCalledWith("mandatory", expect.any(Function)));
	});

	it("fija la var del CSS con el alto de la barra leído del DOM antes de sondear", async () => {
		const seen: string[] = [];
		const instrument = () => {
			seen.push(screen.getByTestId("search-sheet").style.getPropertyValue("--results-bar-h"));
			return FIXTURE_REPORT;
		};
		render(SearchSheet, { props: { instrument } });

		// jsdom no tiene layout: se simula la altura real que el binding pudo no haber alcanzado.
		const bar = screen.getByTestId("results-bar");
		Object.defineProperty(bar, "clientHeight", { get: () => 68, configurable: true });
		seen.length = 0;
		await fireEvent.click(screen.getByTestId("measure-now"));

		// La var que rige el `scroll-margin-top` ya está fija en la **primera** pasada, no recién en
		// la re-medición posterior: si no, la sonda leería un margen que no es el del CSS.
		expect(seen[0]).toBe("68px");
	});
});

describe("hoja de búsqueda — restauración visible", () => {
	it("avisa en pantalla cuando el navegador no deja volver a la posición anterior", async () => {
		setUrl("?snap=mandatory");
		const instrument = (_mode: SnappingMode, onRestoreUnstable: (check: RestoreCheck) => void) => {
			onRestoreUnstable({ target: 0, current: 736 });
			return FIXTURE_REPORT;
		};
		render(SearchSheet, { props: { instrument } });

		const warning = await screen.findByTestId("restore-warning");
		expect(warning).toHaveTextContent(/no deja volver a la posición anterior/i);
	});

	it("no muestra el aviso cuando la posición se sostiene", () => {
		render(SearchSheet, withInstrument());

		expect(screen.queryByTestId("restore-warning")).toBeNull();
	});
});

describe("hoja de búsqueda — panel de control", () => {
	it("arranca cerrado para no cubrir una card", () => {
		setUrl("");
		render(SearchSheet, withInstrument());

		expect(screen.getByTestId("panel-toggle")).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByTestId("snap-off")).toBeNull();
	});

	it("`?panel=open` lo despliega en la carga", () => {
		setUrl("?panel=open");
		render(SearchSheet, withInstrument());

		expect(screen.getByTestId("panel-toggle")).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByTestId("snap-off")).toBeInTheDocument();
	});

	it("el interruptor lo abre y lo vuelve a cerrar", async () => {
		setUrl("");
		render(SearchSheet, withInstrument());

		await fireEvent.click(screen.getByTestId("panel-toggle"));
		await waitFor(() => expect(screen.getByTestId("snap-off")).toBeInTheDocument());

		await fireEvent.click(screen.getByTestId("panel-toggle"));
		await waitFor(() => expect(screen.queryByTestId("snap-off")).toBeNull());
	});
});

describe("hoja de búsqueda — la ruta no existe en producción", () => {
	it("deja pasar la carga en desarrollo", async () => {
		const { load } = await import("./+page");

		expect(() => load(undefined as never)).not.toThrow();
	});

	it("lanza un 404 cuando el entorno no es de desarrollo", async () => {
		vi.stubEnv("DEV", false);
		try {
			const { load } = await import("./+page");

			expect(() => load(undefined as never)).toThrowError(expect.objectContaining({ status: 404 }));
		} finally {
			vi.unstubAllEnvs();
		}
	});
});
