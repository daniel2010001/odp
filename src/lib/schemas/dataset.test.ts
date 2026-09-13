import { describe, expect, it } from "vitest";
import {
	datasetCreateSchema,
	licenseIdError,
	MAX_MAINTAINER_LENGTH,
	MAX_NOTES_LENGTH,
	MAX_SUMMARY_LENGTH,
	MAX_TITLE_LENGTH,
	MAX_URL_LENGTH,
	tagProblem,
} from "./dataset";

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

describe("datasetCreateSchema — url (página de destino)", () => {
	it("es opcional y se normaliza a undefined cuando viene vacía", () => {
		expect(datasetCreateSchema.parse(base).url).toBeUndefined();
		expect(datasetCreateSchema.parse({ ...base, url: "   " }).url).toBeUndefined();
	});

	it("acepta http y https, y recorta los espacios", () => {
		expect(datasetCreateSchema.parse({ ...base, url: " https://datos.umss.edu/x " }).url).toBe(
			"https://datos.umss.edu/x",
		);
		expect(datasetCreateSchema.parse({ ...base, url: "http://localhost:8080/x" }).url).toBe(
			"http://localhost:8080/x",
		);
	});

	it("rechaza esquemas ejecutables con el mismo mensaje que los enlaces de recurso", () => {
		const result = datasetCreateSchema.safeParse({ ...base, url: "javascript:alert(1)" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"El enlace debe usar los protocolos http o https.",
			);
			expect(result.error.issues[0].path).toEqual(["url"]);
		}
	});

	it("rechaza una URL relativa o mal formada", () => {
		const result = datasetCreateSchema.safeParse({ ...base, url: "datos.umss.edu/x" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toContain("no es válida");
		}
	});
});

describe("datasetCreateSchema — maintainer_email", () => {
	it("es opcional y se normaliza a undefined cuando viene vacío", () => {
		expect(datasetCreateSchema.parse(base).maintainer_email).toBeUndefined();
		expect(datasetCreateSchema.parse({ ...base, maintainer_email: "  " }).maintainer_email).toBe(
			undefined,
		);
	});

	it("acepta un email válido y lo recorta", () => {
		expect(
			datasetCreateSchema.parse({ ...base, maintainer_email: " datos@umss.edu " }).maintainer_email,
		).toBe("datos@umss.edu");
	});

	it("rechaza un email mal formado, incluso con puntos mal usados", () => {
		for (const invalido of ["datos", "datos@", "@umss.edu", ".datos@umss.edu", "a..b@umss.edu"]) {
			const result = datasetCreateSchema.safeParse({ ...base, maintainer_email: invalido });
			expect(result.success, `debería rechazar «${invalido}»`).toBe(false);
		}
	});
});

describe("datasetCreateSchema — maintainer", () => {
	it("es opcional y se recorta", () => {
		expect(datasetCreateSchema.parse(base).maintainer).toBeUndefined();
		expect(
			datasetCreateSchema.parse({ ...base, maintainer: "  Unidad de Datos  " }).maintainer,
		).toBe("Unidad de Datos");
	});
});

describe("datasetCreateSchema — tag_string", () => {
	const tags = (tag_string: string) =>
		datasetCreateSchema.parse({ ...base, tag_string }).tag_string;

	it("normaliza como CKAN: separa por coma, recorta y descarta vacíos", () => {
		expect(tags("salud, educacion ,, ")).toBe("salud, educacion");
	});

	it("elimina duplicados conservando el orden", () => {
		expect(tags("salud, educacion, salud")).toBe("salud, educacion");
	});

	it("rechaza un tag de un solo carácter (mínimo de CKAN)", () => {
		const result = datasetCreateSchema.safeParse({ ...base, tag_string: "salud, a" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toEqual(["tag_string"]);
			expect(result.error.issues[0].message).toContain("2");
		}
	});

	it("rechaza un tag de más de 100 caracteres (máximo de CKAN)", () => {
		const result = datasetCreateSchema.safeParse({ ...base, tag_string: "a".repeat(101) });
		expect(result.success).toBe(false);
	});

	it("rechaza caracteres que CKAN no acepta (coma, barra, dos puntos, comillas)", () => {
		for (const invalido of ["salud/mental", "a:b", "salud“x”"]) {
			const result = datasetCreateSchema.safeParse({ ...base, tag_string: invalido });
			expect(result.success, `debería rechazar «${invalido}»`).toBe(false);
		}
	});

	it("acepta el charset real de CKAN: letras, números, espacio, guion, guión bajo y punto", () => {
		expect(tags("covid-19, salud_publica, v2.1, gestión escolar")).toBe(
			"covid-19, salud_publica, v2.1, gestión escolar",
		);
	});
});

describe("datasetCreateSchema — topes de UX del portal", () => {
	it(`rechaza un título de más de ${MAX_TITLE_LENGTH} caracteres`, () => {
		const result = datasetCreateSchema.safeParse({
			...base,
			title: "x".repeat(MAX_TITLE_LENGTH + 1),
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toEqual(["title"]);
			expect(result.error.issues[0].message).toContain(String(MAX_TITLE_LENGTH));
		}
	});

	it("acepta un título exactamente en el tope", () => {
		expect(
			datasetCreateSchema.safeParse({ ...base, title: "x".repeat(MAX_TITLE_LENGTH) }).success,
		).toBe(true);
	});

	it(`rechaza una descripción de más de ${MAX_NOTES_LENGTH} caracteres`, () => {
		const result = datasetCreateSchema.safeParse({
			...base,
			notes: "d".repeat(MAX_NOTES_LENGTH + 1),
		});
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0].path).toEqual(["notes"]);
	});

	it(`rechaza un responsable de más de ${MAX_MAINTAINER_LENGTH} caracteres`, () => {
		const result = datasetCreateSchema.safeParse({
			...base,
			maintainer: "m".repeat(MAX_MAINTAINER_LENGTH + 1),
		});
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0].path).toEqual(["maintainer"]);
	});

	it(`rechaza una URL de más de ${MAX_URL_LENGTH} caracteres`, () => {
		const result = datasetCreateSchema.safeParse({
			...base,
			url: `https://datos.umss.edu/${"a".repeat(MAX_URL_LENGTH + 10)}`,
		});
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0].path).toEqual(["url"]);
	});
});

