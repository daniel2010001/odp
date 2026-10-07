// Pruebas de `PublicationQueue`: la cola del **administrador de la organización** — las solicitudes
// pendientes de las organizaciones donde administra, con aprobar, rechazar y un comentario.
//
// Dos reglas de esta cola se prueban acá:
//  1. **Cuatro ojos**: una solicitud que la propia persona creó se muestra como no decidible, sin
//     ofrecer aprobar ni rechazar. Si la comprobación desapareciera, la fila volvería a ofrecer los
//     botones y la aserción fallaría.
//  2. **Rechazar exige un motivo**: sin comentario la decisión no se envía y se explica por qué. Si
//     la comprobación desapareciera, `decide` se llamaría sin comentario y la aserción fallaría.
//
// Las dos llamadas entran inyectadas (`list` y `decide`): las acciones del catálogo todavía no
// existen en la capa de API del portal. Lo que se prueba además es la honestidad: la fila sólo sale
// de la cola cuando el catálogo confirmó la decisión con el estado correspondiente, y un `403` se
// explica como capacidad faltante, no como error de red.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage, CkanUser } from "$lib/types/ckan";
import PublicationQueue, { type PublicationQueueItem } from "./PublicationQueue.svelte";

const LOADING = "Cargando solicitudes…";
const EMPTY = "No hay solicitudes pendientes de revisión.";
const COMMENT_LABEL = "Comentario (obligatorio para rechazar)";
const APPROVE_LABEL = "Aprobar";
const REJECT_LABEL = "Rechazar";
const SELF_APPROVAL = "No puede aprobar su propia solicitud.";
const REASON_REQUIRED = "Para rechazar una solicitud debe escribir un motivo.";
const REFUSED_DECIDE =
	"Solo un administrador de la organización puede decidir sobre las solicitudes de publicación.";
// Mensaje crudo del catálogo, distinto de la frase amable: si el `403` cayera en la rama
// genérica, la alerta mostraría este texto y las aserciones de abajo fallarían.
const SERVER_403_DECIDE =
	"Authorization Error: la acción 'package_update' requiere el rol admin de la organización.";
const UNCONFIRMED_DECIDE = "El catálogo no confirmó la decisión.";
const APPROVED_NOTE = "La solicitud fue aprobada.";
const REJECTED_NOTE = "La solicitud fue rechazada.";
// Etiqueta neutral cuando el catálogo no entrega el nombre visible de quien solicitó: la fila nunca
// cae al id crudo.
const REQUESTER_FALLBACK = "un usuario del catálogo";

// `requested_by` es el **id** de usuario que el catálogo guarda y devuelve; el nombre visible viaja
// aparte (`requested_by_name`). Los fixtures usan la forma real —ids con forma de UUID más el
// nombre—: el id sólo sirve para la comparación de cuatro ojos y nunca se renderiza.
const SOLICITANTE_ID = "7f3c1a2e-9b4d-4e6f-8a10-2c5d6e7f8a90";
const SOLICITANTE_NAME = "editor.tecnologia";
const OTRO_ID = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";
const OTRO_NAME = "editor.economicas";

type QueueProps = {
	list: (status?: PublicationQueueItem["status"]) => Promise<PublicationQueueItem[]>;
	decide: (requestId: string, approve: boolean, comments?: string) => Promise<DecisionResult>;
	ondecided?: (item: DecisionResult) => void;
	/** Quién está mirando la cola; su propia solicitud no es decidible por él. */
	currentUser?: string | null;
};

// La respuesta de `publication_request_decide`: la fila decidida, más el dataset resultante cuando la
// decisión fue una aprobación. Un rechazo no toca la visibilidad y por eso puede no traerlo.
type DecisionResult = PublicationQueueItem & { dataset?: CkanPackage };

function makeDataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: true,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

function makeItem(overrides: Partial<DecisionResult> = {}): DecisionResult {
	return {
		id: "req-1",
		dataset_title: "Matrícula 2026",
		organization_title: "Facultad de Tecnología",
		requested_by: SOLICITANTE_ID,
		requested_by_name: SOLICITANTE_NAME,
		created_at: "2026-10-01T00:00:00.000000",
		status: "pending",
		comments: null,
		...overrides,
	};
}

