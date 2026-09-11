// API: consultas al DataStore de CKAN (tablas tabulares de recursos)
//
// `datastore_search` devuelve las filas ya parseadas en JSON, con paginación
// server-side. Es la fuente de datos de la vista previa de recursos CSV (RF-31).

import type { CkanClient } from "./client";

export interface DatastoreField {
	id: string;
	type: string;
}

export interface DatastoreSearchResult {
	fields: DatastoreField[];
	records: Record<string, unknown>[];
	total: number;
}

export function createDatastoreApi(client: CkanClient) {
	return {
		/** Primeras filas de la tabla del recurso (paginado server-side). */
		async search(
			resourceId: string,
			options: { limit?: number; offset?: number } = {},
		): Promise<DatastoreSearchResult> {
			const result = await client.post<{
				fields: DatastoreField[];
				records: Record<string, unknown>[];
				total: number;
			}>("datastore_search", {
				resource_id: resourceId,
				limit: options.limit ?? 20,
				offset: options.offset ?? 0,
			});
			return {
				fields: result.fields,
				records: result.records,
				total: result.total,
			};
		},
	};
}

export type DatastoreApi = ReturnType<typeof createDatastoreApi>;
