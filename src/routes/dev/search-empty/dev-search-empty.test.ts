// Tests del playground del vacío del buscador: lo que lo hace útil es que muestre el vacío de hoy y las
// cuatro formas de llenarlo, y que **use los componentes reales** (`DatasetCard`, `OrganizationCard`) con
// las fixtures del repo, para que lo que el autor apruebe sea lo que se publica. El bloque del vacío y
// los chips son copias, y la hoja lo dice.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`, y se ejercita en las dos direcciones
// (abajo) porque un test de una sola dirección pasa igual si `load` tirara siempre.

import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchEmptySheet from "./+page.svelte";

describe("Playground del vacío del buscador", () => {
	it("muestra el vacío de hoy y las cuatro formas de llenarlo", () => {
		render(SearchEmptySheet);

		expect(screen.getByText("Hoy")).toBeTruthy();
		for (const label of [
			"A · Mientras tanto, lo más reciente",
			"B · Explorar por organización",
			"C · A + B",
			"D · Búsquedas sugeridas",
		]) {
			expect(screen.getByText(label)).toBeTruthy();
		}
		// El bloque del vacío se repite una vez por sección: hoy + las cuatro propuestas.
		expect(screen.getAllByText("Sin resultados")).toHaveLength(5);
	});

	it("usa los componentes reales con las fixtures del repo", () => {
		render(SearchEmptySheet);

		// Las cards de organización son el componente real: traen los nombres de las fixtures.
		expect(screen.getAllByText(/Facultad|Dirección|Rectorado/i).length).toBeGreaterThan(0);
		// Y los datasets también: sus cards traen el título de la fixture.
		expect(screen.getAllByRole("link", { name: /./ }).length).toBeGreaterThan(0);
	});
});

describe("La compuerta de producción", () => {
	// El `DEV` que se siembra abajo se restaura SIEMPRE: sin esto el valor se filtra a los tests
	// siguientes y el resultado pasa a depender del orden.
	afterEach(() => vi.unstubAllEnvs());

	it("no existe fuera de desarrollo, y sí en desarrollo", async () => {
		const { load } = await import("./+page");

		vi.stubEnv("DEV", true);
		expect(() => load({} as never)).not.toThrow();

		vi.stubEnv("DEV", false);
		expect(() => load({} as never)).toThrow();
	});
});
