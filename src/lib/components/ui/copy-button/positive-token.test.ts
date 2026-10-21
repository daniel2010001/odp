// Anclas estructurales del token `--positive` (S32): una declaración por tema, el mapeo de Tailwind, la
// variante `dark:` atada al interruptor de tema y ningún `emerald` suelto fuera de las hojas de `/dev`.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app.css", "utf8");
const block = (selector: string) => {
	const start = css.indexOf(`\n${selector} {`);
	return css.slice(start, css.indexOf("\n}", start));
};

describe("token --positive", () => {
	it("se declara una vez en :root y una vez en .dark, con su foreground", () => {
		const light = block(":root");
		const dark = block(".dark");
		expect(light.match(/--positive:\s*oklch\(0\.5 0\.08 175\)/g)).toHaveLength(1);
		expect(dark.match(/--positive:\s*oklch\(0\.76 0\.09 175\)/g)).toHaveLength(1);
		expect(light).toContain("--positive-foreground:");
		expect(dark).toContain("--positive-foreground:");
		expect(css.match(/^\s*--positive:/gm)).toHaveLength(2);
	});

	it("se mapea en el tema de Tailwind", () => {
		expect(css).toContain("--color-positive: var(--positive);");
		expect(css).toContain("--color-positive-foreground: var(--positive-foreground);");
	});

	it("`dark:` sigue a la clase del interruptor de tema, no al sistema", () => {
		expect(css).toContain("@custom-variant dark (&:where(.dark, .dark *));");
	});

	it("no queda ningún emerald fuera de las hojas de /dev", () => {
		const out = execSync(
			"grep -rn emerald src --include=*.svelte --include=*.ts | grep -v routes/dev | grep -v positive-token.test.ts || true",
		).toString();
		expect(out.trim()).toBe("");
	});
});
