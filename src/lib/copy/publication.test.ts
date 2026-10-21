// Pruebas de la copia de la solicitud de publicación: el rótulo del historial nunca lanza.

import { describe, expect, it } from "vitest";
import type { PublicationRequest } from "$lib/api/publication";
import { estadoDelHistorial } from "./publication";

describe("estadoDelHistorial", () => {
	it.each([
		["pending", "Pendiente", null],
		["approved", "Aprobada", "Aprobada"],
		["rejected", "Rechazada", "Rechazada"],
		["cancelled", "Retirada", "Retirada"],
		["annulled", "Anulada", "Anulada"],
	] as const)("%s se rotula %s", (status, label, resolvio) => {
		const e = estadoDelHistorial(status);
		expect(e.label).toBe(label);
		expect(e.resolvio).toBe(resolvio);
		expect(e.tone).not.toBe("");
	});

	it("un estado desconocido (o ausente) es neutral y no lanza", () => {
		for (const raro of ["escalated", "", undefined, null]) {
			const e = estadoDelHistorial(raro as unknown as PublicationRequest["status"]);
			expect(e.label).toBe("Estado desconocido");
			expect(e.resolvio).toBeNull();
			expect(e.tone).toContain("text-muted-foreground");
		}
	});
});
