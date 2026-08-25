import { get } from "svelte/store";
import { env } from "$lib/env";
import { auth } from "$lib/stores/auth";
import type { CkanClient } from "./api/client";
import { createCkanClient } from "./api/client";

let client: CkanClient | null = null;

/**
 * Obtener la instancia singleton del cliente CKAN.
 *
 * Usa env.CKAN_URL si está definida (producción), o ruta relativa
 * para que el proxy de Vite (desarrollo) derive a la instancia CKAN.
 *
 * El token se resuelve de forma lazy en cada request (vía el getter
 * `apiKey`), por lo que la memoización del singleton no deja un token
 * cacheado de una sesión anterior.
 */
export function getCkanClient(): CkanClient {
	if (!client) {
		client = createCkanClient({
			baseUrl: env.CKAN_URL,
			apiKey: () => get(auth).token,
		});
	}
	return client;
}
