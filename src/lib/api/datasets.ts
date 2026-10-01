// API: operaciones sobre datasets (packages en CKAN)

import type { PaginationParams, SearchParams, SearchResponse } from "$lib/types/api";
import type { CkanPackage, CkanPagination } from "$lib/types/ckan";
import type { CkanClient } from "./client";

export function createDatasetApi(client: CkanClient) {
	return {
		/** Listar datasets públicos con búsqueda y facetas */
		async search(params: SearchParams = {}): Promise<SearchResponse<CkanPackage>> {
			const result = await client.post<CkanPagination>("package_search", {
				q: params.q ?? "*:*",
				fq: params.fq,
				rows: params.limit ?? 20,
				start: params.offset ?? 0,
				sort: params.sort ?? "metadata_modified desc",
				// CKAN usa notación con punto para params de Solr
				"facet.field": params.facet_field ?? ["organization", "tags", "res_format", "license_id"],
				"facet.limit": params.facet_limit ?? 50,
				"facet.mincount": params.facet_min_count ?? 1,
				include_private: params.include_private,
			});

			return {
				count: result.count,
				results: result.results,
				sort: result.sort,
				search_facets: result.search_facets,
			};
		},

		/**
		 * Sugerencias de tags desde la faceta `tags` de `package_search`.
		 *
		 * Es una **conveniencia** para el wizard: si la faceta no viene, o si la llamada falla,
		 * devuelve `[]` en vez de propagar el error. Unas sugerencias faltantes jamás deben bloquear
		 * ni romper el asistente de creación de dataset (mismo criterio que `listForUser` con los
		 * extras de organización).
		 */
		async tagSuggestions(limit = 20): Promise<string[]> {
			try {
				const result = await this.search({
					limit: 0,
					facet_field: ["tags"],
					facet_limit: limit,
				});
				return result.search_facets.tags?.items.map((item) => item.name) ?? [];
			} catch {
				return [];
			}
		},

		/** Obtener detalle de un dataset por ID o slug */
		async show(id: string): Promise<CkanPackage> {
			return client.post<CkanPackage>("package_show", { id });
		},

		/** Crear un nuevo dataset */
		async create(data: Record<string, unknown>): Promise<CkanPackage> {
			return client.post<CkanPackage>("package_create", data);
		},

		/** Actualizar un dataset existente */
		async update(data: Record<string, unknown>): Promise<CkanPackage> {
			return client.post<CkanPackage>("package_update", data);
		},

		/** Eliminar (soft-delete) un dataset */
		async delete(id: string): Promise<void> {
			await client.post<void>("package_delete", { id });
		},

		/** Listar datasets de una organización */
		async byOrganization(
			orgId: string,
			params: SearchParams = {},
		): Promise<SearchResponse<CkanPackage>> {
			const fq = `organization:${orgId}`;
			const mergedParams = { ...params, fq: params.fq ? `${params.fq} AND ${fq}` : fq };
			return this.search(mergedParams);
		},

		/**
		 * Datasets creados por el usuario actual — «Mis datasets».
		 *
		 * **No** usamos `current_package_list_with_resources`: fija `include_private =
		 * is_sysadmin(user)` (`ckan/logic/action/get.py:143`), así que un no-sysadmin nunca recibe un
		 * privado, ni siquiera el propio.
		 *
		 * Espejamos en cambio la condición del propio dashboard de CKAN (`user_show` con
		 * `include_datasets`), apoyada en `package_search`:
		 *
		 * - `fq=+creator_user_id:<id>`: el `+` es la cláusula requerida de Solr, la misma forma que
		 *   emite CKAN.
		 * - `include_private: true` hace falta **además** del `fq`: medido, sin él el privado propio no
		 *   vuelve en la lista.
		 * - `sort` explícito (el default de `search`): sin él la paginación no es estable — medido,
		 *   `start=0` y `start=2` devolvieron conjuntos disjuntos.
		 * - `count` viaja en la respuesta para que la UI pueda decir el total real.
		 *
		 * `params` sólo aporta paginación (`limit`/`offset`); `fq` e `include_private` los fija esta
		 * llamada.
		 */
		async currentUser(
			userId: string,
			params: PaginationParams = {},
		): Promise<SearchResponse<CkanPackage>> {
			return this.search({
				fq: `+creator_user_id:${userId}`,
				include_private: true,
				...params,
			});
		},

		/** Activar/desactivar un dataset */
		async setState(id: string, state: "active" | "deleted" | "draft"): Promise<CkanPackage> {
			return client.post<CkanPackage>("package_patch", { id, state });
		},
	};
}

export type DatasetApi = ReturnType<typeof createDatasetApi>;
