// La identidad llega del servidor (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, § El
// diseño de T4, D3): el layout entrega el **usuario** de la sesión y nunca el token. `hooks.server.ts` ya
// resolvió la cookie; acá sólo se la pasa al navegador.

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => {
	return { sessionUser: locals.user };
};
