// Compuerta de producción de `/dev/resource-views`: el `load` lanza un 404 cuando `import.meta.env.DEV` es falso,
// así que la ruta responde como cualquier ruta inexistente en un build real.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
