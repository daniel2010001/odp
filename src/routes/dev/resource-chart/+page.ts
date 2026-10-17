// Playground del constructor de gráficos de un recurso tabular (`/dev/resource-chart`).
//
// Es un borrador (AGENTS.md, regla 8): se itera acá con el autor y, al promover el constructor a la
// página real del recurso, se borra. En producción no existe: el `load` lanza un 404 cuando
// `import.meta.env.DEV` es falso.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
