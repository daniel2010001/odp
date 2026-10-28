// La compuerta del modo prototipo (S14 de `odd/tasks/prototype-presentation.md`): una sola fuente para el
// encabezado, la ficha del dataset, el panel y la ficha de la organización. Nunca en producción y apagada
// por defecto en desarrollo.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
	isPrototypeMode,
	PROTOTYPE_COOKIE,
	PROTOTYPE_COOKIE_ON,
	resolvePrototypeMode,
	setPrototypeModeCookie,
} from "./mode";

afterEach(() => {
	vi.unstubAllEnvs();
	setPrototypeModeCookie(false);
});

describe("resolvePrototypeMode (servidor)", () => {
	it("es falso fuera de desarrollo, aunque la cookie esté puesta", () => {
		expect(resolvePrototypeMode(false, PROTOTYPE_COOKIE_ON)).toBe(false);
	});

	it("en desarrollo está apagado por defecto", () => {
		expect(resolvePrototypeMode(true, undefined)).toBe(false);
		expect(resolvePrototypeMode(true, "otra-cosa")).toBe(false);
	});

	it("en desarrollo y con la cookie puesta, está activado", () => {
		expect(resolvePrototypeMode(true, PROTOTYPE_COOKIE_ON)).toBe(true);
	});
});

describe("isPrototypeMode (páginas)", () => {
	it("lee el dato que entregó el layout raíz", () => {
		expect(isPrototypeMode({ prototype: true })).toBe(true);
		expect(isPrototypeMode({ prototype: false })).toBe(false);
		expect(isPrototypeMode({})).toBe(false);
		expect(isPrototypeMode(undefined)).toBe(false);
	});

	it("es falso fuera de desarrollo, aunque el dato diga lo contrario", () => {
		vi.stubEnv("DEV", false);
		expect(isPrototypeMode({ prototype: true })).toBe(false);
	});
});

describe("setPrototypeModeCookie (interruptor)", () => {
	it("pone la cookie para todo el sitio y la quita al apagar", () => {
		setPrototypeModeCookie(true);
		expect(document.cookie).toContain(`${PROTOTYPE_COOKIE}=${PROTOTYPE_COOKIE_ON}`);

		setPrototypeModeCookie(false);
		expect(document.cookie).not.toContain(PROTOTYPE_COOKIE);
	});
});
