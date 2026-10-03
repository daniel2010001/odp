import { describe, expect, it } from "vitest";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";
import { ownerOrgIdOf } from "./ckan";

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
