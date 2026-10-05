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
// Los controles agregados en la cuarta ronda se declaran también acá, porque son declaraciones y
// no medidas:
//   · «Tratamiento destructivo»: cómo se pinta el botón «Eliminar» de G y H. Son dos tratamientos
//     que ya existen en el portal —el de `UserMenu.svelte:81`, destructivo en reposo, y el de la
//     acción de editar—, y el control permite elegir entre ellos. «—» cuando la variante no tiene
//     acción destructiva.
//   · «Bajo lg»: si la acción se oculta por debajo de `lg`, siguiendo el precedente de
//     `dashboard/+page.svelte:423`. En móvil la fila entera queda como objetivo de apertura.
// El ancho declarado del listado es global, no por variante, así que se imprime fuera de la tabla.
//
// El paso de número a texto vive acá, aislado y sin DOM, para poder testearlo con entradas
// conocidas: en jsdom no hay motor de layout y toda medida vale 0, así que la única parte
// verificable sin navegador es que el texto impreso sea exactamente el que corresponde.

/** Mínimo de WCAG 2.5.5 (objetivo táctil). */
export const TOUCH_MIN_PX = 44;

/** Tratamiento declarado del botón destructivo: el de `UserMenu` o el de la acción de editar. */
export type DeleteTreatment = "usermenu" | "editar";

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
	/** Tratamiento declarado del botón «Eliminar»; `null` si la variante no lo ofrece. */
	deleteTreatment: DeleteTreatment | null;
	/** Si la acción se oculta por debajo de `lg` (precedente de `dashboard/+page.svelte:423`). */
	actionsFromLg: boolean;
}

export interface FormattedCardActionMeasurement {
	variant: string;
	label: string;
	declared: string;
	target: string;
	touch: string;
	visibility: string;
	reveal: string;
	deleteStyle: string;
	breakpoint: string;
}

const REVEAL_LABEL: Record<CardActionMeasurement["reveal"], string> = {
	siempre: "siempre visible",
	"en reposo": "oculta hasta hover o foco",
	forzado: "forzada visible",
};

const DELETE_LABEL: Record<DeleteTreatment, string> = {
	usermenu: "como UserMenu: destructivo en reposo",
	editar: "como la acción de editar",
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
		deleteStyle: measurement.deleteTreatment ? DELETE_LABEL[measurement.deleteTreatment] : "—",
		breakpoint: measurement.actionsFromLg ? "sólo desde lg" : "visible siempre",
	};
}
