// El resumen del dataset de cada solicitud abierta, pedido **cuando se abre** la fila y guardado por dataset.
// Una fila cerrada no pide nada; cerrar y reabrir una fila no vuelve a pedir; un fallo se olvida para que
// reabrir la fila lo reintente. Es un dato de contexto: nunca bloquea decidir.

import type { CkanPackage } from "$lib/types/ckan";
import { type DatasetSummary, datasetSummary } from "./requests-model";

export type SummaryState =
	| { status: "loading" }
	| { status: "ready"; summary: DatasetSummary }
	| { status: "error" };

export class SummaryStore {
	entries = $state<Record<string, SummaryState>>({});

	readonly #read: (id: string) => Promise<CkanPackage>;

	constructor(read: (id: string) => Promise<CkanPackage>) {
		this.#read = read;
	}

	/** Lo que se sabe del dataset hasta ahora; `undefined` si nunca se pidió. */
	get = (id: string): SummaryState | undefined => this.entries[id];

	/** Pide el resumen si no lo tiene (o si el intento anterior falló). Nunca lanza. */
	load = async (id: string): Promise<void> => {
		const actual = this.entries[id];
		if (actual && actual.status !== "error") return;
		this.entries[id] = { status: "loading" };
		try {
			this.entries[id] = { status: "ready", summary: datasetSummary(await this.#read(id)) };
		} catch {
			this.entries[id] = { status: "error" };
		}
	};
}
