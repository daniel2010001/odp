import { MAX_SUMMARY_LENGTH } from "$lib/schemas/dataset";
import type { CkanExtra } from "$lib/types/ckan";
import { markdownToPlainText } from "./markdown";

/**
 * Clave del **extra** donde el portal guarda el resumen corto de un dataset (RF-40).
 *
 * No es un campo de DCAT ni de CKAN: es un campo **propio del portal**, y por eso vive en `extras`
 * (el lugar que CKAN da para metadatos adicionales) en vez de fingir ser un campo nativo. La decisión
 * de no escribir extras de DCAT sigue en pie (`dataset-payload.ts`): esa deuda era por vocabulario
 * inestable entre perfiles, y acá no hay vocabulario externo al que conformarse.
 */
export const SUMMARY_EXTRA_KEY = "summary";

/**
 * Texto para las cards del buscador: el **resumen** editorial si existe y, si no, un extracto de la
 * descripción (markdown → texto plano). Un dataset que venga por otro camino (seed, UI de CKAN, API)
 * no tiene el extra, y la card se sigue viendo bien.
 */
export function datasetSummary(dataset: { extras?: CkanExtra[]; notes?: string }): string {
	const resumen = dataset.extras?.find((extra) => extra.key === SUMMARY_EXTRA_KEY)?.value?.trim();
	if (resumen) return resumen;
	if (!dataset.notes) return "";
	return markdownToPlainText(dataset.notes).slice(0, MAX_SUMMARY_LENGTH);
}
