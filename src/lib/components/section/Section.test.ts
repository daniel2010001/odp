// Pruebas de `Section`, la pieza que da a una sección su línea del título con el enlace para compartirla (S27 de
// `odd/tasks/prototype-presentation.md`). Fija el mismo contrato que las tarjetas de la ficha del dataset tenían
// escrito a mano (variante «Unificado», S18): el destino con su `scroll-margin`, la línea del título y, a su lado,
// el ícono que copia la URL actual con el fragmento y aparece con toda la tarjeta.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import Section from "./Section.svelte";

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const SCROLL_MT = "scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))]";
const body = createRawSnippet(() => ({ render: () => "<h2>Archivos disponibles</h2>" }));

describe("Section", () => {
	const writeText = vi.fn();

	beforeEach(() => {
		writeText.mockReset().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		pageStore.set({ params: {}, url: new URL("http://localhost/dataset/x?from=search") });
	});
	afterEach(() => pageStore.set({ params: {}, url: new URL("http://localhost/") }));

	it("como tarjeta: id, margen bajo el encabezado, línea del título y el ícono que aparece con la tarjeta", async () => {
		render(Section, {
			id: "resources",
			label: "Recursos",
			class: "p-6 sm:p-8",
			"data-testid": "seccion",
			children: body,
		});

		const section = screen.getByTestId("seccion");
		expect(section.id).toBe("resources");
		expect(section.className).toContain(SCROLL_MT);
		expect(section.className).toContain("group/tarjeta");
		expect(section.className).toContain("rounded-xl");
		expect(section.className).toContain("p-6 sm:p-8");

		const button = within(section).getByRole("button", {
			name: "Copiar enlace a la sección Recursos",
		});
		expect(button.textContent?.trim()).toBe("");
		expect(button.parentElement?.className).toBe("flex h-4 items-center gap-2");
		expect(button.parentElement?.querySelector("p")?.textContent?.trim()).toBe("Recursos");
		expect(button.className).toContain("opacity-0");
		expect(button.className).toContain("group-hover/tarjeta:opacity-100");
		expect(button.className).toContain("group-focus-within/tarjeta:opacity-100");
		expect(button.className).toContain("[@media(hover:none)]:opacity-100");
		expect(within(section).getByRole("heading", { name: "Archivos disponibles" })).toBeTruthy();

		await fireEvent.click(button);
		await waitFor(() =>
			expect(writeText).toHaveBeenCalledWith("http://localhost/dataset/x?from=search#resources"),
		);
	});

	it("sin tarjeta: el mismo destino y la misma línea, sin el marco", () => {
		render(Section, {
			id: "api",
			label: "API",
			card: false,
			"data-testid": "seccion",
			children: body,
		});

		const section = screen.getByTestId("seccion");
		expect(section.id).toBe("api");
		expect(section.className).toContain(SCROLL_MT);
		expect(section.className).toContain("group/tarjeta");
		expect(section.className).not.toContain("rounded-xl");
		expect(
			within(section).getByRole("button", { name: "Copiar enlace a la sección API" }),
		).toBeTruthy();
	});
});
