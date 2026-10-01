// Tests del playground del vacío del buscador: lo que lo hace útil es que **se vea en acción** (un caso
// simulado a la vez, o una combinación de bloques) y que use los componentes reales (`DatasetCard`,
// `OrganizationCard`) con las fixtures del repo, para que lo que el autor apruebe sea lo que se publica.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`, y se ejercita en las dos direcciones.

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchEmptySheet from "./+page.svelte";

describe("Playground del vacío del buscador", () => {
	it("arranca en «Hoy»: sólo el aviso, y con el control a la vista", () => {
		render(SearchEmptySheet);

		expect(screen.getByText(/Control del playground \(no es UI de producto\)/i)).toBeTruthy();
		expect(screen.getAllByText("Sin resultados")).toHaveLength(1);
		// Ningún bloque encendido al arrancar: es el estado de hoy.
		expect(screen.queryByText("Mientras tanto, lo más reciente")).toBeNull();
		expect(screen.queryByText("Explorar por organización")).toBeNull();
		expect(screen.queryByText("Pruebe con")).toBeNull();
	});

	it("un preset enciende exactamente los bloques que le tocan", async () => {
		render(SearchEmptySheet);

		await fireEvent.click(screen.getByRole("button", { name: "C · A + B" }));

		expect(screen.getByText("Mientras tanto, lo más reciente")).toBeTruthy();
		expect(screen.getByText("Explorar por organización")).toBeTruthy();
		expect(screen.queryByText("Pruebe con")).toBeNull();
		// Las cards son los componentes reales: traen las fixtures del repo.
		expect(screen.getAllByText(/Facultad|Dirección|Rectorado/i).length).toBeGreaterThan(0);
	});

	it("los interruptores combinan lo que entra, y el aviso del vacío queda siempre", async () => {
		render(SearchEmptySheet);

		await fireEvent.click(screen.getByRole("button", { name: "Bloque: Búsquedas sugeridas" }));

		expect(screen.getByText("Pruebe con")).toBeTruthy();
		expect(screen.getAllByText("Sin resultados")).toHaveLength(1);

		await fireEvent.click(screen.getByRole("button", { name: "Bloque: Lo más reciente" }));

		expect(screen.getByText("Pruebe con")).toBeTruthy();
		expect(screen.getByText("Mientras tanto, lo más reciente")).toBeTruthy();
		expect(screen.getByText(/combinación propia/i)).toBeTruthy();
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
