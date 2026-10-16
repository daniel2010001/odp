// `GET /catalog/download/<resourceId>` — el portal descarga el archivo a nombre de la sesión (feature de
// endurecimiento del token, `odd/tasks/token-hardening.md`, S3 y § El diseño de T6, G1).
//
// Es un **adaptador**: toma la sesión que `hooks.server.ts` ya resolvió y delega en `downloadResource`, que es
// donde vive el orden que importa y donde están los tests. Sólo `GET`: leer no es un CSRF, porque una
// navegación ajena con la cookie `Lax` no puede leer la respuesta. El segmento estático le gana a
// `/catalog/[...action]`.

import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { downloadResource } from "$lib/server/ckan-download";
import { resolveCkanInternalUrl } from "$lib/server/ckan-internal-url";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params, locals, request }) =>
	downloadResource({
		resourceId: params.resourceId,
		session: locals.session,
		internalUrl: resolveCkanInternalUrl(env.CKAN_INTERNAL_URL, dev),
		incomingHeaders: request.headers,
		fetcher: fetch,
	});
