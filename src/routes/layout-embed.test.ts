// El layout raíz y las páginas incrustables (P4): `/embed/**` va dentro de un `<iframe>` ajeno, así que no lleva
// el encabezado ni el pie del sitio ni sondea la sesión; una página normal conserva todo.

import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import { auth } from "$lib/stores/auth";
import Layout from "./+layout.svelte";

const sessionMock = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("$lib/api/session", () => ({ createSessionApi: () => ({ check: sessionMock.check }) }));
vi.mock("$lib/env", () => ({ env: { CKAN_URL: "" } }));

const pageStore = page as unknown as { set: (value: unknown) => void };
const children = createRawSnippet(() => ({ render: () => "Contenido" }));
const data = { sessionUser: null };

function routeAt(id: string | null, path: string) {
	pageStore.set({
		params: {},
		url: new URL(`http://localhost${path}`),
		status: 200,
		error: null,
		route: { id },
	});
}

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
});
afterEach(() => routeAt(null, "/"));

describe("layout raíz — páginas incrustables", () => {
	it("una ruta bajo /embed no dibuja encabezado ni pie, pero sí el contenido", () => {
		routeAt("/embed/charts/[viewId]", "/embed/charts/v1");
		const { container } = render(Layout, { children, data });

		expect(screen.getByText("Contenido")).toBeInTheDocument();
		expect(container.querySelector("header")).toBeNull();
		expect(container.querySelector("footer")).toBeNull();
		expect(screen.queryByRole("link", { name: "Iniciar Sesión" })).toBeNull();
		expect(container.querySelector("[data-header-sentinel]")).toBeNull();
	});

	it("una ruta normal conserva el encabezado y el pie", () => {
		routeAt("/dataset/[id]", "/dataset/x");
		const { container } = render(Layout, { children, data });

		expect(container.querySelector("header[data-site-header]")).not.toBeNull();
		expect(container.querySelector("footer")).not.toBeNull();
	});

	it("una ruta cuyo nombre sólo empieza igual (/embedded) conserva el encabezado y el pie", () => {
		routeAt("/embedded", "/embedded");
		const { container } = render(Layout, { children, data });

		expect(container.querySelector("header")).not.toBeNull();
		expect(container.querySelector("footer")).not.toBeNull();
	});
});
