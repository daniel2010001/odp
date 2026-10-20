import { describe, expect, it } from "vitest";
import {
	FORMAT_TOKEN,
	formatDotClass,
	formatIcon,
	formatTileClass,
	formatToken,
} from "./format-visual";

describe("formatToken — un solo mapa formato → token", () => {
	it("mapea los formatos conocidos sin distinguir mayúsculas ni espacios", () => {
		expect(formatToken("CSV")).toBe(FORMAT_TOKEN.CSV);
		expect(formatToken(" csv ")).toBe(FORMAT_TOKEN.CSV);
		expect(formatToken("xls")).toBe(FORMAT_TOKEN.XLSX);
	});

	it("un formato desconocido, vacío o ausente no tiene token", () => {
		expect(formatToken("ZZZ")).toBeNull();
		expect(formatToken("")).toBeNull();
		expect(formatToken(undefined)).toBeNull();
	});
});

describe("formatTileClass", () => {
	it("un archivo con token usa teñido, borde al 40 % y el token mezclado con el texto, sin colores crudos", () => {
		const cls = formatTileClass("CSV", false);
		expect(cls).toContain("bg-chart-1/15");
		expect(cls).toContain("border-chart-1/40");
		expect(cls).toContain("color-mix(in_oklab,var(--chart-1)_70%,var(--foreground))");
		expect(cls).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i);
	});

	it("un enlace es neutro aunque declare un formato con token", () => {
		const cls = formatTileClass("CSV", true);
		expect(cls).toContain("bg-muted");
		expect(cls).not.toContain("chart-");
	});

	it("un formato desconocido es neutro", () => {
		expect(formatTileClass("ZZZ", false)).not.toContain("chart-");
		expect(formatTileClass(undefined, false)).toContain("text-muted-foreground");
	});
});

describe("formatIcon", () => {
	it("elige un ícono por formato, uno distinto para el enlace y uno por defecto", () => {
		expect(formatIcon("CSV", false)).toBe(formatIcon("xlsx", false));
		expect(formatIcon("JSON", false)).not.toBe(formatIcon("CSV", false));
		expect(formatIcon("CSV", true)).not.toBe(formatIcon("CSV", false));
		expect(formatIcon("ZZZ", false)).toBe(formatIcon(undefined, false));
	});
});

describe("formatDotClass", () => {
	it("los formatos de imagen y texto plano tienen token; un desconocido queda neutro", () => {
		for (const f of ["PNG", "JPEG", "JPG", "TXT"]) {
			expect(formatToken(f), f).not.toBeNull();
			expect(formatDotClass(f), f).toMatch(/^bg-chart-[1-5]$/);
		}
		expect(formatDotClass("ZZZ")).toBe("bg-muted-foreground");
	});
});
