// Pruebas de `RequestPublicationControl`: el camino del **editor** — pedir la publicación de un
// dataset privado y cancelar la propia solicitud pendiente.
//
// Lo que se prueba es la honestidad del portal: la capacidad ya viene resuelta (`canRequest`, la
// consulta bulk de `update_dataset` que la página real ya hace) y el componente no vuelve a derivar
// roles; las dos llamadas —pedir y cancelar— entran inyectadas. Sólo cuenta como éxito lo que el
// catálogo confirmó: una respuesta que no deja la solicitud en el estado pedido no es un éxito.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { CkanApiError } from "$lib/types/api";
import RequestPublicationControl, {
	type PublicationRequest,
} from "./RequestPublicationControl.svelte";

const REQUEST_LABEL = "Solicitar publicación";
const REQUEST_AGAIN_LABEL = "Volver a solicitar";
const CONSEQUENCE = "Un administrador de la organización revisará su solicitud.";
const PENDING_HEADING = "Solicitud pendiente de revisión";
const CANCEL_LABEL = "Cancelar solicitud";
const REJECTED_HEADING = "Solicitud rechazada";
const NO_REASON = "No se indicó un motivo.";
const ANNULLED_HEADING = "Solicitud anulada";
const ANNULLED_BODY =
	"La solicitud ya no está vigente porque el conjunto de datos cambió de estado o dejó de existir.";
const REFUSED_REQUEST = "Solo quien puede editar este dataset puede solicitar su publicación.";
const REFUSED_CANCEL =
	"Solo quien la solicitó o un administrador de la organización puede cancelarla.";
// Mensajes crudos del catálogo, distintos de las frases amables: si un `403` cayera en la rama
// genérica, la alerta mostraría el texto crudo y las aserciones fallarían.
const SERVER_403_REQUEST =
	"Authorization Error: la acción 'package_create' requiere ser editor del dataset.";
const SERVER_403_CANCEL =
	"Authorization Error: sólo el autor de la solicitud o un admin puede cancelarla.";
const UNCONFIRMED_REQUEST = "El catálogo no confirmó la solicitud.";
const UNCONFIRMED_CANCEL = "El catálogo no confirmó la cancelación.";

type ControlProps = {
	dataset: { id: string; private: boolean };
	canRequest: boolean;
	currentRequest?: PublicationRequest | null;
	request: (datasetId: string) => Promise<PublicationRequest>;
	cancel: (requestId: string) => Promise<PublicationRequest>;
	onrequested?: (request: PublicationRequest) => void;
	oncancelled?: (request: PublicationRequest) => void;
	/** Presentación: `"accion"` lo dibuja como una acción del hero; `"bloque"` (hoy) con el texto debajo. */
	apariencia?: "bloque" | "accion";
};

function makeRequest(overrides: Partial<PublicationRequest> = {}): PublicationRequest {
	return {
		id: "req-1",
		dataset_id: "pkg-1",
		status: "pending",
		requested_by: "editor",
		comments: null,
		created_at: "2026-10-01T00:00:00.000000",
		...overrides,
	};
}

const DATASET = { id: "pkg-1", private: true };

/** Renderiza con las dos llamadas ya inyectadas y una capacidad afirmativa por defecto. */
function renderControl(overrides: Partial<ControlProps> = {}) {
	const request = vi.fn<(datasetId: string) => Promise<PublicationRequest>>();
	const cancel = vi.fn<(requestId: string) => Promise<PublicationRequest>>();
	const onrequested = vi.fn();
	const oncancelled = vi.fn();

	const resultado = render(RequestPublicationControl, {
		props: {
			dataset: DATASET,
			canRequest: true,
			currentRequest: null,
			request,
			cancel,
			onrequested,
			oncancelled,
			...overrides,
		} satisfies ControlProps,
	});

	return { request, cancel, onrequested, oncancelled, ...resultado };
}

