// El mínimo y el máximo de una columna, para proponer el paso de los rangos (L49). Se piden por el puente con
// `datastore_search`, ordenados con `nulls last`: el filtro `{ col: null }` de CKAN no encuentra los vacíos
// (medido), así que ordenar es la única forma de saltarlos.

import { describe, expect, it, vi } from "vitest";
import { readColumnRange } from "./column-range";

function fakeClient(records: Record<string, Record<string, unknown>[]>) {
	return {
		post: vi.fn(async (_action: string, body: Record<string, unknown>) => ({
			records: records[String(body.sort)] ?? [],
		})),
	};
}

describe("readColumnRange", () => {
	it("pide el menor y el mayor valor con los vacíos al final, por el nombre entre comillas", async () => {
		const client = fakeClient({
			'"monto ejecutado" asc nulls last': [{ "monto ejecutado": 499.78 }],
			'"monto ejecutado" desc nulls last': [{ "monto ejecutado": "398177.9" }],
		});

		await expect(readColumnRange(client, "recurso-1", "monto ejecutado")).resolves.toEqual({
			min: 499.78,
			max: 398177.9,
		});
		expect(client.post).toHaveBeenCalledWith("datastore_search", {
			resource_id: "recurso-1",
			limit: 1,
			fields: ["monto ejecutado"],
			sort: '"monto ejecutado" asc nulls last',
		});
		expect(client.post).toHaveBeenCalledTimes(2);
	});

	it("una columna sin valores no tiene rango", async () => {
		const client = fakeClient({
			'"x" asc nulls last': [{ x: null }],
			'"x" desc nulls last': [{ x: null }],
		});

		await expect(readColumnRange(client, "recurso-1", "x")).resolves.toBeNull();
	});

	it("una tabla vacía no tiene rango", async () => {
		await expect(readColumnRange(fakeClient({}), "recurso-1", "x")).resolves.toBeNull();
	});

	it("un valor que no es un número no es un rango", async () => {
		const client = fakeClient({
			'"x" asc nulls last': [{ x: "abc" }],
			'"x" desc nulls last': [{ x: 3 }],
		});

		await expect(readColumnRange(client, "recurso-1", "x")).resolves.toBeNull();
	});

	it("un fallo del catálogo no rompe el formulario: no hay rango", async () => {
		const client = {
			post: vi.fn(async () => {
				throw new Error("HTTP 500");
			}),
		};

		await expect(readColumnRange(client, "recurso-1", "x")).resolves.toBeNull();
	});
});
