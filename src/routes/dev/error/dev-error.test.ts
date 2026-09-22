// Tests de la hoja de revisión del error: la propiedad que la hace útil es que cubra los cinco
// estados que el autor tiene que mirar —401, 403, 404, 500 y 503— y que muestre el **componente
// real**, no una maqueta. Cada aserción de copia sale de `errorCopy`/`errorState` del propio
// componente: si la hoja deja de renderizarlo (o alguien escribe el texto a mano), estos tests
// fallan.
//
// Los 503 y los 500 no se pueden provocar a mano: por eso la hoja los muestra juntos, igual que
// `/dev/copy` muestra el estado de sesión que la sonda nunca resuelve sola.

import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { errorCopy, errorState } from "$lib/components/error/ErrorPage.svelte";
import ErrorSheet from "./+page.svelte";

const COVERED_STATUSES = [401, 403, 404, 500, 503] as const;
const CLIENT_STATUSES = [401, 403, 404] as const;
const SERVER_STATUSES = [500, 503] as const;

function panel(status: number): HTMLElement {
	return screen.getByTestId(`error-variant-${status}`);
}

function headingOf(status: number): string {
	return within(panel(status)).getByRole("heading", { level: 1 }).textContent?.trim() ?? "";
}

function bodyOf(status: number): string {
	const heading = within(panel(status)).getByRole("heading", { level: 1 });
	const body = heading.nextElementSibling;
	return body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

describe("hoja de error — cobertura de estados", () => {
	it("cubre exactamente 401, 403, 404, 500 y 503, ni uno más", () => {
		render(ErrorSheet);

		const rendered = Array.from(document.querySelectorAll('[data-testid^="error-variant-"]')).map(
			(node) => node.getAttribute("data-testid"),
		);

		expect(rendered).toEqual(COVERED_STATUSES.map((status) => `error-variant-${status}`));
	});

	for (const status of COVERED_STATUSES) {
		it(`la variante ${status} renderiza el componente real con su copia y una etiqueta visible`, () => {
			render(ErrorSheet);

			const copy = errorCopy(status);
			const variant = panel(status);

			expect(within(variant).getByRole("heading", { level: 1 })).toHaveTextContent(copy.heading);
			expect(variant).toHaveTextContent(copy.body);
			expect(variant).toHaveTextContent(`ERROR ${status}`);
			// La etiqueta nombra la variante y su familia, para que el revisor sepa qué está mirando.
			expect(variant).toHaveTextContent(errorState(status) === "client" ? "4xx" : "5xx");
		});
	}

	it("las tres variantes 4xx son el mismo estado y las dos 5xx el suyo", () => {
		render(ErrorSheet);

		const clientHeadings = CLIENT_STATUSES.map((status) => headingOf(status));
		expect(new Set(clientHeadings).size).toBe(1);

		const serverHeadings = SERVER_STATUSES.map((status) => headingOf(status));
		expect(new Set(serverHeadings).size).toBe(1);

		expect(headingOf(404)).not.toBe(headingOf(500));
		expect(bodyOf(401)).toBe(bodyOf(403));
		expect(bodyOf(403)).toBe(bodyOf(404));
	});

	it("ninguna variante ofrece una acción de inicio de sesión", () => {
		render(ErrorSheet);

		for (const status of COVERED_STATUSES) {
			const variant = panel(status);
			expect(
				within(variant).queryByRole("link", { name: /iniciar sesión|ingresar|login/i }),
			).toBeNull();
			expect(variant.textContent ?? "").not.toMatch(/iniciar sesión|ingresar|login/i);
		}
	});

	it("sólo las variantes 5xx ofrecen reintentar", () => {
		render(ErrorSheet);

		for (const status of SERVER_STATUSES) {
			expect(within(panel(status)).getByRole("link", { name: /reintentar/i })).toBeInTheDocument();
		}
		for (const status of CLIENT_STATUSES) {
			expect(within(panel(status)).queryByRole("link", { name: /reintentar/i })).toBeNull();
		}
	});
});

describe("hoja de error — la ruta no existe en producción", () => {
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
