// Pruebas de `overflow-tabs.ts` (el reparto y las clases) y de `OverflowTabs` (prioridad+ con «Más»). jsdom no mide
// ni resuelve container queries: los anchos se simulan (`offsetWidth` por pestaña, `clientWidth` de la fila) y los
// puntos de cambio se afirman por sus clases; los números reales se midieron en Chromium sobre las páginas.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OverflowTabs from "./OverflowTabs.svelte";
import {
	FIELD_CLASS,
	FORMS,
	fitTabs,
	labelWithCount,
	type MobileBelow,
	type OverflowItem,
} from "./overflow-tabs";

const W = [100, 100, 100, 100, 100]; // 5 pestañas de 100 px; separación 4

describe("fitTabs", () => {
	it("deja todas en la fila cuando caben, sin menú", () => {
		expect(fitTabs({ widths: W, active: 0, available: 600, moreWidth: 80 })).toEqual({
			visible: [0, 1, 2, 3, 4],
			hidden: [],
		});
	});

	it("manda al menú las que no caben, en orden, y deja sitio al botón «Más»", () => {
		// 3 pestañas = 308 + 4 + 80 = 392 ≤ 400; con 4 = 512 > 400.
		expect(fitTabs({ widths: W, active: 0, available: 400, moreWidth: 80 })).toEqual({
			visible: [0, 1, 2],
			hidden: [3, 4],
		});
	});

	it("mantiene visible la activa aunque su lugar sea el último, en su posición relativa", () => {
		const r = fitTabs({ widths: W, active: 4, available: 400, moreWidth: 80 });
		expect(r.visible).toEqual([0, 1, 4]);
		expect(r.hidden).toEqual([2, 3]);
	});

	it("no pierde ni repite ninguna pestaña, y la activa siempre está", () => {
		for (let active = 0; active < 5; active++) {
			for (const available of [0, 100, 250, 400, 520, 900]) {
				const r = fitTabs({ widths: W, active, available, moreWidth: 80 });
				expect([...r.visible, ...r.hidden].sort()).toEqual([0, 1, 2, 3, 4]);
				expect(r.visible).toContain(active);
			}
		}
	});

	it("con muy poco ancho deja sólo la activa; sin pestañas devuelve vacío", () => {
		expect(fitTabs({ widths: W, active: 2, available: 50, moreWidth: 80 })).toEqual({
			visible: [2],
			hidden: [0, 1, 3, 4],
		});
		expect(fitTabs({ widths: [], active: -1, available: 300, moreWidth: 80 })).toEqual({
			visible: [],
			hidden: [],
		});
	});

	it("el botón reducido deja más sitio a las pestañas", () => {
		const full = fitTabs({ widths: W, active: 0, available: 400, moreWidth: 116 });
		const compact = fitTabs({ widths: W, active: 0, available: 400, moreWidth: 56 });
		expect(compact.visible.length).toBeGreaterThanOrEqual(full.visible.length);
	});
});

describe("labelWithCount", () => {
	it("agrega el conteo entre paréntesis y sólo si lo hay", () => {
		expect(labelWithCount({ id: "a", label: "Todas", count: 4 })).toBe("Todas (4)");
		expect(labelWithCount({ id: "a", label: "Todas" })).toBe("Todas");
		expect(labelWithCount({ id: "a", label: "Todas", count: 4 }, (n) => `${n} pendientes`)).toBe(
			"Todas (4 pendientes)",
		);
	});
});

describe("FORMS", () => {
	it("cada punto de cambio escribe sus clases con su propio prefijo, sin mezclar", () => {
		const prefix: Record<MobileBelow, string> = { "32rem": "@lg:", "611px": "@min-[611px]:" };
		for (const key of Object.keys(FORMS) as MobileBelow[]) {
			const other = prefix[key === "32rem" ? "611px" : "32rem"];
			for (const [name, classes] of Object.entries(FORMS[key])) {
				expect(classes, `${key}.${name}`).toContain(prefix[key]);
				expect(classes, `${key}.${name}`).not.toContain(other);
			}
		}
	});

	it("el campo angosto fija 44 px, borde, radio y tipografía en una sola clase", () => {
		for (const token of ["h-11", "rounded-md", "border-input", "text-sm", "font-medium", "pr-9"])
			expect(FIELD_CLASS.split(" ")).toContain(token);
	});
});

