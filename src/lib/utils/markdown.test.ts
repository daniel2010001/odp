// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { markdownToPlainText, renderMarkdown } from "./markdown";

/** Parsea el HTML del render para poder afirmar sobre **estructura**, no sobre texto. */
function parse(html: string): HTMLElement {
	const div = document.createElement("div");
	div.innerHTML = html;
	return div;
}

describe("renderMarkdown — formato", () => {
	it("devuelve cadena vacía para entrada vacía o sólo espacios", () => {
		expect(renderMarkdown("")).toBe("");
		expect(renderMarkdown("   \n  ")).toBe("");
	});

	it("renderiza negrita, cursiva, código y encabezados", () => {
		expect(renderMarkdown("**negrita**")).toContain("<strong>negrita</strong>");
		expect(renderMarkdown("*cursiva*")).toContain("<em>cursiva</em>");
		expect(renderMarkdown("`código`")).toContain("<code>código</code>");
		expect(renderMarkdown("## Subtítulo")).toContain("<h2>Subtítulo</h2>");
	});

	it("renderiza listas, citas y tablas GFM", () => {
		expect(renderMarkdown("- uno\n- dos")).toContain("<ul>");
		expect(renderMarkdown("> cita")).toContain("<blockquote>");
		const tabla = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |");
		expect(tabla).toContain("<table>");
		expect(tabla).toContain("<td>1</td>");
	});

	it("conserva acentos y caracteres no ASCII", () => {
		const div = parse(renderMarkdown("**gestión** educativa"));
		expect(div.textContent?.trim()).toBe("gestión educativa");
	});
});

describe("renderMarkdown — enlaces", () => {
	it("acepta http y https", () => {
		const html = renderMarkdown("[datos](https://datos.umss.edu/x)");
		expect(html).toContain('href="https://datos.umss.edu/x"');
	});

	it("abre los enlaces en otra pestaña con rel seguro", () => {
		const html = renderMarkdown("[datos](https://datos.umss.edu/x)");
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});
});

/**
 * Estos payloads son el corazón del slice: el render debe neutralizarlos **estructuralmente**.
 * Se afirma sobre tags y atributos del HTML generado, no sobre el texto (un payload escapado puede
 * contener la palabra `onerror=` como texto visible y eso NO es una vulnerabilidad).
 */
describe("renderMarkdown — XSS (neutralización estructural)", () => {
	const payloads = [
		"<script>alert(1)</script>",
		"<img src=x onerror=alert(1)>",
		"<svg onload=alert(1)>",
		'<iframe src="https://evil.example"></iframe>',
		"<style>body{display:none}</style>",
		'<object data="https://evil.example"></object>',
		'<form action="https://evil.example"><input name=x></form>',
		"[x](javascript:alert(1))",
		"![x](javascript:alert(1))",
		"[x](JavaScript:alert(1))",
		"[x](data:text/html,<script>alert(1)</script>)",
		"[x](vbscript:msgbox(1))",
		"[x](file:///etc/passwd)",
		"[x](//evil.example/x)",
		'<a href="javascript:alert(1)">x</a>',
		"<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
	];

	/** Etiquetas que jamás deben existir como elementos reales en el render. */
	const TAGS_PROHIBIDAS = [
		"script",
		"iframe",
		"object",
		"embed",
		"style",
		"form",
		"input",
		"svg",
		"math",
		"link",
		"base",
		"meta",
	];

	for (const payload of payloads) {
		it(`neutraliza: ${payload.slice(0, 44)}`, () => {
			const div = parse(renderMarkdown(payload));

			for (const tag of TAGS_PROHIBIDAS) {
				expect(div.querySelector(tag), `etiqueta <${tag}>`).toBeNull();
			}

			for (const el of div.querySelectorAll("*")) {
				for (const attr of el.attributes) {
					expect(attr.name.startsWith("on"), `${el.tagName} → ${attr.name}`).toBe(false);
					if (["href", "src", "xlink:href"].includes(attr.name)) {
						expect(
							/^https?:/i.test(attr.value.trim()),
							`${el.tagName} → ${attr.name}="${attr.value}"`,
						).toBe(true);
					}
				}
			}
		});
	}

	it("no interpreta HTML crudo aunque venga con formato markdown válido", () => {
		const div = parse(renderMarkdown("**negrita** y <script>alert(1)</script>"));
		expect(div.querySelector("strong")?.textContent).toBe("negrita");
		expect(div.querySelector("script")).toBeNull();
		// El HTML crudo queda como texto visible, escapado.
		expect(div.textContent).toContain("<script>alert(1)</script>");
	});

	it("un enlace bloqueado deja el texto visible y no genera un <a>", () => {
		const div = parse(renderMarkdown("[texto visible](javascript:alert(1))"));
		expect(div.textContent).toContain("texto visible");
		expect(div.querySelector("a")).toBeNull();
	});
});

describe("markdownToPlainText — extractos sin sintaxis", () => {
	it("quita la sintaxis markdown y unifica espacios", () => {
		expect(markdownToPlainText("# Título\n\n**negrita** y *cursiva*")).toBe(
			"Título negrita y cursiva",
		);
	});

	it("no deja etiquetas ni entidades HTML", () => {
		expect(markdownToPlainText("a < b & c")).toBe("a < b & c");
		expect(markdownToPlainText("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
	});

	it("devuelve cadena vacía sin contenido", () => {
		expect(markdownToPlainText("   ")).toBe("");
	});
});
