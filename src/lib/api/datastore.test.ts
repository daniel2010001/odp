import { describe, expect, it, vi } from "vitest";
import type { CkanClient } from "./client";
import { createDatastoreApi } from "./datastore";

function makeClient() {
	const post = vi.fn().mockResolvedValue({ fields: [], records: [], total: 0 });
	return {
		client: { post } as unknown as CkanClient,
		post,
	};
}

describe("createDatastoreApi", () => {
	it("search llama a datastore_search con resource_id y limit por defecto", async () => {
		const { client, post } = makeClient();
		const api = createDatastoreApi(client);

		await api.search("res-1");

		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("datastore_search");
		expect(params.resource_id).toBe("res-1");
		expect(params.limit).toBe(20);
		expect(params.offset).toBe(0);
	});

	it("search respeta limit y offset proporcionados", async () => {
		const { client, post } = makeClient();
		const api = createDatastoreApi(client);

		await api.search("res-1", { limit: 5, offset: 10 });

		const [, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(params.limit).toBe(5);
		expect(params.offset).toBe(10);
	});

	it("mapea fields, records y total del resultado de CKAN", async () => {
		const { client, post } = makeClient();
		post.mockResolvedValue({
			fields: [{ id: "ciudad", type: "text" }],
			records: [{ ciudad: "Cochabamba" }],
			total: 42,
		});
		const api = createDatastoreApi(client);

		const result = await api.search("res-1");

		expect(result).toEqual({
			fields: [{ id: "ciudad", type: "text" }],
			records: [{ ciudad: "Cochabamba" }],
			total: 42,
		});
	});
});
