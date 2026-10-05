// Hoja de revisión de la tarjeta de fila del dashboard: superficie **sólo para desarrollo**.
//
// ─── Qué decide esta hoja ────────────────────────────────────────────
// Cómo se ofrece la acción «Editar» en cada fila de «Mis datasets». Hoy es un botón de texto,
// hermano de la tarjeta y nunca anidado, porque un elemento interactivo dentro de un `<a>` es HTML
// inválido. La hoja pone las alternativas a la vista para elegir mirando.
//
// ─── Variante C (menú de tres puntos): no se construye ───────────────
// La variante «botón sólo ícono dentro de un menú de tres puntos» exigiría el componente vendorizado
// `src/lib/components/ui/dropdown-menu/`, que **no existe** en este repo. La instrucción de esta
// hoja es no vendorizar componentes nuevos, así que la variante se descarta.
//
// ─── Nota de la variante B ───────────────────────────────────────────
// El botón sólo ícono usa `title` nativo más `aria-label`. Un tooltip real exigiría vendorizar el
// Tooltip de bits-ui, que este repo no tiene: por eso no se construye esa variante.
//
// ─── Qué es real y qué es copia ──────────────────────────────────────
// Real (se importa del repo):
//   · `formatDate` de `$lib/utils/ckan` y los iconos de `@lucide/svelte`.
//   · Los tokens de `src/app.css`: las clases salen de ahí, ninguna de un hex crudo.
// Copia (declarada acá, no importada):
//   · El markup de la fila, duplicado de `src/routes/dashboard/+page.svelte`. La convención del
//     repo es que el playground duplica la página real, el autor revisa y recién entonces se
//     promueve (regla 8 de `AGENTS.md`).
//   · El permiso es un booleano por fila; en la página real sale de `orgsEditables` contra el
//     `owner_org` de CKAN.
// El instrumento (`formatCardActionMeasurement`) es de la hoja, no de producto.
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
