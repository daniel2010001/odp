// API: operaciones sobre organizaciones

import type { CkanOrganization } from "$lib/types/ckan";
import type { CkanClient } from "./client";

export function createOrganizationApi(client: CkanClient) {
	return {
		/** Listar todas las organizaciones */
		async list(): Promise<CkanOrganization[]> {
			return client.post<CkanOrganization[]>("organization_list", {
				all_fields: true,
				include_extras: true,
			});
		},

		/** Obtener detalle de una organización por ID o slug */
		async show(id: string): Promise<CkanOrganization> {
			return client.post<CkanOrganization>("organization_show", {
				id,
				include_datasets: true,
				include_extras: true,
			});
		},

		/** Crear una organización (requiere permisos de admin) */
		async create(data: Record<string, unknown>): Promise<CkanOrganization> {
			return client.post<CkanOrganization>("organization_create", data);
		},

		/** Actualizar una organización */
		async update(data: Record<string, unknown>): Promise<CkanOrganization> {
			return client.post<CkanOrganization>("organization_update", data);
		},

		/**
		 * Organizaciones donde el usuario actual tiene rol.
		 *
		 * Son **dos** llamadas, y no por capricho: `organization_list_for_user` devuelve `capacity`
		 * siempre y `package_count` sólo con `include_dataset_count: true`, pero **no acepta
		 * `include_extras`** (el default de la acción es `False` y el parámetro no llega), así que la
		 * sigla de la organización (`extras.sigla`) se pide aparte, acotada a los ids del usuario.
		 *
		 * Si esa segunda llamada falla, el error **no** se propaga: sin `extras` el mosaico cae al
		 * monograma derivado del nombre. La sigla es cosmética y no debe tumbar el panel.
		 */
		async listForUser(
			permission?: "create_dataset" | "admin" | "editor" | "member",
		): Promise<CkanOrganization[]> {
			const organizations = await client.post<CkanOrganization[]>("organization_list_for_user", {
				permission,
				include_dataset_count: true,
			});
			if (organizations.length === 0) return organizations;

			try {
				const withExtras = await client.post<CkanOrganization[]>("organization_list", {
					ids: organizations.map((organization) => organization.id),
					all_fields: true,
					include_extras: true,
				});
				const extrasById = new Map(withExtras.map((org) => [org.id, org.extras]));
				return organizations.map((organization) => ({
					...organization,
					extras: extrasById.get(organization.id),
				}));
			} catch {
				return organizations;
			}
		},
	};
}

export type OrganizationApi = ReturnType<typeof createOrganizationApi>;
