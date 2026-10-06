import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import TooltipFixture from "./tooltip-fixture.svelte";

// El tooltip es un primitivo: estos tests fijan el contrato que la card necesita
// (foco, hover, Escape, el vínculo `aria-describedby`) y la delegación por `child`.
// El caso del `<a>` —el que necesita la card— se afirma **a través de la card**
// (`DatasetCard.test.ts`), no acá: el envoltorio no debe saber de anclas.
describe("Tooltip — el primitivo vendorizado", () => {
	it("abre con el foco de teclado y el disparador queda descrito por el contenido", async () => {
		render(TooltipFixture);
		const trigger = screen.getByRole("button", { name: "Disparador" });
		expect(screen.queryByRole("tooltip")).toBeNull();

		trigger.focus();

		const content = await screen.findByRole("tooltip");
		expect(content).toHaveTextContent("Contenido del tooltip");
		expect(trigger).toHaveAttribute("aria-describedby", content.id);
	});

	it("abre al pasar el puntero", async () => {
		render(TooltipFixture);
		const trigger = screen.getByRole("button", { name: "Disparador" });
		expect(screen.queryByRole("tooltip")).toBeNull();

		await fireEvent.pointerEnter(trigger);

		const content = await screen.findByRole("tooltip");
		expect(content).toHaveTextContent("Contenido del tooltip");
	});

	it('con delegación a un `<button>` conserva `type="button"` y no cae en `submit`', async () => {
		render(TooltipFixture, { props: { mode: "delegated-button" } });
		const button = screen.getByTestId("delegated-button");

		// El envoltorio no debe reescribir las props delegadas: si recortara el `type`
		// que inyecta bits-ui, un `<button>` real pasaría a `type="submit"` dentro de
		// un formulario. El disparador sigue funcionando por el mismo camino.
		expect(button).toHaveAttribute("type", "button");
		button.focus();
		const content = await screen.findByRole("tooltip");
		expect(button).toHaveAttribute("aria-describedby", content.id);
	});

	it("cierra con Escape", async () => {
		render(TooltipFixture);
		const trigger = screen.getByRole("button", { name: "Disparador" });
		trigger.focus();
		await screen.findByRole("tooltip");

		await fireEvent.keyDown(document, { key: "Escape" });

		await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
	});
});
