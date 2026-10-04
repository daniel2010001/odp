// Tests del resolvedor de fondo efectivo del instrumento de `/dev/error`.
//
// El instrumento mide el contraste de un texto contra el fondo que realmente ve el ojo: el propio
// `background-color` del nodo, compuesto con los ancestros cuando tiene alfa. En un navegador real
// Tailwind v4 emite `bg-destructive/10` como `color-mix(in oklab, … 10%, transparent)`, que Chromium
// serializa a `oklab(… / 0.1)`; el resolvedor tiene que componerlo, no saltarlo.
//
// En jsdom no corre la hoja de estilos, pero `getComputedStyle` sí devuelve el `background-color`
// que se ponga por estilo inline: por eso estos tests son de verdad y no de un mock.

import { describe, expect, it } from "vitest";
import { resolveEffectiveBackground } from "./background";

/** Crea un `div` con el fondo inline dado y lo cuelga del padre indicado (por defecto, `body`). */
function node(backgroundColor: string, parent: HTMLElement = document.body): HTMLDivElement {
	const element = document.createElement("div");
	if (backgroundColor !== "") element.style.backgroundColor = backgroundColor;
	parent.appendChild(element);
	return element;
}

describe("resolveEffectiveBackground — composición", () => {
	it("compone un propio fondo con alfa sobre el ancestro opaco", () => {
		const card = node("#fdfdfe");
		const pill = node("oklab(0.55 0.0869333 0.0232937 / 0.1)", card);

		const result = resolveEffectiveBackground(pill);

		expect(result.composed).toBe(true);
		expect(result.unreadable).toEqual([]);
		expect(result.hex).toBe("#f4edee");
		expect(result.color).toBe("rgb(244, 237, 238)");
	});

	it("un fondo propio opaco no se compone ni toma el del padre", () => {
		const parent = node("#ffffff");
		const child = node("#123456", parent);

		const result = resolveEffectiveBackground(child);

		expect(result.composed).toBe(false);
		expect(result.unreadable).toEqual([]);
		expect(result.hex).toBe("#123456");
	});

	it("compone una cadena de tres alfas en el orden correcto", () => {
		// negro opaco → rojo 0.5 → azul 0.5. Componer al revés daría otro color.
		const bottom = node("#000000");
		const middle = node("rgba(255, 0, 0, 0.5)", bottom);
		const top = node("rgba(0, 0, 255, 0.5)", middle);

		const result = resolveEffectiveBackground(top);

		expect(result.composed).toBe(true);
		// rojo 0.5 sobre negro = (127.5, 0, 0); azul 0.5 sobre eso = (63.75, 0, 127.5) → #400080.
		expect(result.hex).toBe("#400080");
	});

	it("sin ningún fondo declarado asume el lienzo blanco", () => {
		const bare = node("");

		const result = resolveEffectiveBackground(bare);

		expect(result.composed).toBe(false);
		expect(result.unreadable).toEqual([]);
		expect(result.hex).toBe("#ffffff");
	});
});

describe("resolveEffectiveBackground — fondos no medibles", () => {
	it("acumula el background-color que no puede parsear en vez de saltarlo", () => {
		// jsdom deja `lab()` sin resolver (a diferencia de `color-mix`, que sí resuelve a oklab):
		// representa el caso en que el navegador declara un fondo que el parser no entiende.
		const parent = node("lab(50 40 59.5)");
		const child = node("rgba(0, 0, 0, 0)", parent);

		const result = resolveEffectiveBackground(child);

		expect(result.unreadable).toEqual(["lab(50 40 59.5)"]);
	});

	it("no marca como no medible un fondo transparente", () => {
		const parent = node("rgba(0, 0, 0, 0)");
		const child = node("", parent);

		const result = resolveEffectiveBackground(child);

		expect(result.unreadable).toEqual([]);
	});
});
