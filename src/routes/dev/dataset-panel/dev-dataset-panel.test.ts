// Tests del playground del panel derecho de la ficha (`/dev/dataset-panel`, S17 de
// `odd/tasks/prototype-presentation.md`): la propiedad útil es que el autor vea, sin iniciar sesión, cada
// combinación de tarjetas de la columna lateral y compare el orden de hoy contra la propuesta, el panel que
// obliga a bajar la página contra el que se desplaza solo, el historial completo contra el plegado, y el
// botón de copiar el enlace junto al título de hoy contra el unificado. El estado sale de la URL, así que
// cada test fija la suya.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`.

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import DatasetPanelPlayground from "./+page.svelte";

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function at(query: string) {
	pageStore.set({ params: {}, url: new URL(`http://localhost/dev/dataset-panel${query}`) });
}

function aside(): HTMLElement {
	const found = screen.getByTestId("dataset-page").querySelector("aside");
	if (!found) throw new Error("no hay columna lateral");
	return found as HTMLElement;
}

/** Los títulos (la línea en mayúsculas) de las tarjetas de la columna lateral, en el orden del DOM. */
function asideTitles(): string[] {
	return Array.from(aside().children).map(
		(card) => card.querySelector("p")?.textContent?.trim() ?? "",
	);
}

afterEach(() => at(""));

describe("playground del panel — los casos", () => {
	it("«Todas las tarjetas» es el caso por defecto y muestra las cinco a la vez", () => {
		at("");
		render(DatasetPanelPlayground);

		expect(asideTitles()).toEqual([
			"Solicitud de publicación",
			"Citar como",
			"Resumen",
			"Historial de solicitudes",
			"Organización",
		]);
		const history = within(aside()).getByTestId("historial-solicitudes");
		expect(within(history).getAllByTestId("historial-entrada")).toHaveLength(4);
		expect(history).toHaveTextContent("Motivo del rechazo");
		expect(history).toHaveTextContent("Aprobada");
		expect(history).toHaveTextContent("Pendiente");
	});

	it("«Visitante»: dataset publicado, sin solicitud y sin historial", () => {
		at("?caso=visitante");
		render(DatasetPanelPlayground);

		expect(asideTitles()).toEqual(["Citar como", "Resumen", "Organización"]);
		expect(screen.queryByTestId("estado-solicitud")).toBeNull();
		expect(screen.queryByTestId("historial-solicitudes")).toBeNull();
	});

	it("«Editor con solicitud pendiente»: la tarjeta de la solicitud y el historial, sin decidir", () => {
		at("?caso=editor");
		render(DatasetPanelPlayground);

		expect(screen.getByTestId("estado-solicitud")).toHaveTextContent("Pendiente de revisión");
		expect(screen.getByTestId("historial-solicitudes")).toBeTruthy();
		expect(within(aside()).queryByRole("button", { name: /Aprobar/ })).toBeNull();
	});

	it("«Publicado, con sesión»: el historial sin la tarjeta de la solicitud", () => {
		at("?caso=publicado");
		render(DatasetPanelPlayground);

		expect(screen.queryByTestId("estado-solicitud")).toBeNull();
		const history = screen.getByTestId("historial-solicitudes");
		expect(within(history).getAllByTestId("historial-entrada")).toHaveLength(2);
		expect(asideTitles()).toEqual([
			"Citar como",
			"Resumen",
			"Historial de solicitudes",
			"Organización",
		]);
	});

	it("un preset del panel cambia el caso", async () => {
		at("");
		render(DatasetPanelPlayground);

		await fireEvent.click(screen.getByTestId("preset-visitante"));
		expect(screen.queryByTestId("historial-solicitudes")).toBeNull();
	});
});

describe("playground del panel — el orden", () => {
	it("«Propuesta»: solicitud, Resumen, Organización, Citar como y el historial al final", () => {
		at("?orden=propuesta");
		render(DatasetPanelPlayground);

		expect(asideTitles()).toEqual([
			"Solicitud de publicación",
			"Resumen",
			"Organización",
			"Citar como",
			"Historial de solicitudes",
		]);
	});

	it("el interruptor está en la sección del panel y reordena las tarjetas", async () => {
		at("");
		render(DatasetPanelPlayground);

		const toggle = within(screen.getByTestId("aside-toggles")).getByTestId("toggle-orden");
		await fireEvent.click(within(toggle).getByRole("button", { name: "Propuesta" }));
		expect(asideTitles()[1]).toBe("Resumen");
		expect(asideTitles().at(-1)).toBe("Historial de solicitudes");
	});
});

