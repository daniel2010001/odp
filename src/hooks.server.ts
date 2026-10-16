// El hook del servidor: resuelve la sesión **una vez por request** y la deja en `event.locals` para que ninguna
// ruta vuelva a leer la cookie (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, § El
// diseño de T4, D1).
//
// Es un adaptador: la decisión —los tres estados y cuándo se borra la cookie— vive en
// `src/lib/server/request-session.ts`, que es donde se prueba. Acá sólo se leen los módulos virtuales
// (`$env`, `$app`) y la cookie.

import type { Handle } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { resolveRequestSession } from "$lib/server/request-session";
import { resolveSessionSecret, SESSION_COOKIE_NAME } from "$lib/server/session";

export const handle: Handle = async ({ event, resolve }) => {
	const { session, user, clearCookie } = resolveRequestSession({
		cookie: event.cookies.get(SESSION_COOKIE_NAME),
		resolveSecret: () => resolveSessionSecret(env.SESSION_SECRET, dev),
		now: Date.now(),
	});

	event.locals.session = session;
	event.locals.user = user;

	// La cookie muerta se borra en esta misma respuesta: el pedido de ahora ve `"dead"` (y el puente responde
	// `401`), los siguientes llegan sin cookie y son anónimos.
	if (clearCookie) {
		event.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
	}

	return resolve(event);
};
