// Hoja de revisión del hero del dataset: superficie **sólo para desarrollo**.
//
// ─── Qué decide esta hoja ────────────────────────────────────────────
// Dónde vive el botón «Copiar enlace» en el hero de la página del dataset. La página real pone hoy
// `[copiar] [título] [Editar]` en una sola fila, y el autor rechazó ese tratamiento por quedar
// «pegado al título». La prescripción a comparar está en
// `src/routes/dev/dataset-edit/+page.svelte` (sección 3): el título, «Actualizado …» y las insignias
// a la izquierda, y las acciones («Editar») como grupo a la derecha, con
// `flex flex-wrap items-start justify-between gap-4`.
//
// ─── Qué es real y qué es copia ──────────────────────────────────────
// Real (se importa del repo):
//   · `cn` de `$lib/utils` y los iconos de `@lucide/svelte`.
//   · Los tokens de `src/app.css`: las clases salen de ahí, nunca de un hex crudo.
// Copia (marcada abajo donde aparece):
//   · El markup del hero, duplicado de `src/routes/dataset/[id]/+page.svelte` (la fila del título,
//     «Actualizado …», la fila de insignias y el enlace «Editar»). Es deliberado: este repo
//     duplica la página real en el playground, el autor la revisa y recién entonces se cambia la
//     página real y se borra la hoja (regla 8 de `AGENTS.md`).
//   · La nota de permiso, duplicada de `dataset-edit`. El estado de permiso acá es un preset
//     elegido a mano; en la página real sale de `orgsEditables` contra el `owner_org` de CKAN.
// El instrumento (`formatHeroMeasurement`) es de la hoja, no de producto.
//
// ─── En producción no existe ─────────────────────────────────────────
// El `load` lanza un 404 cuando `import.meta.env.DEV` es falso.

import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
