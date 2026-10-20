import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { type OrderableResource, resourceNeighbours } from "$lib/resources/order";
import ResourceStepper from "./ResourceStepper.svelte";

const RESOURCES: OrderableResource[] = [
	{ id: "res-0", name: "Flujos vehiculares 2019", position: 0, format: "CSV" },
	{ id: "res-1", name: "Matrícula 2026", position: 1, format: "PDF" },
	{ id: "res-2", name: "Informe metodológico", position: 2, format: "XLSX" },
];

function mount(currentId: string, resources = RESOURCES) {
	return render(ResourceStepper, {
		props: { datasetId: "matricula-2026", neighbours: resourceNeighbours(resources, currentId) },
	});
}

describe("ResourceStepper", () => {
	it("muestra «Recurso N de M» como disparador de la lista", () => {
		mount("res-1");
		const trigger = screen.getByRole("button", {
			name: "Elegir otro recurso del conjunto de datos",
		});
		expect(trigger).toHaveTextContent("Recurso 2 de 3");
	});

	it("los extremos apuntan a los vecinos, con el nombre completo en title y aria-label", () => {
		mount("res-1");
		const previous = screen.getByRole("link", {
			name: "Recurso anterior: Flujos vehiculares 2019",
		});
		const next = screen.getByRole("link", { name: "Recurso siguiente: Informe metodológico" });
		expect(previous).toHaveAttribute("href", "/dataset/matricula-2026/resource/res-0");
		expect(previous).toHaveAttribute("title", "Flujos vehiculares 2019");
		expect(next).toHaveAttribute("href", "/dataset/matricula-2026/resource/res-2");
		expect(next).toHaveAttribute("title", "Informe metodológico");
		// Objetivo táctil de 44 px (contrato de clases: jsdom no aplica Tailwind).
		expect(previous.className).toContain("size-11");
		expect(next.className).toContain("size-11");
	});

	it("en el primer recurso no hay «anterior»: queda un control inerte y el contador no se mueve", () => {
		const { container } = mount("res-0");
		expect(screen.queryByRole("link", { name: /Recurso anterior/ })).toBeNull();
		expect(screen.getByRole("link", { name: /Recurso siguiente/ })).toBeTruthy();
		const inert = container.querySelector('[data-inert="previous"]') as HTMLElement;
		expect(inert.tagName).toBe("SPAN");
		expect(inert).toHaveAttribute("aria-hidden", "true");
		expect(inert.hasAttribute("tabindex")).toBe(false);
		expect(inert.closest("a")).toBeNull();
		expect(inert.className).toContain("size-11");
		expect(inert.nextElementSibling).toBe(screen.getByRole("button"));
	});

	it("en el último recurso no hay «siguiente»: queda un control inerte", () => {
		const { container } = mount("res-2");
		expect(screen.queryByRole("link", { name: /Recurso siguiente/ })).toBeNull();
		expect(screen.getByRole("link", { name: /Recurso anterior/ })).toBeTruthy();
		const inert = container.querySelector('[data-inert="next"]') as HTMLElement;
		expect(inert.tagName).toBe("SPAN");
		expect(inert).toHaveAttribute("aria-hidden", "true");
		expect(inert.hasAttribute("tabindex")).toBe(false);
		expect(inert.closest("a")).toBeNull();
		expect(inert.previousElementSibling).toBe(screen.getByRole("button"));
	});

	it("la lista ofrece todos los recursos como enlaces y marca el actual con aria-current", async () => {
		mount("res-1");
		await fireEvent.click(screen.getByRole("button"));

		expect(await screen.findByText("Recursos de este dataset")).toBeInTheDocument();
		const menu = screen.getByRole("menu");
		const links = within(menu).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/dataset/matricula-2026/resource/res-0",
			"/dataset/matricula-2026/resource/res-1",
			"/dataset/matricula-2026/resource/res-2",
		]);
		const current = within(menu).getByRole("link", { name: /Matrícula 2026/ });
		expect(current).toHaveAttribute("aria-current", "page");
		expect(within(menu).getByRole("link", { name: /Flujos vehiculares/ })).not.toHaveAttribute(
			"aria-current",
		);
	});

	it("ocupa todo el ancho de la banda y se ajusta desde @lg del contenedor", () => {
		const { container } = mount("res-1");
		const root = container.firstElementChild as HTMLElement;
		for (const token of ["w-full", "@lg:w-auto", "@lg:ml-auto"]) {
			expect(root.className).toContain(token);
		}
	});
});
