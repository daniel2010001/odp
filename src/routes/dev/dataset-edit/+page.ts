// Hoja de revisión del módulo de edición y borrado de datasets: superficie **sólo para desarrollo**.
//
// ─── Qué decide esta hoja ────────────────────────────────────────────
// El módulo `2026-10-02-dataset-edit-and-delete` (diseño y criterios en
// `openspec/changes/2026-10-02-dataset-edit-and-delete/`). El autor tiene que ver, antes de aprobar:
// el formulario en modo edición con los mismos campos del asistente de creación, el payload parcial
// que una edición envía —y lo que deliberadamente **no** envía—, los puntos de entrada en la página
// del dataset en sus tres estados de permiso, la confirmación del borrado lógico con sus tres
// verdades, y el flujo de reemplazo de archivo (hash distinto, mismos bytes, sin hash registrado).
//
// ─── Por qué se borra (es un borrador, no una herramienta) ───────────
// Duplica el formulario y la página del dataset para que el autor revise una propuesta de diseño. No
// es una herramienta permanente como `/dev/copy` o `/dev/kind`: lo que se apruebe se promueve al
// formulario real y esta hoja **se borra** (regla 8 de `AGENTS.md`). Parte de la hoja usa
// componentes reales (`TagsInput`, `MarkdownEditor`, el schema de validación) y parte es copia
// declarada en el encabezado de la página.
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
