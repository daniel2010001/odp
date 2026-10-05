// Medida cruda → texto de la hoja de revisión de la tarjeta de fila del dashboard.
//
// La variante B y la D cambian el botón «Editar» por un botón sólo ícono. Ese cambio tiene una
// medición: el objetivo táctil. WCAG 2.5.5 pide 44 × 44 px, y un ícono de `size-9` (36 px) no lo
// cumple —el número es la razón por la que el autor puede rechazar la variante sin adivinar—. La
// variante D esconde la acción en reposo, así que también se imprime su opacidad computada.
//
// Dos controles de la hoja agregan números que no dependen del layout y por eso sí se pueden
// imprimir en jsdom:
//   · «Objetivo declarado»: el lado que el control de tamaño (36 / 44) pone en pantalla.
//   · «Revelado»: si la acción se revela con hover o foco, queda forzada visible, o es siempre
//     visible. Es la declaración del control «Revelado», no una medición.
//
// El paso de número a texto vive acá, aislado y sin DOM, para poder testearlo con entradas
// conocidas: en jsdom no hay motor de layout y toda medida vale 0, así que la única parte
// verificable sin navegador es que el texto impreso sea exactamente el que corresponde.

/** Mínimo de WCAG 2.5.5 (objetivo táctil). */
export const TOUCH_MIN_PX = 44;

export interface CardActionMeasurement {
	variant: string;
	label: string;
	width: number;
	height: number;
	/** Opacidad computada de la acción; 0 si la variante la esconde en reposo. */
	opacity: number;
	/** Lado declarado del objetivo en px (36 o 44): el número que el control pone en pantalla. */
	declaredPx: number;
	/** Cómo se ofrece la acción: siempre visible, oculta hasta hover/foco, o forzada visible. */
	reveal: "siempre" | "en reposo" | "forzado";
}

export interface FormattedCardActionMeasurement {
	variant: string;
	label: string;
	declared: string;
	target: string;
	touch: string;
	visibility: string;
	reveal: string;
}

const REVEAL_LABEL: Record<CardActionMeasurement["reveal"], string> = {
	siempre: "siempre visible",
	"en reposo": "oculta hasta hover o foco",
	forzado: "forzada visible",
};

export function formatCardActionMeasurement(
	measurement: CardActionMeasurement,
): FormattedCardActionMeasurement {
	const measured = measurement.width > 0 && measurement.height > 0;

	return {
		variant: measurement.variant,
		label: measurement.label,
		declared: `${measurement.declaredPx} px`,
		target: measured
			? `${measurement.width.toFixed(2)} × ${measurement.height.toFixed(2)} px`
			: "—",
		touch: measured
			? Math.min(measurement.width, measurement.height) >= TOUCH_MIN_PX
				? `cumple ${TOUCH_MIN_PX} px`
				: `no cumple ${TOUCH_MIN_PX} px`
			: "—",
		visibility: measured
			? measurement.opacity === 0
				? "oculta en reposo"
				: "visible en reposo"
			: "—",
		reveal: REVEAL_LABEL[measurement.reveal],
	};
}
