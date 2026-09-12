import { render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import type { CkanPackage, CkanResource } from "$lib/types/ckan";
import ResourcePage from "./+page.svelte";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el
// tipo real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	showResource: vi.fn(),
	showDataset: vi.fn(),
	search: vi.fn(),
}));

vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/client", () => ({ createCkanClient: () => ({}) }));
vi.mock("$lib/api/resources", () => ({
	createResourceApi: () => ({ show: mocks.showResource }),
}));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ show: mocks.showDataset }),
}));
vi.mock("$lib/api/datastore", () => ({
	createDatastoreApi: () => ({ search: mocks.search }),
}));

function makeResource(overrides: Partial<CkanResource> = {}): CkanResource {
	return {
		id: "res-1",
		package_id: "pkg-1",
		name: "Matrícula 2026",
		format: "PDF",
		url: "https://datos.umss.edu/matricula-2026.pdf",
		resource_type: "file",
		mimetype: "application/pdf",
		size: 1024,
		created: "2026-01-01T00:00:00.000000",
		last_modified: "2026-01-01T00:00:00.000000",
		state: "active",
		position: 0,
		...overrides,
	};
}

function makeDataset(): CkanPackage {
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
	};
}

/** Todos los `href` renderizados en la página. */
function renderedHrefs(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll("a[href]")).map(
		(anchor) => anchor.getAttribute("href") ?? "",
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	pageStore.set({
		params: { id: "matricula-2026", resourceId: "res-1" },
		url: new URL("http://localhost/"),
	});
	mocks.showResource.mockResolvedValue(makeResource());
	mocks.showDataset.mockResolvedValue(makeDataset());
	mocks.search.mockResolvedValue({ fields: [], records: [], total: 0 });
});

describe("Página de recurso — enlaces externos", () => {
	it("renderiza el enlace de descarga cuando la URL del recurso es http/https", async () => {
		const { container } = render(ResourcePage);

		const download = await screen.findByRole("link", { name: /Descargar recurso/i });
		expect(download.getAttribute("href")).toBe("https://datos.umss.edu/matricula-2026.pdf");
		expect(renderedHrefs(container)).toContain("https://datos.umss.edu/matricula-2026.pdf");
	});

	it("no renderiza un href javascript: guardado en la URL del recurso", async () => {
		mocks.showResource.mockResolvedValue(
			makeResource({ url: "javascript:alert(document.cookie)" }),
		);

		const { container } = render(ResourcePage);
		await waitFor(() => expect(mocks.showResource).toHaveBeenCalled());

		expect(container.querySelector("h1")).toBeTruthy();
		expect(renderedHrefs(container).some((href) => href.startsWith("javascript:"))).toBe(false);
		expect(screen.queryByRole("link", { name: /Descargar recurso/i })).toBeNull();
	});

	it("no renderiza un href javascript: guardado en el extra docs_url", async () => {
		mocks.showResource.mockResolvedValue(
			makeResource({
				resource_type: "api",
				extras: [
					{ key: "api_base_url", value: "https://datos.umss.edu/api" },
					{ key: "docs_url", value: "javascript:alert(document.cookie)" },
				],
			}),
		);

		const { container } = render(ResourcePage);
		await waitFor(() => expect(mocks.showResource).toHaveBeenCalled());

		expect(renderedHrefs(container).some((href) => href.startsWith("javascript:"))).toBe(false);
		expect(screen.queryByRole("link", { name: /Ver documentación de la API/i })).toBeNull();
	});
});
