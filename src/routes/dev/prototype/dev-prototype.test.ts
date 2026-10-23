// Tests del índice del prototipo (`/dev/prototype`): es el mapa que se recorre para capturar cada
// pantalla en Figma, así que su propiedad útil es que **cada pantalla del inventario tenga su enlace**
// —las construidas, a su ruta real; las nuevas, a su maqueta— y que el índice diga cuál es cuál.
//
// La compuerta de producción vive en `+layout.ts` y cubre todas las maquetas de la carpeta.

import { render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { load } from "./+layout";
import PrototypeIndex from "./+page.svelte";
import { SCREENS } from "./screens";

describe("índice del prototipo", () => {
	it("enlaza cada pantalla construida a su ruta real", () => {
		render(PrototypeIndex);
		const built = screen.getByTestId("prototype-built");

		for (const item of SCREENS.filter((s) => s.kind === "built")) {
			const link = within(built).getByRole("link", { name: new RegExp(`^${item.title}$`) });
			expect(link.getAttribute("href")).toBe(item.href);
			expect(item.href.startsWith("/dev/")).toBe(false);
		}
	});

	it("enlaza cada pantalla nueva a su maqueta bajo /dev/prototype", () => {
		render(PrototypeIndex);
		const mock = screen.getByTestId("prototype-mock");

		for (const item of SCREENS.filter((s) => s.kind === "mock")) {
			const link = within(mock).getByRole("link", { name: new RegExp(`^${item.title}$`) });
			expect(link.getAttribute("href")).toMatch(/^\/dev\/prototype\/[a-z-]+$/);
		}
	});

	it("rotula las maquetas como pantallas sin funcionamiento", () => {
		render(PrototypeIndex);
		expect(screen.getByTestId("prototype-mock")).toHaveTextContent(/sin funcionamiento/i);
	});
});

describe("compuerta de producción", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("responde 404 fuera de desarrollo", () => {
		vi.stubEnv("DEV", false);
		expect(() => load({} as Parameters<typeof load>[0])).toThrow();
		try {
			load({} as Parameters<typeof load>[0]);
		} catch (err) {
			expect((err as { status: number }).status).toBe(404);
		}
	});

	it("deja pasar en desarrollo", () => {
		vi.stubEnv("DEV", true);
		expect(() => load({} as Parameters<typeof load>[0])).not.toThrow();
	});
});
