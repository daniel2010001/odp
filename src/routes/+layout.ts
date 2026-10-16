import type { LayoutLoad } from "./$types";

// Con un `+layout.server.ts` presente, el `load` universal recibe sus datos en `data` y **tiene que devolverlos**:
// lo que retorna es lo que ve el layout. Sin esto `sessionUser` se perdería por el camino.
export const load: LayoutLoad = async ({ data }) => {
	return data;
};
