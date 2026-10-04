/**
 * Módulo puro de contraste — sRGB y WCAG 2.1.
 *
 * Lo consume el instrumento de la hoja de revisión de errores (`/dev/error`): el navegador le da a
 * `getComputedStyle` cadenas en cualquier notación (`oklch(...)`, `rgb(...)`, `#rrggbb`) y este
 * módulo las vuelve sRGB con alfa, compone fondos translúcidos y calcula el ratio WCAG. No toca el
 * DOM: se puede probar con fixtures deterministas.
 */

/** Un color sRGB: canales en 0..255 y alfa en 0..1. */
export interface Rgba {
	r: number;
	g: number;
	b: number;
	a: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** `1.055 * c^(1/2.4) - 0.055` para c lineal en [0,1]; linealiza a 8 bits por canal. */
function linearToSrgb(channel: number): number {
	const c = clamp(channel, 0, 1);
	const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
	return clamp(srgb, 0, 1) * 255;
}

/** Inversa de `linearToSrgb`, sobre el canal 0..255. */
function srgbToLinear(channel: number): number {
	const c = clamp(channel, 0, 255) / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** oklab (L 0..1, a, b) → sRGB. La matemática es la del espacio Oklab. */
function oklabToRgb(lightness: number, a: number, b: number): { r: number; g: number; b: number } {
	const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
	const l = lRoot ** 3;
	const m = mRoot ** 3;
	const s = sRoot ** 3;

	return {
		r: linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	};
}

/** oklch (L 0..1, C, H en grados) → sRGB: pasa por Oklab con `a = C·cos H`, `b = C·sin H`. */
function oklchToRgb(
	lightness: number,
	chroma: number,
	hueDegrees: number,
): { r: number; g: number; b: number } {
	const hue = (hueDegrees * Math.PI) / 180;
	return oklabToRgb(lightness, chroma * Math.cos(hue), chroma * Math.sin(hue));
}

/** HSL (H en grados, S y L en 0..1) → sRGB. Fórmula estándar de CSS Color 4. */
function hslToRgb(hueDegrees: number, saturation: number, lightness: number): Rgba {
	const h = (((hueDegrees % 360) + 360) % 360) / 360;
	if (saturation === 0) {
		const gray = lightness * 255;
		return { r: gray, g: gray, b: gray, a: 1 };
	}

	const q =
		lightness < 0.5
			? lightness * (1 + saturation)
			: lightness + saturation - lightness * saturation;
	const p = 2 * lightness - q;
	const channel = (offset: number): number => {
		let t = offset;
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};

	return {
		r: channel(h + 1 / 3) * 255,
		g: channel(h) * 255,
		b: channel(h - 1 / 3) * 255,
		a: 1,
	};
}

function parseAlpha(token: string): number | null {
	const raw = token.trim();
	if (raw === "") return null;
	if (raw.endsWith("%")) {
		const value = Number.parseFloat(raw.slice(0, -1));
		return Number.isFinite(value) ? clamp(value / 100, 0, 1) : null;
	}
	const value = Number.parseFloat(raw);
	return Number.isFinite(value) ? clamp(value, 0, 1) : null;
}

function parseChannel(token: string): number | null {
	const raw = token.trim();
	if (raw === "") return null;
	if (raw.endsWith("%")) {
		const value = Number.parseFloat(raw.slice(0, -1));
		return Number.isFinite(value) ? clamp((value / 100) * 255, 0, 255) : null;
	}
	const value = Number.parseFloat(raw);
	return Number.isFinite(value) ? clamp(value, 0, 255) : null;
}

/**
 * Toma un componente que en CSS puede ser un número o un porcentaje y lo lleva a su escala real.
 * `scale` es el valor que corresponde a `100%` (1 para L de oklch/oklab, 0.4 para a y b de oklab,
 * 1 para los canales de `color(srgb …)`). Devuelve `null` si el token no es numérico.
 */
function parseScaled(token: string, scale: number): number | null {
	const raw = token.trim();
	if (raw === "") return null;
	if (raw.endsWith("%")) {
		const value = Number.parseFloat(raw.slice(0, -1));
		return Number.isFinite(value) ? (value / 100) * scale : null;
	}
	const value = Number.parseFloat(raw);
	return Number.isFinite(value) ? value : null;
}

/** Porcentaje obligatorio (0..100%) a fracción 0..1. La sintaxis HSL exige `%` en S y L. */
function parsePercentFraction(token: string): number | null {
	const raw = token.trim();
	if (!raw.endsWith("%")) return null;
	const value = Number.parseFloat(raw.slice(0, -1));
	return Number.isFinite(value) ? clamp(value / 100, 0, 1) : null;
}

/** Ángulo con unidad (`deg`, `grad`, `rad`, `turn`) o número suelto (grados). */
function parseHue(token: string): number | null {
	const raw = token.trim().toLowerCase();
	let value: number;
	if (raw.endsWith("grad")) value = Number.parseFloat(raw.slice(0, -4)) * 0.9;
	else if (raw.endsWith("turn")) value = Number.parseFloat(raw.slice(0, -4)) * 360;
	else if (raw.endsWith("rad")) value = (Number.parseFloat(raw.slice(0, -3)) * 180) / Math.PI;
	else if (raw.endsWith("deg")) value = Number.parseFloat(raw.slice(0, -3));
	else value = Number.parseFloat(raw);
	return Number.isFinite(value) ? value : null;
}

/** Separa la parte de color de la de alfa (`... / A`); sin barra, alfa es 1. */
function splitAlpha(inner: string): { color: string; alpha: string | null } {
	const slash = inner.indexOf("/");
	if (slash === -1) return { color: inner, alpha: null };
	return { color: inner.slice(0, slash), alpha: inner.slice(slash + 1) };
}

function parseHex(value: string): Rgba | null {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
	if (!match) return null;
	const digits = match[1];
	const expanded =
		digits.length === 3
			? digits
					.split("")
					.map((d) => d + d)
					.join("")
			: digits;
	return {
		r: Number.parseInt(expanded.slice(0, 2), 16),
		g: Number.parseInt(expanded.slice(2, 4), 16),
		b: Number.parseInt(expanded.slice(4, 6), 16),
		a: 1,
	};
}

function parseOklch(inner: string): Rgba | null {
	const { color, alpha } = splitAlpha(inner);
	const tokens = color.trim().split(/\s+/);
	if (tokens.length !== 3) return null;

	const [rawL, rawC, rawH] = tokens;
	const lightness = parseScaled(rawL, 1);
	const chroma = parseScaled(rawC, 0.4);
	const hue = parseHue(rawH);
	if (lightness === null || chroma === null || hue === null) return null;

	const alphaValue = alpha === null ? 1 : parseAlpha(alpha);
	if (alphaValue === null) return null;

	const { r, g, b } = oklchToRgb(clamp(lightness, 0, 1), chroma, hue);
	return { r, g, b, a: alphaValue };
}

function parseOklab(inner: string): Rgba | null {
	const { color, alpha } = splitAlpha(inner);
	const tokens = color.trim().split(/\s+/);
	if (tokens.length !== 3) return null;

	const [rawL, rawA, rawB] = tokens;
	const lightness = parseScaled(rawL, 1);
	const a = parseScaled(rawA, 0.4);
	const b = parseScaled(rawB, 0.4);
	if (lightness === null || a === null || b === null) return null;

	const alphaValue = alpha === null ? 1 : parseAlpha(alpha);
	if (alphaValue === null) return null;

	const rgb = oklabToRgb(clamp(lightness, 0, 1), a, b);
	return { ...rgb, a: alphaValue };
}

function parseHsl(inner: string): Rgba | null {
	const { color, alpha } = splitAlpha(inner);
	let channelTokens: string[];
	let alphaToken = alpha;

	if (color.includes(",")) {
		channelTokens = color.split(",").map((token) => token.trim());
		if (alphaToken === null && channelTokens.length === 4) {
			alphaToken = channelTokens.pop() ?? null;
		}
	} else {
		channelTokens = color.trim().split(/\s+/);
	}

	if (channelTokens.length !== 3) return null;
	const hue = parseHue(channelTokens[0] as string);
	const saturation = parsePercentFraction(channelTokens[1] as string);
	const lightness = parsePercentFraction(channelTokens[2] as string);
	if (hue === null || saturation === null || lightness === null) return null;

	const alphaValue = alphaToken === null ? 1 : parseAlpha(alphaToken);
	if (alphaValue === null) return null;

	const rgb = hslToRgb(hue, saturation, lightness);
	return { ...rgb, a: alphaValue };
}

/** `color(srgb r g b [/ A])` con canales 0..1 (o porcentaje). Otros espacios se rechazan. */
function parseColorFunction(inner: string): Rgba | null {
	const { color, alpha } = splitAlpha(inner);
	const tokens = color.trim().split(/\s+/);
	if (tokens.length !== 4) return null;
	const [space, ...channels] = tokens;
	if (space?.toLowerCase() !== "srgb") return null;

	const values = channels.map((token) => parseScaled(token, 1));
	if (values.some((value) => value === null)) return null;

	const alphaValue = alpha === null ? 1 : parseAlpha(alpha);
	if (alphaValue === null) return null;

	return {
		r: clamp(values[0] as number, 0, 1) * 255,
		g: clamp(values[1] as number, 0, 1) * 255,
		b: clamp(values[2] as number, 0, 1) * 255,
		a: alphaValue,
	};
}

function parseRgb(inner: string): Rgba | null {
	const { color, alpha } = splitAlpha(inner);
	let channelTokens: string[];
	let alphaToken = alpha;

	if (color.includes(",")) {
		channelTokens = color.split(",");
		if (alphaToken === null && channelTokens.length === 4) {
			alphaToken = channelTokens.pop() ?? null;
		}
	} else {
		channelTokens = color.trim().split(/\s+/);
	}

	if (channelTokens.length !== 3) return null;
	const channels = channelTokens.map(parseChannel);
	if (channels.some((channel) => channel === null)) return null;

	const alphaValue = alphaToken === null ? 1 : parseAlpha(alphaToken);
	if (alphaValue === null) return null;

	return {
		r: channels[0] as number,
		g: channels[1] as number,
		b: channels[2] as number,
		a: alphaValue,
	};
}

/**
 * Convierte una cadena CSS a sRGB. Devuelve `null` si no entiende el formato; nunca lanza.
 *
 * Acepta hex (`#rgb`/`#rrggbb`), `rgb()`/`rgba()` y `hsl()`/`hsla()` (comas o espacios, con `/`
 * para el alfa, canales y alfa también en porcentaje), `oklch(L C H)` / `oklab(L a b)` (con L en
 * 0..1 o porcentaje, alfa numérica o en porcentaje y matiz con `deg`/`grad`/`rad`/`turn`) y
 * `color(srgb r g b / A)` con canales 0..1 o porcentaje. Otros espacios de color y funciones
 * (`lab()`, `lch()`, `color-mix()`) quedan fuera y devuelven `null`: el instrumento los trata como
 * fondo no medible en vez de inventar un valor.
 */
export function parseCssColor(value: string): Rgba | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed === "") return null;

