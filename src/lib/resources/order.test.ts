import { describe, expect, it } from "vitest";
import type { CkanResource } from "$lib/types/ckan";
import { resourceNeighbours } from "./order";

/** Fixture mínimo: la decisión sólo lee `id` y `position`. */
function resource(id: string, position?: number): Pick<CkanResource, "id"> & { position?: number } {
	return position === undefined ? { id } : { id, position };
}

describe("resourceNeighbours", () => {
	it("ordena por la `position` de CKAN aunque la lista venga desordenada", () => {
		const resultado = resourceNeighbours(
			[resource("c", 2), resource("a", 0), resource("b", 1)],
			"b",
		);

		expect(resultado.ordered.map((r) => r.id)).toEqual(["a", "b", "c"]);
		expect(resultado.index).toBe(1);
	});

	it("da el anterior y el siguiente del recurso actual", () => {
		const resultado = resourceNeighbours(
			[resource("a", 0), resource("b", 1), resource("c", 2)],
			"b",
		);

		expect(resultado.previous?.id).toBe("a");
		expect(resultado.next?.id).toBe("c");
	});

	it("en los extremos falta el que no existe, en vez de envolver", () => {
		const primero = resourceNeighbours([resource("a", 0), resource("b", 1)], "a");
		const ultimo = resourceNeighbours([resource("a", 0), resource("b", 1)], "b");

		// No envuelve a propósito: pasar del primero al último daría un salto que el usuario no pidió.
		expect(primero.previous).toBeUndefined();
		expect(primero.next?.id).toBe("b");
		expect(ultimo.previous?.id).toBe("a");
		expect(ultimo.next).toBeUndefined();
	});

	it("un recurso sin `position` no rompe el orden ni la cuenta", () => {
		// CKAN siempre manda `position`, pero el portal no puede depender de eso para no romperse.
		const resultado = resourceNeighbours(
			[resource("a", 1), resource("sin-position")],
			"sin-position",
		);

		expect(resultado.ordered).toHaveLength(2);
		expect(resultado.previous?.id).toBe("a");
		expect(resultado.next).toBeUndefined();
	});

	it("el recurso actual que no está en la lista deja todo sin vecinos", () => {
		const resultado = resourceNeighbours([resource("a", 0), resource("b", 1)], "ajeno");

		expect(resultado.index).toBe(-1);
		expect(resultado.previous).toBeUndefined();
		expect(resultado.next).toBeUndefined();
	});

	it("una lista vacía o ausente no lanza", () => {
		expect(resourceNeighbours([], "a").ordered).toEqual([]);
		expect(resourceNeighbours(undefined, "a").ordered).toEqual([]);
	});

	it("sin recurso actual (mientras carga) tampoco hay vecinos", () => {
		const resultado = resourceNeighbours([resource("a", 0), resource("b", 1)], undefined);

		expect(resultado.ordered).toHaveLength(2);
		expect(resultado.index).toBe(-1);
		expect(resultado.previous).toBeUndefined();
		expect(resultado.next).toBeUndefined();
	});

	it("no muta la lista que recibe", () => {
		const original = [resource("c", 2), resource("a", 0)];

		resourceNeighbours(original, "a");

		expect(original.map((r) => r.id)).toEqual(["c", "a"]);
	});
});
