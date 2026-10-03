// Tipos para la capa de comunicación con la API de CKAN

export interface ApiClientConfig {
	/** URL base del CKAN (ej: https://data.miuniversidad.edu.bo) */
	baseUrl: string;
	/** API Key opcional para acciones autenticadas (string o getter lazy) */
	apiKey?: string | (() => string | null);
	/** Timeout por defecto en ms */
	timeout?: number;
}

export interface PaginationParams {
	limit?: number;
	offset?: number;
}

export interface SearchParams extends PaginationParams {
	q?: string;
	fq?: string; // filter query (facetado)
	sort?: string;
	facet_field?: string[];
	facet_limit?: number;
	facet_min_count?: number;
	/**
	 * Pedir también los datasets privados. CKAN lo honra sólo si quien llama es `sysadmin` **o**
	 * dueño de la cuenta consultada (`user_show`, `include_private_and_draft_datasets`): es una
	 * petición que CKAN puede rechazar, no un permiso que el portal se otorgue a sí mismo.
	 */
	include_private?: boolean;
}

export interface SearchResponse<T = unknown> {
	count: number;
	results: T[];
	sort: string;
	search_facets: Record<string, FacetDistribution>;
}

export interface FacetDistribution {
	title: string;
	items: FacetItem[];
}

export interface FacetItem {
	name: string;
	display_name: string;
	count: number;
}

// ─── API Error ───────────────────────────────────────────────────────
export class CkanApiError extends Error {
	constructor(
		message: string,
		public status?: number,
		public ckanType?: string,
		/**
		 * Objeto `error` crudo de la respuesta de CKAN, tal cual llegó, sin copiar claves.
		 *
		 * Hace falta porque el status y el `__type` no alcanzan para distinguir errores:
		 * medido el 2026-10-03 contra CKAN 2.12.0, el conflicto de compare-and-set de
		 * `package_revise` y un error genérico de esquema comparten status 409 y
		 * `__type: "Validation Error"`. Sólo el `error.match` los separa.
		 *
		 * Es opcional y va último: los errores armados a mano (timeout 408, transporte 0)
		 * no tienen body, y ninguna llamada existente cambia de forma.
		 */
		public payload?: Record<string, unknown>,
	) {
		super(message);
		this.name = "CkanApiError";
	}
}

// ─── Auth ────────────────────────────────────────────────────────────
export interface AuthSession {
	token: string;
	user: CkanUser;
}

// Re-export para conveniencia
import type { CkanUser } from "./ckan";
