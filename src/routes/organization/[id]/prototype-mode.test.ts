// Modo prototipo en la ficha real de la organización (S14 de `odd/tasks/prototype-presentation.md`, Q18):
// con él activado, «Colecciones que cura» lista las colecciones de la maqueta curadas por esa organización
// que un visitante puede ver (Q10: sólo las públicas). Sin ninguna, no hay sección. Apagado, la ficha es la
// de siempre.

import { render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import type { CkanOrganization } from "$lib/types/ckan";
import { collectionHref } from "../../dev/prototype/collections/data";
import OrganizationPage from "./+page.svelte";

const pageStore = page as unknown as {
	set: (value: {
		params: Record<string, string>;
		url: URL;
		data?: Record<string, unknown>;
	}) => void;
};

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "" } }));
vi.mock("$lib/api/client", () => ({ createCkanClient: () => ({}) }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({
		show: async (id: string): Promise<CkanOrganization> => ({
			id: `org-${id}`,
			name: id,
			title: `Organización ${id}`,
			description: "",
			image_url: "",
			created: "2026-01-01T00:00:00.000000",
			state: "active",
		}),
	}),
}));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ byOrganization: async () => ({ count: 0, results: [] }) }),
}));

function open(org: string, prototype: boolean | undefined) {
	pageStore.set({
		params: { id: org },
		url: new URL(`http://localhost/organization/${org}`),
		...(prototype === undefined ? {} : { data: { prototype } }),
	});
	render(OrganizationPage);
}

afterEach(() => {
	pageStore.set({ params: {}, url: new URL("http://localhost/") });
});

// Con la máquina cargada, el primer render de la página se acerca a los 5 s por defecto.
const SLOW = 15_000;

describe("Ficha de la organización — modo prototipo", () => {
	it(
		"activado: «Colecciones que cura» enlaza las colecciones públicas que cura",
		async () => {
			open("direccion-investigacion", true);

			const section = await screen.findByTestId("org-curated-collections");
			expect(
				within(section).getByRole("heading", { name: /Colecciones que cura/ }),
			).toBeInTheDocument();
			expect(
				within(section).getByRole("link", { name: /Investigación y laboratorios de la FCyT/ }),
			).toHaveAttribute("href", collectionHref("investigacion-laboratorios-fcyt"));
		},
		SLOW,
	);

	it(
		"activado: sin colecciones visibles no hay sección (la del Rectorado es privada)",
		async () => {
			open("rectorado", true);

			await screen.findByRole("heading", { name: /^Datasets/ });
			expect(screen.queryByTestId("org-curated-collections")).not.toBeInTheDocument();
			expect(screen.queryByText("Rendición pública de cuentas 2025")).not.toBeInTheDocument();
		},
		SLOW,
	);

	it(
		"apagado (por defecto): ninguna sección de colecciones",
		async () => {
			open("direccion-investigacion", undefined);

			await screen.findByRole("heading", { name: /^Datasets/ });
			expect(screen.queryByTestId("org-curated-collections")).not.toBeInTheDocument();
			expect(screen.queryByText(/Colecciones que cura/)).not.toBeInTheDocument();
		},
		SLOW,
	);
});
