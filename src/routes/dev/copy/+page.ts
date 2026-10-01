// Hoja de revisión de copia: superficie **sólo para desarrollo**.
//
// ─── Por qué se queda (no es un playground para borrar) ──────────────
// El playground `/dev/<page>` del proyecto es un borrador: se duplica una página, se itera y se
// borra al promover. Esta hoja es lo contrario: es una herramienta permanente de revisión, porque
// hay estados del portal que no se pueden reproducir a mano. El caso que la motiva es la sonda de
// sesión inconclusa (`unauthorized` / `unknown` en `$lib/api/failure.ts`): nadie la provoca desde el
// navegador, la sonda tiene que quedar sin resolver por sí sola. Sin esta hoja, la única forma de
// leer esos textos es editar el código. Si una sesión futura la borra «para limpiar», borra la
// herramienta, no el borrador.
//
// ─── En producción no existe ─────────────────────────────────────────
// El `load` lanza un 404 cuando `import.meta.env.DEV` es falso: la ruta responde como cualquier ruta
// inexistente, sin exponer copia interna en un build real.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
