// Los enlaces del pie de una solicitud abierta: lo que se puede hacer con el dataset además de decidir. Son
// enlaces de verdad, con su destino: la ficha del dataset y su historial de solicitudes (`#history`, el ancla
// de `RequestHistory`).

import { ExternalLink, History } from "@lucide/svelte";
import type { MenuItem } from "$lib/components/dataset/more-menu";
import type { QueueItem } from "./requests-model";

export function datasetLinks(item: QueueItem): MenuItem[] {
	const dataset = `/dataset/${encodeURIComponent(item.dataset_id)}`;
	return [
		{ label: "Abrir el dataset", icon: ExternalLink, href: dataset },
		{ label: "Historial de solicitudes", icon: History, href: `${dataset}#history` },
	];
}
