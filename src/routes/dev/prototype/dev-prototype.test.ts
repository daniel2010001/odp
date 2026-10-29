// Tests del índice del prototipo (`/dev/prototype`): es el mapa que se recorre para capturar cada
// pantalla en Figma, así que su propiedad útil es que **cada pantalla del inventario tenga su enlace**
// —las construidas, a su ruta real; las nuevas, a su maqueta— y que el índice diga cuál es cuál.
//
// La compuerta de producción vive en `+layout.ts` y cubre todas las maquetas de la carpeta.

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invalidateAll } from "$app/navigation";
import { page } from "$app/stores";
import { PROTOTYPE_COOKIE, PROTOTYPE_COOKIE_ON, setPrototypeModeCookie } from "$lib/prototype/mode";
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

	// S42: «Un dataset en dos colecciones» (H3-4) repetía la ficha real de la matrícula (H2-4) y salió del recorrido.
	it("no lista «Colecciones de un dataset» como pantalla del recorrido", () => {
		render(PrototypeIndex);

		expect(SCREENS.some((s) => s.href.startsWith("/dev/prototype/dataset-collections"))).toBe(
			false,
		);
		expect(screen.queryByRole("link", { name: /Colecciones de un dataset/ })).toBeNull();
		for (const link of screen.getAllByRole("link")) {
			expect(link.getAttribute("href") ?? "").not.toContain("dataset-collections");
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

// El interruptor del modo prototipo (S14): pone o quita la cookie que lee `+layout.server.ts` y vuelve a
// cargar los datos, para que todo el sitio —incluido el SSR— vea el cambio.
describe("interruptor del modo prototipo", () => {
	const pageStore = page as unknown as {
		set: (value: {
			params: Record<string, string>;
			url: URL;
			data?: Record<string, unknown>;
		}) => void;
	};

	function open(prototype: boolean) {
		pageStore.set({
			params: {},
			url: new URL("http://localhost/dev/prototype"),
			data: { prototype },
		});
		render(PrototypeIndex);
	}

	afterEach(() => {
		pageStore.set({ params: {}, url: new URL("http://localhost/") });
		setPrototypeModeCookie(false);
		vi.clearAllMocks();
	});

	it("apagado por defecto: dice «desactivado» y al pulsarlo pone la cookie y recarga los datos", async () => {
		open(false);
		const toggle = screen.getByRole("switch", { name: /Modo prototipo: desactivado/ });
		expect(toggle).toHaveAttribute("aria-checked", "false");

		await fireEvent.click(toggle);

		expect(document.cookie).toContain(`${PROTOTYPE_COOKIE}=${PROTOTYPE_COOKIE_ON}`);
		expect(invalidateAll).toHaveBeenCalledTimes(1);
	});

	it("activado: dice «activado» y al pulsarlo quita la cookie", async () => {
		setPrototypeModeCookie(true);
		open(true);
		const toggle = screen.getByRole("switch", { name: /Modo prototipo: activado/ });
		expect(toggle).toHaveAttribute("aria-checked", "true");

		await fireEvent.click(toggle);

		expect(document.cookie).not.toContain(PROTOTYPE_COOKIE);
		expect(invalidateAll).toHaveBeenCalledTimes(1);
	});
});
