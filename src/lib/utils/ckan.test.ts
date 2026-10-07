import { describe, expect, it } from "vitest";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { formatRelativeAge, ownerOrgIdOf } from "./ckan";

function makeOrganization(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-2",
		name: "fcyt",
		title: "Facultad de Ciencias y Tecnología",
		description: "",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

function makePackage(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: false,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

describe("formatRelativeAge", () => {
	// La antigüedad es una función pura de (fecha, ahora): se prueba siempre con un `now` fijo y
	// nunca contra la hora real de la máquina.
	const AHORA = new Date("2026-10-07T12:00:00");

	it("el mismo día dice «hoy»", () => {
		// Mutación que lo rompe: contar por milisegundos y cortar en 1 día devolvería «hace 1 día».
		expect(formatRelativeAge("2026-10-07T08:00:00.000000", AHORA)).toBe("hoy");
	});

	it("un día es «hace 1 día» (singular)", () => {
		// Mutación que lo rompe: pluralizar siempre devolvería «hace 1 días».
		expect(formatRelativeAge("2026-10-06T09:00:00.000000", AHORA)).toBe("hace 1 día");
	});

	it("varios días es «hace N días» (plural)", () => {
		// Mutación que lo rompe: singularizar siempre devolvería «hace 5 día».
		expect(formatRelativeAge("2026-10-02T00:00:00.000000", AHORA)).toBe("hace 5 días");
	});

	it("un mes es «hace 1 mes» (singular)", () => {
		// Mutación que lo rompe: pluralizar siempre devolvería «hace 1 meses».
		expect(formatRelativeAge("2026-09-07T12:00:00.000000", AHORA)).toBe("hace 1 mes");
	});

	it("varios meses es «hace N meses» (plural)", () => {
		// Mutación que lo rompe: contar mal el tramo devolvería otro N; saltar a años daría «hace 0 años».
		expect(formatRelativeAge("2026-04-03T00:00:00.000000", AHORA)).toBe("hace 6 meses");
	});

	it("un año es «hace 1 año» (singular)", () => {
		// Mutación que lo rompe: pluralizar siempre devolvería «hace 1 años».
		expect(formatRelativeAge("2025-10-07T12:00:00.000000", AHORA)).toBe("hace 1 año");
	});

	it("varios años es «hace N años» (plural)", () => {
		// Mutación que lo rompe: singularizar siempre devolvería «hace 2 año».
		expect(formatRelativeAge("2024-10-07T12:00:00.000000", AHORA)).toBe("hace 2 años");
	});

	it("un valor que no se puede parsear no produce ninguna frase", () => {
		// Mutación que lo rompe: devolver el valor crudo o «hace NaN años» contaminaría la fila.
		expect(formatRelativeAge("no-es-una-fecha", AHORA)).toBe("");
	});

	it("una fecha futura dice «en …», nunca «hace -N días»", () => {
		// Mutación que lo rompe: omitir la rama futura devolvería «hace -3 días».
		expect(formatRelativeAge("2026-10-10T00:00:00.000000", AHORA)).toBe("en 3 días");
	});
});

describe("ownerOrgIdOf", () => {
	it("devuelve `owner_org` cuando el paquete lo trae", () => {
		const pkg = makePackage({ owner_org: "org-1" });

		expect(ownerOrgIdOf(pkg)).toBe("org-1");
	});

	it("cae a `organization.id` cuando `owner_org` está ausente (el campo es opcional)", () => {
		const pkg = makePackage({ organization: makeOrganization({ id: "org-2" }) });

		expect(ownerOrgIdOf(pkg)).toBe("org-2");
	});

	it('sin `owner_org` ni `organization` devuelve "" (no coincide con ningún id: fail closed)', () => {
		// Se eligió la cadena vacía y no `undefined`: mantiene la firma `string` de los tres llamadores
		// existentes y, al no coincidir con ningún id real, deja la decisión en fail closed.
		expect(ownerOrgIdOf(makePackage())).toBe("");
	});

	it("ignora un `owner_org` que no sea cadena y cae a `organization.id`", () => {
		// El paquete llega de la red y el tipo se borra: la ruta de edición comprobaba esto en runtime
		// antes de que el helper unificara los tres llamadores, y unificar no puede perder el chequeo.
		const pkg = makePackage({
			owner_org: { anidado: true } as unknown as string,
			organization: makeOrganization({ id: "org-2" }),
		});

		expect(ownerOrgIdOf(pkg)).toBe("org-2");
	});

	it("cae a `organization.id` cuando `owner_org` es la cadena vacía", () => {
		const pkg = makePackage({ owner_org: "", organization: makeOrganization() });
		expect(ownerOrgIdOf(pkg)).toBe("org-2");
	});

	it('devuelve "" cuando `organization.id` es la cadena vacía', () => {
		expect(ownerOrgIdOf(makePackage({ organization: makeOrganization({ id: "" }) }))).toBe("");
	});

	it("ignora un `organization.id` que no sea cadena", () => {
		const pkg = makePackage({
			organization: { ...makeOrganization(), id: 7 } as unknown as CkanOrganization,
		});

		expect(ownerOrgIdOf(pkg)).toBe("");
	});
});
