import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});

describe("Alto del encabezado: una sola fuente", () => {
	it("el token `--header-h` se declara una sola vez, en app.css", () => {
		const css = readFileSync(join(routesDir, "..", "app.css"), "utf8");

		expect(css.match(/--header-h\s*:/g) ?? []).toHaveLength(1);
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
