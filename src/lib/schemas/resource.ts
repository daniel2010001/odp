import { z } from "zod/v4";
import { unsafeUrlReason } from "$lib/utils/external-url";

// ─── Topes de UX del portal (NO son límites de CKAN) ─────────────────────
// Verificado contra CKAN (PRD §7): `resource.name` y `resource.description` son `text` **sin
// límite** y `description` **no es obligatoria**. Estos topes son guardrails del portal; un recurso
// que entre por otro camino (API, UI de CKAN) puede superarlos y el render debe aguantarlo.
export const MIN_RESOURCE_NAME_LENGTH = 1;
export const MAX_RESOURCE_NAME_LENGTH = 120;
export const MAX_RESOURCE_DESCRIPTION_LENGTH = 1000;

/** Límite de longitud de la URL de un recurso (mismo tope que el sitio del dataset). */
export const MAX_RESOURCE_URL_LENGTH = 500;

/**
 * URL de un recurso: sólo http/https, con **la misma política** que el resto de la app
 * (`$lib/utils/external-url`), fail-closed. Sin valor se omite (un archivo no tiene URL todavía).
 */
const resourceUrl = z
	.string()
	.optional()
	.transform((raw) => raw?.trim() ?? "")
	.refine(
		(value) => value.length <= MAX_RESOURCE_URL_LENGTH,
		`La URL no puede superar los ${MAX_RESOURCE_URL_LENGTH} caracteres.`,
	)
	.superRefine((value, ctx) => {
		if (!value) return;
		const reason = unsafeUrlReason(value);
		if (reason === null) return;
		ctx.addIssue({
			code: "custom",
			message:
				reason === "protocol"
					? "El enlace debe usar los protocolos http o https."
					: "La URL no es válida. Use una dirección completa (ej.: https://...).",
		});
	})
	.transform((value) => value || undefined);

/**
 * Metadatos de un recurso. RF-13: un recurso es archivo **o** enlace, nunca ambos — por eso un
 * recurso de tipo `enlace` exige URL y uno de tipo `archivo` no la lleva.
 *
 * El **nombre es obligatorio** porque CKAN no lo hereda del archivo (verificado): si el formulario
 * no lo manda, el recurso queda sin nombre. El portal resuelve el valor por defecto (nombre del
 * archivo o dominio de la URL) antes de validar.
 */
export const resourceCreateSchema = z
	.object({
		tipo: z.enum(["archivo", "enlace"]),
		name: z
			.string()
			.trim()
			.min(
				MIN_RESOURCE_NAME_LENGTH,
				"El nombre del recurso es obligatorio (puede usar el del archivo).",
			)
			.max(
				MAX_RESOURCE_NAME_LENGTH,
				`El nombre del recurso no puede superar los ${MAX_RESOURCE_NAME_LENGTH} caracteres.`,
			),
		description: z
			.string()
			.max(
				MAX_RESOURCE_DESCRIPTION_LENGTH,
				`La descripción del recurso no puede superar los ${MAX_RESOURCE_DESCRIPTION_LENGTH} caracteres.`,
			)
			.optional()
			.transform((raw) => raw?.trim() || undefined),
		url: resourceUrl,
	})
	.superRefine((value, ctx) => {
		if (value.tipo === "enlace" && !value.url) {
			ctx.addIssue({
				code: "custom",
				path: ["url"],
				message: "Escriba la URL del enlace.",
			});
		}
	});

export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
