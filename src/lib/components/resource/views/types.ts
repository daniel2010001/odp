/** Cómo se disponen la tabla y los gráficos: uno bajo el otro, o en pestañas `Tabla | <gráfico>…`. */
export type ChartsLayout = "stacked" | "tabs";
/**
 * Cómo se dibujan las pestañas: `underline` (barra con línea, hoy en revisión) o `segmented` (el control
 * segmentado con íconos que tenía la vista previa antes de `ce8670a`, dentro de la misma tarjeta).
 */
export type TabStyle = "underline" | "segmented";
/**
 * Dónde vive «Crear gráfico»: a la derecha del encabezado de la sección, al final de la barra de pestañas
 * (sólo con pestañas; apilado cae al encabezado), como tarjeta punteada al final de la lista, o en ningún
 * lugar de este componente (lo ofrece quien lo aloja, por ejemplo en el encabezado del recurso).
 */
export type CreatePlacement = "heading" | "tabs" | "card" | "none";
