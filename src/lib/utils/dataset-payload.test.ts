import { describe, expect, it } from "vitest";
import {
	buildPackagePayload,
	inferResourceFormat,
	MAX_RESOURCE_BYTES,
	suggestSlug,
	validateResourceFile,
} from "./dataset-payload";
import { SUMMARY_EXTRA_KEY } from "./dataset-summary";

const base = {
	title: "Matrícula Estudiantil 2026",
	name: "matricula-estudiantil-2026",
	owner_org: "facultad-de-ciencias",
	private: true,
};

describe("buildPackagePayload", () => {
	it("con lo mínimo emite solo los campos obligatorios", () => {
		expect(buildPackagePayload(base)).toEqual({
			title: "Matrícula Estudiantil 2026",
			name: "matricula-estudiantil-2026",
			owner_org: "facultad-de-ciencias",
			private: true,
		});
	});

	it("omite los opcionales vacíos en lugar de mandar cadenas vacías", () => {
		const payload = buildPackagePayload({
			...base,
			notes: "",
			license_id: "",
			tag_string: "   ",
			url: "",
			maintainer: "",
		});

		expect(payload).not.toHaveProperty("notes");
		expect(payload).not.toHaveProperty("license_id");
		expect(payload).not.toHaveProperty("tag_string");
		expect(payload).not.toHaveProperty("url");
		expect(payload).not.toHaveProperty("maintainer");
	});

	it("coloca los opcionales en campos nativos de CKAN", () => {
		const payload = buildPackagePayload({
			...base,
			notes: "Descripción",
			license_id: "cc-by",
			tag_string: "matricula, estudiantes",
			url: "https://umss.edu.bo/datos",
			maintainer: "Dirección de Sistemas",
			maintainer_email: "datos@umss.edu.bo",
		});

		expect(payload.notes).toBe("Descripción");
		expect(payload.license_id).toBe("cc-by");
		expect(payload.tag_string).toBe("matricula, estudiantes");
		expect(payload.url).toBe("https://umss.edu.bo/datos");
		expect(payload.maintainer).toBe("Dirección de Sistemas");
		expect(payload.maintainer_email).toBe("datos@umss.edu.bo");
	});

	it("no escribe ningún extra (decisión v0: sin claves DCAT inventadas)", () => {
		const payload = buildPackagePayload({
			...base,
			notes: "Descripción",
			license_id: "cc-by",
			tag_string: "uno, dos",
			url: "https://umss.edu.bo/datos",
			maintainer: "Dirección de Sistemas",
			maintainer_email: "datos@umss.edu.bo",
		});

		expect(payload).not.toHaveProperty("extras");
	});

	it("recorta los espacios de los valores", () => {
		const payload = buildPackagePayload({
			...base,
			title: "  Matrícula 2026  ",
			owner_org: "  facultad-de-ciencias  ",
			notes: "  Descripción  ",
		});

		expect(payload.title).toBe("Matrícula 2026");
		expect(payload.owner_org).toBe("facultad-de-ciencias");
		expect(payload.notes).toBe("Descripción");
	});

	it("respeta la visibilidad pública", () => {
		expect(buildPackagePayload({ ...base, private: false }).private).toBe(false);
	});
});

describe("suggestSlug", () => {
	it("deriva el slug del título quitando acentos y separadores", () => {
		expect(suggestSlug("Matrícula Estudiantil 2026")).toBe("matricula-estudiantil-2026");
	});

	it("colapsa separadores repetidos y recorta los extremos", () => {
		expect(suggestSlug("  Datos   Abiertos -- UMSS  ")).toBe("datos-abiertos-umss");
	});

	it("descarta signos de puntuación", () => {
		expect(suggestSlug("¿Matrícula? (2026)")).toBe("matricula-2026");
	});

	it("conserva guiones y guión bajo existentes", () => {
		expect(suggestSlug("covid_19-bolivia")).toBe("covid_19-bolivia");
	});

	it("no supera los 100 caracteres que acepta el schema", () => {
		expect(suggestSlug("a".repeat(150)).length).toBeLessThanOrEqual(100);
	});

	it("no deja un separador colgando al truncar en el límite de 100 (guión y guión bajo)", () => {
		const long = "a".repeat(99);
		expect(suggestSlug(`${long}-b`)).toBe(long);
		expect(suggestSlug(`${long}_b`)).toBe(long);
	});

	it("recorta un título largo terminado en separador justo en el límite", () => {
		const hundred = "a".repeat(100);
		expect(suggestSlug(`${hundred}-`)).toBe(hundred);
	});

	it("devuelve una cadena vacía cuando no queda nada utilizable", () => {
		expect(suggestSlug("¡...!")).toBe("");
	});
});

describe("inferResourceFormat", () => {
	it("toma la extensión en mayúsculas", () => {
		expect(inferResourceFormat("matricula.csv")).toBe("CSV");
		expect(inferResourceFormat("informe.pdf")).toBe("PDF");
	});

	it("no depende de mayúsculas ni minúsculas en la extensión", () => {
		expect(inferResourceFormat("MATRICULA.CSV")).toBe("CSV");
	});

	it("devuelve una cadena vacía cuando no hay extensión", () => {
		expect(inferResourceFormat("sin-extension")).toBe("");
	});

	it("usa solo la última extensión cuando hay puntos en el nombre", () => {
		expect(inferResourceFormat("datos.2026.csv")).toBe("CSV");
	});
});

describe("validateResourceFile", () => {
	it("acepta un archivo de exactamente 50 MB", () => {
		expect(validateResourceFile({ name: "justo.csv", size: MAX_RESOURCE_BYTES })).toEqual({
			ok: true,
		});
	});

	it("rechaza un archivo mayor, nombrando el archivo y su tamaño", () => {
		const result = validateResourceFile({
			name: "grande.csv",
			size: MAX_RESOURCE_BYTES + 1024 * 1024,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toContain("grande.csv");
			expect(result.message).toContain("51.0 MB");
			expect(result.message).toContain("50 MB");
		}
	});

	it("el límite es el de PRD RF-12 (50 MB)", () => {
		expect(MAX_RESOURCE_BYTES).toBe(50 * 1024 * 1024);
	});
});

describe("buildPackagePayload — resumen (RF-40)", () => {
	it("escribe el resumen como extra del dataset", () => {
		const payload = buildPackagePayload({ ...base, summary: "  Un resumen corto  " });
		expect(payload.extras).toEqual([{ key: SUMMARY_EXTRA_KEY, value: "Un resumen corto" }]);
	});

	it("no escribe extras si no hay resumen", () => {
		expect(buildPackagePayload({ ...base }).extras).toBeUndefined();
		expect(buildPackagePayload({ ...base, summary: "   " }).extras).toBeUndefined();
	});
});
