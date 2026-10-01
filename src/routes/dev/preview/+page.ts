// Hoja de revisión de la vista previa de recursos: superficie **sólo para desarrollo**.
//
// ─── Por qué se queda (no es un playground para borrar) ──────────────
// El playground `/dev/<page>` del proyecto es un borrador: se duplica una página, se itera y se
// borra al promover. Esta hoja es lo contrario: es una herramienta permanente de revisión, porque
// el catálogo no tiene archivos alojados con los que provocar cada tipo —los 35 recursos medidos son
// enlaces externos y ninguno tiene tabla—, así que un PDF subido, una imagen o un texto no se
// consiguen navegando. Muestra el **componente real**, así que lo que el autor aprueba es lo que se
// publica y la hoja no se desincroniza. Si una sesión futura la borra «para limpiar», borra la
// herramienta, no el borrador.
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
