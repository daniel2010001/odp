// La guarda de los colores del gráfico: lee los tokens de `src/app.css`, que son la verdad, y comprueba que cada
// `--chart-1..5` llegue a 3:1 (WCAG 1.4.11) contra `--card` —donde se dibuja el gráfico— y contra `--background`,
// en modo claro y en oscuro. Si alguien retoca un token y rompe el contraste, falla acá.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, GRAPHICAL_OBJECT_MIN_CONTRAST, parseOklch } from "./contrast";

const css = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");

/** El cuerpo de un bloque de tokens: `:root { … }` o `.dark { … }`. */
function block(selector: string): string {
	const start = css.indexOf(`\n${selector} {`);
	if (start === -1) throw new Error(`No se encontró el bloque «${selector}» en app.css`);
	return css.slice(start, css.indexOf("\n}", start));
}

function token(body: string, name: string): string {
	const match = new RegExp(`--${name}:\\s*(oklch\\([^)]*\\))`).exec(body);
	if (!match) throw new Error(`No se encontró el token --${name}`);
	return match[1];
}

describe.each([
	["claro", ":root"],
	["oscuro", ".dark"],
])("colores del gráfico en modo %s", (_mode, selector) => {
	const body = block(selector);
	const surfaces = ["card", "background"] as const;

	it.each([1, 2, 3, 4, 5])("--chart-%i llega a 3:1 contra --card y --background", (n) => {
		const color = parseOklch(token(body, `chart-${n}`));
		for (const surface of surfaces) {
			const ratio = contrastRatio(color, parseOklch(token(body, surface)));
			expect(ratio, `--chart-${n} contra --${surface}`).toBeGreaterThanOrEqual(
				GRAPHICAL_OBJECT_MIN_CONTRAST,
			);
		}
	});
});
