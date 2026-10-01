// Playground del vacío del buscador: superficie **sólo para desarrollo**.
//
// Existe para que el autor elija, viéndolas, qué contenido llena el hueco que deja una búsqueda sin
// resultados (medido el 2026-10-01: el bloque del vacío mide 192 px en 1280×800 dentro de una página
// de 1310). La elegida se promueve a `src/routes/search/+page.svelte` y **esta hoja se borra** (regla 8
// de `AGENTS.md`). No es una herramienta permanente.
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
