import { describe, expect, it } from "vitest";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { formatCitationAPA, formatCitationBibTeX, formatCitationNatural } from "./citation";

function makeOrg(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-1",
		name: "facultad-medicina",
		title: "Facultad de Medicina",
		description: "Datos de salud pública",
		created: "2020-01-01T00:00:00Z",
		state: "active",
		...overrides,
	};
}

function makeDataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "dataset-1",
		name: "indicadores-salud",
		title: "Indicadores de salud pública",
		private: false,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2024-05-10T12:00:00Z",
		metadata_modified: "2024-05-10T12:00:00Z",
		...overrides,
	};
}

describe("formatCitationAPA", () => {
	it("formatea con autor presente", () => {
		const dataset = makeDataset({
			author: "Juan Pérez",
			version: "2.0",
			organization: makeOrg(),
		});

		expect(formatCitationAPA(dataset)).toBe(
			"Pérez, J. (2024). Indicadores de salud pública (Version 2.0) [Data set]. Universidad Mayor de San Simón, Facultad de Medicina. https://datos.umss.edu/dataset/indicadores-salud",
		);
	});

	it("usa el título de la organización como fallback cuando no hay autor", () => {
		const dataset = makeDataset({ organization: makeOrg() });

		expect(formatCitationAPA(dataset)).toContain("Facultad de Medicina (2024)");
	});

	it("usa el fallback por defecto cuando no hay autor ni organización", () => {
		const dataset = makeDataset();

		expect(formatCitationAPA(dataset)).toContain("Universidad Mayor de San Simón (2024)");
	});

	it("deriva el año de metadata_created", () => {
		const dataset = makeDataset({ metadata_created: "2021-03-15T00:00:00Z" });

		expect(formatCitationAPA(dataset)).toContain("(2021)");
	});
});

describe("formatCitationBibTeX", () => {
	it("incluye @dataset, autor, año y url", () => {
		const dataset = makeDataset({ author: "Juan Pérez", organization: makeOrg() });

		const result = formatCitationBibTeX(dataset);

		expect(result).toContain("@dataset{");
		expect(result).toContain("author    = {Juan Pérez}");
		expect(result).toContain("year      = {2024}");
		expect(result).toContain("url       = {https://datos.umss.edu/dataset/indicadores-salud}");
	});

	it("construye la key con autor + año + título", () => {
		const dataset = makeDataset({ author: "Juan Pérez" });

		expect(formatCitationBibTeX(dataset)).toContain("@dataset{juan2024indicadores,");
	});
});

describe("formatCitationNatural", () => {
	it("formatea org + año + título + Datos UMSS", () => {
		const dataset = makeDataset({ organization: makeOrg() });

		expect(formatCitationNatural(dataset)).toBe(
			"Universidad Mayor de San Simón, Facultad de Medicina. (2024). Indicadores de salud pública. Datos UMSS.",
		);
	});

	it("usa el fallback sin organización", () => {
		const dataset = makeDataset();

		expect(formatCitationNatural(dataset)).toBe(
			"Universidad Mayor de San Simón. (2024). Indicadores de salud pública. Datos UMSS.",
		);
	});
});
