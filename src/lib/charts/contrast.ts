// Contraste de un color `oklch` contra otro, según WCAG 2.x (criterio 1.4.11: ≥ 3:1 en objetos gráficos).
//
// Función pura: oklch → sRGB lineal → luminancia relativa → razón de contraste. Los colores fuera de la gama
// sRGB se recortan al cortar cada canal en [0, 1], que es lo que hace el navegador al pintarlos.

export interface Oklch {
	l: number;
	c: number;
	h: number;
}

/** El umbral de WCAG 1.4.11 para objetos gráficos. */
export const GRAPHICAL_OBJECT_MIN_CONTRAST = 3;

const OKLCH_PATTERN = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

export function parseOklch(value: string): Oklch {
	const match = OKLCH_PATTERN.exec(value.trim());
	if (!match) throw new Error(`No es un color oklch(l c h): «${value}»`);
	const lightness = Number(match[1]);
	return {
		l: match[2] === "%" ? lightness / 100 : lightness,
		c: Number(match[3]),
		h: Number(match[4]),
	};
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** oklch → sRGB lineal (Björn Ottosson), cada canal recortado a [0, 1]. */
function toLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
	const hue = (h * Math.PI) / 180;
	const a = c * Math.cos(hue);
	const b = c * Math.sin(hue);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		clamp01(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
		clamp01(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
		clamp01(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
	];
}

export function relativeLuminance(color: Oklch): number {
	const [r, g, b] = toLinearSrgb(color);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first: Oklch, second: Oklch): number {
	const a = relativeLuminance(first);
	const b = relativeLuminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
