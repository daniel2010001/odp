import { describe, expect, it } from "vitest";
import { datasetCreateSchema } from "./dataset";

const base = {
	name: "matricula-2026",
	title: "Matrícula 2026",
	owner_org: "facultad-de-ciencias",
};

describe("datasetCreateSchema — owner_org", () => {
	it("acepta un slug de organización", () => {
		expect(datasetCreateSchema.safeParse(base).success).toBe(true);
	});

	it("acepta un UUID de organización", () => {
		const result = datasetCreateSchema.safeParse({
			...base,
			owner_org: "3f7b1b0e-6f4a-4b4e-9a1c-2d3e4f5a6b7c",
		});
		expect(result.success).toBe(true);
	});

	it("rechaza una organización vacía", () => {
		expect(datasetCreateSchema.safeParse({ ...base, owner_org: "" }).success).toBe(false);
	});

	it("rechaza una organización con solo espacios", () => {
		expect(datasetCreateSchema.safeParse({ ...base, owner_org: "   " }).success).toBe(false);
	});

	it("recorta los espacios de una organización válida", () => {
		expect(
			datasetCreateSchema.parse({ ...base, owner_org: "  facultad-de-ciencias  " }).owner_org,
		).toBe("facultad-de-ciencias");
	});

	it("reporta el error en español cuando falta la organización", () => {
		const result = datasetCreateSchema.safeParse({ ...base, owner_org: "" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.map((i) => i.message)).toContain(
				"Debe seleccionar una organización",
			);
		}
	});
});

describe("datasetCreateSchema — contrato del slug", () => {
	it("rechaza mayúsculas", () => {
		expect(datasetCreateSchema.safeParse({ ...base, name: "Matricula" }).success).toBe(false);
	});

	it("rechaza espacios", () => {
		expect(datasetCreateSchema.safeParse({ ...base, name: "matricula 2026" }).success).toBe(false);
	});

	it("acepta guiones y guión bajo", () => {
		expect(datasetCreateSchema.safeParse({ ...base, name: "matricula_2026-a" }).success).toBe(true);
	});

	it("rechaza un slug de un solo carácter", () => {
		expect(datasetCreateSchema.safeParse({ ...base, name: "a" }).success).toBe(false);
	});
});

describe("datasetCreateSchema — visibilidad", () => {
	it("es privado por defecto", () => {
		expect(datasetCreateSchema.parse(base).private).toBe(true);
	});

	it("respeta la visibilidad pública explícita", () => {
		expect(datasetCreateSchema.parse({ ...base, private: false }).private).toBe(false);
	});
});