function makeUser(overrides: Partial<CkanUser> = {}): CkanUser {
	return {
		id: "user-1",
		name: "admin.tecnologia",
		display_name: "Administración de Tecnología",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

const ITEMS: PublicationQueueItem[] = [
	makeItem(),
	makeItem({
		id: "req-2",
		dataset_title: "Presupuesto 2026",
		organization_title: "Facultad de Ciencias Económicas",
		requested_by: OTRO_ID,
		requested_by_name: OTRO_NAME,
	}),
];

function renderQueue(overrides: Partial<QueueProps> = {}) {
	const list = vi.fn<QueueProps["list"]>().mockResolvedValue(ITEMS);
	const decide = vi.fn<QueueProps["decide"]>();
	const ondecided = vi.fn();

	const resultado = render(PublicationQueue, {
		props: { list, decide, ondecided, currentUser: null, ...overrides } satisfies QueueProps,
	});

	return { list, decide, ondecided, ...resultado };
}

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	auth.reset();
});

/** Devuelve la fila (el `li`) cuyo título de dataset es `titulo`. */
async function rowFor(titulo: string): Promise<HTMLElement> {
	await screen.findByText(titulo);
	const fila = screen.getByText(titulo).closest("li");
	if (!fila) throw new Error(`No se encontró la fila de «${titulo}»`);
	return fila;
}

describe("PublicationQueue — qué carga y qué muestra", () => {
	it("pide las solicitudes pendientes al montarse y las lista", async () => {
		const { list } = renderQueue();

		await waitFor(() => expect(screen.getByText("Matrícula 2026")).toBeInTheDocument());
		expect(list).toHaveBeenCalledWith("pending");
		expect(screen.getByText("Presupuesto 2026")).toBeInTheDocument();
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});

	it("mientras carga lo dice y no muestra la lista", () => {
		renderQueue({ list: vi.fn().mockReturnValue(new Promise(() => {})) });

		expect(screen.getByText(LOADING)).toBeInTheDocument();
		expect(screen.queryAllByRole("listitem")).toHaveLength(0);
	});

	it("sin solicitudes pendientes lo dice sin inventar filas", async () => {
		renderQueue({ list: vi.fn().mockResolvedValue([]) });

		await waitFor(() => expect(screen.getByText(EMPTY)).toBeInTheDocument());
		expect(screen.queryAllByRole("listitem")).toHaveLength(0);
	});

	it("un fallo al cargar: error explícito y reintento que vuelve a pedirlas", async () => {
		const list = vi
			.fn<QueueProps["list"]>()
			.mockRejectedValueOnce(new Error("502 Bad Gateway"))
			.mockResolvedValueOnce(ITEMS);
		renderQueue({ list });

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("502 Bad Gateway"));

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => expect(screen.getByText("Matrícula 2026")).toBeInTheDocument());
		expect(list).toHaveBeenCalledTimes(2);
	});

	it("cada fila dice de qué dataset y de quién es la solicitud", async () => {
		renderQueue();

		const fila = await rowFor("Matrícula 2026");
		// La fila muestra el nombre visible de quien solicitó, no el id con el que se compara.
		expect(within(fila).getByText(/editor\.tecnologia/)).toBeInTheDocument();
		expect(within(fila).queryByText(new RegExp(SOLICITANTE_ID))).toBeNull();
		expect(within(fila).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();
		expect(within(fila).getByRole("button", { name: REJECT_LABEL })).toBeInTheDocument();
		expect(within(fila).getByLabelText(COMMENT_LABEL)).toBeInTheDocument();
	});

	it("sin nombre de quien solicitó, la fila usa una etiqueta neutral y nunca el id", async () => {
		const list = vi
			.fn<QueueProps["list"]>()
			.mockResolvedValue([makeItem({ requested_by_name: undefined })]);
		renderQueue({ list });

		const fila = await rowFor("Matrícula 2026");
		expect(within(fila).getByText(new RegExp(REQUESTER_FALLBACK))).toBeInTheDocument();
		expect(within(fila).queryByText(new RegExp(SOLICITANTE_ID))).toBeNull();
	});
});

