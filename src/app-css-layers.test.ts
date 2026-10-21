import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// P19 (S46 de odd/tasks/v0.1.1-polish.md): sin el orden declarado al inicio, el build de producción dejaba
// `components` antes que `base` y el resaltado del hover de LayerChart (capa `components`) perdía contra su regla
// de `base`: la barra resaltada salía opaca. La prueba fija que la declaración siga ahí y antes de Tailwind.
describe("src/app.css — orden de las capas", () => {
	const css = readFileSync("src/app.css", "utf8");

	it("declara theme, base, components, utilities antes de importar Tailwind", () => {
		const order = css.indexOf("@layer theme, base, components, utilities;");
		const tailwind = css.indexOf('@import "tailwindcss";');
		expect(order).toBeGreaterThanOrEqual(0);
		expect(order).toBeLessThan(tailwind);
	});
});
