// Paletas candidatas del gráfico, para que el autor las compare en el playground. Los valores de producción
// siguen siendo `--chart-1..5` de `src/app.css`: cuando el autor elija, se copian allí y esto se borra.
//
// Cada paleta trae su variante clara y su variante oscura, medidas contra `--background` de cada modo
// (WCAG 1.4.11: ≥ 3:1 para objetos gráficos). Los fondos se repiten acá como valores de medición; si
// `src/app.css` los cambia, hay que actualizarlos.

import { contrastRatio, parseOklch } from "./contrast";

export type PaletteId = "current" | "vivid" | "brand";

export interface Palette {
	id: PaletteId;
	label: string;
	note: string;
	light: readonly string[];
	dark: readonly string[];
}

export const BACKGROUND = {
	light: "oklch(0.973 0.006 250)",
	dark: "oklch(0.22 0.02 257)",
} as const;

export const PALETTES: readonly Palette[] = [
	{
		id: "current",
		label: "Actual",
		note: "Los tokens de hoy, sin tocar: croma 0.07–0.08.",
		light: [
			"oklch(0.62 0.08 257)",
			"oklch(0.72 0.07 60)",
			"oklch(0.8 0.07 120)",
			"oklch(0.74 0.07 200)",
			"oklch(0.68 0.07 300)",
		],
		dark: [
			"oklch(0.6 0.1 257)",
			"oklch(0.78 0.07 60)",
			"oklch(0.82 0.07 120)",
			"oklch(0.76 0.07 200)",
			"oklch(0.72 0.07 300)",
		],
	},
	{
		id: "vivid",
		label: "Mismos tonos, más vivos",
		note: "Los matices 257, 60, 120, 200 y 300 con croma 0.13; claridad pareja (0.58–0.62 en claro, 0.70–0.74 en oscuro).",
		light: [
			"oklch(0.58 0.13 257)",
			"oklch(0.62 0.13 60)",
			"oklch(0.62 0.13 120)",
			"oklch(0.62 0.13 200)",
			"oklch(0.58 0.13 300)",
		],
		dark: [
			"oklch(0.7 0.13 257)",
			"oklch(0.74 0.13 60)",
			"oklch(0.74 0.13 120)",
			"oklch(0.74 0.13 200)",
			"oklch(0.7 0.13 300)",
		],
	},
	{
		id: "brand",
		label: "De la marca",
		note: "Azul (257) y coral (25) primero; luego verde azulado, ámbar y violeta. Croma 0.10–0.13.",
		light: [
			"oklch(0.56 0.13 257)",
			"oklch(0.64 0.13 25)",
			"oklch(0.6 0.1 185)",
			"oklch(0.64 0.12 75)",
			"oklch(0.58 0.12 300)",
		],
		dark: [
			"oklch(0.68 0.13 257)",
			"oklch(0.74 0.12 25)",
			"oklch(0.74 0.1 185)",
			"oklch(0.76 0.12 75)",
			"oklch(0.72 0.12 300)",
		],
	},
];

export function findPalette(id: string | null | undefined): Palette {
	return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/** Razón de contraste de cada color de la paleta contra el fondo de su modo. */
export function paletteContrast(palette: Palette, mode: "light" | "dark"): number[] {
	const background = parseOklch(BACKGROUND[mode]);
	return palette[mode].map((color) => contrastRatio(parseOklch(color), background));
}

/**
 * Las variables que el contenedor del gráfico recibe en línea. Las dos variantes viajan como `--palette-*`
 * y la hoja del playground elige una según la clase `.dark`, que es como el portal cambia de modo.
 */
export function paletteStyle(palette: Palette): string {
	return palette.light
		.map(
			(color, index) =>
				`--palette-light-${index + 1}: ${color}; --palette-dark-${index + 1}: ${palette.dark[index]}`,
		)
		.join("; ");
}
