import type { Database } from "@lucide/svelte";

/** Una acción del panel: la misma descripción alimenta la grilla y la barra pegajosa. */
export interface DashboardAction {
	id: string;
	title: string;
	description: string;
	href: string;
	icon: typeof Database;
	/** Línea de estado bajo la descripción; ausente mientras el dato no se conoce o no se pudo leer. */
	status?: string;
	/** «3 pendientes»: sólo cuando hay algo que decidir. Marca la tarjeta y viaja en el nombre accesible. */
	badge?: string;
	/** Número que acompaña a la acción en la barra. */
	count?: number;
}
