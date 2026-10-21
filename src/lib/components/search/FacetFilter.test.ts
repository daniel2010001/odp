import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import FacetFilter from "./FacetFilter.svelte";

function etiquetas(): string[] {
	return screen.getAllByRole("checkbox").map((c) => c.closest("label")?.textContent?.trim() ?? "");
}

describe("FacetFilter — orden", () => {
	it("conserva el orden por conteo y desempata alfabéticamente (es)", async () => {
		render(FacetFilter, {
			props: {
				title: "Formato",
				items: [
					{ name: "z", display_name: "Zeta", count: 3 },
					{ name: "n", display_name: "Ñandú", count: 3 },
					{ name: "a", display_name: "Álgebra", count: 3 },
					{ name: "top", display_name: "Mayor", count: 9 },
					{ name: "d9", display_name: "Dataset 9", count: 1 },
				],
			},
		});
		// En jsdom el acordeón arranca contraído (sin `md`): se abre como lo haría el usuario.
		await fireEvent.click(screen.getByRole("button", { name: /Formato/ }));
		expect(etiquetas()).toEqual(["Mayor 9", "Álgebra 3", "Ñandú 3", "Zeta 3", "Dataset 9 1"]);
	});
});
