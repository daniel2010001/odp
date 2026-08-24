import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { CkanOrganization } from "$lib/types/ckan";
import OrganizationCard from "./OrganizationCard.svelte";

function makeOrg(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-1",
		name: "facultad-medicina",
		title: "Facultad de Medicina",
		description: "Datos de salud pública",
		created: "2020-01-01T00:00:00Z",
		state: "active",
		...overrides,
	};
}

describe("OrganizationCard", () => {
	it("renderiza title, description y conteo de datasets", () => {
		const org = makeOrg();

		render(OrganizationCard, { props: { org, count: 5 } });

		expect(screen.getByText("Facultad de Medicina")).toBeInTheDocument();
		expect(screen.getByText("Datos de salud pública")).toBeInTheDocument();
		expect(screen.getByText("5 datasets")).toBeInTheDocument();
	});

	it("renderiza el conteo en singular para un solo dataset", () => {
		const org = makeOrg();

		render(OrganizationCard, { props: { org, count: 1 } });

		expect(screen.getByText("1 dataset")).toBeInTheDocument();
	});

	it("renderiza un enlace a /organization/{name}", () => {
		const org = makeOrg();

		render(OrganizationCard, { props: { org, count: 0 } });

		expect(screen.getByRole("link")).toHaveAttribute("href", "/organization/facultad-medicina");
	});

	it("renderiza el monograma (sin <img>) cuando image_url está vacío", () => {
		const org = makeOrg({ image_url: "" });

		const { container } = render(OrganizationCard, { props: { org, count: 0 } });

		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toContain("FM");
	});
});
