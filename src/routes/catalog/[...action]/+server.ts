// `/catalog/<acción>` — el navegador le pide al portal, y el portal le pide al catálogo con la credencial que
// el navegador ya no tiene (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, S1/S2).
//
// ─── Por qué la ruta vive en `/catalog` y no en `/api` ─────────────────
// `/api` **ya está tomado** por el proxy hacia CKAN: lo fija `vite.config.ts` para el desarrollo y el proxy del
// stack desplegado publica `/api/` justamente como la superficie pública del catálogo. Una ruta del portal ahí
// no llegaría nunca a SvelteKit: la intercepta el proxy antes. El cambio del `baseUrl` del cliente para que use
// este camino es parte de la migración (T4 del plan).
//
// ─── Qué hace esta ruta, y qué no ──────────────────────────────────────
// Es un **adaptador**: resuelve la sesión sellada, junta los parámetros y delega en `forwardToCatalog`, que es
// donde vive el orden que importa —guarda, credencial, reenvío— y donde están los tests. Acá sólo se lee el
// entorno y la cookie, que son los módulos virtuales que Vitest no resuelve.
//
// La credencial sale de la cookie `httpOnly` y **nunca** del pedido: si el navegador manda un `Authorization`,
// `upstreamHeaders` no lo copia.

import { json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { forwardToCatalog } from "$lib/server/ckan-bridge";
import { resolveCkanInternalUrl } from "$lib/server/ckan-internal-url";
import { openSession, resolveSessionSecret, SESSION_COOKIE_NAME } from "$lib/server/session";
import type { RequestEvent, RequestHandler } from "./$types";

/** El cuerpo del pedido como objeto plano. Sin cuerpo o con basura, el catálogo decide con sus defaults. */
async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
	try {
		const raw: unknown = await request.json();
		return typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

/** El camino compartido por los dos verbos: sólo cambia de dónde salen los parámetros. */
async function bridge(event: RequestEvent, method: "GET" | "POST") {
	const session = openSession(
		event.cookies.get(SESSION_COOKIE_NAME),
		resolveSessionSecret(env.SESSION_SECRET, dev),
		Date.now(),
	);

	const resultado = await forwardToCatalog({
		action: event.params.action,
		method,
		params:
			method === "POST"
				? await readJsonBody(event.request)
				: Object.fromEntries(event.url.searchParams),
		// Sin sesión el token va vacío y el puente devuelve `401` **sin** llamar al catálogo.
		token: session?.token ?? "",
		internalUrl: resolveCkanInternalUrl(env.CKAN_INTERNAL_URL, dev),
		incomingHeaders: event.request.headers,
	});

	return json(resultado.body, { status: resultado.status });
}

export const GET: RequestHandler = (event) => bridge(event, "GET");
export const POST: RequestHandler = (event) => bridge(event, "POST");
