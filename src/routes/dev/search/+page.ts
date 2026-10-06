// Hoja de decisión del buscador (`/dev/search`): superficie **sólo para desarrollo**.
//
// ─── Qué decide esta hoja ────────────────────────────────────────────
// Dos decisiones del buscador que sólo se pueden tomar mirando: dónde vive el *scroll snapping* de
// la lista de resultados —(a) `proximity` en la página, (b) `mandatory` en la página, (c) un
// contenedor con scroll propio— y cuál es el disparador de la divulgación de los tags y formatos
// que el recorte esconde. La hoja renderiza el **componente real** (`DatasetCard.svelte`) sobre la
// estructura real de la página (encabezado pegajoso del layout, `aside` *sticky*, `ResultsBar`
// *sticky*), con un panel fijo que fija el estado y un instrumento que imprime números.
//
// ─── Por qué se borra (es un borrador, no una herramienta) ───────────
// A diferencia de `/dev/error` o `/dev/copy`, que son herramientas permanentes porque hay estados
// imposibles de provocar a mano, esta hoja **duplica una página para una decisión**: lo que el
// autor apruebe se promueve al buscador real y esta hoja **se retira** (regla 8 de `AGENTS.md`).
// Si una sesión futura la encuentra «abandonada», lo correcto es borrarla, no conservarla.
//
// ─── En producción no existe ─────────────────────────────────────────
// El `load` lanza un 404 cuando `import.meta.env.DEV` es falso: la ruta responde como cualquier ruta
// inexistente, sin exponer el andamiaje de desarrollo en un build real.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
