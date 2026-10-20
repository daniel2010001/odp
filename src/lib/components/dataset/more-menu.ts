import type { Pencil } from "@lucide/svelte";

/** Una acción de un menú «Más acciones»: siempre un enlace (con su destino real). */
export interface MenuItem {
	label: string;
	icon: typeof Pencil;
	href: string;
}
