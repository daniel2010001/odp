// Hoja de revisión de la publicación: superficie **sólo para desarrollo**.
//
// ─── Por qué existe (y por qué se borra, no se promueve) ─────────────
// La publicación ofrece **una sola** vía —el control de solicitud, habilitado por `update_dataset`
// para cualquier llamador— y la decisión se toma en la cola de aprobación. Hay estados que no se
// pueden provocar a mano: un `403` del catálogo, un `200` que no concede, una verificación de
// capacidad caída y una cola que no carga. La hoja los muestra con los **componentes reales**, sobre
// dobles de las llamadas inyectadas, que es material de revisión del autor (AGENTS.md regla 8) y se
// borra al promover las páginas reales.
//
// ─── En producción no existe ─────────────────────────────────────────
// El `load` lanza un 404 cuando `import.meta.env.DEV` es falso: la ruta responde como cualquier ruta
// inexistente, sin exponer el andamiaje de desarrollo en un build real.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
