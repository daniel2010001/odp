// Compuerta de las maquetas del prototipo: superficie **sólo para desarrollo**.
//
// Todo lo que vive bajo `/dev/prototype` son hojas de presentación —pantallas sin funcionamiento,
// con datos fijos— que se capturan para el prototipo de Figma (`odd/tasks/prototype-presentation.md`).
// No son features: en un build real la carpeta entera responde 404, igual que `/dev/kind`.

import { error } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";

export const load: LayoutLoad = () => {
	if (!import.meta.env.DEV) {
		throw error(404, "Not found");
	}
	return {};
};
