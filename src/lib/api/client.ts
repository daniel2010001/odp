// Cliente HTTP para la API REST de CKAN
// Maneja autenticación, errores, y formato de respuestas

import type { ApiClientConfig } from "$lib/types/api";
import { CkanApiError } from "$lib/types/api";

/**
 * La query de un `GET`: lo que el puente del portal lee con `Object.fromEntries(searchParams)`. Los objetos y
 * arreglos viajan como JSON, los escalares como texto, y `undefined` se omite (un parámetro ausente no es la
 * cadena «undefined»).
 */
function toQueryString(params?: Record<string, unknown>): string {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params ?? {})) {
		if (value === undefined) continue;
		query.set(
			key,
			typeof value === "object" && value !== null ? JSON.stringify(value) : String(value),
		);
	}
	const text = query.toString();
	return text ? `?${text}` : "";
}

/** Lo que lee el usuario cuando la respuesta no es JSON; coincide con la frase de `failure.ts` para `unavailable`. */
const UNREADABLE_RESPONSE_MESSAGE = "No se pudo completar la consulta al catálogo de datos.";

/**
 * El cliente de `config.baseUrl` es el de CKAN; `actionUrl` lo abstrae para que el cliente del portal comparta
 * todo lo demás (errores, timeout, query de un `GET`) y sólo cambie a dónde apunta.
 */
function buildClient(
	config: ApiClientConfig,
	actionUrl: (action: string) => string,
	{ withAuthorization }: { withAuthorization: boolean },
) {
	const { timeout = 10000 } = config;

	async function request<T>(
		action: string,
		data?: Record<string, unknown>,
		method: "GET" | "POST" = "POST",
	): Promise<T> {
		// Un `GET` no lleva cuerpo, así que sus parámetros viajan en la query; sin esto `publication_request_list
		// {status}` perdía el filtro sin avisar.
		const url = actionUrl(action) + (method === "GET" ? toQueryString(data) : "");

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (withAuthorization) {
			const apiKey = typeof config.apiKey === "function" ? config.apiKey() : config.apiKey;
			if (apiKey) {
				headers.Authorization = apiKey;
			}
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: method === "POST" && data ? JSON.stringify(data) : undefined,
				signal: controller.signal,
			});

			// Un cuerpo que no es JSON (el HTML de un 502 del proxy con el catálogo caído) no es una respuesta
			// del catálogo: se traduce a una frase nuestra y nunca al mensaje del intérprete. Con un error HTTP
			// se conserva el status; con un 200 ilegible no hay estado que citar y se clasifica como transporte.
			let json: Awaited<ReturnType<typeof response.json>>;
			try {
				json = await response.json();
			} catch {
				throw new CkanApiError(UNREADABLE_RESPONSE_MESSAGE, response.ok ? 0 : response.status);
			}

			if (!response.ok || !json.success) {
				throw new CkanApiError(
					json.error?.message ?? `HTTP ${response.status}`,
					response.status,
					json.error?.__type,
					json.error,
				);
			}

			return json.result as T;
		} catch (err) {
			if (err instanceof CkanApiError) throw err;
			if (err instanceof DOMException && err.name === "AbortError") {
				throw new CkanApiError("Request timed out", 408);
			}
			throw new CkanApiError(err instanceof Error ? err.message : "Unknown error", 0);
		} finally {
			clearTimeout(timer);
		}
	}

	return {
		/** GET request (para acciones que solo leen) */
		get<T>(action: string, params?: Record<string, unknown>): Promise<T> {
			// CKAN usa POST incluso para lecturas, pero algunas acciones soportan GET
			return request<T>(action, params, "GET");
		},
		/** POST request (estándar CKAN) */
		post<T>(action: string, data?: Record<string, unknown>): Promise<T> {
			return request<T>(action, data, "POST");
		},
		/** Config actual (útil para stores de auth) */
		getConfig: () => config,
	};
}

export function createCkanClient(config: ApiClientConfig) {
	const base = config.baseUrl.replace(/\/$/, "");
	return buildClient(config, (action) => `${base}/api/3/action/${action}`, {
		withAuthorization: true,
	});
}

/** Lo único que el cliente del portal admite configurar: no hay `baseUrl` ni `apiKey`. */
export type PortalClientConfig = Pick<ApiClientConfig, "timeout">;

/**
 * El cliente que habla con el **puente del portal**: pide a `/catalog/<acción>` del mismo origen y **no manda
 * `Authorization`** ni admite `apiKey`. La credencial vive en la cookie `httpOnly` y la inyecta el servidor
 * (`src/routes/catalog/[...action]/+server.ts`); el navegador no la tiene. Es el cliente de todo lo que
 * requiere —o puede requerir— sesión; las páginas públicas siguen con `createCkanClient` contra `CKAN_URL`.
 */
export function createPortalClient(config: PortalClientConfig = {}) {
	return buildClient({ baseUrl: "", ...config }, (action) => `/catalog/${action}`, {
		withAuthorization: false,
	});
}

export type CkanClient = ReturnType<typeof createCkanClient>;
