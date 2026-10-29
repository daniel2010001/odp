// Playground de la barra de resultados del buscador: superficie **sólo para desarrollo**.
//
// Duplica `/search` para que el autor juzgue S24 (`odd/tasks/prototype-presentation.md`): la barra que pasa de
// ocupar las dos columnas a sólo la de resultados y muestra el campo de búsqueda. Es un borrador (AGENTS.md,
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
