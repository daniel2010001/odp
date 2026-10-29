// Modo prototipo en la ficha real del dataset (S14 de `odd/tasks/prototype-presentation.md`): con él
// activado, un dataset real con maqueta muestra «Aparece en las colecciones» con las colecciones que un
// visitante puede ver (Q10: sólo las públicas). Apagado, la ficha es la de siempre.

import { render, screen, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import { collectionHref } from "../../dev/prototype/collections/data";
import DatasetPage from "./+page.svelte";

const pageStore = page as unknown as {
	set: (value: {
		params: Record<string, string>;
		url: URL;
		data?: Record<string, unknown>;
	}) => void;
};

const mocks = vi.hoisted(() => ({
	showDataset: vi.fn(),
	check: vi.fn(),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "http://localhost:5000" } }));
vi.mock("$lib/api/client", () => ({ createPortalClient: () => ({}) }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({
		listUpdatableOrganizationIds: async () => ({ state: "unknown" }),
		canAdministerOrganization: async () => "may_not",
	}),
}));
vi.mock("$lib/api/publication", () => ({
	createPublicationApi: () => ({ list: async () => [], history: async () => [] }),
}));
vi.mock("$lib/mock/data", () => ({ getMockDatasetById: () => undefined }));
vi.mock("$lib/api/session", () => ({ createSessionApi: () => ({ check: mocks.check }) }));

const REAL_SLUG = "matricula-estudiantil-por-carrera-y-gestion";

function makeDataset(name: string): CkanPackage {
	return {
		id: "pkg-1",
		name,
		title: "Matrícula estudiantil por carrera y gestión",
		private: false,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		organization: {
			id: "org-1",
			name: "fcs",
			title: "Facultad de Ciencias de la Salud",
			description: "",
			created: "2026-01-01T00:00:00.000000",
			state: "active",
		},
	} as CkanPackage;
}

function open(slug: string, prototype: boolean | undefined) {
	pageStore.set({
		params: { id: slug },
		url: new URL(`http://localhost/dataset/${slug}`),
		...(prototype === undefined ? {} : { data: { prototype } }),
	});
	mocks.showDataset.mockResolvedValue(makeDataset(slug));
	render(DatasetPage);
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
	mocks.check.mockResolvedValue({
		state: "inconclusive",
		error: new CkanApiError("Server Error", 500),
	});
});

afterEach(() => {
	pageStore.set({ params: {}, url: new URL("http://localhost/") });
	auth.reset();
});

// La ficha es la página más pesada de compilar: con la máquina cargada, el primer render se acerca a los
// 5 s por defecto.
const SLOW = 15_000;

describe("Ficha del dataset — modo prototipo", () => {
	it(
		"activado: muestra «Aparece en las colecciones» sólo con las públicas, enlazadas a su maqueta",
		async () => {
			open(REAL_SLUG, true);

			const section = await screen.findByTestId("dataset-collections");
			expect(
				within(section).getByRole("heading", { name: /Aparece en las colecciones/ }),
			).toBeInTheDocument();
			const link = within(section).getByRole("link", { name: /Indicadores académicos para tesis/ });
			expect(link).toHaveAttribute("href", collectionHref("indicadores-academicos"));
			// Q10: un visitante nunca ve las privadas.
			expect(section).not.toHaveTextContent("Rendición pública de cuentas 2025");
			expect(section).not.toHaveTextContent("Lista de trabajo");
			// S42: varias colecciones públicas, de curadores distintos (H2-4).
			expect(
				within(section)
					.getAllByTestId("dataset-collection")
					.map((el) => el.getAttribute("href")),
			).toEqual([
				collectionHref("indicadores-academicos"),
				collectionHref("estadisticas-academicas-pregrado"),
				collectionHref("ciencias-salud-en-cifras"),
			]);
			// Va en la columna principal, después de los recursos.
			const resources = document.getElementById("resources") as HTMLElement;
			expect(
				resources.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
		},
		SLOW,
	);

	it(
		"activado, un dataset real sin maqueta no muestra la sección",
		async () => {
			open("otro-dataset-real", true);

			await screen.findByRole("heading", { name: /Archivos disponibles/ });
			expect(screen.queryByTestId("dataset-collections")).not.toBeInTheDocument();
		},
		SLOW,
	);

	it(
		"apagado (por defecto): la ficha no muestra la sección",
		async () => {
			open(REAL_SLUG, undefined);

			await screen.findByRole("heading", { name: /Archivos disponibles/ });
			expect(screen.queryByTestId("dataset-collections")).not.toBeInTheDocument();
			expect(screen.queryByText(/Aparece en las colecciones/)).not.toBeInTheDocument();
		},
		SLOW,
	);
});
