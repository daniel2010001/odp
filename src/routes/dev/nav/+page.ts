import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// Playground de la regla 8: material de trabajo, NO se trackea y se borra al promover.
export const load: PageLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}

	return {};
};
