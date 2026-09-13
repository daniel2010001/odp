import MarkdownIt from "markdown-it";
import { unsafeUrlReason } from "./external-url";

/**
 * Render de la descripción de un dataset (RF-39).
 *
 * Es seguro **por construcción**, no por limpieza posterior:
 *
 * - `html: false` → el HTML que escriba el usuario **nunca se interpreta**; markdown-it lo escapa y se
 *   ve como texto. No hay HTML de terceros que limpiar, así que no hace falta un sanitizador.
 * - Los únicos atributos del render que llevan URL son `href` y `src`, y pasan por `unsafeUrlReason`,
 *   la **misma** política fail-closed (sólo `http`/`https`) que el resto de la aplicación. Una sola
 *   implementación para todos los bordes de salida.
 *
 * Si algún día se habilita `html: true`, un sanitizador con allowlist pasa a ser **obligatorio**.
 */
const md = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: true,
});

md.validateLink = (url) => unsafeUrlReason(url) === null;

// Los enlaces salen en otra pestaña con `rel` seguro (convención de la app para enlaces externos).
const defaultLinkOpen =
	md.renderer.rules.link_open ??
	((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	tokens[idx].attrSet("target", "_blank");
	tokens[idx].attrSet("rel", "noopener noreferrer");
	return defaultLinkOpen(tokens, idx, options, env, self);
};

/** Markdown → HTML seguro. Devuelve cadena vacía si no hay contenido. */
export function renderMarkdown(source: string): string {
	if (!source.trim()) return "";
	return md.render(source);
}

const ENTIDADES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};

/**
 * Texto plano de un markdown: quita la sintaxis y las etiquetas del render. Se usa para **extractos**
 * (cards, metadatos) donde no corresponde inyectar HTML. No es un sanitizador: el HTML que se
 * recorre es el que generó el parser, no el del usuario.
 */
export function markdownToPlainText(source: string): string {
	return renderMarkdown(source)
		.replace(/<[^>]*>/g, " ")
		.replace(/&(?:amp|lt|gt|quot|#39);/g, (entidad) => ENTIDADES[entidad] ?? entidad)
		.replace(/\s+/g, " ")
		.trim();
}