describe("RequestPublicationControl — qué se ofrece según la capacidad", () => {
	it("sin capacidad de edición no renderiza nada", () => {
		const { container } = renderControl({ canRequest: false });

		expect(container.textContent?.trim()).toBe("");
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("un dataset ya público no ofrece nada: la retracción está fuera del alcance", () => {
		const { container } = renderControl({ dataset: { id: "pkg-1", private: false } });

		expect(container.textContent?.trim()).toBe("");
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("privado + sin solicitud: ofrece pedirla y enuncia la consecuencia", () => {
		renderControl();

		expect(screen.getByRole("button", { name: REQUEST_LABEL })).toBeInTheDocument();
		expect(screen.getByText(CONSEQUENCE)).toBeInTheDocument();
	});

	it("privado + solicitud pendiente: la muestra y sólo ofrece cancelarla", () => {
		renderControl({ currentRequest: makeRequest() });

		expect(screen.getByText(PENDING_HEADING)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: CANCEL_LABEL })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: REQUEST_LABEL })).toBeNull();
	});

	it("solicitud rechazada: muestra el motivo y permite volver a solicitarla", () => {
		const motivo = "Faltan los metadatos obligatorios del conjunto de datos.";
		renderControl({ currentRequest: makeRequest({ status: "rejected", comments: motivo }) });

		expect(screen.getByText(REJECTED_HEADING)).toBeInTheDocument();
		expect(screen.getByText(new RegExp(motivo))).toBeInTheDocument();
		expect(screen.getByRole("button", { name: REQUEST_AGAIN_LABEL })).toBeInTheDocument();
	});

	it("solicitud rechazada sin comentario: dice que no se indicó un motivo", () => {
		renderControl({ currentRequest: makeRequest({ status: "rejected", comments: null }) });

		expect(screen.getByText(REJECTED_HEADING)).toBeInTheDocument();
		expect(screen.getByText(NO_REASON)).toBeInTheDocument();
	});

	it("una solicitud cancelada vuelve a ofrecer el control", () => {
		renderControl({ currentRequest: makeRequest({ status: "cancelled" }) });

		expect(screen.getByRole("button", { name: REQUEST_LABEL })).toBeInTheDocument();
		expect(screen.queryByText(PENDING_HEADING)).toBeNull();
	});

	it("solicitud anulada: dice que dejó de estar vigente y no ofrece volver a pedirla", () => {
		// La anulación llega cuando la solicitud perdió su objeto (el dataset se eliminó o ya se
		// publicó por otra vía). Si la rama desapareciera, el control volvería a ofrecer el botón de
		// solicitud y la aserción fallaría.
		renderControl({ currentRequest: makeRequest({ status: "annulled" }) });

		expect(screen.getByText(ANNULLED_HEADING)).toBeInTheDocument();
		expect(screen.getByText(ANNULLED_BODY)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: REQUEST_LABEL })).toBeNull();
	});

	it("una solicitud aprobada no ofrece nada: el dataset ya es público", () => {
		const { container } = renderControl({ currentRequest: makeRequest({ status: "approved" }) });

		expect(container.textContent?.trim()).toBe("");
		expect(screen.queryByRole("button")).toBeNull();
	});
});

