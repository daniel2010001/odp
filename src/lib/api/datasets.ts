// API: operaciones sobre datasets (packages en CKAN)

import type { PaginationParams, SearchParams, SearchResponse } from "$lib/types/api";
import { CkanApiError } from "$lib/types/api";
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
			return normalizeTitle(await client.post<CkanPackage>("package_show", { id }));
		},

		/** Crear un nuevo dataset */
		async create(data: Record<string, unknown>): Promise<CkanPackage> {
			return client.post<CkanPackage>("package_create", data);
		},

		/**
		 * Editar un dataset con **`package_revise`**.
		 *
		 * El `match` es la precondición de concurrencia —el `metadata_modified` que el formulario cargó—:
		 * si el dataset cambió desde entonces, CKAN responde `ValidationError` en vez de pisar el cambio
		 * ajeno. El `filter` suelta las listas almacenadas (`-extras`, `-tags`) para que CKAN instale las
		 * del `update` verbatim: sin él, `extras` se mezcla por índice y `tag_string` es aditivo. El
		 * `update` lleva sólo los campos que el formulario gobierna, con la lista `extras` cargada
		 * completa y las `tags` exactas del formulario.
		 *
		 * No se usa `package_update` (borra todo campo ausente del request) ni `package_patch` (su firma
		 * plana descarta `metadata_modified` y no puede expresar la precondición).
		 */
		async revise({
			match,
			filter,
			update,
		}: {
			match: Record<string, unknown>;
			filter: string[];
			update: Record<string, unknown>;
		}): Promise<CkanPackage> {
			// Medido en CKAN 2.12.0: `package_revise` anida el paquete bajo `result.package`.
			const result = await client.post<{ package?: CkanPackage }>("package_revise", {
				match,
				filter,
				update,
			});

			const pkg = result?.package;
			if (!pkg || typeof pkg.id !== "string" || typeof pkg.name !== "string") {
				throw new MalformedReviseResponseError();
			}

			return pkg;
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

/**
 * Normaliza el `title` de un dataset en el borde de la API.
 *
 * CKAN **acepta y persiste** un `title` que no es texto: medido el 2026-10-08 contra la 2.12.0,
 * `package_patch {title: {"x": 1}}` responde `200` y guarda el diccionario, y la ficha del dataset
 * pinta `[object Object]` en su `<h1>` (medido en jsdom con un `package_show` simulado). El tipo
 * `CkanPackage.title` dice `string`, así que la mentira está en el borde: se corrige acá.
 *
 * Sólo se toca **`title`** —es el campo medido—: si no es un string con contenido se cae al `name`,
 * que es la dirección legible del dataset, y si el `name` tampoco es usable, al literal `"Dataset"`,
 * para que el `<h1>` nunca muestre un valor que no es texto.
 */
function normalizeTitle(pkg: CkanPackage): CkanPackage {
	const usable = (value: unknown): value is string =>
		typeof value === "string" && value.trim() !== "";
	const name = usable(pkg.name) ? pkg.name : "Dataset";
	const title = usable(pkg.title) ? pkg.title : name;
	return { ...pkg, title };
}

/** `package_revise` anida el paquete en `result.package`; sin él `revise` falla, en vez de
 * devolver `undefined` y dejar que un llamador navegue a `/dataset/undefined`. */
export class MalformedReviseResponseError extends Error {
	constructor() {
		super("package_revise devolvió un `result` sin `package`: se esperaba { package: ... }");
		this.name = "MalformedReviseResponseError";
	}
}

/**
 * ¿El error es el **conflicto de compare-and-set** que levanta `package_revise`?
 *
 * **Medido, no supuesto**, el 2026-10-03 contra CKAN 2.12.0. El status 409 por sí solo
 * **no alcanza**: el conflicto real y un error genérico de esquema responden los dos
 * con 409 y `__type: "Validation Error"`. Lo único que los distingue es el `error.match`:
 * sólo el conflicto nombra `metadata_modified`, porque es la precondición que el propio
 * `revise` envió. Un 404 por id inexistente tampoco es conflicto. La otra única acción que
 * puede levantarlo es `revise`, que es la que manda la precondición `match`.
 *
 * El cuerpo medido del conflicto **no traía `error.message`**, pero eso es una observación
 * y no un discriminador: exigir su ausencia convertiría un conflicto con prosa en un fallo
 * genérico, y el falso negativo es justo lo que el contrato prohíbe —el portal DEBE decirle
 * al lector que el dataset cambió—. Por eso no se comprueba que el mensaje falte.
 *
 * Sin el payload crudo preservado en `CkanApiError` este predicado sería imposible.
 *
 * @returns `true` sólo si TODAS se cumplen: `CkanApiError`, `status === 409`,
 * `ckanType === "Validation Error"` y `payload.match` es un array que incluye
 * `"metadata_modified"`. Cualquier otra cosa —el 404, el error de esquema, un error de
 * transporte, un `Error` común— es `false`.
 */
export function isEditConflict(error: unknown): boolean {
	if (!(error instanceof CkanApiError)) return false;
	if (error.status !== 409) return false;
	if (error.ckanType !== "Validation Error") return false;

	const payload = error.payload;
	if (!payload) return false;
	if (!Array.isArray(payload.match)) return false;
	if (!payload.match.includes("metadata_modified")) return false;

	return true;
}
