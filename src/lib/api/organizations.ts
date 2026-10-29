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

		/**
		 * Todas las organizaciones, sin tope: la página de organizaciones no se pagina (Q12 de
		 * `design-system/datos-umss/preguntas-abiertas.md`), pero `organization_list` con todos los campos
		 * devuelve **25 como máximo** por pedido (`ckan.group_and_organization_list_all_fields_max`, medido).
		 * Se piden de a 25 hasta que un pedido vuelva incompleto: con N organizaciones son ⌊N/25⌋ + 1
		 * pedidos.
		 *
		 * `include_groups` trae los grupos en los que está cada organización, que es como CKAN declara de
		 * quién depende (Q6); hoy vuelve vacío y la jerarquía no se muestra.
		 */
		async listAll(): Promise<ListedOrganization[]> {
			const all: ListedOrganization[] = [];
			// Tope de seguridad: 40 pedidos son 1000 organizaciones, muy por encima de las de la universidad.
			for (let page = 0; page < MAX_LIST_PAGES; page++) {
				const chunk = await client.post<ListedOrganization[]>("organization_list", {
					all_fields: true,
					include_extras: true,
					include_groups: true,
					limit: LIST_PAGE_SIZE,
					offset: page * LIST_PAGE_SIZE,
				});
				all.push(...chunk);
				if (chunk.length < LIST_PAGE_SIZE) break;
			}
			return all;
		},

		/**
		 * Fecha de la última actualización de cada organización (por su `name`): la del dataset público
		 * modificado más recientemente. Es **un** pedido a la búsqueda, ordenado del más reciente al más
		 * antiguo y con sólo los dos campos que hacen falta, en vez de uno por organización. Si hubiera más
		 * de 1000 datasets, una organización cuyo último cambio quede fuera de los primeros 1000 sale sin
		 * fecha, nunca con una equivocada.
		 *
		 * Si la búsqueda falla devuelve un mapa vacío: la fecha es un dato de más y no debe tumbar la página.
		 */
		async lastUpdates(): Promise<Map<string, string>> {
			try {
				const result = await client.post<{
					results: { organization?: string | null; metadata_modified?: string }[];
				}>("package_search", {
					q: "*:*",
					fl: "organization,metadata_modified",
					sort: "metadata_modified desc",
					rows: 1000,
				});
				const updates = new Map<string, string>();
				for (const { organization, metadata_modified } of result.results) {
					if (organization && metadata_modified && !updates.has(organization)) {
						updates.set(organization, metadata_modified);
					}
				}
				return updates;
			} catch {
				return new Map();
			}
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
		async canUpdateDatasetIn(orgId: string): Promise<PermissionAnswer> {
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
		 * ¿Es el usuario actual **administrador** de esta organización?
		 *
		 * Tres estados cerrados y **fail-closed**, con la misma disciplina que `canUpdateDatasetIn`:
		 * `unknown` significa «no se pudo preguntar» y quien consume lo trata como `may_not`.
		 *
		 * Es la pregunta que exige **decidir una solicitud de publicación**, y **no** es la de editar:
		 * `update_dataset` contesta «admin **o editor**» —`get_roles_with_permission` incluye siempre al
		 * admin y suma al editor— y un editor no puede decidir. Medido en el CKAN que corre en los
		 * contenedores (2026-10-14), leyendo su fuente **y llamando la función**: `ROLE_PERMISSIONS`
		 * (`ckan/authz.py:251`) da `admin → ['admin','membership']` y `editor → [… 'update_dataset' …]`, y
		 * `get_roles_with_permission` (`ckan/authz.py:292`) devuelve `['admin']` para `"admin"` y
		 * `['admin','editor']` para `"update_dataset"`.
		 *
		 * **La trampa real es el literal conocido equivocado, no el desconocido**: la función incluye al rol
		 * admin **siempre** (`if permission in permissions or 'admin' in permissions`), así que un permiso
		 * inventado también devuelve `['admin']` —medido: `"permiso-que-no-existe"` → `['admin']`—. Un typo
		 * no apaga el control: deja la pregunta donde la deja `"admin"`. Lo que sí la cambiaría es un permiso
		 * que el editor también tenga, y por eso el test fija el literal que se manda.
		 *
		 * Quirk que este módulo ya documenta y conviene repetir acá: para un **sysadmin** CKAN ignora el
		 * argumento `permission` y devuelve **todas** las organizaciones con `capacity: "admin"`
		 * (`ckan/logic/action/get.py:682`), así que la pregunta **no discrimina** para la superadministración
		 * de la plataforma: contesta que sí. La frontera no se mueve — el catálogo es quien decide, y
		 * responde `403` con su frase si la decisión no correspondía.
		 */
		async canAdministerOrganization(orgId: string): Promise<PermissionAnswer> {
			try {
				const result = await client.post<CkanOrganization[]>("organization_list_for_user", {
					permission: "admin",
				});
				return result.some((organization) => organization.id === orgId) ? "may" : "may_not";
			} catch {
				return "unknown";
			}
		},

		/**
		 * Organizaciones donde el usuario puede editar datasets, en **una** llamada (bulk de
		 * `canUpdateDatasetIn`, sin N+1). Fail closed, con tres estados: `known` trae el conjunto
		 * explícito —puede ser vacío— y `unknown` es el tercero, que **sólo** nace de un error lanzado
		 * (la respuesta de CKAN no distingue «no podés editar nada» de «esa pregunta no significaba
		 * nada»). El llamador trata `unknown` como «no podés» y no ofrece ninguna acción.
		 */
		async listUpdatableOrganizationIds(): Promise<UpdatableOrganizations> {
			try {
				const result = await client.post<CkanOrganization[]>("organization_list_for_user", {
					permission: "update_dataset",
				});
				return { state: "known", ids: result.map((organization) => organization.id) };
			} catch {
				return { state: "unknown" };
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

const LIST_PAGE_SIZE = 25;
const MAX_LIST_PAGES = 40;

/** Una organización de `listAll`: con `groups`, los grupos en los que está (de quién depende). */
export type ListedOrganization = CkanOrganization & { groups?: { name: string }[] };

/**
 * Los tres estados de una pregunta de permiso al catálogo: **cerrados** y fail-closed.
 *
 * `unknown` —no se pudo preguntar— se trata como `may_not`: los dos se comportan igual (no se ofrece
 * la acción) y sólo se distinguen para poder decir *por qué* no se ofrece cuando haga falta.
 */
export type PermissionAnswer = "may" | "may_not" | "unknown";

/** Respuesta bulk: conjunto explícito (`known`, puede ser vacío) o `unknown` (no se pudo preguntar). */
export type UpdatableOrganizations = { state: "known"; ids: string[] } | { state: "unknown" };

export type OrganizationApi = ReturnType<typeof createOrganizationApi>;