describe("PublicationQueue — cuatro ojos", () => {
	it("una solicitud creada por quien mira se muestra como no decidible, sin ofrecer decidirla", async () => {
		// La persona que mira es la misma que creó la solicitud `req-1`; `req-2` es de otra persona.
		renderQueue({ currentUser: SOLICITANTE_ID });

		const propia = await rowFor("Matrícula 2026");
		expect(within(propia).getByText(SELF_APPROVAL)).toBeInTheDocument();
		expect(within(propia).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
		expect(within(propia).queryByRole("button", { name: REJECT_LABEL })).toBeNull();
		expect(within(propia).queryByLabelText(COMMENT_LABEL)).toBeNull();

		// La solicitud de otra persona sigue siendo decidible: el bloqueo es por solicitud, no global.
		const ajena = await rowFor("Presupuesto 2026");
		expect(within(ajena).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();
	});

	it("sin `currentUser` inyectado, la sesión bloquea la propia por `id`", async () => {
		// Camino real del default: la sesión trae el usuario y la fila trae el mismo `id` de usuario.
		// El nombre de la sesión no coincide con el id de la fila a propósito: si la comparación
		// volviera al nombre, no habría bloqueo y la aserción fallaría.
		auth.login("tok", makeUser({ id: SOLICITANTE_ID, name: "otro.nombre" }));
		renderQueue({ currentUser: undefined });

		const propia = await rowFor("Matrícula 2026");
		expect(within(propia).getByText(SELF_APPROVAL)).toBeInTheDocument();
		expect(within(propia).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
		expect(within(propia).queryByRole("button", { name: REJECT_LABEL })).toBeNull();
		expect(within(propia).queryByLabelText(COMMENT_LABEL)).toBeNull();
	});

	it("un `name` de la sesión igual al id de la fila no bloquea si el `id` difiere", async () => {
		// Guarda contra revertir la comparación al nombre: el `name` de la sesión ES el id de la fila
		// `req-1`, pero su `id` es otro. La comparación por id no debe bloquear.
		auth.login("tok", makeUser({ id: OTRO_ID, name: SOLICITANTE_ID }));
		renderQueue({ currentUser: undefined });

		const fila = await rowFor("Matrícula 2026");
		expect(within(fila).queryByText(SELF_APPROVAL)).toBeNull();
		expect(within(fila).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();
		expect(within(fila).getByRole("button", { name: REJECT_LABEL })).toBeInTheDocument();
		expect(within(fila).getByLabelText(COMMENT_LABEL)).toBeInTheDocument();
	});
});

describe("PublicationQueue — rechazar exige un motivo", () => {
	it("rechazar sin comentario no envía la decisión y pide el motivo", async () => {
		const { decide, ondecided } = renderQueue();

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: REJECT_LABEL }));

		await waitFor(() => expect(within(fila).getByRole("alert")).toHaveTextContent(REASON_REQUIRED));
		expect(decide).not.toHaveBeenCalled();
		expect(ondecided).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
	});

	it("rechazar con el motivo escrito sí envía la decisión con ese comentario", async () => {
		const { decide } = renderQueue();
		// Un rechazo no toca la visibilidad: basta con su fila confirmada, sin `dataset`.
		const rechazada = makeItem({ status: "rejected" });
		decide.mockResolvedValue(rechazada);

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.input(within(fila).getByLabelText(COMMENT_LABEL), {
			target: { value: "Los datos aún no están consolidados." },
		});
		await fireEvent.click(within(fila).getByRole("button", { name: REJECT_LABEL }));

		await waitFor(() =>
			expect(decide).toHaveBeenCalledWith("req-1", false, "Los datos aún no están consolidados."),
		);
		expect(screen.getByText(REJECTED_NOTE)).toBeInTheDocument();
		expect(screen.queryByText("Matrícula 2026")).toBeNull();
	});
});

describe("PublicationQueue — qué reporta después de decidir", () => {
	it("aprobar: decide sin comentario y la fila sale de la cola", async () => {
		const { decide, ondecided } = renderQueue();
		// El catálogo devolvió el estado y el dataset ya público: la aprobación se concede.
		const aprobada = makeItem({ status: "approved", dataset: makeDataset({ private: false }) });
		decide.mockResolvedValue(aprobada);

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() => expect(ondecided).toHaveBeenCalledWith(aprobada));
		expect(decide).toHaveBeenCalledWith("req-1", true, undefined);
		expect(screen.getByText(APPROVED_NOTE)).toBeInTheDocument();
		expect(screen.queryByText("Matrícula 2026")).toBeNull();
		// La otra solicitud sigue en la cola: sólo salió la decidida.
		expect(screen.getByText("Presupuesto 2026")).toBeInTheDocument();
	});

	it("aprobar sin el dataset devuelto: el estado no alcanza y la fila no sale", async () => {
		const { decide, ondecided } = renderQueue();
		// El catálogo contestó `approved` pero no devolvió el dataset: sin el flip confirmado no hay
		// publicación concedida, así que la fila sigue pendiente.
		decide.mockResolvedValue(makeItem({ status: "approved" }));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(UNCONFIRMED_DECIDE),
		);
		expect(ondecided).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
	});

	it("aprobar con el dataset aún privado: la fila no sale aunque el estado diga aprobada", async () => {
		const { decide, ondecided } = renderQueue();
		// La fila dice `approved`, pero el dataset resultante sigue privado: la aprobación no se
		// concedió. Si la regla mirara sólo el estado de la fila, saldría de la cola.
		decide.mockResolvedValue(
			makeItem({ status: "approved", dataset: makeDataset({ private: true }) }),
		);

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(UNCONFIRMED_DECIDE),
		);
		expect(ondecided).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
	});

	it("403: rechazo honesto con la capacidad que falta y la fila sigue pendiente", async () => {
		const { decide, ondecided } = renderQueue();
		decide.mockRejectedValue(new CkanApiError(SERVER_403_DECIDE, 403, "Authorization Error"));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		// Anclado: la alerta debe ser exactamente la frase honesta, y el mensaje crudo no debe verse.
		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(new RegExp(`^${REFUSED_DECIDE}$`)),
		);
		expect(within(fila).getByRole("alert")).not.toHaveTextContent(SERVER_403_DECIDE);
		expect(ondecided).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
		expect(within(fila).getByRole("button", { name: APPROVE_LABEL })).toBeEnabled();
	});

	it("200 que no deja la solicitud decidida: dice que el catálogo no confirmó y la conserva", async () => {
		const { decide, ondecided } = renderQueue();
		// El catálogo contestó 200 pero la solicitud volvió pendiente: no concedió la decisión.
		decide.mockResolvedValue(makeItem({ status: "pending" }));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(UNCONFIRMED_DECIDE),
		);
		expect(ondecided).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
	});

	it("otro fallo: error explícito y la fila sigue ahí para reintentar", async () => {
		const { decide, ondecided } = renderQueue();
		const aprobada = makeItem({ status: "approved", dataset: makeDataset({ private: false }) });
		decide
			.mockRejectedValueOnce(new Error("503 Service Unavailable"))
			.mockResolvedValueOnce(aprobada);

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent("503 Service Unavailable"),
		);
		expect(decide).toHaveBeenCalledTimes(1);

		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() => expect(ondecided).toHaveBeenCalledWith(aprobada));
		expect(decide).toHaveBeenCalledTimes(2);
	});

	it("en vuelo: la fila reporta ocupado y no anuncia ninguna decisión", async () => {
		const { decide, ondecided } = renderQueue();
		decide.mockReturnValue(new Promise(() => {}));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		const enVuelo = within(fila).getByRole("button", { name: /aprobando/i });
		expect(enVuelo).toBeDisabled();
		expect(within(fila).getByRole("button", { name: REJECT_LABEL })).toBeDisabled();
		expect(within(fila).queryByRole("alert")).toBeNull();
		expect(ondecided).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
	});
});
