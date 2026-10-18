// Playground de los valores sobre las barras (regla 8): se itera acá, el autor elige, se promueve a
// `ResourceChart` y esta ruta se borra. En un build real no existe.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
