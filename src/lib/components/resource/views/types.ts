/** Cómo se disponen la tabla y los gráficos: uno bajo el otro, o en pestañas `Tabla | <gráfico>…`. */
export type ChartsLayout = "stacked" | "tabs";
/**
 * Dónde vive «Crear gráfico»: a la derecha del encabezado de la sección, al final de la barra de pestañas
 * (sólo con pestañas; apilado cae al encabezado), como tarjeta punteada al final de la lista, o en ningún
 * lugar de este componente (lo ofrece quien lo aloja, por ejemplo en el encabezado del recurso).
 */
export type CreatePlacement = "heading" | "tabs" | "card" | "none";
