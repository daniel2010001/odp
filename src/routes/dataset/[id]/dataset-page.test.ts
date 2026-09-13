import { render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import { auth } from "$lib/stores/auth";
import { type ApiClientConfig, CkanApiError } from "$lib/types/api";
import type { CkanPackage, CkanUser } from "$lib/types/ckan";
import DatasetPage from "./+page.svelte";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el
// tipo real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	createCkanClient: vi.fn<(config: ApiClientConfig) => object>(),
	showDataset: vi.fn(),
	getMockDatasetById: vi.fn(),
}));

// Se mockea en el borde de módulo para que `package_show` nunca dispare HTTP real. `$lib/mock/data`
// devuelve un dataset centinela: si la página cayera al fallback de desarrollo, su título aparecería
// renderizado y el test lo detecta.
vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/client", () => ({ createCkanClient: mocks.createCkanClient }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/mock/data", () => ({ getMockDatasetById: mocks.getMockDatasetById }));

const PRIVATE_MESSAGE =
	"Este dataset es privado. Inicie sesión con una cuenta autorizada para verlo.";
const NOT_FOUND_MESSAGE = "No se encontró el dataset solicitado.";
const MOCK_TITLE = "Dataset Mock De Desarrollo";

function makeUser(): CkanUser {
	return {
		id: "user-1",
		name: "dueno",
		display_name: "Dueño",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
	};
}

function makeDataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: false,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
	pageStore.set({
		params: { id: "matricula-2026" },
		url: new URL("http://localhost/"),
	});
	mocks.createCkanClient.mockReturnValue({});
	mocks.showDataset.mockResolvedValue(makeDataset());
	mocks.getMockDatasetById.mockReturnValue(
		makeDataset({ id: "mock-0", name: "mock-0", title: MOCK_TITLE }),
	);
});

describe("Página de dataset — carga con API key", () => {
	it("crea el cliente CKAN con un apiKey que devuelve el token de la sesión", async () => {
		auth.login("token-de-prueba", makeUser());

		render(DatasetPage);
		await waitFor(() => expect(mocks.createCkanClient).toHaveBeenCalled());

		const config = mocks.createCkanClient.mock.calls[0][0];
		expect(config.apiKey).toBeTypeOf("function");
		expect((config.apiKey as () => string | null)()).toBe("token-de-prueba");
	});

	it("muestra el mensaje de dataset privado y no el mock cuando package_show responde 403", async () => {
		mocks.showDataset.mockRejectedValue(new CkanApiError("Forbidden", 403));

		render(DatasetPage);

		expect(await screen.findByText(PRIVATE_MESSAGE)).toBeTruthy();
		expect(screen.queryByText(MOCK_TITLE)).toBeNull();
	});

	it("muestra el mensaje de no encontrado cuando package_show responde 404", async () => {
		mocks.showDataset.mockRejectedValue(new CkanApiError("Not Found", 404));

		render(DatasetPage);

		expect(await screen.findByText(NOT_FOUND_MESSAGE)).toBeTruthy();
	});

	it("renderiza el título del dataset cuando package_show resuelve", async () => {
		mocks.showDataset.mockResolvedValue(makeDataset());

		render(DatasetPage);

		expect(await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" })).toBeTruthy();
	});
});
