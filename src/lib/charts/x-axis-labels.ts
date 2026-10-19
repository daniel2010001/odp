// Los rótulos del eje X cuando las categorías tienen nombre largo.
//
// El eje reparte el ancho del gráfico entre las categorías y escribe cada rótulo centrado bajo la suya; si
// el nombre es más ancho que su lugar, pisa al vecino («Arquitectura y Ciencias del Hábitat» sobre «Ciencias
// Agrícolas»). Decisión del autor (2026-10-19, variante E de la hoja de pruebas): el eje elige una sola forma
// para todos los rótulos, según lo que quepa sin recortar nada (`resolveAutoMode`): derechos si cada uno cabe
// entero, en hasta 3 renglones si así caben sin «…», y girados en el resto.
//
// El recorte y los renglones se calculan acá y no en la biblioteca: el `width` del texto de LayerChart no
// corta en los espacios y mide con la fuente del documento, no con la del eje. La medida se inyecta
// (`measure`) para que esto sea puro: el componente mide en un canvas con la fuente real del eje.

/** La forma de un eje: rótulos derechos tal cual, en renglones o girados. */
export type XLabelMode = "straight" | "wrap" | "rotate";

/** Ancho en píxeles de un texto escrito con la fuente del eje. */
export type MeasureText = (text: string) => number;

const ELLIPSIS = "…";

/** Sin ancho medido todavía: pasadas estas categorías se rotula una de cada N. */
const MAX_X_TICKS = 8;

/** El lugar mínimo por categoría, en píxeles, para escribir un rótulo en cada forma. */
const MIN_SLOT: Record<XLabelMode, number> = {
	// Girado, lo que se reparte es la altura de un renglón, no el largo del nombre: 11 px de fuente a 40°
	// piden unos 17 px de separación horizontal (medido en la hoja: con 14 se pisaban).
	rotate: 18,
	straight: 28,
	wrap: 28,
};

/** Lo que se deja libre entre dos rótulos vecinos. */
const GAP = 6;

export interface XAxisLayout {
	/** Se rotula una categoría de cada `tickStep`. */
	tickStep: number;
	/** El ancho del que dispone cada rótulo (partido); 0 si no se midió el eje. */
	labelWidth: number;
}

/**
 * Cuántos rótulos se escriben y de qué ancho. Sin ancho medido todavía (`innerWidth <= 0`: servidor, primer
 * pintado, pruebas) se rotula una de cada N pasadas las 8 categorías, para no pisar más de lo que se pisaba.
 */
export function xAxisLayout(mode: XLabelMode, count: number, innerWidth: number): XAxisLayout {
	if (innerWidth <= 0 || count <= 0)
		return { tickStep: Math.max(1, Math.ceil(count / MAX_X_TICKS)), labelWidth: 0 };
	const slot = innerWidth / count;
	const tickStep = Math.max(1, Math.ceil(MIN_SLOT[mode] / slot));
	return { tickStep, labelWidth: Math.max(0, Math.floor(slot * tickStep - GAP)) };
}

/** El rótulo tal cual si cabe en `maxWidth`; si no, el prefijo más largo que cabe seguido de «…». */
export function fitLabel(text: string, maxWidth: number, measure: MeasureText): string {
	if (measure(text) <= maxWidth) return text;
	// Búsqueda binaria del prefijo: la medida crece con el largo.
	let low = 0;
	let high = text.length;
	while (low < high) {
		const mid = Math.ceil((low + high) / 2);
		if (measure(text.slice(0, mid).trimEnd() + ELLIPSIS) <= maxWidth) low = mid;
		else high = mid - 1;
	}
	return text.slice(0, low).trimEnd() + ELLIPSIS;
}

/**
 * El rótulo partido por palabras en renglones de a lo sumo `maxWidth`, unidos con `\n` (el texto de
 * LayerChart los escribe uno debajo del otro). Pasado `maxLines`, el último renglón lleva lo que sobra
 * recortado con «…»; una palabra sola más ancha que el renglón también se recorta.
 */
export function wrapLabel(
	text: string,
	maxWidth: number,
	maxLines: number,
	measure: MeasureText,
): string {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let index = 0;
	while (index < words.length && lines.length < maxLines) {
		if (lines.length === maxLines - 1) {
			lines.push(fitLabel(words.slice(index).join(" "), maxWidth, measure));
			break;
		}
		let line = words[index];
		index++;
		while (index < words.length && measure(`${line} ${words[index]}`) <= maxWidth) {
			line = `${line} ${words[index]}`;
			index++;
		}
		lines.push(fitLabel(line, maxWidth, measure));
	}
	return lines.join("\n");
}

/**
 * La forma de todo el eje, sin recortar nada salvo en la última reserva:
 *  1. derechos, si cada rótulo cabe entero en el lugar de su categoría;
 *  2. en renglones, si cada uno se parte en a lo sumo `maxLines` renglones sin que haga falta «…»;
 *  3. girados, en el resto (incluso cuando hay tantas categorías que no se puede rotular cada una derecha).
 * Un solo rótulo que no cabe decide por todos: el eje no mezcla formas. Sin ancho medido todavía
 * (`innerWidth <= 0`) se devuelven derechos; `xAxisLayout` se ocupa de saltear rótulos en ese caso.
 */
export function resolveAutoMode(
	labels: string[],
	innerWidth: number,
	measure: MeasureText,
	maxLines: number,
): XLabelMode {
	if (innerWidth <= 0 || labels.length === 0) return "straight";
	// Derechos y partidos piden el mismo lugar mínimo por categoría: si hay que saltear, no es ninguno.
	const { tickStep, labelWidth } = xAxisLayout("wrap", labels.length, innerWidth);
	if (tickStep > 1) return "rotate";
	if (labels.every((label) => measure(label) <= labelWidth)) return "straight";
	const untouched = (label: string) => {
		const wrapped = wrapLabel(label, labelWidth, maxLines, measure);
		return wrapped.split("\n").join(" ") === label.split(/\s+/).filter(Boolean).join(" ");
	};
	return labels.every(untouched) ? "wrap" : "rotate";
}
