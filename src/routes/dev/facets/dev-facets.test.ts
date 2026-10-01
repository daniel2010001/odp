// Tests del playground de la facet: lo que lo hace útil es que muestre el **componente real** como
// referencia de «hoy» y las tres variantes del estado sin coincidencias, con la búsqueda sembrada
// para que se vean sin escribir. Las variantes son copias y la hoja lo dice.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`.

import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FacetsSheet from "./+page.svelte";
import FacetVariant from "./FacetVariant.svelte";

describe("Playground de la facet", () => {
	it("muestra el componente real como referencia y las tres variantes", () => {
		render(FacetsSheet);

		expect(screen.getByText(/Hoy — el componente real/i)).toBeTruthy();
		expect(screen.getAllByText(/Copia de la propuesta — no es el componente real/i)).toHaveLength(
			3,
		);
		for (const label of ["A · Limpiar", "B · Mostrar el resto", "C · A + B"]) {
			expect(screen.getByText(label)).toBeTruthy();
		}
	});
});

// El comportamiento de cada variante, que es lo que se va a promover.
describe("Variantes del estado sin coincidencias", () => {
	const items = [
		{ name: "a", display_name: "Alfa", count: 1 },
		{ name: "b", display_name: "Beta", count: 1 },
		{ name: "c", display_name: "Gamma", count: 1 },
	];

	it("«limpiar» recupera la lista al usarlo, y no promete mostrar el resto", async () => {
		render(FacetVariant, { items, variant: "limpiar", initialQuery: "zzz" });

		expect(screen.getByText(/Sin coincidencias para «zzz»/i)).toBeTruthy();
		expect(screen.queryByText(/Todas las opciones/i)).toBeNull();
		// La opción NO se muestra mientras el texto esté ahí: es lo que esta variante no cambia.
		expect(screen.queryByText("Alfa")).toBeNull();

		// Y la recuperación se comprueba usándola, no sólo viendo que el botón existe (`R3-003`).
		await fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));

		expect(screen.queryByText(/Sin coincidencias/i)).toBeNull();
		expect(screen.getByText("Alfa")).toBeTruthy();
	});

	it("«Ver más» muestra el resto de las opciones, no sólo cambia su rótulo", async () => {
		// El bug que la compuerta encontró (`R3-001`): `showAll` no se leía al recortar la lista.
		const many = Array.from({ length: 8 }, (_, i) => ({
			name: `o${i}`,
			display_name: `Opción ${i}`,
			count: 1,
		}));
		render(FacetVariant, { items: many, variant: "mostrar", initialQuery: "zzz" });

		expect(screen.getByText("Opción 0")).toBeTruthy();
		expect(screen.queryByText("Opción 7")).toBeNull();

		await fireEvent.click(screen.getByRole("button", { name: /ver 3 más/i }));

		expect(screen.getByText("Opción 7")).toBeTruthy();
	});

	it("«mostrar» no esconde las opciones y no ofrece limpiar", () => {
		render(FacetVariant, { items, variant: "mostrar", initialQuery: "zzz" });

		expect(screen.getByText(/Todas las opciones/i)).toBeTruthy();
		// Las tres opciones siguen visibles: es lo que el defecto escondía.
		expect(screen.getByText("Alfa")).toBeTruthy();
		expect(screen.getByText("Beta")).toBeTruthy();
		expect(screen.getByText("Gamma")).toBeTruthy();
		expect(screen.queryByRole("button", { name: /limpiar/i })).toBeNull();
	});

	it("«ambos» hace las dos cosas", () => {
		render(FacetVariant, { items, variant: "ambos", initialQuery: "zzz" });

		expect(screen.getByRole("button", { name: /limpiar/i })).toBeTruthy();
		expect(screen.getByText(/Todas las opciones/i)).toBeTruthy();
		expect(screen.getByText("Alfa")).toBeTruthy();
	});
});

// `R3-002` de `review-47e567f7470cf00e`: la compuerta de producción (`+page.ts`) no estaba ejercitada.
describe("La compuerta de producción", () => {
	// El `DEV` que se siembra abajo se restaura SIEMPRE: sin esto el `false` se filtra a los tests
	// siguientes y el resultado pasa a depender del orden (`R3-001` de `review-6ad360242a23b4ba`).
	afterEach(() => vi.unstubAllEnvs());

	it("no existe fuera de desarrollo, y sí en desarrollo", async () => {
		const { load } = await import("./+page");

		// El control importa: sin esta dirección, el test pasaría igual si `load` tirara siempre —y
		// una medición que devuelve lo mismo para la hipótesis y para el control no mide nada.
		vi.stubEnv("DEV", true);
		expect(() => load({} as never)).not.toThrow();

		vi.stubEnv("DEV", false);
		expect(() => load({} as never)).toThrow();
	});
});
