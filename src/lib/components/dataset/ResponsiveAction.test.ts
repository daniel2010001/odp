// Pruebas de `ResponsiveAction` (T13): la acción de banda con ícono + texto que, bajo el umbral de su
// contenedor, queda sólo en ícono. El nombre accesible no cambia nunca; jsdom no aplica Tailwind, así que
// los umbrales se prueban por contrato de clases.

import { Download, Pencil } from "@lucide/svelte";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ResponsiveAction from "./ResponsiveAction.svelte";

describe("ResponsiveAction", () => {
	it("un enlace conserva su destino y no cancela la navegación", async () => {
		render(ResponsiveAction, {
			props: { icon: Pencil, label: "Editar", href: "/dashboard/datasets/x/edit" },
		});

		const link = screen.getByRole("link", { name: "Editar" });
		expect(link).toHaveAttribute("href", "/dashboard/datasets/x/edit");
		const notCancelled = await fireEvent.click(link);
		expect(notCancelled).toBe(true);
	});

	it("`external` abre en otra pestaña con `noopener noreferrer`", () => {
		render(ResponsiveAction, {
			props: { icon: Download, label: "Descargar recurso", href: "/f.csv", external: true },
		});

		const link = screen.getByRole("link", { name: "Descargar recurso" });
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("con `collapseBelow` mide 44 px colapsada y conserva el nombre accesible aunque el texto se acorte", () => {
		render(ResponsiveAction, {
			props: {
				icon: Pencil,
				label: "Volver a solicitar",
				text: "Volver",
				suffix: "a solicitar",
				collapseBelow: "20rem",
				height: "11",
			},
		});

		const button = screen.getByRole("button", { name: "Volver a solicitar" });
		expect(button.className).toContain("size-11");
		expect(button.className).toContain("@[20rem]:w-auto");
		expect(button.querySelector("[data-label]")?.className).toContain("hidden @[20rem]:inline");
	});

	it("sin `collapseBelow` conserva siempre el texto y el alto pedido", () => {
		render(ResponsiveAction, {
			props: {
				icon: Download,
				label: "Descargar recurso",
				text: "Descargar",
				suffix: "recurso",
				href: "/f",
				height: "11",
				tone: "coral",
			},
		});

		const link = screen.getByRole("link", { name: "Descargar recurso" });
		expect(link.className).toContain("h-11");
		expect(link.className).toContain("bg-destructive");
		expect(link.className).not.toContain("bg-background");
		expect(link.querySelector("[data-label]")?.className).not.toContain("hidden");
		// La cola «recurso» se oculta a la vista bajo 24 rem del contenedor, no del árbol de accesibilidad.
		expect(link.querySelector("[data-label] span")?.className).toContain("hidden @[24rem]:inline");
	});

	it("un botón puede deshabilitarse mientras la acción está en curso", () => {
		render(ResponsiveAction, { props: { icon: Pencil, label: "Enviando…", disabled: true } });

		expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
	});
});
