// Hoja de revisión temporal: superficie **sólo para desarrollo**.
//
// Es el borrador de la regla 8 de `AGENTS.md`: duplica el vacío de `src/routes/search/+page.svelte`,
// el autor elige la lectura y la hoja se borra al promover. No es una herramienta permanente (eso es
// `/dev/copy`), así que no lleva test ni se versiona la decisión: la decisión vive en el expediente
// `odd/tasks/search-empty-anchors.md` y en la página real.
//
// En producción no existe: el `load` lanza un 404 cuando `import.meta.env.DEV` es falso, igual que
// `src/routes/dev/copy/+page.ts`.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}

	return {};
};
