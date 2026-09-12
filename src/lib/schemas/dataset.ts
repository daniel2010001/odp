import { z } from "zod/v4";
import { unsafeUrlReason } from "$lib/utils/external-url";

// NOTA: Zod v4 cambia algunas APIs. Si usás Zod v3, reemplazá `z.object` sin cambios.
// Para Zod v4, la sintaxis es compatible hacia atrás en la mayoría de los casos.

// ─── Reglas espejadas de CKAN ────────────────────────────────────────────
// Validar en el cliente reglas *distintas* a las del servidor produce errores peores que no
// validar: el usuario corrige lo que le pedimos y CKAN lo rechaza igual. Estas constantes están
// medidas sobre los validadores del CKAN que corre (2.10), no inventadas:
//   `tag_length_validator`      → MIN_TAG_LENGTH=2, MAX_TAG_LENGTH=100 (`ckan.model`)
//   `tag_name_validator`        → charset `[\w \-.]` con `re.UNICODE` en Python: letras, números,
//                                 espacio, guion, guión bajo y punto. **Ojo**: el `\w` de JavaScript
//                                 es ASCII, así que usarlo tal cual rechazaría «gestión», «año» o
//                                 «educación» —etiquetas que CKAN sí acepta—. De ahí `\p{L}\p{N}_`.
//   `tag_string_convert`        → separa por coma, recorta y descarta vacíos (no deduplica)
//   `email_validator`           → `email_pattern` de `ckan/logic/validators.py`, con los tres
//                                 lookaheads que rechazan punto inicial, punto final y punto doble.
//   `maintainer`, `url`         → sólo `strip_value` + `unicode_safe`: sin reglas de formato.
export const MIN_TAG_LENGTH = 2;
export const MAX_TAG_LENGTH = 100;

const TAG_CHARSET = /^[\p{L}\p{N}_ \-.]*$/u;

const CKAN_EMAIL_PATTERN =
	/^(?!\.)(?!.*\.$)(?!.*?\.\.)[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Separar la etiquetas como CKAN: por coma, recortando y descartando vacíos. */
export function parseTagString(raw: string): string[] {
	return raw
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}

/**
 * URL opcional de enlace externo. Sin valor se omite; con valor se aplica **la misma** política que
 * los enlaces de recurso (`$lib/utils/external-url`): sólo http/https, fail-closed.
 */
const optionalExternalUrl = z
	.string()
	.optional()
	.transform((raw) => raw?.trim() ?? "")
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

/** Email opcional, validado sólo si tiene valor (igual que CKAN). */
const optionalEmail = z
	.string()
	.optional()
	.transform((raw) => raw?.trim() ?? "")
	.superRefine((value, ctx) => {
		if (!value || CKAN_EMAIL_PATTERN.test(value)) return;
		ctx.addIssue({ code: "custom", message: "Escriba un correo electrónico válido." });
	})
	.transform((value) => value || undefined);

/**
 * Etiquetas: se validan con las reglas de CKAN y se normalizan (se quitan los duplicados, que CKAN
 * acepta pero no aportan nada). El resultado es el string ya normalizado, para que lo que se vea
 * sea lo que CKAN guarda.
 */
const tagString = z
	.string()
	.optional()
	.transform((raw) => parseTagString(raw ?? ""))
	.superRefine((tags, ctx) => {
		for (const tag of tags) {
			if (tag.length < MIN_TAG_LENGTH || tag.length > MAX_TAG_LENGTH) {
				ctx.addIssue({
					code: "custom",
					message: `La etiqueta «${tag}» debe tener entre ${MIN_TAG_LENGTH} y ${MAX_TAG_LENGTH} caracteres.`,
				});
			} else if (!TAG_CHARSET.test(tag)) {
				ctx.addIssue({
					code: "custom",
					message: `La etiqueta «${tag}» solo puede tener letras, números, espacios, guiones, guiones bajos y puntos.`,
				});
			}
		}
	})
	.transform((tags) => {
		const unique = [...new Set(tags)];
		return unique.length > 0 ? unique.join(", ") : undefined;
	});

/**
 * `owner_org` acepta el id (UUID) o el slug de la organización: el wizard envía el
 * slug que devuelve `organization_list_for_user`, así que exigir UUID rompía el submit.
 *
 * La existencia de la organización no se valida acá a propósito: el select se puebla
 * desde `organization_list_for_user`, de modo que un valor inventado solo podría entrar
 * por una request armada a mano, y CKAN la rechaza igual.
 */
export const datasetCreateSchema = z.object({
	name: z
		.string()
		.min(2, "El slug debe tener al menos 2 caracteres")
		.max(100)
		.regex(/^[a-z0-9_-]+$/, "Solo minúsculas, números, guiones y guión bajo"),
	title: z
		.string()
		.min(3, "El título debe tener al menos 3 caracteres")
		.max(200, "El título no puede exceder 200 caracteres"),
	notes: z.string().max(5000).optional(),
	owner_org: z.string().trim().min(1, "Debe seleccionar una organización"),
	private: z.boolean().default(true),
	license_id: z.string().optional(),
	tag_string: tagString,
	url: optionalExternalUrl,
	maintainer: z
		.string()
		.optional()
		.transform((raw) => raw?.trim() || undefined),
	maintainer_email: optionalEmail,
	// extras se pasan como key-value
	extras: z
		.array(
			z.object({
				key: z.string(),
				value: z.string(),
			}),
		)
		.optional(),
});

export type DatasetCreateInput = z.infer<typeof datasetCreateSchema>;

export const datasetUpdateSchema = datasetCreateSchema.partial();
export type DatasetUpdateInput = z.infer<typeof datasetUpdateSchema>;

export const searchSchema = z.object({
	q: z.string().default(""),
	organization: z.string().optional(),
	tags: z.string().optional(),
	res_format: z.string().optional(),
	license_id: z.string().optional(),
	sort: z.string().default("metadata_modified desc"),
	rows: z.coerce.number().min(1).max(100).default(20),
	start: z.coerce.number().min(0).default(0),
});

export type SearchInput = z.infer<typeof searchSchema>;
