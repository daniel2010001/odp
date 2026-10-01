// Hoja de revisión de la página de error: superficie **sólo para desarrollo**.
//
// ─── Por qué se queda (no es un playground para borrar) ──────────────
// El playground `/dev/<page>` del proyecto es un borrador: se duplica una página, se itera y se
// borra al promover. Esta hoja es lo contrario: es una herramienta permanente de revisión, porque
// hay estados que no se pueden provocar a mano. Un 500 y un 503 no se disparan desde el navegador
// —el mismo motivo que justifica `/dev/copy`—, y sin la hoja la única forma de leer el estado 5xx
// es romper el código o editar el componente. Si una sesión futura la borra «para limpiar», borra
// la herramienta, no el borrador.
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
