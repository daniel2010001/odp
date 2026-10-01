// Playground de la facet de búsqueda: superficie **sólo para desarrollo**.
//
// Es un playground, no una herramienta permanente: existe para que el autor elija, con las tres
// variantes lado a lado, qué pasa cuando la búsqueda interna de una faceta no encuentra nada. La
// elegida se promueve a `$lib/components/search/FacetFilter.svelte` y **esta hoja se borra** (regla 8
// de `AGENTS.md`). Las variantes son copias rotuladas: el componente real se muestra aparte, como
// referencia de «hoy».
//
// En producción no existe: el `load` lanza 404 cuando `import.meta.env.DEV` es falso.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
