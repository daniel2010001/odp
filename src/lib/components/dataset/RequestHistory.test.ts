// Pruebas de `RequestHistory`: el historial de solicitudes de publicación de un dataset (S12/S19).
// Sólo muestra lo que la fila trae: lo ausente se omite, `"unknown"` se nombra con una etiqueta neutra y
// las filas anteriores a la migración 0002 no inventan fecha, autor ni atribución.

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { PublicationRequest } from "$lib/api/publication";
import RequestHistory from "./RequestHistory.svelte";

function fila(overrides: Partial<PublicationRequest> = {}): PublicationRequest {
	return {
		id: "req-1",
		dataset_id: "pkg-1",
		status: "pending",
		requested_by_name: "Ana Flores",
		created_at: "2026-10-17T10:00:00.000000",
		...overrides,
	};
}

function entradas() {
	return screen.getAllByTestId("historial-entrada");
}

/** El historial va plegado (S18): para leer varias entradas, primero se despliega. */
async function desplegar() {
	await fireEvent.click(screen.getByRole("button", { name: /^Ver \d+ más$/ }));
}

describe("RequestHistory", () => {
	it("un estado que el portal no conoce no rompe la tarjeta: se lee «Estado desconocido»", () => {
		const futura = fila({ status: "escalated" as unknown as PublicationRequest["status"] });
		render(RequestHistory, { rows: [futura] });
		const [e] = entradas();
		expect(within(e).getByText("Estado desconocido")).toBeTruthy();
		expect(within(e).getByText("Pedida por Ana Flores el 17 de octubre de 2026")).toBeTruthy();
		expect(e.textContent).not.toMatch(/escalated/);
	});

	it("sin filas no dibuja la tarjeta", () => {
		render(RequestHistory, { rows: [] });
		expect(screen.queryByTestId("historial-solicitudes")).toBeNull();
		expect(screen.queryByText("Historial de solicitudes")).toBeNull();
	});

	it("una pendiente dice quién la pidió y cuándo, y no tiene línea de resolución", () => {
		render(RequestHistory, { rows: [fila()] });
		const [e] = entradas();
		expect(within(e).getByText("Pendiente")).toBeTruthy();
		expect(within(e).getByText("Pedida por Ana Flores el 17 de octubre de 2026")).toBeTruthy();
		expect(e.textContent).not.toMatch(/Aprobada|Rechazada|Retirada|Anulada/);
	});

	it.each([
		["approved", "Aprobada"],
		["rejected", "Rechazada"],
		["cancelled", "Retirada"],
		["annulled", "Anulada"],
	] as const)("%s: la resolución nombra a quien resolvió y la fecha", (status, rotulo) => {
		render(RequestHistory, {
			rows: [
				fila({
					status,
					resolved_by_name: "Marta Quispe",
					decided_at: "2026-10-18T09:30:00.000000",
				}),
			],
		});
		const [e] = entradas();
		expect(within(e).getByText(`${rotulo} por Marta Quispe el 18 de octubre de 2026`)).toBeTruthy();
	});

	it("muestra la nota de quien pidió y el comentario de la decisión, cada uno con su rótulo", () => {
		render(RequestHistory, {
			rows: [
				fila({
					status: "approved",
					resolved_by_name: "Marta Quispe",
					request_comment: "Datos validados.",
					decision_comment: "Todo en orden.",
				}),
			],
		});
		const [e] = entradas();
		expect(e.textContent).toContain("Nota de quien pidió: Datos validados.");
		expect(e.textContent).toContain("Comentario de la decisión: Todo en orden.");
	});

	it("un rechazo rotula su comentario como motivo", () => {
		render(RequestHistory, {
			rows: [
				fila({ status: "rejected", resolved_by_name: "M", decision_comment: "Falta licencia." }),
			],
		});
		expect(entradas()[0].textContent).toContain("Motivo del rechazo: Falta licencia.");
	});

	it("omite las notas que no existen", () => {
		render(RequestHistory, {
			rows: [fila({ status: "approved", request_comment: "  ", decision_comment: null })],
		});
		expect(entradas()[0].textContent).not.toMatch(/Nota de quien pidió|Comentario/);
	});

	it("una anulada dice la causa con el copy del portal, no el token", async () => {
		render(RequestHistory, {
			rows: [
				fila({ id: "a", status: "annulled", motive: "dataset_deleted" }),
				fila({ id: "b", status: "annulled", motive: "published_by_another_path" }),
				fila({ id: "c", status: "annulled", motive: "algo_nuevo" }),
			],
		});
		await desplegar();
		const [a, b, c] = entradas();
		expect(a.textContent).toContain("Causa de la anulación: El dataset se eliminó.");
		expect(b.textContent).toContain("Causa de la anulación: El dataset se publicó por otra vía.");
		expect(c.textContent).toContain("Causa de la anulación: La solicitud dejó de estar vigente.");
		expect(document.body.textContent).not.toContain("dataset_deleted");
		expect(document.body.textContent).not.toContain("algo_nuevo");
	});

	it("fila anterior a la 0002: una cancelación sin fecha ni autor no inventa la resolución", () => {
		render(RequestHistory, {
			rows: [fila({ status: "cancelled", decided_at: null, resolved_by_name: null })],
		});
		const [e] = entradas();
		expect(within(e).getByText("Retirada")).toBeTruthy();
		expect(e.textContent).not.toMatch(/Retirada por|Retirada el/);
	});

	it("fila anterior a la 0002: una aprobación toma a quien decidió de approved_by_name", () => {
		render(RequestHistory, {
			rows: [
				fila({
					status: "approved",
					resolved_by_name: null,
					approved_by_name: "Marta Quispe",
					decided_at: "2026-10-18T09:30:00.000000",
				}),
			],
		});
		expect(entradas()[0].textContent).toContain(
			"Aprobada por Marta Quispe el 18 de octubre de 2026",
		);
	});

	it("fila anterior a la 0002: el comentario sin atribuir se rotula «Comentario» a secas", () => {
		render(RequestHistory, {
			rows: [
				fila({
					status: "approved",
					comments: "Publíquese.",
					request_comment: null,
					decision_comment: null,
				}),
			],
		});
		const texto = entradas()[0].textContent ?? "";
		expect(texto).toContain("Comentario: Publíquese.");
		expect(texto).not.toMatch(/Nota de quien pidió|Comentario de la decisión|Motivo del rechazo/);
	});

	it("el `comments` viejo de una pendiente es la nota de quien pidió", () => {
		render(RequestHistory, { rows: [fila({ comments: "Urgente." })] });
		expect(entradas()[0].textContent).toContain("Nota de quien pidió: Urgente.");
	});

	it("el `comments` viejo no duplica los comentarios nuevos", () => {
		render(RequestHistory, {
			rows: [
				fila({
					status: "approved",
					comments: "Todo en orden.",
					decision_comment: "Todo en orden.",
				}),
			],
		});
		expect(entradas()[0].textContent?.match(/Todo en orden/g)).toHaveLength(1);
	});

	it("nombres: vacío se omite y «unknown» es una etiqueta neutra, nunca el valor crudo", async () => {
		render(RequestHistory, {
			rows: [
				fila({ id: "a", requested_by_name: null }),
				fila({
					id: "b",
					status: "rejected",
					requested_by_name: "unknown",
					resolved_by_name: "unknown",
					decided_at: "2026-10-18T09:30:00.000000",
				}),
			],
		});
		await desplegar();
		const [a, b] = entradas();
		expect(within(a).getByText("Pedida el 17 de octubre de 2026")).toBeTruthy();
		expect(
			within(b).getByText("Pedida por usuario no disponible el 17 de octubre de 2026"),
		).toBeTruthy();
		expect(
			within(b).getByText("Rechazada por usuario no disponible el 18 de octubre de 2026"),
		).toBeTruthy();
		expect(document.body.textContent).not.toContain("unknown");
	});

	// Historial «Plegado» (S18 de `odd/tasks/prototype-presentation.md`): antes mostraba cuatro entradas.
	it("plegado: muestra la última solicitud y «Ver N más» despliega el resto", async () => {
		const rows = Array.from({ length: 6 }, (_, i) => fila({ id: `r${i}` }));
		render(RequestHistory, { rows });
		expect(entradas()).toHaveLength(1);
		await fireEvent.click(screen.getByRole("button", { name: "Ver 5 más" }));
		expect(entradas()).toHaveLength(6);
		expect(screen.getByRole("button", { name: "Ver menos" })).toBeTruthy();
	});

	it("con una sola solicitud no ofrece «Ver más»", () => {
		render(RequestHistory, { rows: [fila()] });
		expect(entradas()).toHaveLength(1);
		expect(screen.queryByRole("button", { name: /Ver/ })).toBeNull();
	});
});
