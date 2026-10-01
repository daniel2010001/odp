import { resourceKind } from "$lib/resources/kind";
import type { CkanResource } from "$lib/types/ckan";

/** Qué puede renderizar el portal para un recurso, o `"none"` si no puede previsualizar nada. */
export type PreviewKind = "table" | "pdf" | "image" | "text" | "none";

/**
 * Las extensiones cortas que el DataPusher intenta cargar por defecto. Espeja la clave
 * `ckan.datapusher.formats` de `ckanext/datapusher/config_declaration.yaml` (medida sin
 * configurar el 2026-09-23: CKAN usa su valor por defecto).
 */
const TABULAR_FORMATS = new Set(["csv", "xls", "xlsx", "tsv", "ods"]);

/**
 * Los MIME equivalentes de esos cinco formatos, en la misma lista de CKAN. Se comparan sobre el
 * `mimetype` del recurso porque un archivo subido puede no traer `format` pero sí su MIME correcto.
 */
const TABULAR_MIMETYPES = new Set([
	"application/csv",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.oasis.opendocument.spreadsheet",
]);

/** Extensiones que el navegador puede mostrar en un `<img>`. */
const IMAGE_FORMATS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"]);

/** Extensiones que se muestran como texto plano, sin motor de render. */
const TEXT_FORMATS = new Set(["txt", "json", "geojson"]);

/** Minúsculas y sin espacios alrededor: `undefined` y `""` colapsan al mismo «no declarado». */
function normalize(value: string | undefined): string {
	return value?.trim().toLowerCase() ?? "";
}

/**
 * Decide qué previsualiza el portal para un recurso. El **orden** es la decisión de diseño:
 *
 * 1. Un `link` no tiene vista previa del portal. Es una referencia externa y la página del recurso
 *    ya renderiza su propio estado antes de que este módulo corra (decisión de C2); sin esta regla,
 *    además, un enlace llamado `PDF` se incrustaría como si sus bytes vivieran en CKAN. La pregunta
 *    archivo/enlace se delega entera en `resources/kind.ts`: una sola regla, no dos.
 * 2. `datastore_active === true` → `table`. Va **antes** del formato a propósito: `datastore_search`
 *    sirve cualquier tabla que exista, sin importar el formato del archivo de origen. Medido el
 *    2026-09-23, el DataPusher carga `csv, xls, xlsx, tsv, ods` por defecto, así que un XLSX puede
 *    tener una tabla funcionando; el viejo filtro `format === "csv"` era un falso negativo nuestro.
 * 3. Si no hay tabla, el tipo lo decide el `format` normalizado: `pdf` → `pdf`, imagen → `image`,
 *    `txt | json | geojson` → `text`.
 * 4. Cualquier otra cosa → `none`. Incluye `csv` **sin** tabla: RF-31 pide una tabla de las primeras
 *    20 filas vía `datastore_search`, y volcar el CSV crudo como texto no es eso. El último `none`
 *    también agrupa los formatos desconocidos; `Gráfico` y `Mapa` no son clases de vista previa
 *    (el modelo de vistas del PRD los separa y pertenecen al análisis de datos, RF-24/25/26).
 */
export function previewKind(
	resource: Pick<CkanResource, "url_type" | "format" | "datastore_active">,
): PreviewKind {
	if (resourceKind(resource) === "link") return "none";
	if (resource.datastore_active === true) return "table";

	const format = normalize(resource.format);
	if (format === "pdf") return "pdf";
	if (IMAGE_FORMATS.has(format)) return "image";
	if (TEXT_FORMATS.has(format)) return "text";
	return "none";
}

/**
 * ¿El formato de este recurso es uno que el DataPusher intentaría cargar al DataStore?
 *
 * Espeja la lista de CKAN, no una nuestra: `ckanext/datapusher/config_declaration.yaml`, clave
 * `ckan.datapusher.formats`, cuyo valor por defecto es `csv, xls, xlsx, tsv, ods` más los MIME
 * `application/csv`, `application/vnd.ms-excel`,
 * `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y
 * `application/vnd.oasis.opendocument.spreadsheet`. El `format` se compara normalizado contra los
 * cinco nombres cortos y el `mimetype` contra los cuatro MIME.
 *
 * Existe para que el componente distinga «este recurso podría tener una tabla pero todavía no la
 * tiene» de «este tipo de archivo no tiene vista previa en absoluto», y el texto diga la verdad en
 * cada caso. No decide la vista previa: esa la decide `previewKind`.
 */
export function isTabularFormat(resource: Pick<CkanResource, "format" | "mimetype">): boolean {
	if (TABULAR_FORMATS.has(normalize(resource.format))) return true;
	return TABULAR_MIMETYPES.has(normalize(resource.mimetype));
}
