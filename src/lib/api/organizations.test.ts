import { describe, expect, it, vi } from "vitest";
import type { CkanOrganization } from "$lib/types/ckan";
import type { CkanClient } from "./client";
import { createOrganizationApi } from "./organizations";

function makeOrg(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-1",
		name: "fcyt",
		title: "Facultad de Ciencias y Tecnología",
		description: "Docencia e investigación.",
		image_url: "",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

/** Cliente falso: responde por acción, para poder separar las dos llamadas de `listForUser`. */
function makeClient(respuestas: Record<string, unknown | (() => unknown)>) {
	// Dos parámetros a propósito: así `post.mock.calls` se tipa como tupla `[acción, params]` y los
	// tests pueden leer el payload que la API mandó a CKAN.
	const post = vi.fn(async (action: string, _params?: Record<string, unknown>) => {
		const valor = respuestas[action];
		if (valor === undefined) throw new Error(`acción no esperada: ${action}`);
		return typeof valor === "function" ? (valor as () => unknown)() : valor;
	});
	return { client: { post } as unknown as CkanClient, post };
}

describe("createOrganizationApi.listForUser", () => {
	it("pide el conteo de datasets: sin `include_dataset_count` la API no lo devuelve", async () => {
		const { client, post } = makeClient({
			organization_list_for_user: [makeOrg({ capacity: "admin" })],
			organization_list: [],
		});

		await createOrganizationApi(client).listForUser("create_dataset");

		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("organization_list_for_user");
		expect(params.permission).toBe("create_dataset");
		expect(params.include_dataset_count).toBe(true);
	});

	it("completa los extras (sigla) con una segunda llamada acotada a los ids del usuario", async () => {
		const { client, post } = makeClient({
			organization_list_for_user: [
				makeOrg({ id: "org-1", capacity: "admin", package_count: 5 }),
				makeOrg({ id: "org-2", name: "fcs", title: "Facultad de Ciencias de la Salud" }),
			],
			organization_list: [
				makeOrg({ id: "org-1", extras: [{ key: "sigla", value: "FCyT" }] }),
				makeOrg({ id: "org-2", extras: [] }),
			],
		});

		const orgs = await createOrganizationApi(client).listForUser();

		const [accion, params] = post.mock.calls[1] as [string, Record<string, unknown>];
		expect(accion).toBe("organization_list");
		expect(params.ids).toEqual(["org-1", "org-2"]);
		expect(params.include_extras).toBe(true);

		expect(orgs[0].extras).toEqual([{ key: "sigla", value: "FCyT" }]);
		expect(orgs[0].package_count).toBe(5);
		expect(orgs[0].capacity).toBe("admin");
		expect(orgs[1].extras).toEqual([]);
	});

	it("no pide extras si el usuario no tiene organizaciones", async () => {
		const { client, post } = makeClient({ organization_list_for_user: [] });

		const orgs = await createOrganizationApi(client).listForUser();

		expect(orgs).toEqual([]);
		expect(post.mock.calls).toHaveLength(1);
	});

	it("si la llamada de extras falla, devuelve las organizaciones sin extras (la sigla es cosmética)", async () => {
		const { client } = makeClient({
			organization_list_for_user: [makeOrg({ id: "org-1", capacity: "editor" })],
			organization_list: () => {
				throw new Error("500");
			},
		});

		const orgs = await createOrganizationApi(client).listForUser();

		expect(orgs).toHaveLength(1);
		expect(orgs[0].title).toBe("Facultad de Ciencias y Tecnología");
		expect(orgs[0].extras).toBeUndefined();
	});
});

describe("createOrganizationApi.canUpdateDatasetIn", () => {
	// La misma disciplina que `canCreateDataset`, pero para editar. Tres estados cerrados, y el
	// tercero (`unknown`) sólo puede nacer de un error lanzado: la respuesta no distingue «no podés
	// editar nada» de «esa pregunta no significaba nada». El llamador lo trata como «no podés».
	it("devuelve 'may' cuando la organización consultada vuelve en la lista filtrada", async () => {
		const { client } = makeClient({
			organization_list_for_user: [makeOrg({ id: "org-1", capacity: "editor" })],
		});

		const permiso = await createOrganizationApi(client).canUpdateDatasetIn("org-1");

		expect(permiso).toBe("may");
	});

	it("devuelve 'may_not' cuando la organización consultada no vuelve", async () => {
		const { client } = makeClient({
			organization_list_for_user: [makeOrg({ id: "org-otra", capacity: "editor" })],
		});

		const permiso = await createOrganizationApi(client).canUpdateDatasetIn("org-1");

		expect(permiso).toBe("may_not");
	});

	it("devuelve 'may_not' (nunca el tercer estado) cuando CKAN responde []", async () => {
		const { client } = makeClient({ organization_list_for_user: [] });

		const permiso = await createOrganizationApi(client).canUpdateDatasetIn("org-1");

		expect(permiso).toBe("may_not");
	});

	it("devuelve 'unknown' cuando la llamada falla (transporte o 403)", async () => {
		const { client } = makeClient({
			organization_list_for_user: () => {
				throw new Error("403");
			},
		});

		const permiso = await createOrganizationApi(client).canUpdateDatasetIn("org-1");

		expect(permiso).toBe("unknown");
	});

	it("fija el permiso literal 'update_dataset' que se manda a la acción", async () => {
		const { client, post } = makeClient({
			organization_list_for_user: [makeOrg({ id: "org-1" })],
		});

		await createOrganizationApi(client).canUpdateDatasetIn("org-1");

		// Único instrumento que atrapa un typo: para un no-sysadmin un permiso inexistente devuelve
		// [] con HTTP 200, o sea falla cerrado y en silencio (nadie podría editar, sin error alguno).
		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("organization_list_for_user");
		expect(params.permission).toBe("update_dataset");
		expect(params).toEqual({ permission: "update_dataset" });
	});
});

describe("createOrganizationApi.canCreateDataset", () => {
	// La compuerta del panel no puede reusar la lista amplia de membresías: una con
	// `capacity: "member"` pertenece a una organización pero no puede crear datasets. Esta consulta
	// tiene que ser la misma que hace el asistente.
	it("devuelve true cuando hay al menos una organización donde puede crear", async () => {
		const { client, post } = makeClient({
			organization_list_for_user: [makeOrg({ capacity: "editor" })],
		});

		const puede = await createOrganizationApi(client).canCreateDataset();

		expect(puede).toBe(true);
		// El payload entero, no sólo el permiso: si la consulta se ensancha con parámetros de la
		// lista de display, deja de preguntar lo mismo que el asistente y la compuerta vuelve a
		// ofrecer una acción que el backend no puede cumplir.
		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("organization_list_for_user");
		expect(params).toEqual({ permission: "create_dataset" });
	});

	it("devuelve false cuando CKAN responde [] para ese permiso", async () => {
		const { client, post } = makeClient({ organization_list_for_user: [] });

		const puede = await createOrganizationApi(client).canCreateDataset();

		expect(puede).toBe(false);
		// Una sola llamada: la pregunta de permiso no necesita el enriquecimiento de display.
		expect(post.mock.calls).toHaveLength(1);
		const [action, params] = post.mock.calls[0] as [string, Record<string, unknown>];
		expect(action).toBe("organization_list_for_user");
		expect(params).toEqual({ permission: "create_dataset" });
	});
});
