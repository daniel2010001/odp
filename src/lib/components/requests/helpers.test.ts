// Tests de los helpers puros de la page de solicitudes: los enlaces del pie de cada fila y los iconos de estado.

import { CircleHelp } from "@lucide/svelte";
import { describe, expect, it } from "vitest";
import type { PublicationRequestStatus } from "$lib/api/publication";
import { datasetLinks } from "./dataset-links";
import type { QueueItem } from "./requests-model";
import { statusIcon } from "./status-icons";

function item(datasetId: string): QueueItem {
	return {
		id: "r",
		dataset_id: datasetId,
		dataset_title: "Dataset",
		status: "pending",
		requested_by: "otro",
		created_at: "2026-10-01T00:00:00",
	};
}

describe("datasetLinks", () => {
	it("ofrece la ficha del dataset y su historial de solicitudes, con enlaces reales", () => {
		const items = datasetLinks(item("pkg-p1"));
		expect(items.map((i) => [i.label, i.href])).toEqual([
			["Abrir el dataset", "/dataset/pkg-p1"],
			["Historial de solicitudes", "/dataset/pkg-p1#history"],
		]);
	});

	it("codifica el id del dataset en la ruta", () => {
		const [ficha, historial] = datasetLinks(item("a b/c"));
		expect(ficha.href).toBe("/dataset/a%20b%2Fc");
		expect(historial.href).toBe("/dataset/a%20b%2Fc#history");
	});
});

describe("statusIcon", () => {
	const ESTADOS: PublicationRequestStatus[] = [
		"pending",
		"approved",
		"rejected",
		"cancelled",
		"annulled",
	];

	it("cada estado tiene su propio icono", () => {
		const iconos = new Set(ESTADOS.map(statusIcon));
		expect(iconos.size).toBe(ESTADOS.length);
		expect(iconos.has(CircleHelp)).toBe(false);
	});

	it("un estado desconocido cae a la interrogación neutral", () => {
		expect(statusIcon("otro" as PublicationRequestStatus)).toBe(CircleHelp);
	});
});
