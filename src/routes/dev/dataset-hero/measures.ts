// Medida cruda → texto de la hoja de revisión del hero del dataset.
//
// El instrumento mide, sobre el nodo ya renderizado, la caja del título y la separación entre el
// título y el botón de copiar enlace. Es exactamente la queja que esta hoja existe para resolver:
// hoy el botón queda «pegado al título». El paso de número a texto vive acá, aislado y sin DOM,
// para poder testearlo con entradas conocidas: en jsdom no hay motor de layout y toda medida vale
// 0, así que la única parte verificable sin navegador es que el texto impreso sea exactamente el
// que corresponde a la medida.

export interface HeroMeasurement {
	variant: string;
	label: string;
	titleWidth: number;
	titleHeight: number;
	/** Separación horizontal entre el título y el botón de copiar; 0 si no comparten fila. */
	gapX: number;
	/** Separación vertical entre el título y el botón de copiar; 0 si comparten fila. */
	gapY: number;
}

export interface FormattedHeroMeasurement {
	variant: string;
	label: string;
	title: string;
	gapX: string;
	gapY: string;
	sameRow: string;
}

export function formatHeroMeasurement(measurement: HeroMeasurement): FormattedHeroMeasurement {
	return {
		variant: measurement.variant,
		label: measurement.label,
		title: `${measurement.titleWidth.toFixed(2)} × ${measurement.titleHeight.toFixed(2)} px`,
		gapX: `${measurement.gapX.toFixed(2)} px`,
		gapY: `${measurement.gapY.toFixed(2)} px`,
		sameRow: measurement.gapY === 0 ? "sí" : "no",
	};
}
