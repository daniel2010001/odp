import { describe, expect, it } from "vitest";
import {
	isOfferedInForm,
	labelFor,
	licenseSummary,
	licenseTermsUrl,
	mapLicenseItems,
} from "./licenses";

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
		expect(labelFor("odc-pddl")).toBe("ODC-PDDL — Dominio Público (bases de datos)");
		expect(labelFor("odc-odbl")).toBe("ODbL — Licencia Abierta de Bases de Datos");
	});

	it("usa las etiquetas aprobadas «SIGLA — nombre» para los 15 ids", () => {
		const esperadas: Record<string, string> = {
			"cc-by": "CC BY — Atribución",
			"cc-by-sa": "CC BY-SA — Atribución-CompartirIgual",
			"cc-zero": "CC0 — Dominio Público",
			"cc-nc": "CC BY-NC — Atribución-NoComercial",
			"odc-pddl": "ODC-PDDL — Dominio Público (bases de datos)",
			"odc-odbl": "ODbL — Licencia Abierta de Bases de Datos",
			"odc-by": "ODC-BY — Atribución (bases de datos)",
			gfdl: "GFDL — Licencia de Documentación Libre de GNU",
			"uk-ogl": "OGL — Gobierno Abierto (Reino Unido)",
			"other-open": "Otra licencia abierta",
			"other-pd": "Otra licencia de dominio público",
			"other-at": "Otra licencia con atribución",
			"other-nc": "Otra licencia no comercial",
			"other-closed": "Otra licencia (no abierta)",
			notspecified: "Sin especificar",
		};
		for (const [id, label] of Object.entries(esperadas)) expect(labelFor(id), id).toBe(label);
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
		expect(item.display_name).toBe("ODC-PDDL — Dominio Público (bases de datos)");
		expect(item.display_name).toBe(labelFor("odc-pddl"));
	});
});

describe("isOfferedInForm", () => {
	it("oculta uk-ogl del selector y ofrece el resto", () => {
		expect(isOfferedInForm("uk-ogl")).toBe(false);
		for (const id of Object.keys(OFERTA_CKAN).filter((i) => i !== "uk-ogl")) {
			expect(isOfferedInForm(id), id).toBe(true);
		}
	});
});

describe("licenseSummary", () => {
	it("da una frase en español para cada id que CKAN ofrece, salvo «sin especificar»", () => {
		expect(licenseSummary("cc-by")).toBe(
			"Permite usar, compartir y adaptar los datos, incluso con fines comerciales, citando la fuente.",
		);
		for (const id of Object.keys(OFERTA_CKAN).filter((i) => i !== "notspecified")) {
			expect(licenseSummary(id), id).toMatch(/\.$/);
		}
	});

	it("un id desconocido no tiene resumen", () => {
		expect(licenseSummary("nueva-licencia")).toBeNull();
		expect(licenseSummary(undefined)).toBeNull();
	});
});

describe("licenseTermsUrl", () => {
	it("mapea cada id a su página oficial, en español cuando existe", () => {
		expect(licenseTermsUrl("cc-by", "http://www.opendefinition.org/licenses/cc-by")).toBe(
			"https://creativecommons.org/licenses/by/4.0/deed.es",
		);
		expect(licenseTermsUrl("cc-by-sa")).toBe(
			"https://creativecommons.org/licenses/by-sa/4.0/deed.es",
		);
		expect(licenseTermsUrl("cc-zero")).toBe(
			"https://creativecommons.org/publicdomain/zero/1.0/deed.es",
		);
		expect(licenseTermsUrl("cc-nc")).toBe("https://creativecommons.org/licenses/by-nc/4.0/deed.es");
		expect(licenseTermsUrl("odc-pddl")).toBe("https://opendatacommons.org/licenses/pddl/1-0/");
		expect(licenseTermsUrl("odc-odbl")).toBe("https://opendatacommons.org/licenses/odbl/1-0/");
		expect(licenseTermsUrl("odc-by")).toBe("https://opendatacommons.org/licenses/by/1-0/");
		expect(licenseTermsUrl("gfdl")).toBe("https://www.gnu.org/licenses/fdl-1.3.html");
		expect(licenseTermsUrl("uk-ogl")).toBe(
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		);
	});

	it("todas las direcciones mapeadas son https", () => {
		for (const id of Object.keys(OFERTA_CKAN)) {
			const url = licenseTermsUrl(id);
			if (url) expect(url, id).toMatch(/^https:\/\//);
		}
	});

	it("un id sin página oficial o desconocido cae a la dirección de CKAN", () => {
		expect(licenseTermsUrl("other-open", "https://example.org/terminos")).toBe(
			"https://example.org/terminos",
		);
		expect(licenseTermsUrl("nueva-licencia", "https://example.org/x")).toBe(
			"https://example.org/x",
		);
		expect(licenseTermsUrl(undefined, "https://example.org/x")).toBe("https://example.org/x");
		expect(licenseTermsUrl("nueva-licencia")).toBeUndefined();
	});
});
