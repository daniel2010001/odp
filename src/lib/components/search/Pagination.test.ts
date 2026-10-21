import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Pagination from "./Pagination.svelte";

describe("Pagination", () => {
	it("la página actual usa el par de tokens del primario, no blanco fijo", () => {
		// En modo oscuro el primario es un relleno claro (`5140f80`): `text-white` encima no llega a 4.5:1.
		// `text-primary-foreground` es el texto que el sistema de diseño define para ese fondo, en los dos temas.
		render(Pagination, { current: 2, total: 3 });

		const actual = screen.getByRole("button", { name: "Ir a página 2" });
		expect(actual).toHaveAttribute("aria-current", "page");
		expect(actual.className).toContain("text-primary-foreground");
		expect(actual.className).not.toContain("text-white");
	});
});