describe("datasetCreateSchema — título: reglas del portal", () => {
	it("acepta un título de un solo carácter (solo se exige no-vacío)", () => {
		expect(datasetCreateSchema.safeParse({ ...base, title: "A" }).success).toBe(true);
	});

	it("rechaza un título vacío o de solo espacios", () => {
		expect(datasetCreateSchema.safeParse({ ...base, title: "" }).success).toBe(false);
		expect(datasetCreateSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
	});

	it("recorta los espacios del título", () => {
		expect(datasetCreateSchema.parse({ ...base, title: "  Matrícula 2026  " }).title).toBe(
			"Matrícula 2026",
		);
	});
});

describe("datasetCreateSchema — descripción (notes)", () => {
	it("sigue siendo opcional", () => {
		expect(datasetCreateSchema.parse(base).notes).toBeUndefined();
	});

	it(`acepta una descripción justo en el tope de ${MAX_NOTES_LENGTH}`, () => {
		expect(
			datasetCreateSchema.safeParse({ ...base, notes: "x".repeat(MAX_NOTES_LENGTH) }).success,
		).toBe(true);
	});
});

describe("datasetCreateSchema — resumen (RF-40)", () => {
	it("es opcional", () => {
		expect(datasetCreateSchema.parse(base).summary).toBeUndefined();
	});

	it(`rechaza más de ${MAX_SUMMARY_LENGTH} caracteres`, () => {
		const result = datasetCreateSchema.safeParse({
			...base,
			summary: "s".repeat(MAX_SUMMARY_LENGTH + 1),
		});
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0].path).toEqual(["summary"]);
	});

	it("acepta un resumen justo en el tope", () => {
		expect(
			datasetCreateSchema.safeParse({ ...base, summary: "s".repeat(MAX_SUMMARY_LENGTH) }).success,
		).toBe(true);
	});
});

describe("tagProblem — reglas de CKAN", () => {
	it("devuelve null para una etiqueta válida", () => {
		expect(tagProblem("salud")).toBeNull();
		expect(tagProblem("covid-19")).toBeNull();
		expect(tagProblem("gestión escolar")).toBeNull();
	});

	it("rechaza una etiqueta demasiado corta", () => {
		expect(tagProblem("a")).toContain("entre 2 y 100");
	});

	it("rechaza una etiqueta demasiado larga", () => {
		expect(tagProblem("a".repeat(101))).toContain("entre 2 y 100");
	});

	it("rechaza un carácter que CKAN no acepta", () => {
		expect(tagProblem("salud!")).toContain("solo puede tener");
	});
});

describe("licenseIdError — CKAN no valida la licencia", () => {
	const lista = ["cc-by", "odc-odbl"];

	it("no se queja si el id está en la lista", () => {
		expect(licenseIdError("cc-by", lista)).toBeNull();
	});

	it("no se queja si no hay licencia", () => {
		expect(licenseIdError(undefined, lista)).toBeNull();
		expect(licenseIdError("", lista)).toBeNull();
	});

	it("rechaza un id que no está en la lista (CKAN lo aceptaría igual)", () => {
		expect(licenseIdError("no-existe", lista)).toContain("no está en la lista de CKAN");
	});
});
