import { describe, expect, it } from "vitest";
import { stateLabel } from "./states";

describe("stateLabel", () => {
	it("nombra los estados conocidos", () => {
		expect(stateLabel("active")).toBe("Activo");
		expect(stateLabel("draft")).toBe("Borrador");
		expect(stateLabel("deleted")).toBe("Eliminado");
	});

	it("un estado desconocido no se descarta: cae a una etiqueta neutra", () => {
		expect(stateLabel("pending-review")).toBe("Sin clasificar");
	});

	it("sin estado no hay nada que nombrar", () => {
		expect(stateLabel(undefined)).toBeNull();
		expect(stateLabel("")).toBeNull();
	});
});
