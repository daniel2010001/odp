// Medida cruda → texto de la hoja de revisión del error.
//
// El instrumento de `/dev/error` mide el layout del nodo ya renderizado y lo imprime. El paso de
// número a texto vive acá, aislado y sin DOM, para poder testearlo con entradas conocidas: en
// jsdom no hay motor de layout y toda medida vale 0, así que la única parte verificable sin
// navegador es que el texto impreso sea exactamente el que corresponde a la medida.
//
// `columnWidth` se muestra con dos decimales porque un ancho fraccionario es información —una
// columna en 383.50 px no mide lo mismo que una en 384.00 px—; los anchos de desborde son enteros
// de píxeles y se muestran como el par `scroll / client` que el revisor compara.

export interface SheetMeasures {
	columnWidth: number;
	cardScrollWidth: number;
	cardClientWidth: number;
	pageScrollWidth: number;
	pageClientWidth: number;
}

export interface FormattedMeasures {
	columnWidth: string;
	cardOverflow: string;
	documentOverflow: string;
}

export function formatMeasures(measures: SheetMeasures): FormattedMeasures {
	return {
		columnWidth: `${measures.columnWidth.toFixed(2)} px`,
		cardOverflow: `${measures.cardScrollWidth} / ${measures.cardClientWidth}`,
		documentOverflow: `${measures.pageScrollWidth} / ${measures.pageClientWidth}`,
	};
}
