// Resuelve la URL interna de CKAN que usan los routes server-side (login y
// logout) para hablar con CKAN.
//
// Es una función pura a propósito: quien la llama lee el entorno y le pasa los
// valores, porque `$env/dynamic/private` y `$app/environment` son módulos
// virtuales de SvelteKit que Vitest no resuelve (no hay alias para ellos en
// `vitest.config.ts`). Así la decisión se testea sin mockear virtuales.
//
// Medición (2026-09-23, dev box): `odp/.env` **no** define
// `CKAN_INTERNAL_URL`; sólo `PUBLIC_CKAN_URL` y `PUBLIC_APP_URL`. Por eso el
// fallback a `http://localhost:5000` es lo único que hace funcionar el login de
// `pnpm dev` en el host: el portal corre fuera de la red de contenedores y
// alcanza el CKAN publicado en ese puerto. El portal contenedorizado sí recibe
// `CKAN_INTERNAL_URL` desde compose (apunta al nombre del servicio).
//
// Por eso producción no puede heredar ese default: un despliegue que olvide la
// variable apuntaría el puente de login a su propio localhost, en silencio, y
// fallaría recién cuando alguien intente iniciar sesión. Fallar ruidosamente al
// resolverlo es preferible a un error remoto confuso.

/** Valor que se asume sólo en desarrollo cuando la variable no está configurada. */
export const DEV_CKAN_INTERNAL_URL = "http://localhost:5000";

/** Variable de entorno que debe definir la URL interna de CKAN fuera de dev. */
export const CKAN_INTERNAL_URL_VAR = "CKAN_INTERNAL_URL";

/**
 * Devuelve la URL interna de CKAN.
 *
 * - `configured` con contenido (tras `trim()`) → ese valor, recortado.
 * - sin configurar **y** `isDev` → {@link DEV_CKAN_INTERNAL_URL} (comodidad del
 *   `pnpm dev` en el host).
 * - sin configurar **y** sin dev → lanza `Error`, porque producción no tiene
 *   default razonable.
 *
 * @throws {Error} cuando no hay valor configurado y `isDev` es `false`.
 */
export function resolveCkanInternalUrl(configured: string | undefined, isDev: boolean): string {
	const trimmed = configured?.trim();
	if (trimmed) {
		return trimmed;
	}

	if (isDev) {
		return DEV_CKAN_INTERNAL_URL;
	}

	throw new Error(
		`${CKAN_INTERNAL_URL_VAR} no está configurada y el portal no corre en desarrollo. ` +
			"Defínala con la URL interna de CKAN (la que el servidor del portal puede alcanzar, " +
			"por ejemplo el servicio de CKAN dentro de la red de contenedores). En producción no " +
			"se asume http://localhost:5000: apuntaría el login a la propia máquina del portal.",
	);
}
