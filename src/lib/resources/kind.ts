import type { CkanResource } from "$lib/types/ckan";

export type ResourceKind = "file" | "link";

/**
 * ¿El recurso es un archivo alojado o una referencia externa?
 *
 * La prueba es la de CKAN, no una nuestra: `ckan/lib/dictization/model_dictize.py:132` reescribe
 * la `url` al enlace de descarga **sólo** cuando `url_type == "upload"`, y `ckan/lib/uploader.py`
 * lo escribe en 301 y lo vacía en 324. Medido en este catálogo: los 35 recursos sembrados no
 * traen el campo y son URLs externas; un archivo subido por el asistente trae `"upload"`.
 *
 * Por eso la prueba es positiva (`=== "upload"`) y no negativa: `""` (una subida que se limpió) y
 * la ausencia del campo (un `resource_create` con URL) son dos formas distintas de «no es un
 * archivo alojado». Y como es la regla de CKAN, también cubre recursos que el portal no creó.
 *
 * El asistente distingue archivo de enlace en su formulario, pero **no lo persiste**
 * (`createLinkEntry` manda sólo `package_id`, `name`, `url`, `description`), así que no hay
 * marcador propio que leer.
 */
export function resourceKind(resource: Pick<CkanResource, "url_type">): ResourceKind {
	return resource.url_type === "upload" ? "file" : "link";
}