describe("RequestPublicationControl — qué reporta después del click", () => {
	it("pide la publicación del dataset y sólo pasa al estado pendiente si el catálogo lo confirmó", async () => {
		const { request, onrequested } = renderControl();
		const confirmada = makeRequest({ id: "req-9" });
		request.mockResolvedValue(confirmada);

		await fireEvent.click(screen.getByRole("button", { name: REQUEST_LABEL }));

		await waitFor(() => expect(onrequested).toHaveBeenCalledWith(confirmada));
		expect(request).toHaveBeenCalledWith("pkg-1");
		expect(screen.getByText(PENDING_HEADING)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: REQUEST_LABEL })).toBeNull();
	});

	it("403: rechazo honesto con la capacidad que falta y sin anunciar ninguna solicitud", async () => {
		const { request, onrequested } = renderControl();
		request.mockRejectedValue(new CkanApiError(SERVER_403_REQUEST, 403, "Authorization Error"));

		await fireEvent.click(screen.getByRole("button", { name: REQUEST_LABEL }));

		// Anclado: la alerta debe ser exactamente la frase honesta, y el mensaje crudo no debe verse.
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(new RegExp(`^${REFUSED_REQUEST}$`)),
		);
		expect(screen.getByRole("alert")).not.toHaveTextContent(SERVER_403_REQUEST);
		expect(onrequested).not.toHaveBeenCalled();
		expect(screen.queryByText(PENDING_HEADING)).toBeNull();
		// El control sigue ofrecido: el rechazo no se disfraza de éxito ni de error de red.
		expect(screen.getByRole("button", { name: REQUEST_LABEL })).toBeEnabled();
	});

	it("200 que no deja la solicitud pendiente: dice que el catálogo no confirmó", async () => {
		const { request, onrequested } = renderControl();
		// El catálogo contestó 200 pero la solicitud volvió rechazada: no concedió lo que se pidió.
		request.mockResolvedValue(makeRequest({ status: "rejected" }));

		await fireEvent.click(screen.getByRole("button", { name: REQUEST_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNCONFIRMED_REQUEST));
		expect(onrequested).not.toHaveBeenCalled();
		expect(screen.queryByText(PENDING_HEADING)).toBeNull();
		expect(screen.getByRole("button", { name: REQUEST_LABEL })).toBeInTheDocument();
	});

	it("otro fallo al pedir: error explícito con reintento que vuelve a intentar", async () => {
		const { request, onrequested } = renderControl();
		const confirmada = makeRequest();
		request.mockRejectedValueOnce(new Error("502 Bad Gateway")).mockResolvedValueOnce(confirmada);

		await fireEvent.click(screen.getByRole("button", { name: REQUEST_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("502 Bad Gateway"));
		expect(request).toHaveBeenCalledTimes(1);

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => expect(onrequested).toHaveBeenCalledWith(confirmada));
		expect(request).toHaveBeenCalledTimes(2);
	});

	it("en vuelo: el control reporta ocupado y no anuncia ninguna solicitud", async () => {
		const { request, onrequested } = renderControl();
		request.mockReturnValue(new Promise(() => {}));

		await fireEvent.click(screen.getByRole("button", { name: REQUEST_LABEL }));

		const boton = screen.getByRole("button", { name: /enviando/i });
		expect(boton).toBeDisabled();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(onrequested).not.toHaveBeenCalled();
	});

	it("cancela la solicitud pendiente con su identificador y sólo vuelve al inicio si el catálogo lo confirmó", async () => {
		const { cancel, oncancelled } = renderControl({ currentRequest: makeRequest({ id: "req-7" }) });
		const cancelada = makeRequest({ id: "req-7", status: "cancelled" });
		cancel.mockResolvedValue(cancelada);

		await fireEvent.click(screen.getByRole("button", { name: CANCEL_LABEL }));

		await waitFor(() => expect(oncancelled).toHaveBeenCalledWith(cancelada));
		expect(cancel).toHaveBeenCalledWith("req-7");
		expect(screen.queryByText(PENDING_HEADING)).toBeNull();
		expect(screen.getByRole("button", { name: REQUEST_LABEL })).toBeInTheDocument();
	});

	it("403 al cancelar: nombra quién puede cancelar y la solicitud sigue pendiente", async () => {
		const { cancel, oncancelled } = renderControl({ currentRequest: makeRequest() });
		cancel.mockRejectedValue(new CkanApiError(SERVER_403_CANCEL, 403, "Authorization Error"));

		await fireEvent.click(screen.getByRole("button", { name: CANCEL_LABEL }));

		// Anclado: la alerta debe ser exactamente la frase honesta, y el mensaje crudo no debe verse.
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(new RegExp(`^${REFUSED_CANCEL}$`)),
		);
		expect(screen.getByRole("alert")).not.toHaveTextContent(SERVER_403_CANCEL);
		expect(oncancelled).not.toHaveBeenCalled();
		expect(screen.getByText(PENDING_HEADING)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: CANCEL_LABEL })).toBeEnabled();
	});

	it("200 que no cancela: dice que el catálogo no confirmó la cancelación", async () => {
		const { cancel, oncancelled } = renderControl({ currentRequest: makeRequest() });
		// El catálogo contestó 200 pero la solicitud sigue pendiente: no concedió la cancelación.
		cancel.mockResolvedValue(makeRequest({ status: "pending" }));

		await fireEvent.click(screen.getByRole("button", { name: CANCEL_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNCONFIRMED_CANCEL));
		expect(oncancelled).not.toHaveBeenCalled();
		expect(screen.getByText(PENDING_HEADING)).toBeInTheDocument();
	});

	it("otro fallo al cancelar: error explícito con reintento que vuelve a cancelar", async () => {
		const { cancel, oncancelled } = renderControl({ currentRequest: makeRequest() });
		const cancelada = makeRequest({ status: "cancelled" });
		cancel
			.mockRejectedValueOnce(new Error("503 Service Unavailable"))
			.mockResolvedValueOnce(cancelada);

		await fireEvent.click(screen.getByRole("button", { name: CANCEL_LABEL }));

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("503 Service Unavailable"),
		);

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => expect(oncancelled).toHaveBeenCalledWith(cancelada));
		expect(cancel).toHaveBeenCalledTimes(2);
	});
});

// La presentación de **acción**: el control en la fila del hero. Se dibuja como sus hermanos y la
// explicación pasa al `title`. Los **estados** no cambian: una solicitud pendiente o anulada es
// información, no la acción, y sigue ocupando su bloque.
describe("RequestPublicationControl — la presentación de acción", () => {
	it("en `accion` dibuja sólo el botón, con la forma de las acciones del hero y la explicación en el tooltip", async () => {
		renderControl({ apariencia: "accion" });

		const boton = await screen.findByRole("button", { name: REQUEST_LABEL });

		expect(boton.className).toContain("h-9");
		expect(boton.className).toContain("border-input");
		expect(boton.className).toContain("bg-background");

		// La explicación no ocupa lugar en el flujo: no hay ningún párrafo con ella...
		expect(screen.queryByText(CONSEQUENCE, { selector: "p" })).toBeNull();
		// ...pero no se pierde. Es el tooltip, y además queda asociada al botón: el `title` solo alcanza
		// al puntero, no al teclado.
		expect(boton).toHaveAttribute("title", CONSEQUENCE);
		const descrito = boton.getAttribute("aria-describedby");
		expect(descrito).toBeTruthy();
		const copia = document.getElementById(descrito ?? "");
		expect(copia).toHaveTextContent(CONSEQUENCE);
		expect(copia).toHaveClass("sr-only");
	});

	it("en `accion` el estado pendiente sigue siendo información, con su cancelar", async () => {
		renderControl({ apariencia: "accion", currentRequest: makeRequest({ status: "pending" }) });

		expect(await screen.findByText(PENDING_HEADING)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: CANCEL_LABEL })).toBeInTheDocument();
	});

	it("en `bloque` la explicación sigue debajo del botón, y sin tooltip", async () => {
		renderControl();

		expect(await screen.findByText(CONSEQUENCE)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: REQUEST_LABEL })).not.toHaveAttribute("title");
	});
});
