// Playground de la página de organizaciones: superficie **sólo para desarrollo**.
//
// Duplica `/organizations` para comparar la cuadrícula actual contra la propuesta de S9
// (`odd/tasks/prototype-presentation.md`), con datos fijos. Es un borrador (AGENTS.md, regla 8): cuando
// el autor apruebe la propuesta, se promueve a la página real y esta carpeta se borra.
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
