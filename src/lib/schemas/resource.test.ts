import { describe, expect, it } from "vitest";
import {
	MAX_RESOURCE_DESCRIPTION_LENGTH,
	MAX_RESOURCE_NAME_LENGTH,
	resourceCreateSchema,
} from "./resource";

const base = {
	tipo: "archivo" as const,
	name: "Informe de gestión 2026",
};

describe("resourceCreateSchema — nombre", () => {
	it("exige un nombre (CKAN no lo hereda del archivo)", () => {
		expect(resourceCreateSchema.safeParse({ ...base, name: "" }).success).toBe(false);
		expect(resourceCreateSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
	});

	it("recorta los espacios del nombre", () => {
		expect(resourceCreateSchema.parse({ ...base, name: "  Datos 2026  " }).name).toBe("Datos 2026");
	});

	it(`rechaza más de ${MAX_RESOURCE_NAME_LENGTH} caracteres (tope de UX del portal)`, () => {
		const largo = "x".repeat(MAX_RESOURCE_NAME_LENGTH + 1);
		const result = resourceCreateSchema.safeParse({ ...base, name: largo });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path[0] === "name")).toBe(true);
		}
	});
});

describe("resourceCreateSchema — descripción", () => {
	it("es opcional", () => {
		expect(resourceCreateSchema.parse(base).description).toBeUndefined();
		expect(resourceCreateSchema.parse({ ...base, description: "   " }).description).toBeUndefined();
	});

	it("recorta y conserva el texto válido", () => {
		expect(
			resourceCreateSchema.parse({ ...base, description: "  Tabla completa  " }).description,
		).toBe("Tabla completa");
	});

	it(`rechaza más de ${MAX_RESOURCE_DESCRIPTION_LENGTH} caracteres`, () => {
		const largo = "d".repeat(MAX_RESOURCE_DESCRIPTION_LENGTH + 1);
		const result = resourceCreateSchema.safeParse({ ...base, description: largo });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path[0] === "description")).toBe(true);
		}
	});
});

describe("resourceCreateSchema — enlace", () => {
	it("un enlace exige URL", () => {
		const result = resourceCreateSchema.safeParse({ tipo: "enlace", name: "Tablero" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toEqual(["url"]);
			expect(result.error.issues[0].message).toBe("Escriba la URL del enlace.");
		}
	});

	it("un archivo no necesita URL", () => {
		expect(resourceCreateSchema.safeParse({ ...base, tipo: "archivo" }).success).toBe(true);
	});

	it("acepta http y https", () => {
		expect(
			resourceCreateSchema.parse({
				tipo: "enlace",
				name: "Tablero",
				url: " https://datos.umss.edu/x ",
			}).url,
		).toBe("https://datos.umss.edu/x");
	});

	it("rechaza esquemas ejecutables con el mismo mensaje que el resto de la app", () => {
		const result = resourceCreateSchema.safeParse({
			tipo: "enlace",
			name: "X",
			url: "javascript:alert(1)",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"El enlace debe usar los protocolos http o https.",
			);
		}
	});

	it("rechaza una URL relativa o mal formada", () => {
		const result = resourceCreateSchema.safeParse({
			tipo: "enlace",
			name: "X",
			url: "datos.umss.edu/x",
		});
		expect(result.success).toBe(false);
	});

	it("rechaza una URL de más de 500 caracteres", () => {
		const result = resourceCreateSchema.safeParse({
			tipo: "enlace",
			name: "X",
			url: `https://datos.umss.edu/${"a".repeat(600)}`,
		});
		expect(result.success).toBe(false);
	});
});
