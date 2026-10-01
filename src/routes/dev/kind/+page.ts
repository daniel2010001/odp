// Hoja de revisión del chip de tipo: superficie **sólo para desarrollo**.
//
// ─── Por qué se queda (no es un playground para borrar) ──────────────
// El playground `/dev/<page>` del proyecto es un borrador: se duplica una página, se itera y se
// borra al promover. Esta hoja es lo contrario: es una herramienta permanente de revisión, porque
// hay variantes del chip que no se pueden producir a mano desde el catálogo —un archivo sin formato
// o una referencia externa no se provocan a gusto— y porque el chip vive en dos superficies a la
// vez (la lista del dataset y el encabezado de la ficha). Muestra el **componente real**, así que lo
// que el autor aprueba es lo que se publica y la hoja no se desincroniza. Si una sesión futura la
// borra «para limpiar», borra la herramienta, no el borrador.
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
