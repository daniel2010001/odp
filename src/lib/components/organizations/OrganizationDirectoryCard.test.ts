// La tarjeta del listado de organizaciones (S25 de `odd/tasks/prototype-presentation.md`): muestra lo que el
// catálogo ya entrega —tipo deducido del título, cantidad de datasets, fecha de la última actualización— y
// la sigla y la jerarquía **sólo cuando el dato existe** (Q13, Q6): sin dato, no hay marca ni hueco.

import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { CkanOrganization } from "$lib/types/ckan";
import OrganizationDirectoryCard from "./OrganizationDirectoryCard.svelte";

function makeOrg(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-fcyt",
		name: "fcyt",
		title: "Facultad de Ciencias y Tecnología",
		description: "Docencia e investigación.",
		image_url: "",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

describe("OrganizationDirectoryCard", () => {
	it("muestra el tipo deducido del título, el título enlazado, la cantidad y la fecha", () => {
		render(OrganizationDirectoryCard, {
			props: { org: makeOrg(), count: 10, updated: "2026-10-20T22:02:42.593Z" },
		});

		const card = screen.getByTestId("org-card-fcyt");
		expect(card).toHaveTextContent("Facultad");
		expect(screen.getByRole("link", { name: "Facultad de Ciencias y Tecnología" })).toHaveAttribute(
			"href",
			"/organization/fcyt",
		);
		expect(card).toHaveTextContent("10 datasets");
		const time = card.querySelector("time");
		expect(time).toHaveAttribute("datetime", "2026-10-20T22:02:42.593Z");
		expect(card).toHaveTextContent(/Actualizado el .*2026/);
	});

	it("en singular para un solo dataset", () => {
		render(OrganizationDirectoryCard, { props: { org: makeOrg(), count: 1 } });

		expect(screen.getByTestId("org-card-fcyt")).toHaveTextContent("1 dataset");
		expect(screen.getByTestId("org-card-fcyt")).not.toHaveTextContent("1 datasets");
	});

	it("sin datasets lo dice, y no muestra fecha", () => {
		render(OrganizationDirectoryCard, { props: { org: makeOrg(), count: 0 } });

		const card = screen.getByTestId("org-card-fcyt");
		expect(card).toHaveTextContent("Aún sin datasets publicados");
		expect(card.querySelector("time")).toBeNull();
	});

	it("sin sigla ni jerarquía no deja ninguna marca de ellas", () => {
		render(OrganizationDirectoryCard, { props: { org: makeOrg(), count: 3 } });

		const card = screen.getByTestId("org-card-fcyt");
		expect(card.querySelector("[data-org-acronym]")).toBeNull();
		expect(card).not.toHaveTextContent(/Depende de|unidad(es)? dependiente/);
		expect(within(card).queryByRole("list")).toBeNull();
		expect(within(card).getAllByRole("link")).toHaveLength(1);
	});

	it("con la sigla declarada la muestra junto al tipo", () => {
		render(OrganizationDirectoryCard, {
			props: { org: makeOrg(), count: 3, acronym: "FCyT" },
		});

		expect(
			screen.getByTestId("org-card-fcyt").querySelector("[data-org-acronym]"),
		).toHaveTextContent("FCyT");
	});

	it("con jerarquía dice de quién depende y enlaza sus unidades dependientes", () => {
		render(OrganizationDirectoryCard, {
			props: {
				org: makeOrg(),
				count: 3,
				parent: { name: "rectorado", title: "Rectorado UMSS" },
				dependents: [
					{ name: "casa", title: "Centro de Aguas y Saneamiento Ambiental" },
					{ name: "dep-fisica", title: "Departamento de Física" },
				],
			},
		});

		const card = screen.getByTestId("org-card-fcyt");
		expect(card).toHaveTextContent("Depende de Rectorado UMSS");
		expect(within(card).getByRole("link", { name: "Rectorado UMSS" })).toHaveAttribute(
			"href",
			"/organization/rectorado",
		);
		expect(card).toHaveTextContent("2 unidades dependientes");
		const list = within(card).getByRole("list", { name: "Unidades dependientes" });
		expect(
			within(list)
				.getAllByRole("link")
				.map((link) => link.getAttribute("href")),
		).toEqual(["/organization/casa", "/organization/dep-fisica"]);
	});

	it("una sola unidad dependiente va en singular", () => {
		render(OrganizationDirectoryCard, {
			props: { org: makeOrg(), count: 3, dependents: [{ name: "casa", title: "CASA" }] },
		});

		expect(screen.getByTestId("org-card-fcyt")).toHaveTextContent("1 unidad dependiente");
	});
});
