// Playground de los bloques del vacío del buscador: superficie **sólo para desarrollo**.
//
// Duplica `/search` para que el autor juzgue S41 (`odd/tasks/prototype-presentation.md`): «Pruebe con» y «lo más
// reciente», que hoy sólo salen cuando no hay resultados, también con resultados. Es un borrador (AGENTS.md,
// regla 8): cuando el autor elija, se promueve a la página real y esta carpeta se borra.
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