	if (trimmed.startsWith("#")) return parseHex(trimmed.toLowerCase());

	const match = /^(oklch|oklab|hsla?|rgba?|color)\((.*)\)$/i.exec(trimmed);
	if (!match) return null;

	const fn = (match[1] as string).toLowerCase();
	const inner = match[2] as string;
	switch (fn) {
		case "oklch":
			return parseOklch(inner);
		case "oklab":
			return parseOklab(inner);
		case "hsl":
		case "hsla":
			return parseHsl(inner);
		case "color":
			return parseColorFunction(inner);
		default:
			return parseRgb(inner);
	}
}

/**
 * Compone `fg` sobre `bg` con la fórmula alfa estándar (`out = fg·a + bg·(1 − a)`).
 *
 * El alfa resultante es `fg.a + bg.a·(1 − fg.a)`: un fondo opaco opaca el resultado.
 */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
	const a = fg.a + bg.a * (1 - fg.a);
	if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
	return {
		r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
		g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
		b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
		a,
	};
}

/** Luminancia relativa WCAG 2.1 sobre canales sRGB 0..255. */
export function relativeLuminance(color: { r: number; g: number; b: number }): number {
	const r = srgbToLinear(color.r);
	const g = srgbToLinear(color.g);
	const b = srgbToLinear(color.b);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG 2.1, siempre entre 1 y 21. Es simétrico. */
export function contrastRatio(
	a: { r: number; g: number; b: number },
	b: { r: number; g: number; b: number },
): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const lighter = Math.max(la, lb);
	const darker = Math.min(la, lb);
	return clamp((lighter + 0.05) / (darker + 0.05), 1, 21);
}

function isBold(weight: number | string): boolean {
	if (typeof weight === "number") return weight >= 700;
	const normalized = weight.trim().toLowerCase();
	if (normalized === "bold" || normalized === "bolder") return true;
	const numeric = Number.parseFloat(normalized);
	return Number.isFinite(numeric) ? numeric >= 700 : false;
}

/** AA «texto grande»: ≥24px, o ≥18.66px si el peso es ≥700. */
export function isLargeText(fontSizePx: number, fontWeight: number | string): boolean {
	if (fontSizePx >= 24) return true;
	return fontSizePx >= 18.66 && isBold(fontWeight);
}

/** Ratio que exige AA: 3:1 para texto grande, 4.5:1 para el resto. */
export function requiredRatio(fontSizePx: number, fontWeight: number | string): number {
	return isLargeText(fontSizePx, fontWeight) ? 3 : 4.5;
}
