// Playground del editor de gráficos: superficie **sólo para desarrollo** (AGENTS.md, regla 8).
//
// En producción no existe: el `load` lanza un 404 cuando `import.meta.env.DEV` es falso, así que la ruta
// responde como cualquier ruta inexistente. Se borra al promover la disposición elegida por el autor.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
