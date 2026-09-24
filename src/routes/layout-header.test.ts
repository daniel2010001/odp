import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/svelte";
import { createRawSnippet, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import Layout from "./+layout.svelte";

// Esta suite es el ancla anti-deriva del alto del encabezado. La propiedad no se puede verificar en
// jsdom —no hay layout, `getBoundingClientRect` da 0 y tampoco hay media queries—, así que la
// propiedad que SÍ se puede anclar es la estructural: una sola fuente, y todos los offsets pegados
// consumiéndola. Es lo que la entrada `[v1]` del backlog pedía cuando decía que la
// desincronización «nada lo detecta».
const routesDir = dirname(fileURLToPath(import.meta.url));
const source = (relative: string) => readFileSync(join(routesDir, relative), "utf8");

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

const children = createRawSnippet(() => ({ render: () => "Contenido" }));

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
});

describe("Header (layout)", () => {
	it("muestra 'Iniciar Sesión' hacia /auth/login cuando el usuario es anónimo", () => {
		render(Layout, { children });

		const link = screen.getByRole("link", { name: "Iniciar Sesión" });
		expect(link).toHaveAttribute("href", "/auth/login");
	});

	it("muestra el menú de usuario cuando hay sesión autenticada", () => {
		auth.login("tok-123", baseUser);

		render(Layout, { children });

		expect(screen.getByText("Jane Doe")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "Iniciar Sesión" })).not.toBeInTheDocument();
	});

	afterEach(() => {
		document.documentElement.removeAttribute("data-header-shrunk");
		vi.unstubAllGlobals();
	});
});

describe("Alto del encabezado: una sola fuente", () => {
	it("el token tiene exactamente dos estados, y cada uno en el selector que le corresponde", () => {
		const css = readFileSync(join(routesDir, "..", "app.css"), "utf8");

		// Declararlo dentro de `.dark` deja al modo claro SIN el token: `var(--header-h)` queda
		// inválido, el `height` cae a `auto` (el encabezado mide la mitad) y cada `top:` cae a
		// `auto` (todos los pegados se rompen). Pasó exactamente eso el 2026-09-24, y las
		// verificaciones de entonces no lo vieron porque contaban apariciones en vez de mirar el
		// selector que las contiene. Estas aserciones son esa mirada, una por estado.
		const rootBlocks = css.match(/:root\s*\{([^}]*)\}/gs) ?? [];
		const darkBlocks = css.match(/\.dark\s*\{([^}]*)\}/gs) ?? [];
		const shrunkBlocks = css.match(/\[data-header-shrunk\][^{]*\{([^}]*)\}/gs) ?? [];

		expect(rootBlocks.some((block) => /--header-h\s*:/.test(block))).toBe(true);
		expect(darkBlocks.some((block) => /--header-h\s*:/.test(block))).toBe(false);
		expect(shrunkBlocks.some((block) => /--header-h\s*:/.test(block))).toBe(true);
		expect(css.match(/--header-h\s*:/g) ?? []).toHaveLength(2);
	});

	it("el estado achicado es más chico que el del tope: si no, el encabezado crecería al scrollear", () => {
		const css = readFileSync(join(routesDir, "..", "app.css"), "utf8");
		const remOf = (pattern: RegExp) => {
			const match = (css.match(pattern) ?? []).join(" ").match(/--header-h\s*:\s*([\d.]+)rem/);
			return match ? Number(match[1]) : undefined;
		};

		const base = remOf(/:root\s*\{([^}]*)\}/gs);
		const shrunk = remOf(/\[data-header-shrunk\][^{]*\{([^}]*)\}/gs);

		expect(base).toBeDefined();
		expect(shrunk).toBeDefined();
		expect(shrunk as number).toBeLessThan(base as number);
	});

	it("el encabezado deriva su alto del token y no de un literal", () => {
		const layout = source("+layout.svelte");

		expect(layout).toContain("h-[var(--header-h)]");
		expect(layout).not.toMatch(/\bh-20\b/);
	});

	it("el encabezado lleva el hook que el panel mide para su barra pegajosa", () => {
		// Sin este atributo, `headerHeightPx()` devuelve 0 y la barra aparece en el momento
		// equivocado: el fallo es silencioso, así que se ancla acá.
		expect(source("+layout.svelte")).toContain("data-site-header");
	});

	it("cada offset pegado consume el token", () => {
		const consumers = [
			["dashboard/+page.svelte", "la barra de acciones"],
			["search/+page.svelte", "la barra de resultados"],
			["dataset/[id]/+page.svelte", "el panel de la ficha del dataset"],
			["dashboard/datasets/new/+page.svelte", "el panel del asistente"],
		] as const;

		for (const [file, description] of consumers) {
			expect(source(file), description).toContain("var(--header-h)");
		}
	});

	it("los literales que causaban la desincronización ya no están", () => {
		expect(source("search/+page.svelte")).not.toContain("top-[81px]");
		expect(source("dashboard/+page.svelte")).not.toMatch(/const\s+HEADER_PX\b/);
		expect(source("dataset/[id]/+page.svelte")).not.toMatch(/lg:top-24\b/);
		expect(source("dashboard/datasets/new/+page.svelte")).not.toMatch(/lg:top-24\b/);
	});
});

/**
 * Controlador de un `IntersectionObserver` de mentira: jsdom no trae ninguno, y el callback es código
 * nuestro, así que se puede conducir la decisión sin navegador.
 */
function fakeIntersectionObserver() {
	let callback: IntersectionObserverCallback | undefined;

	class FakeIntersectionObserver {
		constructor(cb: IntersectionObserverCallback) {
			callback = cb;
		}
		observe() {}
		unobserve() {}
		disconnect() {}
		takeRecords() {
			return [];
		}
	}

	vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

	return (isIntersecting: boolean) =>
		callback?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
}

describe("El encabezado se achica cuando la página deja el tope", () => {
	it("hay un centinela en el tope: sin él el observer no tiene qué observar", () => {
		render(Layout, { children });

		expect(document.querySelector("[data-header-sentinel]")).not.toBeNull();
	});

	it("al salir del tope marca el documento, y al volver lo desmarca", async () => {
		const notify = fakeIntersectionObserver();

		render(Layout, { children });
		await tick();

		expect(document.documentElement.hasAttribute("data-header-shrunk")).toBe(false);

		notify(false);
		await tick();
		expect(document.documentElement.hasAttribute("data-header-shrunk")).toBe(true);

		notify(true);
		await tick();
		expect(document.documentElement.hasAttribute("data-header-shrunk")).toBe(false);
	});

	it("el estado achicado va en el documento, no en el encabezado: los otros pegados también lo leen", async () => {
		const notify = fakeIntersectionObserver();

		render(Layout, { children });
		await tick();
		notify(false);
		await tick();

		// Si el atributo viviera en el `<header>`, la variable no llegaría a los pegados que son
		// hermanos suyos, y se desincronizarían igual que antes de E2.
		expect(document.querySelector("header")?.hasAttribute("data-header-shrunk")).toBe(false);
		expect(document.documentElement.hasAttribute("data-header-shrunk")).toBe(true);
	});
});
