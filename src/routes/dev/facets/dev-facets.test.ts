// Tests del playground de la facet: lo que lo hace útil es que muestre el **componente real** como
// referencia de «hoy» y las tres variantes del estado sin coincidencias, con la búsqueda sembrada
// para que se vean sin escribir. Las variantes son copias y la hoja lo dice.
//
// La ruta no existe en producción: la compuerta está en `+page.ts`.

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
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

	it("«limpiar» ofrece la acción y no promete mostrar el resto", () => {
		render(FacetVariant, { items, variant: "limpiar", initialQuery: "zzz" });

		expect(screen.getByText(/Sin coincidencias para «zzz»/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /limpiar/i })).toBeTruthy();
		expect(screen.queryByText(/Todas las opciones/i)).toBeNull();
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
