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
import { type BridgeSession, forwardToCatalog } from "$lib/server/ckan-bridge";
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
	// Tres estados que **no** se confunden: sin cookie es **anónimo** —un visitante leyendo lo público tiene que
	// seguir funcionando, y por eso el pedido se reenvía sin credencial—, y una cookie que no abre es una
	// **sesión muerta**, que se responde con `401` para que el portal expulse por su camino único en vez de
	// degradar la lectura a una vista vacía.
	//
	// La clave se resuelve **sólo** si hay cookie: el camino anónimo no debe depender de una variable obligatoria
	// que no necesita, o un despliegue sin ella dejaría de servir lo público.
	const cookie = event.cookies.get(SESSION_COOKIE_NAME);
	let session: BridgeSession = "anonymous";
	if (cookie !== undefined) {
		const abierta = openSession(cookie, resolveSessionSecret(env.SESSION_SECRET, dev), Date.now());
		session = abierta ? { token: abierta.token } : "dead";
	}

	const resultado = await forwardToCatalog({
		action: event.params.action,
		method,
		params:
			method === "POST"
				? await readJsonBody(event.request)
				: Object.fromEntries(event.url.searchParams),
		session,
		internalUrl: resolveCkanInternalUrl(env.CKAN_INTERNAL_URL, dev),
		incomingHeaders: event.request.headers,
	});

	// La misma URL responde distinto según la cookie (anónimo o con sesión), así que ninguna caché —ni el proxy
	// del stack ni el navegador— puede guardarla: una respuesta privada servida a otro visitante sería una fuga.
	return json(resultado.body, {
		status: resultado.status,
		headers: { "cache-control": "private, no-store", vary: "cookie" },
	});
}

export const GET: RequestHandler = (event) => bridge(event, "GET");
export const POST: RequestHandler = (event) => bridge(event, "POST");
