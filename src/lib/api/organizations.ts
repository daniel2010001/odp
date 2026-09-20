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
		 * ¿Puede el usuario actual crear datasets en alguna organización?
		 *
		 * Existe porque la lista de membresías (`listForUser`) responde una pregunta **más amplia** que
		 * la que hace el asistente: incluye toda membresía, y una con `capacity: "member"` no puede
		 * crear datasets. Medido contra CKAN (2026-09-20), con el mismo usuario y la misma sesión:
		 * `organization_list_for_user {}` devuelve una organización con `capacity: "member"`, mientras
		 * que `{ permission: "create_dataset" }` devuelve `[]`; tras promover a ese usuario a `editor`,
		 * la misma llamada filtrada vuelve a devolver la organización. Un panel que ofrezca publicar a
		 * partir de la lista amplia estaría ofreciendo una acción que el backend no puede cumplir.
		 *
		 * Por eso esta consulta debe seguir siendo **la misma pregunta** que hace el asistente
		 * (`listForUser("create_dataset")`): si el asistente cambia de pregunta, esto cambia con él.
		 */
		async canCreateDataset(): Promise<boolean> {
			const result = await client.post<CkanOrganization[]>("organization_list_for_user", {
				permission: "create_dataset",
			});
			return result.length > 0;
		},

		/**
		 * Organizaciones donde el usuario actual tiene rol.
		 *
		 * Ojo: esta es la pregunta **amplia** (toda membresía, con su `capacity`). Para decidir si se
		 * ofrece publicar use `canCreateDataset()`, que pregunta exactamente lo que la acción exige.
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
