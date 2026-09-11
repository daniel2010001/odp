import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { DatastoreApi } from "$lib/api/datastore";
import type { CkanResource } from "$lib/types/ckan";
import ResourcePreview from "./ResourcePreview.svelte";

function makeResource(format: string): CkanResource {
	return {
		id: "res-1",
		package_id: "pkg-1",
		name: "Flujos vehiculares",
		format,
		url: "https://example.com/flujos.csv",
		created: "2024-01-01T00:00:00Z",
		last_modified: "2024-01-01T00:00:00Z",
		state: "active",
		position: 0,
	};
}

function makeDatastore() {
	const search = vi.fn();
	return {
		api: { search } as unknown as DatastoreApi,
		search,
	};
}

describe("ResourcePreview", () => {
	it("no consulta el datastore para formatos que no son CSV", async () => {
		const { api, search } = makeDatastore();
		render(ResourcePreview, { props: { resource: makeResource("PDF"), datastore: api } });

		expect(await screen.findByText(/únicamente para recursos CSV/i)).toBeInTheDocument();
		expect(search).not.toHaveBeenCalled();
	});

	it("consulta el datastore y renderiza las filas", async () => {
		const { api, search } = makeDatastore();
		search.mockResolvedValue({
			fields: [{ id: "ciudad", type: "text" }],
			records: [{ ciudad: "Cochabamba" }],
			total: 1,
		});
		render(ResourcePreview, { props: { resource: makeResource("CSV"), datastore: api } });

		expect(await screen.findByText("Cochabamba")).toBeInTheDocument();
		expect(search).toHaveBeenCalledWith("res-1", { limit: 20 });
	});

	it("muestra el estado vacío cuando no hay registros", async () => {
		const { api, search } = makeDatastore();
		search.mockResolvedValue({ fields: [], records: [], total: 0 });
		render(ResourcePreview, { props: { resource: makeResource("CSV"), datastore: api } });

		expect(await screen.findByText(/aún no tiene datos cargados/i)).toBeInTheDocument();
	});

	it("muestra el estado de error cuando el datastore falla", async () => {
		const { api, search } = makeDatastore();
		search.mockRejectedValue(new Error("boom"));
		render(ResourcePreview, { props: { resource: makeResource("CSV"), datastore: api } });

		expect(
			await screen.findByText(/No se pudo cargar la vista previa de datos/i),
		).toBeInTheDocument();
	});
});
