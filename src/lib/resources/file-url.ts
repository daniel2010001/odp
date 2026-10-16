import type { CkanResource } from "$lib/types/ckan";
import { safeExternalUrl } from "$lib/utils/external-url";
import { resourceKind } from "./kind";

/**
 * La URL con la que el navegador pide el recurso.
 *
 * Un **archivo alojado** sale del portal (`/catalog/download/<id>`, `src/routes/catalog/download`): el portal
 * autentica contra el catálogo y devuelve los bytes, porque el navegador ya no tiene credencial de CKAN y su
 * `resource.url` apunta a un host que ni siquiera tiene por qué alcanzar. Un **enlace** sigue siendo su URL
 * externa, saneada (`safeExternalUrl`): `null` si no es http/https.
 */
export function fileUrl(resource: Pick<CkanResource, "id" | "url" | "url_type">): string | null {
	if (resourceKind(resource) === "file") {
		return `/catalog/download/${encodeURIComponent(resource.id)}`;
	}
	return safeExternalUrl(resource.url);
}
