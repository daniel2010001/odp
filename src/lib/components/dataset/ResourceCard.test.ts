import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { CkanResource } from "$lib/types/ckan";
import ResourceCard from "./ResourceCard.svelte";

function resource(overrides: Partial<CkanResource> = {}): CkanResource {
	return {
		id: "r1",
		package_id: "p1",
		name: "Matrícula",
		description: "Descripción",
		format: "CSV",
		url: "https://x.test/a.csv",
		resource_type: "file",
		mimetype: "text/csv",
		size: 2048,
		created: "2026-01-01T00:00:00.000000",
		last_modified: "2026-01-01T00:00:00.000000",
		state: "active",
		position: 0,
		url_type: "upload",
		...overrides,
	};
}

const renderCard = (r: CkanResource) =>
	render(ResourceCard, { props: { resource: r, datasetSlug: "ds" } });

describe("ResourceCard — íconos por formato y formato como enlace", () => {
	it("la fila conserva su enlace a la página del recurso", () => {
		renderCard(resource());
		const link = screen.getByRole("link", { name: /Matrícula, detalle del recurso/ });
		expect(link).toHaveAttribute("href", "/dataset/ds/resource/r1");
	});

	it("el formato de un archivo es un enlace hermano a /search?format=, nunca anidado", () => {
		const { container } = renderCard(resource());
		const chip = screen.getByRole("link", { name: /CSV/ });
		expect(chip).toHaveAttribute("href", "/search?format=CSV");
		expect(chip.closest("a")).toBe(chip);
		expect(container.querySelectorAll("a a")).toHaveLength(0);
		expect(screen.getAllByRole("link")).toHaveLength(2);
	});

	it("el punto del chip y el cuadro del ícono llevan el token del formato", () => {
		const { container } = renderCard(resource());
		expect(container.querySelector(".bg-chart-1")).not.toBeNull();
		expect(container.querySelector("svg")).not.toBeNull();
		expect(container.querySelector(".border-chart-1\\/40")).not.toBeNull();
	});

	it("un enlace externo no tiene enlace de formato y es neutro", () => {
		const { container } = renderCard(resource({ url_type: "" }));
		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.getByText("Enlace externo")).toBeTruthy();
		expect(container.querySelector("[class*='chart-']")).toBeNull();
	});

	it("un archivo sin formato dice «Archivo», sin enlace de formato y neutro", () => {
		const { container } = renderCard(resource({ format: "" }));
		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.getByText("Archivo")).toBeTruthy();
		expect(container.querySelector("[class*='chart-']")).toBeNull();
	});

	it("un formato sin token enlaza a la búsqueda pero con punto neutro", () => {
		const { container } = renderCard(resource({ format: "zzz" }));
		expect(screen.getByRole("link", { name: /ZZZ/ })).toHaveAttribute("href", "/search?format=ZZZ");
		expect(container.querySelector("[class*='chart-']")).toBeNull();
	});

	it("el área de toque del enlace de formato llega a 44 px (pseudo-elemento ampliado)", () => {
		renderCard(resource());
		expect(screen.getByRole("link", { name: /CSV/ }).className).toContain("before:-inset-y-3");
	});
});
