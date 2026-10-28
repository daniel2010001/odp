// Playground del panel derecho de la ficha del dataset: superficie **sólo para desarrollo**.
//
// Duplica `/dataset/[id]` con datos fijos para que el autor juzgue S17 (`odd/tasks/prototype-presentation.md`)
// sin iniciar sesión: el orden de las tarjetas de la columna lateral, su desplazamiento propio con un alto que
// sigue a la ventana, el historial plegado y el botón del enlace de cada tarjeta. Es un borrador (AGENTS.md,
// regla 8): cuando el autor elija, se promueve a la ficha real y esta carpeta se borra.
//
// El `load` lanza un 404 cuando `import.meta.env.DEV` es falso, igual que `/dev/kind`.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
