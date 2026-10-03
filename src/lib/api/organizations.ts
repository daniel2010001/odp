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
		 * la misma llamada filtrada vuelve a devolver la organización. Un panel que ofrezca crear a
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
		 * ¿Puede el usuario actual editar los datasets de esta organización?
		 *
		 * Tres estados cerrados y **fail-closed**: `unknown` significa *no* se puede. Quien consuma
		 * esta respuesta debe tratar `unknown` como `may_not`.
		 *
		 * Es la misma pregunta que hace la acción exigida — `organization_list_for_user` con
		 * `permission: "update_dataset"`, el mismo tipo de llamada que `canCreateDataset()` usa con
		 * `create_dataset`. Medido contra CKAN 2.12.0 (2026-10-03): un `editor` de la organización la
		 * recupera en la lista; un `member` no; un permiso inexistente devuelve `[]`. Verificado a
		 * nivel de rol: `get_roles_with_permission('update_dataset')` → `['admin','editor']`.
		 *
		 * `[]` (o una lista que no contiene a `orgId`) es `may_not`, **nunca** `unknown`: una lista
		 * vacía es una respuesta válida. El tercer estado sólo puede nacer de un error lanzado
		 * (transporte, 403), porque la respuesta no trae ninguna forma de error, ningún `__type`, que
		 * separe «no podés editar nada» de «esa pregunta no significaba nada».
		 *
		 * Quirk medido que no cambia el resultado: para un **sysadmin** CKAN ignora por completo el
		 * argumento `permission` y devuelve todas las organizaciones (`ckan/logic/action/get.py:682`,
		 * `if sysadmin: …`). El sysadmin igual obtiene `may`, pero lo produce ese atajo, no el filtro.
		 *
		 * En este stack `ckan.auth.allow_dataset_collaborators` es **false** (verificado en el ini, el
		 * entorno y el proceso vivo), así que la limitación declarada sobre colaboradores nativos no
		 * aplica aquí.
		 */
		async canUpdateDatasetIn(orgId: string): Promise<UpdateDatasetPermission> {
			try {
				const result = await client.post<CkanOrganization[]>("organization_list_for_user", {
					permission: "update_dataset",
				});
				return result.some((organization) => organization.id === orgId) ? "may" : "may_not";
			} catch {
				return "unknown";
			}
		},

		/**
		 * Organizaciones donde el usuario actual tiene rol.
		 *
		 * Ojo: esta es la pregunta **amplia** (toda membresía, con su `capacity`). Para decidir si se
		 * ofrece crear use `canCreateDataset()`, que pregunta exactamente lo que la acción exige.
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
			permission?: "create_dataset" | "update_dataset" | "admin" | "editor" | "member",
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

export type UpdateDatasetPermission = "may" | "may_not" | "unknown";

export type OrganizationApi = ReturnType<typeof createOrganizationApi>;
