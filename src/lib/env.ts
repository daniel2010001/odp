// ─── Configuración tipada con Zod ─────────────────────────────
// Centraliza todas las variables de entorno con validación.
// Las public (`PUBLIC_*`) vienen de SvelteKit ($env/static/public).

import { z } from "zod";
import { PUBLIC_CKAN_URL } from "$env/static/public";

const envSchema = z.object({
	/**
	 * URL base de CKAN.
	 * - En desarrollo: vacío → usa el proxy de Vite (/api → CKAN local, puerto 5000)
	 * - En producción: https://ckan.mi-universidad.edu.bo
	 */
	CKAN_URL: z.string().default(""),
});

export const env = envSchema.parse({
	CKAN_URL: PUBLIC_CKAN_URL,
});

// Tipo inferido del schema (útil para expandir después)
export type Env = z.infer<typeof envSchema>;
