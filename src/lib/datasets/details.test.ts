import { describe, expect, it } from "vitest";
import type { CkanPackage } from "$lib/types/ckan";
import { summaryFacts, technicalGroups } from "./details";

const dataset = (overrides: Partial<CkanPackage> = {}): CkanPackage =>
	({
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula",
		state: "active",
		private: false,
		metadata_created: "2026-01-01T00:00:00",
		metadata_modified: "2026-01-01T00:00:00",
		...overrides,
	}) as CkanPackage;

const rowValue = (d: CkanPackage, label: string) =>
	technicalGroups(d)
		.flatMap((g) => g.rows)
		.find((r) => r.label === label)?.value;

describe("licencia y estado de la ficha", () => {
	it("el resumen y la información técnica dicen la licencia con la etiqueta del portal", () => {
		const d = dataset({ license_id: "odc-pddl", license_title: "Open Data Commons PDDL" });
		expect(summaryFacts(d).find((f) => f.key === "license")?.value).toBe(
			"ODC-PDDL — Dominio Público (bases de datos)",
		);
		expect(rowValue(d, "Licencia")).toBe("ODC-PDDL — Dominio Público (bases de datos)");
	});

	it("un id fuera de la tabla muestra el título de CKAN", () => {
		const d = dataset({ license_id: "otra", license_title: "Otra Licencia 2.0" });
		expect(rowValue(d, "Licencia")).toBe("Otra Licencia 2.0");
	});

	it("un dataset sin licencia no inventa la fila", () => {
		expect(rowValue(dataset(), "Licencia")).toBeUndefined();
		expect(summaryFacts(dataset()).some((f) => f.key === "license")).toBe(false);
	});

	it("un estado desconocido no hace desaparecer la fila «Estado»", () => {
		expect(rowValue(dataset({ state: "pending-review" as CkanPackage["state"] }), "Estado")).toBe(
			"Sin clasificar",
		);
		expect(rowValue(dataset({ state: "draft" }), "Estado")).toBe("Borrador");
	});
});
