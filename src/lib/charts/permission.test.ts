// ¿Quién ve las acciones de editar gráficos? La misma regla que la página del dataset para «Editar»: la
// organización dueña tiene que estar entre las que el usuario puede actualizar. El servidor la exige de
// todos modos (`resource_update`); acá sólo se evita ofrecer lo que fallaría, y ante la duda no se ofrece.

import { describe, expect, it, vi } from "vitest";
import type { CkanClient } from "$lib/api/client";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import { canEditResourceCharts } from "./permission";

const dataset = { id: "pkg-1", owner_org: "org-1" } as unknown as CkanPackage;

function clientReturning(result: unknown) {
	const post = vi.fn(async () => result);
	return { client: { post } as unknown as CkanClient, post };
}

describe("canEditResourceCharts", () => {
	it("es verdadero si la organización dueña está entre las que el usuario puede actualizar", async () => {
		const { client, post } = clientReturning([{ id: "org-0" }, { id: "org-1" }]);

		expect(await canEditResourceCharts(client, dataset)).toBe(true);
		expect(post).toHaveBeenCalledWith("organization_list_for_user", {
			permission: "update_dataset",
		});
	});

	it("es falso si la organización dueña no está", async () => {
		const { client } = clientReturning([{ id: "org-9" }]);

		expect(await canEditResourceCharts(client, dataset)).toBe(false);
	});

	it("es falso sin dataset, y no pregunta nada", async () => {
		const { client, post } = clientReturning([{ id: "org-1" }]);

		expect(await canEditResourceCharts(client, null)).toBe(false);
		expect(post).not.toHaveBeenCalled();
	});

	it("ante un fallo de la consulta no ofrece nada (falla cerrado)", async () => {
		const client = {
			post: vi.fn(async () => {
				throw new CkanApiError("Server Error", 500);
			}),
		} as unknown as CkanClient;

		expect(await canEditResourceCharts(client, dataset)).toBe(false);
	});
});
