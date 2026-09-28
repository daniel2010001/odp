import { render, screen, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClientConfig } from "$lib/types/api";
import type { CkanOrganization } from "$lib/types/ckan";
import HomePage from "./+page.svelte";

// Se mockea en el borde de módulo para que el `onMount` de la home nunca dispare HTTP real. La
// home pide `package_search` (stats) y `organization_list` (tarjetas); el fallback de DEV se
// sustituye por centinelas vacíos para que, si la consulta fallara, ninguna tarjeta aparezca y el
// test lo note en vez de pasar por accidente.
const mocks = vi.hoisted(() => ({
	createCkanClient: vi.fn<(config: ApiClientConfig) => object>(),
	search: vi.fn(),
	listOrgs: vi.fn(),
}));

vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000" },
}));
vi.mock("$lib/api/client", () => ({ createCkanClient: mocks.createCkanClient }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ search: mocks.search }) }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ list: mocks.listOrgs }),
}));
vi.mock("$lib/mock/data", () => ({
	getMockSearchResult: vi.fn(),
	MOCK_DATASETS: [],
	MOCK_ORGS: [],
}));

function makeOrganization(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-1",
		name: "facultad-de-ciencias",
		title: "Facultad de Ciencias",
		description: "Facultad de Ciencias y Tecnología",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		package_count: 3,
		...overrides,
	};
}

const ORGS: CkanOrganization[] = [
	makeOrganization({ id: "org-1", name: "facultad-de-ciencias", title: "Facultad de Ciencias" }),
	makeOrganization({
		id: "org-2",
		name: "rectorado",
		title: "Rectorado",
		description: "Rectorado de la Universidad Mayor de San Simón",
		package_count: 1,
	}),
];

beforeEach(() => {
	vi.clearAllMocks();
	mocks.createCkanClient.mockReturnValue({});
	mocks.search.mockResolvedValue({
		count: 12,
		search_facets: { res_format: { items: [{ name: "CSV", display_name: "CSV", count: 12 }] } },
	});
	mocks.listOrgs.mockResolvedValue(ORGS);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("Página de inicio — las tarjetas de organización", () => {
	it("cada tarjeta lleva a la página de la organización y ninguna a una búsqueda filtrada", async () => {
		// La tarjeta sólo aparece cuando `organization_list` resuelve: la espera ancla la carga.
		const { container } = render(HomePage);
		await screen.findByRole("link", { name: /Facultad de Ciencias/i });

		const section = container.querySelector("#organizaciones");
		expect(section).not.toBeNull();
		const scoped = within(section as HTMLElement);

		for (const org of ORGS) {
			const card = scoped.getByRole("link", { name: new RegExp(org.title, "i") });
			expect(card).toHaveAttribute("href", `/organization/${org.name}`);
		}

		// Y la propiedad de refuerzo: ninguna tarjeta quedó apuntando a la búsqueda filtrada por `org`,
		// que era el defecto medido.
		const hrefs = Array.from((section as HTMLElement).querySelectorAll("a[href]")).map(
			(anchor) => anchor.getAttribute("href") ?? "",
		);
		expect(hrefs.some((href) => href.includes("search?org="))).toBe(false);
	});
});
