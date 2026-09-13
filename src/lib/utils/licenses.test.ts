import { describe, expect, it } from "vitest";
import { curatedLicenseLabel, licenseLabel } from "./licenses";

describe("curatedLicenseLabel", () => {
	it("devuelve el label curado para un id que CKAN ofrece", () => {
		expect(curatedLicenseLabel("cc-by")).toBe("CC BY — Atribución");
		expect(curatedLicenseLabel("cc-by-sa")).toBe("CC BY-SA — Atribución-CompartirIgual");
		expect(curatedLicenseLabel("cc-by-nc-nd")).toBe(
			"CC BY-NC-ND — Atribución-NoComercial-SinDerivadas",
		);
	});

	it("devuelve null para los ids eliminados que CKAN no ofrece", () => {
		expect(curatedLicenseLabel("cc-by-nc")).toBeNull();
		expect(curatedLicenseLabel("cc-by-nc-sa")).toBeNull();
		expect(curatedLicenseLabel("cc0-1.0")).toBeNull();
		expect(curatedLicenseLabel("pddl")).toBeNull();
	});

	it("devuelve el label curado para odc-pddl", () => {
		expect(curatedLicenseLabel("odc-pddl")).toBe("PDDL — Dominio Público");
	});

	it("devuelve null para ids desconocidos", () => {
		expect(curatedLicenseLabel("no-existe")).toBeNull();
		expect(curatedLicenseLabel("")).toBeNull();
	});
});

describe("licenseLabel se mantiene intacto", () => {
	it("sigue dando el label completo para ids que ya no están curados", () => {
		// Aunque `cc-by-nc` ya no sea curado, `licenseLabel` conserva su fallback de legibilidad.
		expect(licenseLabel("cc-by-nc")).toBe("CC BY-NC — Atribución-NoComercial");
		expect(licenseLabel("pddl")).toBe("PDDL — Dominio Público");
	});

	it("capitaliza ids sin label conocido", () => {
		expect(licenseLabel("no-existe")).toBe("No-existe");
	});
});
