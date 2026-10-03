// Resolución del fondo efectivo de un nodo del DOM para el instrumento de `/dev/error`.
//
// Un `background-color` con alfa no es el fondo que ve el ojo: hay que componerlo con lo que tenga
// debajo. Tailwind v4 compila `bg-destructive/10` a `color-mix(in oklab, … 10%, transparent)` y el
// navegador lo serializa como `oklab(… / 0.1)`, así que el fondo propio del pill coral casi nunca es
// opaco. Este módulo aísla ese recorrido del DOM para poder testearlo con jsdom —donde
// `getComputedStyle` devuelve el estilo inline— sin depender del navegador.
//
// Regla dura: un `background-color` que no se puede parsear **no se saltea en silencio**. Queda en
// `unreadable` para que el instrumento diga «no medible» en vez de inventar un aprobado subiendo al
// ancestro equivocado. Ese fue exactamente el defecto de la ronda anterior: el parser no entendía
// `oklab()`, el instrumento descartaba el fondo del pill, medía contra el de la card y reportaba 4.99
// «ok» cuando el compuesto real quedaba en 4.39 «falla». Son los dos números medidos en Chromium
// headless sobre `tarjeta/claro`; en jsdom el mismo par da 4.99 y 4.40 porque serializa el literal
// `oklab(…)` en vez de resolver el `color-mix`, y aun así el veredicto es el mismo.

import { compositeOver, parseCssColor, type Rgba } from "$lib/color/contrast";

/** Fondo ya compuesto a sRGB opaco, con la trazabilidad de cómo se obtuvo. */
export interface EffectiveBackground {
	/** Color resuelto en notación `rgb(r, g, b)`. */
	color: string;
	/** El mismo color en hex `#rrggbb`, para mostrarlo en la hoja. */
	hex: string;
	/** `true` si hubo que componer al menos un alfa sobre un ancestro (o el lienzo). */
	composed: boolean;
	/** `background-color` intermedios que no se pudieron parsear, en orden de recorrido. */
	unreadable: string[];
}

function channel(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(color: { r: number; g: number; b: number }): string {
	const part = (value: number): string => channel(value).toString(16).padStart(2, "0");
	return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

/** `true` si la cadena declara transparencia total; no cuenta como fondo no medible. */
function isTransparent(raw: string): boolean {
	return raw === "transparent" || raw === "rgba(0, 0, 0, 0)" || raw === "rgb(0 0 0 / 0)";
}

/**
 * Resuelve el fondo efectivo de `element`: junta su propio `background-color` y los de sus ancestros
 * hasta el primero opaco, y compone los alfas de abajo hacia arriba sobre el lienzo blanco.
 *
 * Devuelve además `unreadable`, la lista de valores que no se pudieron parsear: el llamador tiene que
 * tratarlos como «no medible» y no como un fondo válido.
 */
export function resolveEffectiveBackground(element: HTMLElement): EffectiveBackground {
	const layers: Rgba[] = [];
	const unreadable: string[] = [];

	let current: HTMLElement | null = element;
	while (current) {
		const raw = getComputedStyle(current).backgroundColor.trim();
		if (raw !== "") {
			const parsed = parseCssColor(raw);
			if (parsed === null) {
				if (!isTransparent(raw)) unreadable.push(raw);
			} else if (parsed.a > 0) {
				layers.push(parsed);
				if (parsed.a >= 1) break;
			}
		}
		current = current.parentElement;
	}

	// Sin capa opaca el lienzo es blanco. Se compone de la más externa (última en `layers`) a la más
	// interna: cada capa se pinta encima de lo ya resuelto.
	let result: Rgba = { r: 255, g: 255, b: 255, a: 1 };
	for (let index = layers.length - 1; index >= 0; index -= 1) {
		result = compositeOver(layers[index] as Rgba, result);
	}

	const composed = layers.length > 1 || (layers.length === 1 && (layers[0] as Rgba).a < 1);

	return {
		color: `rgb(${channel(result.r)}, ${channel(result.g)}, ${channel(result.b)})`,
		hex: toHex(result),
		composed,
		unreadable,
	};
}