describe("playground del panel — el desplazamiento", () => {
	const OWN_HEIGHT = "lg:max-h-[calc(100dvh-var(--header-h-min)-1px-2*var(--sticky-air))]";

	it("«Como hoy»: la columna es pegajosa y no tiene desplazamiento propio", () => {
		at("?panel=hoy");
		render(DatasetPanelPlayground);

		const classes = Array.from(aside().classList);
		expect(classes).toContain("lg:sticky");
		expect(classes).not.toContain("lg:overflow-y-auto");
		expect(classes).not.toContain(OWN_HEIGHT);
	});

	it("«Scroll propio»: sigue pegajosa, con un alto que sigue a la ventana y su propio desplazamiento", () => {
		at("?panel=propio");
		render(DatasetPanelPlayground);

		const classes = Array.from(aside().classList);
		expect(classes).toContain("lg:sticky");
		expect(classes).toContain(OWN_HEIGHT);
		expect(classes).toContain("lg:overflow-y-auto");
		expect(classes).toContain("lg:overscroll-contain");
	});

	it("el interruptor del panel cambia el desplazamiento", async () => {
		at("");
		render(DatasetPanelPlayground);

		const toggle = within(screen.getByTestId("aside-toggles")).getByTestId("toggle-panel");
		await fireEvent.click(within(toggle).getByRole("button", { name: "Scroll propio" }));
		expect(Array.from(aside().classList)).toContain("lg:overflow-y-auto");
	});

	it("«Historial plegado» deja sólo la última solicitud a la vista", () => {
		at("?historial=plegado");
		render(DatasetPanelPlayground);

		const history = screen.getByTestId("historial-solicitudes");
		const rows = within(history).getAllByTestId("historial-entrada");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toHaveTextContent("Pendiente");
		expect(within(history).getByRole("button", { name: "Ver 3 más" })).toBeTruthy();
	});

	it("el instrumento muestra el alto del panel y el alto disponible", () => {
		at("");
		render(DatasetPanelPlayground);

		const instrument = screen.getByTestId("aside-instrument");
		expect(instrument).toHaveTextContent("Alto del panel");
		expect(instrument).toHaveTextContent("Alto disponible");
		expect(instrument).toHaveTextContent("Fuera de la vista");
	});
});

describe("playground del panel — el botón de copiar el enlace", () => {
	/** La fila del título que acompaña al botón: el primer ancestro que contiene un título. */
	function rowOf(anchor: HTMLElement): HTMLElement {
		let el = anchor.parentElement;
		while (el && !el.querySelector("p, h2")) el = el.parentElement;
		if (!el) throw new Error("el botón no está junto a ningún título");
		return el;
	}

	/** Los botones de copiar el enlace de una tarjeta (los de una fila de «Resumen» no son de tarjeta). */
	function cardAnchors(): HTMLElement[] {
		return screen
			.getAllByRole("button", { name: /^Copiar enlace a la sección / })
			.filter((button) => !/Licencia|Términos/.test(button.getAttribute("aria-label") ?? ""));
	}

	it("«Como hoy»: a la izquierda va junto al segundo título y aparece con el título", () => {
		at("?ancla=hoy");
		render(DatasetPanelPlayground);

		const resources = screen.getByRole("button", { name: "Copiar enlace a la sección Recursos" });
		expect(rowOf(resources).querySelector("h2")).toBeTruthy();
		expect(resources.className).toContain("group-hover/ancla:opacity-100");
	});

	it("«Unificado»: en las dos columnas va junto a la línea del título y aparece con toda la tarjeta", () => {
		at("?ancla=unificado");
		render(DatasetPanelPlayground);

		const anchors = cardAnchors();
		// Recursos, Información técnica, Citar como, Resumen, Historial y Organización.
		expect(anchors).toHaveLength(6);
		for (const anchor of anchors) {
			const row = rowOf(anchor);
			const eyebrow = row.querySelector("p");
			expect(eyebrow?.className).toContain("uppercase");
			expect(row.querySelector("h2")).toBeNull();
			expect(anchor.className).toContain("group-hover/tarjeta:opacity-100");
			expect(anchor.className).toContain("group-focus-within/tarjeta:opacity-100");
			expect(anchor.className).toContain("focus-visible:opacity-100");
			expect(anchor.closest(".group\\/tarjeta")).toBeTruthy();
		}
	});
});

describe("playground del panel — la ruta no existe en producción", () => {
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