// ─── El componente ────────────────────────────────────────────────

const items = (n: number): OverflowItem[] =>
	Array.from({ length: n }, (_, i) => ({
		id: `t${i}`,
		label: `Pestaña ${i}`,
		count: i === 1 ? 4 : undefined,
	}));

let available = 400;
let observers: (() => void)[] = [];
const originals: Record<string, PropertyDescriptor | undefined> = {};

beforeEach(() => {
	available = 400;
	observers = [];
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(private cb: () => void) {}
			observe() {
				observers.push(this.cb);
			}
			unobserve() {}
			disconnect() {}
		},
	);
	for (const name of ["offsetWidth", "clientWidth"])
		originals[name] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
	Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
		configurable: true,
		get(this: HTMLElement) {
			if (this.hasAttribute("data-m-more")) return 80;
			return this.hasAttribute("data-m") ? 100 : 0;
		},
	});
	Object.defineProperty(HTMLElement.prototype, "clientWidth", {
		configurable: true,
		get(this: HTMLElement) {
			return this.hasAttribute("data-overflow-host") ? available : 0;
		},
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	for (const [name, original] of Object.entries(originals)) {
		if (original) Object.defineProperty(HTMLElement.prototype, name, original);
		else Reflect.deleteProperty(HTMLElement.prototype, name);
	}
});

function mount(props: Partial<{ n: number; value: string; mobileBelow: MobileBelow }> = {}) {
	const onchange = vi.fn();
	const view = render(OverflowTabs, {
		items: items(props.n ?? 6),
		value: props.value ?? "t0",
		onchange,
		label: "Vistas",
		...(props.mobileBelow ? { mobileBelow: props.mobileBelow } : {}),
	});
	return { onchange, ...view };
}

const tabNames = () =>
	screen.getAllByRole("tab").map((t) => t.textContent?.replace(/\s+/g, " ").trim());
const more = () => screen.queryByRole("button", { name: /^Más vistas/ });

describe("OverflowTabs — fondo de la barra pegada (P18, S49)", () => {
	const bar = () => screen.getByRole("tablist").closest("[data-hidden]") as HTMLElement;

	it("sin clase propia la barra tiene el fondo de la página, para no dejar ver lo que pasa por debajo", () => {
		mount();
		expect(bar().className).toContain("bg-background");
	});

	it("el fondo de quien la usa reemplaza al de la página (la cola de solicitudes va sobre una tarjeta)", () => {
		render(OverflowTabs, {
			items: items(3),
			value: "t0",
			onchange: vi.fn(),
			label: "Vistas",
			class: "bg-card",
		});
		expect(bar().className).toContain("bg-card");
		expect(bar().className).not.toContain("bg-background");
	});
});

