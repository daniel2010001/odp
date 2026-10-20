import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor } from "@testing-library/svelte";
import { createRawSnippet, tick } from "svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import Layout from "./+layout.svelte";

// La sonda de sesión vive en `$lib/api/session`; acá se la reemplaza por un doble controlable para
// decidir «viva», «muerta» o «no llamada» sin red. `$lib/env` también se reemplaza: el layout lo
// importa para armar el cliente, y `$env/static/public` no resuelve en Vitest.
const sessionMock = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock("$lib/api/session", () => ({
	createSessionApi: () => ({ check: sessionMock.check }),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "" } }));

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

/** Lo que `+layout.server.ts` entrega: el usuario de la sesión (nunca el token) o `null` si es anónimo. */
const sessionUser = { id: "u-1", name: "jdoe", displayName: "Jane Doe", sysadmin: false };
const anonymousData = { sessionUser: null };
const signedInData = { sessionUser };

const children = createRawSnippet(() => ({ render: () => "Contenido" }));

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
	// Por defecto la sonda confirma una sesión viva: los tests del alto del encabezado renderizan
	// anónimos (no sondean) y los autenticados no deben perder su nombre por accidente.
	sessionMock.check.mockResolvedValue({ state: "alive", user: baseUser });
});

describe("Header (layout)", () => {
	it("muestra 'Iniciar Sesión' hacia /auth/login cuando el usuario es anónimo", () => {
		render(Layout, { children, data: anonymousData });

		const link = screen.getByRole("link", { name: "Iniciar Sesión" });
		expect(link).toHaveAttribute("href", "/auth/login");
	});

	it("muestra el menú de usuario cuando el servidor entrega una sesión", () => {
		render(Layout, { children, data: signedInData });

		expect(screen.getByText("Jane Doe")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "Iniciar Sesión" })).not.toBeInTheDocument();
	});

	it("adopta al usuario del servidor en el store, sin token", () => {
		render(Layout, { children, data: signedInData });

		expect(get(auth).user).toMatchObject({ id: "u-1", name: "jdoe", sysadmin: false });
		expect(get(auth)).not.toHaveProperty("token");
	});

	it("si el servidor no tiene sesión, manda el servidor: lo que el store tenía se cierra", () => {
		auth.setUser(baseUser);

		render(Layout, { children, data: anonymousData });

		expect(screen.getByRole("link", { name: "Iniciar Sesión" })).toBeInTheDocument();
		expect(get(auth).user).toBeNull();
	});

	afterEach(() => {
		document.documentElement.removeAttribute("data-header-shrunk");
		vi.unstubAllGlobals();
	});
});

describe("El encabezado sondea la sesión guardada", () => {
	it("una sesión muerta se termina localmente: pasa a anónimo y no navega", async () => {
		sessionMock.check.mockResolvedValue({ state: "dead" });

		render(Layout, { children, data: signedInData });

		await waitFor(() => expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument());
		expect(screen.getByRole("link", { name: "Iniciar Sesión" })).toHaveAttribute(
			"href",
			"/auth/login",
		);
		expect(get(auth).user).toBeNull();
		// El encabezado termina la sesión, no expulsa: en una página pública nadie debe rebotar al login.
		expect(goto).not.toHaveBeenCalled();
	});

	it("una sesión viva conserva el nombre en el encabezado", async () => {
		auth.setUser(baseUser);
		sessionMock.check.mockResolvedValue({ state: "alive", user: baseUser });

		render(Layout, { children, data: signedInData });

		await waitFor(() => expect(sessionMock.check).toHaveBeenCalledTimes(1));
		expect(screen.getByText("Jane Doe")).toBeInTheDocument();
		// La sonda viva no cierra la sesión: el usuario sigue en el store.
		expect(get(auth).user?.id).toBe(baseUser.id);
	});

	it("sin sesión guardada no llama a la API de sesión", async () => {
		render(Layout, { children, data: anonymousData });
		await tick();

		expect(sessionMock.check).not.toHaveBeenCalled();
		expect(screen.getByRole("link", { name: "Iniciar Sesión" })).toBeInTheDocument();
	});

	it("sondea una sola vez aunque el estado de la sesión cambie", async () => {
		render(Layout, { children, data: signedInData });
		await waitFor(() => expect(sessionMock.check).toHaveBeenCalledTimes(1));

		// Otra escritura en la tienda (p. ej. un `login` de otra pantalla) no vuelve a sondear: la
		// sonda cuelga del montaje del layout raíz, no de la suscripción reactiva.
		auth.setLoading(true);
		await tick();

		expect(sessionMock.check).toHaveBeenCalledTimes(1);
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
		// El tope declara `--header-h: var(--header-h-max)`: se resuelve al valor de la reserva.
		const max = css.match(/--header-h-max\s*:\s*([\d.]+)rem/);
		const remOf = (pattern: RegExp) => {
			const block = (css.match(pattern) ?? []).join(" ");
			if (/--header-h\s*:\s*var\(--header-h-max\)/.test(block))
				return max ? Number(max[1]) : undefined;
			const match = block.match(/--header-h\s*:\s*([\d.]+)rem/);
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
			// La barra de acciones del panel vive en su componente desde la promoción de T18 (`108ca03`).
			["../lib/components/dashboard/ActionBar.svelte", "la barra de acciones"],
			["search/+page.svelte", "la barra de resultados"],
			["dataset/[id]/+page.svelte", "el panel de la ficha del dataset"],
			// El panel pegajoso del asistente vive ahora en el formulario extraído: el ancla lo sigue
			// hasta su casa nueva, que es el punto de la prueba (si el token se consumiera en un literal,
			// esto se pone rojo). La página del asistente ya no consume el token, así que sale de la lista.
			["../lib/components/datasets/DatasetForm.svelte", "el panel del asistente"],
		] as const;

		for (const [file, description] of consumers) {
			expect(source(file), description).toContain("var(--header-h)");
		}
	});

	it("todos los pegados y los destinos de salto comparten el aire de 12 px (`--sticky-air`)", () => {
		// Decisión del autor (L37 de `odd/tasks/v0.1.1-polish.md`): «12 de forma global». Cada superficie
		// había inventado el suyo (1rem, 17px, pt-2); un literal nuevo vuelve a separarlas sin que nadie lo vea.
		const surfaces = [
			"search/+page.svelte",
			"dataset/[id]/+page.svelte",
			"dataset/[id]/resource/[resourceId]/+page.svelte",
			"../lib/components/datasets/DatasetForm.svelte",
			"../lib/components/resource/chart/ChartForm.svelte",
			"../lib/components/dashboard/ActionBar.svelte",
		] as const;

		for (const file of surfaces) {
			const text = source(file);
			expect(text, file).toContain("var(--sticky-air)");
			expect(text, file).not.toMatch(/var\(--header-h\)\+(1rem|17px)\)/);
		}
	});

	it("los literales que causaban la desincronización ya no están", () => {
		expect(source("search/+page.svelte")).not.toContain("top-[81px]");
		expect(source("dashboard/+page.svelte")).not.toMatch(/const\s+HEADER_PX\b/);
		expect(source("dataset/[id]/+page.svelte")).not.toMatch(/lg:top-24\b/);
		expect(source("dashboard/datasets/new/+page.svelte")).not.toMatch(/lg:top-24\b/);
		expect(source("../lib/components/datasets/DatasetForm.svelte")).not.toMatch(/lg:top-24\b/);
	});
});

