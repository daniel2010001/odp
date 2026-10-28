// La identidad llega del servidor (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, § El
// diseño de T4, D3): el layout entrega el **usuario** de la sesión y nunca el token. `hooks.server.ts` ya
// resolvió la cookie; acá sólo se la pasa al navegador.
//
// `prototype` es el modo prototipo (`$lib/prototype/mode.ts`): sólo en desarrollo y con su cookie puesta.

import { dev } from "$app/environment";
import { PROTOTYPE_COOKIE, resolvePrototypeMode } from "$lib/prototype/mode";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals, cookies }) => {
	// Apagado, la clave ni siquiera viaja: los datos del layout son los de siempre.
	const prototype = resolvePrototypeMode(dev, cookies.get(PROTOTYPE_COOKIE));
	return { sessionUser: locals.user, ...(prototype ? { prototype } : {}) };
};
