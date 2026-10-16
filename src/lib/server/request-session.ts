// La **sesión de un request**: lo que el portal sabe de quién pide, resuelto una sola vez antes de que corra
// ninguna ruta (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, § El diseño de T4, D1).
//
// ─── Por qué es un módulo aparte del hook ──────────────────────────────
// `src/hooks.server.ts` necesita `$env` y `$app`, módulos virtuales que Vitest no resuelve, así que el hook es
// un adaptador y la decisión vive acá, donde se prueba. La clave y el reloj entran por parámetro por la misma
// razón (y es el patrón de `session.ts`).
//
// ─── Los tres estados, y el borrado de la cookie muerta ────────────────
//  · sin cookie → `"anonymous"`: un visitante leyendo lo público tiene que seguir funcionando;
//  · cookie que abre → `{ token }` más el usuario;
//  · cookie que no abre (vencida, alterada, otra clave) → `"dead"`, y se pide **borrarla en esa respuesta**: el
//    primer pedido responde `401` (la señal de expulsión) y los siguientes son anónimos. Sin el borrado el
//    `401` sería eterno y rompería la navegación pública después de un vencimiento.
//
// La clave se resuelve **sólo** si hay cookie: el camino anónimo no debe depender de una variable obligatoria
// que no necesita. Y si resolverla falla (despliegue sin `SESSION_SECRET`), el error **sube**: una cookie que no
// se puede abrir por configuración no es una sesión muerta, y borrarla destruiría sesiones válidas.

import type { BridgeSession } from "./ckan-bridge";
import { openSession, type SessionUser } from "./session";

export interface RequestSession {
	session: BridgeSession;
	/** El usuario de la sesión; **nunca** el token. Es lo que el layout entrega al navegador. */
	user: SessionUser | null;
	/** `true` cuando la cookie estaba y no abrió: quien responde debe borrarla. */
	clearCookie: boolean;
}

export function resolveRequestSession(input: {
	/** El valor de la cookie de sesión, o `undefined` si el navegador no la mandó. */
	cookie: string | undefined;
	/** Resuelve la clave de sellado. Se llama sólo si hay cookie. */
	resolveSecret: () => string;
	now: number;
}): RequestSession {
	if (input.cookie === undefined) {
		return { session: "anonymous", user: null, clearCookie: false };
	}

	const abierta = openSession(input.cookie, input.resolveSecret(), input.now);
	if (!abierta) {
		return { session: "dead", user: null, clearCookie: true };
	}

	return { session: { token: abierta.token }, user: abierta.user, clearCookie: false };
}
