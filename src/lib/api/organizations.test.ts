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