// El aviso de Chromium «el anclaje de desplazamiento se desactivó… demasiados ajustes consecutivos»
// (S17 de `odd/tasks/v0.1.1-polish.md`) nace de que el encabezado, al achicarse, cambiaba su alto EN EL
// FLUJO: medido en Chromium el 2026-10-20, `main` bajaba de 81 a 65 px y el navegador compensaba el
// scroll (300 → 284) en cada cruce. La propuesta del autor: que cambie sólo el alto del encabezado y que
// el espacio que el contenido le reserva no se reduzca. jsdom no tiene layout, así que se ancla la
// estructura que lo garantiza; la medición en navegador queda en el log del expediente.
describe("La reserva del encabezado no se mueve al achicarse", () => {
	it("el encabezado es fijo: su alto ya no empuja el contenido", () => {
		render(Layout, { children, data: anonymousData });

		const header = document.querySelector("[data-site-header]") as HTMLElement;
		expect(header.className).toMatch(/\bfixed\b/);
		expect(header.className).not.toMatch(/\bsticky\b/);
	});

	it("el contenido reserva el alto del tope, que no cambia con el estado achicado", () => {
		render(Layout, { children, data: anonymousData });

		const spacer = document.querySelector("[data-header-spacer]") as HTMLElement;
		expect(spacer).not.toBeNull();
		expect(spacer).toHaveAttribute("aria-hidden", "true");
		// Alto del tope + 1px del borde inferior del encabezado; nunca `--header-h`, que se achica.
		expect(spacer.className).toContain("h-[calc(var(--header-h-max)+1px)]");
		expect(spacer.className).not.toContain("var(--header-h)");
	});

	it("la reserva sólo se declara en `:root`: el estado achicado no la toca", () => {
		const css = readFileSync(join(routesDir, "..", "app.css"), "utf8");
		const rootBlocks = css.match(/:root\s*\{([^}]*)\}/gs) ?? [];
		const shrunkBlocks = css.match(/\[data-header-shrunk\][^{]*\{([^}]*)\}/gs) ?? [];

		expect(rootBlocks.some((block) => /--header-h-max\s*:/.test(block))).toBe(true);
		expect(shrunkBlocks.some((block) => /--header-h-max\s*:/.test(block))).toBe(false);
		expect(css.match(/--header-h-max\s*:/g) ?? []).toHaveLength(1);
	});

	it("el menú móvil se desplaza por dentro: un encabezado fijo no puede crecer más que la pantalla", async () => {
		render(Layout, { children, data: anonymousData });

		screen.getByRole("button", { name: /menú/i }).click();
		await tick();

		const menu = document.querySelector("[data-mobile-menu]") as HTMLElement;
		expect(menu).not.toBeNull();
		expect(menu.className).toContain("max-h-[calc(100dvh-var(--header-h)-1px)]");
		expect(menu.className).toContain("overflow-y-auto");
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
		render(Layout, { children, data: anonymousData });

		expect(document.querySelector("[data-header-sentinel]")).not.toBeNull();
	});

	it("al salir del tope marca el documento, y al volver lo desmarca", async () => {
		const notify = fakeIntersectionObserver();

		render(Layout, { children, data: anonymousData });
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

		render(Layout, { children, data: anonymousData });
		await tick();
		notify(false);
		await tick();

		// Si el atributo viviera en el `<header>`, la variable no llegaría a los pegados que son
		// hermanos suyos, y se desincronizarían igual que antes de E2.
		expect(document.querySelector("header")?.hasAttribute("data-header-shrunk")).toBe(false);
		expect(document.documentElement.hasAttribute("data-header-shrunk")).toBe(true);
	});
});
