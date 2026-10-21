// Pruebas del tope del comentario de `PublicationDecision`: el contador «x/1000» que tienen los demás
// campos y la decisión que no se envía al pasarse. El tope aplica al texto **ya recortado**, que es lo
// que se envía al catálogo.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import PublicationDecision from "./PublicationDecision.svelte";
import {
	type DecidePublicationRequest,
	MAX_DECISION_COMMENT_LENGTH,
	type PublicationDecisionResult,
} from "./publication-decision";

const COMMENT_LABEL = "Comentario (obligatorio para rechazar)";
const APPROVE_LABEL = "Aprobar";
const REJECT_LABEL = "Rechazar";

const REJECTED = {
	id: "req-1",
	dataset_id: "pkg-1",
	status: "rejected",
} as unknown as PublicationDecisionResult;

function renderDecision() {
	const decide = vi.fn<DecidePublicationRequest>().mockResolvedValue(REJECTED);
	const readDataset = vi.fn().mockResolvedValue({ private: false });
	render(PublicationDecision, {
		props: { item: { id: "req-1", requested_by: "otro" }, decide, readDataset, currentUser: null },
	});
	return { decide };
}

async function write(text: string) {
	await fireEvent.input(screen.getByLabelText(COMMENT_LABEL), { target: { value: text } });
}

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	auth.reset();
});

describe("PublicationDecision — tope del comentario", () => {
	it("el tope es 1000", () => {
		expect(MAX_DECISION_COMMENT_LENGTH).toBe(1000);
	});

	it("el contador arranca en «0/1000» y sigue lo que se escribe", async () => {
		renderDecision();
		expect(screen.getByText("0/1000")).toBeInTheDocument();

		await write("Motivo breve");
		expect(screen.getByText("12/1000")).toBeInTheDocument();
	});

	it("el contador queda ligado al campo por aria-describedby", () => {
		renderDecision();
		const contador = screen.getByText("0/1000");
		expect(screen.getByLabelText(COMMENT_LABEL).getAttribute("aria-describedby")).toContain(
			contador.id,
		);
	});

	it("el contador pasa de neutro a aviso (80%) y a error (sobre el tope)", async () => {
		renderDecision();
		await write("a".repeat(799));
		expect(screen.getByText("799/1000").className).toContain("text-muted-foreground");

		await write("a".repeat(800));
		expect(screen.getByText("800/1000").className).toContain("text-destructive/70");

		await write("a".repeat(1001));
		expect(screen.getByText("1001/1000").className).toContain("font-semibold");
	});

	it.each([
		[APPROVE_LABEL],
		[REJECT_LABEL],
	])("con 1001 caracteres «%s» no envía la decisión y marca el campo", async (label) => {
		const { decide } = renderDecision();
		await write("a".repeat(1001));
		await fireEvent.click(screen.getByRole("button", { name: label }));

		expect(decide).not.toHaveBeenCalled();
		expect(screen.getByText("El comentario no puede superar los 1000 caracteres.")).toBeVisible();
		expect(screen.getByLabelText(COMMENT_LABEL)).toHaveAttribute("aria-invalid", "true");
	});

	it("con exactamente 1000 caracteres acepta y envía", async () => {
		const { decide } = renderDecision();
		const texto = "a".repeat(1000);
		await write(texto);
		await fireEvent.click(screen.getByRole("button", { name: REJECT_LABEL }));

		await waitFor(() => expect(decide).toHaveBeenCalledWith("req-1", false, texto));
		expect(screen.queryByText("El comentario no puede superar los 1000 caracteres.")).toBeNull();
	});

	it("el tope cuenta el texto recortado: 1000 más espacios alrededor se acepta", async () => {
		const { decide } = renderDecision();
		await write(`  ${"a".repeat(1000)}  `);
		await fireEvent.click(screen.getByRole("button", { name: REJECT_LABEL }));

		await waitFor(() => expect(decide).toHaveBeenCalledWith("req-1", false, "a".repeat(1000)));
	});

	it("regresión: un rechazo normal envía el comentario recortado", async () => {
		const { decide } = renderDecision();
		await write("  Faltan datos.  ");
		await fireEvent.click(screen.getByRole("button", { name: REJECT_LABEL }));

		await waitFor(() => expect(decide).toHaveBeenCalledWith("req-1", false, "Faltan datos."));
	});

	it("regresión: aprobar sin comentario envía `undefined`", async () => {
		const { decide } = renderDecision();
		decide.mockResolvedValue({ ...REJECTED, status: "approved" } as PublicationDecisionResult);
		await fireEvent.click(screen.getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() => expect(decide).toHaveBeenCalledWith("req-1", true, undefined));
	});
});

describe("PublicationDecision — la carrera: otra persona decidió primero", () => {
	// Contrato (`src/lib/api/publication.ts`): el `409` con la clave `request_id` es la carrera real —dos
	// administradores con la misma lista— y el portal tiene que decir «ya fue decidida», no «no se pudo
	// registrar»: la diferencia es si el usuario recarga o reintenta algo que no va a funcionar nunca.
	function renderWithFailure(err: unknown) {
		const decide = vi.fn<DecidePublicationRequest>().mockRejectedValue(err);
		const readDataset = vi.fn();
		render(PublicationDecision, {
			props: {
				item: { id: "req-1", requested_by: "otro" },
				decide,
				readDataset,
				currentUser: null,
			},
		});
		return { decide };
	}

	it("un 409 con `request_id` dice que la solicitud ya fue decidida, sin dato técnico", async () => {
		renderWithFailure(
			new CkanApiError("Validation Error", 409, "Validation Error", {
				__type: "Validation Error",
				request_id: ["Request is not pending"],
			}),
		);

		await fireEvent.click(screen.getByRole("button", { name: APPROVE_LABEL }));

		const alerta = await screen.findByRole("alert");
		expect(alerta).toHaveTextContent(
			"Esta solicitud ya fue decidida por otra persona. Recargue la página para ver su estado.",
		);
		expect(alerta).not.toHaveTextContent("No se pudo registrar la decisión.");
	});

	it("regresión: un 409 con otra clave sigue siendo el fallo genérico", async () => {
		renderWithFailure(
			new CkanApiError("Validation Error", 409, "Validation Error", {
				__type: "Validation Error",
				approve: ["Missing value"],
			}),
		);

		await fireEvent.click(screen.getByRole("button", { name: APPROVE_LABEL }));

		expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo registrar la decisión.");
	});
});
