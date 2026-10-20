import { describe, expect, it } from "vitest";
import { labelFor, mapLicenseItems } from "./licenses";

// Los 15 ids que `license_list` de CKAN 2.12 devolvió en dev (2026-10-20), con sus títulos en inglés.
const OFERTA_CKAN: Record<string, string> = {
	notspecified: "License not specified",
	"odc-pddl": "Open Data Commons Public Domain Dedication and License (PDDL)",
	"odc-odbl": "Open Data Commons Open Database License (ODbL)",
	"odc-by": "Open Data Commons Attribution License",
	"cc-zero": "Creative Commons CCZero",
	"cc-by": "Creative Commons Attribution",
	"cc-by-sa": "Creative Commons Attribution Share-Alike",
	gfdl: "GNU Free Documentation License",
	"other-open": "Other (Open)",
	"other-pd": "Other (Public Domain)",
	"other-at": "Other (Attribution)",
	"uk-ogl": "UK Open Government Licence (OGL)",
	"cc-nc": "Creative Commons Non-Commercial (Any)",
	"other-nc": "Other (Non-Commercial)",
	"other-closed": "Other (Not Open)",
};

describe("labelFor", () => {
	it("da el nombre del portal para un id de CKAN, ignorando el título en inglés", () => {
		expect(labelFor("cc-by", "Creative Commons Attribution")).toBe("CC BY — Atribución");
		expect(labelFor("odc-pddl")).toBe("PDDL — Dominio Público");
		expect(labelFor("odc-odbl")).toBe("ODbL — Open Database License");
	});

	it("cubre los 15 ids que CKAN ofrece: ninguno cae al título en inglés", () => {
		for (const [id, title] of Object.entries(OFERTA_CKAN)) {
			expect(labelFor(id, title), id).not.toBe(title);
		}
	});

	it("«notspecified» se dice «Sin especificar»", () => {
		expect(labelFor("notspecified", "License not specified")).toBe("Sin especificar");
	});

	it("un id que CKAN ofrece pero la tabla no tiene muestra el título de CKAN, no el id", () => {
		expect(labelFor("nueva-licencia", "Nueva Licencia 1.0")).toBe("Nueva Licencia 1.0");
	});

	it("sin entrada ni título muestra el id tal cual, sin desfigurarlo", () => {
		expect(labelFor("nueva-licencia")).toBe("nueva-licencia");
	});

	it("sin id muestra el título, y sin ninguno de los dos, «Sin especificar»", () => {
		expect(labelFor(undefined, "Creative Commons Atribución 4.0")).toBe(
			"Creative Commons Atribución 4.0",
		);
		expect(labelFor("")).toBe("Sin especificar");
	});

	it("los ids que CKAN no ofrece ya no tienen entrada propia", () => {
		expect(labelFor("cc-by-nc", "Algo")).toBe("Algo");
		expect(labelFor("pddl")).toBe("pddl");
	});
});

describe("mapLicenseItems", () => {
	it("el facet usa la misma etiqueta que el formulario", () => {
		const [item] = mapLicenseItems([{ name: "odc-pddl", count: 4 }]);
		expect(item.display_name).toBe("PDDL — Dominio Público");
		expect(item.display_name).toBe(labelFor("odc-pddl"));
	});
});
