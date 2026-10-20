/** Una fila de ficha: etiqueta arriba, valor debajo y, si `copy` existe, el botón de copiar al extremo. */
export type MetaRow = {
	label: string;
	value: string;
	/** Nombre accesible del botón de copiar; sin él, la fila no se copia. */
	copy?: string;
	mono?: boolean;
};

/** Un grupo de filas con su título. `id` enlaza el título con el grupo (`aria-labelledby`). */
export type MetaGroupData = { id: string; title: string; rows: MetaRow[] };