describe("OverflowTabs — prioridad+", () => {
	it("con todas a la vista no hay «Más»", async () => {
		available = 2000;
		mount();
		await waitFor(() => expect(tabNames()).toHaveLength(6));
		expect(more()).toBeNull();
	});

	it("reparte: las que caben se quedan y el resto va a «Más (n)», con el conteo en su nombre", async () => {
		mount({ n: 6 }); // 3 caben en 400 px: 308 + 4 + 80
		await waitFor(() => expect(tabNames()).toHaveLength(3));
		expect(tabNames()).toEqual(["Pestaña 0", "Pestaña 1 4", "Pestaña 2"]);
		const trigger = more() as HTMLElement;
		expect(trigger).toHaveAttribute("aria-label", "Más vistas: 3 más");
		expect(trigger).toHaveTextContent("Más (3)");
	});

	it("la pestaña activa siempre queda a la vista, aunque sea la última", async () => {
		mount({ n: 6, value: "t5" });
		await waitFor(() => expect(tabNames()).toContain("Pestaña 5"));
		expect(screen.getByRole("tab", { name: "Pestaña 5" })).toHaveAttribute("data-state", "active");
		expect(tabNames()).toHaveLength(3);
	});

	it("«Más» lista las pestañas escondidas, en orden, y elegir una avisa su id", async () => {
		const { onchange } = mount({ n: 6 });
		await waitFor(() => expect(more()).not.toBeNull());
		await fireEvent.keyDown(more() as HTMLElement, { key: "Enter" });
		const menu = await screen.findByRole("menu");
		const entries = within(menu).getAllByRole("menuitem");
		expect(entries.map((e) => e.textContent?.trim())).toEqual([
			"Pestaña 3",
			"Pestaña 4",
			"Pestaña 5",
		]);
		await fireEvent.click(entries[1]);
		expect(onchange).toHaveBeenCalledWith("t4");
	});

	it("el teclado: desde la última visible la flecha derecha llega a «Más» y la izquierda vuelve", async () => {
		mount({ n: 6 });
		await waitFor(() => expect(more()).not.toBeNull());
		const last = screen.getByRole("tab", { name: "Pestaña 2" });
		last.focus();
		await fireEvent.keyDown(last, { key: "ArrowRight" });
		expect(more()).toHaveFocus();
		await fireEvent.keyDown(more() as HTMLElement, { key: "ArrowLeft" });
		expect(last).toHaveFocus();
	});

	it("la fila de medición no se ve ni se enfoca y no duplica pestañas para los lectores", async () => {
		mount({ n: 6 });
		await waitFor(() => expect(more()).not.toBeNull());
		const medicion = document.querySelector("[data-m]")?.parentElement as HTMLElement;
		expect(medicion).toHaveAttribute("aria-hidden", "true");
		expect(medicion).toHaveAttribute("inert");
		expect(screen.getAllByRole("tab")).toHaveLength(3);
	});

	it("la forma angosta es un desplegable con todas las pestañas y el campo de 44 px", async () => {
		mount({ n: 6, value: "t2" });
		const trigger = screen.getByRole("button", { name: "Vistas" });
		expect(trigger).toHaveTextContent("Pestaña 2");
		for (const token of FIELD_CLASS.split(" ")) expect(trigger.className).toContain(token);
		expect(trigger.parentElement?.className).toContain("@lg:hidden");
	});

	it.each([
		["32rem", "@lg:hidden", "@lg:block"],
		["611px", "@min-[611px]:hidden", "@min-[611px]:block"],
	] as const)("mobileBelow=%s: el desplegable se oculta y las pestañas aparecen con %s", async (below, hide, show) => {
		mount({ mobileBelow: below });
		const trigger = screen.getByRole("button", { name: "Vistas" });
		expect(trigger.parentElement?.className).toContain(hide);
		const tablist = screen.getByRole("tablist", { name: "Vistas" });
		expect(tablist.closest("[data-list]")?.parentElement?.className).toContain(show);
	});

	it("la fila lleva `leading` al extremo izquierdo y `trailing` al derecho", async () => {
		const { createRawSnippet } = await import("svelte");
		render(OverflowTabs, {
			items: items(3),
			value: "t0",
			onchange: () => {},
			label: "Vistas",
			leading: createRawSnippet(() => ({ render: () => "<span>4 solicitudes</span>" })),
			trailing: createRawSnippet(() => ({ render: () => "<span>Mostrar</span>" })),
		});
		const bar = screen.getByTestId("tabs-bar");
		const kids = [...bar.children].map((c) => c.textContent?.trim());
		expect(kids[0]).toBe("4 solicitudes");
		expect(kids[kids.length - 1]).toBe("Mostrar");
		expect(bar.className).not.toMatch(/flex-col|flex-row/);
		expect(bar.className).toContain("@lg:flex-nowrap");
	});
});
