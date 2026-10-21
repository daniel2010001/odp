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
// El contrato de retorno es **uniforme**: `decide` devuelve sólo su fila `publication_requests`, sin
// `dataset`. Por eso la aprobación se confirma con una segunda llamada inyectada (`readDataset`),
// que relee el **valor almacenado**; el rechazo no toca la visibilidad y confirma con el estado que
// la propia fila devolvió. Las tres situaciones se mantienen separadas: *la acción falló*,
// *la acción concedió y la confirmación no se pudo establecer* —relectura que sigue privada o que
// falla— y *confirmada*.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage, CkanUser } from "$lib/types/ckan";
import PublicationQueue, { type PublicationQueueItem } from "./PublicationQueue.svelte";
import type { PublicationDecisionResult } from "./publication-decision";

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
// La confirmación que no se pudo establecer: cubre la relectura que sigue privada y la que falla.
const UNCONFIRMED_DECIDE = "El catálogo no confirmó la decisión.";
const ERROR_PREFIX = "No se pudo registrar la decisión";
const APPROVED_NOTE = "La solicitud fue aprobada.";
const REJECTED_NOTE = "La solicitud fue rechazada.";
// Etiqueta neutral cuando el catálogo no entrega un nombre visible: la fila nunca cae al id crudo.
// La misma regla sirve para quien solicitó y para quien decidió.
const REQUESTER_FALLBACK = "un usuario del catálogo";
// Nombre visible de quien decide una solicitud ya resuelta; no es quien la solicitó.
const DECISOR_NAME = "admin.tecnologia";
// Desenlaces sin decisor: la canceló quien la solicitó, y la anulada perdió su objeto.
const WITHDRAWN_NOTE = "Cancelada por quien la solicitó.";
const ANNULLED_NOTE = "Anulada: la solicitud dejó de estar vigente.";

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
	readDataset: (id: string) => Promise<CkanPackage>;
	/**
	 * Lo que la cola reporta al confirmar una decisión: la **fila del catálogo**
	 * (`PublicationDecisionResult`), no la vista de la lista. El parámetro es el que la prop declara, y por
	 * eso el manejador no puede pedir el tipo más angosto (`PublicationQueueItem`) que usa la lista.
	 */
	ondecided?: (item: PublicationDecisionResult) => void;
	/** Quién está mirando la cola; su propia solicitud no es decidible por él. */
	currentUser?: string | null;
	/** Reloj inyectable: fija la antigüedad que muestra cada fila. */
	now?: Date;
	/** Presentación: `true` agrupa en Pendientes y Resueltas; `false` (hoy) deja la lista plana. */
	secciones?: boolean;
	/** Presentación: `"primera"` abre sólo el primer pendiente ajeno; `"todas"` (hoy) abre todo. */
	expansion?: "todas" | "primera";
};

// La respuesta de `publication_request_decide`: **sólo** su fila `publication_requests`. No hay
// `dataset` en la forma; la confirmación de una aprobación sale de `readDataset`.
type DecisionResult = PublicationQueueItem;

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

function makeItem(overrides: Partial<PublicationQueueItem> = {}): PublicationQueueItem {
	return {
		id: "req-1",
		dataset_id: "pkg-1",
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
		dataset_id: "pkg-2",
		dataset_title: "Presupuesto 2026",
		organization_title: "Facultad de Ciencias Económicas",
		requested_by: OTRO_ID,
		requested_by_name: OTRO_NAME,
	}),
];

function renderQueue(overrides: Partial<QueueProps> = {}) {
	const list = vi.fn<QueueProps["list"]>().mockResolvedValue(ITEMS);
	const decide = vi.fn<QueueProps["decide"]>();
	const readDataset = vi.fn<QueueProps["readDataset"]>();
	const ondecided = vi.fn();

	const resultado = render(PublicationQueue, {
		props: {
			list,
			decide,
			readDataset,
			ondecided,
			currentUser: null,
			...overrides,
		} satisfies QueueProps,
	});

	return { list, decide, readDataset, ondecided, ...resultado };
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
	it("pide todas las solicitudes que el catálogo autoriza (sin filtrar por estado) y las lista", async () => {
		const { list } = renderQueue();

		await waitFor(() => expect(screen.getByText("Matrícula 2026")).toBeInTheDocument());
		expect(list).toHaveBeenCalledTimes(1);
		expect(list).toHaveBeenCalledWith();
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

	it("un fallo al cargar: la frase entendible encabeza, y el dato técnico la sigue", async () => {
		const list = vi
			.fn<QueueProps["list"]>()
			.mockRejectedValueOnce(new Error("502 Bad Gateway"))
			.mockResolvedValueOnce(ITEMS);
		renderQueue({ list });

		const alerta = await screen.findByRole("alert");
		// El foco es la frase; el texto crudo queda como **dato secundario**, no como el mensaje.
		expect(alerta).toHaveTextContent(/^No se pudieron cargar las solicitudes\./);
		expect(alerta).toHaveTextContent("502 Bad Gateway");

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => expect(screen.getByText("Matrícula 2026")).toBeInTheDocument());
		expect(list).toHaveBeenCalledTimes(2);
	});

	it("un fallo que lanza un valor falsy sigue siendo un fallo: la cola no se disfraza de vacía", async () => {
		// Un `throw ""` —o `0`, o `null`— es falsy: si el estado de fallo se guardara como el valor
		// lanzado, la cola caída caería a «no hay solicitudes», que es lo que este componente no hace.
		const list = vi.fn<QueueProps["list"]>().mockRejectedValueOnce("").mockResolvedValueOnce(ITEMS);
		renderQueue({ list });

		const alerta = await screen.findByRole("alert");
		expect(alerta).toHaveTextContent("No se pudieron cargar las solicitudes.");
		expect(screen.queryByText(EMPTY)).toBeNull();

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => expect(screen.getByText("Matrícula 2026")).toBeInTheDocument());
	});

	it("un fallo al cargar con respuesta del catálogo: el código, no la prosa del servidor", async () => {
		const list = vi
			.fn<QueueProps["list"]>()
			.mockRejectedValueOnce(new CkanApiError("Service Unavailable", 503));
		renderQueue({ list });

		const alerta = await screen.findByRole("alert");
		expect(alerta).toHaveTextContent(/^No se pudieron cargar las solicitudes\./);
		expect(alerta).toHaveTextContent("error 503");
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

describe("PublicationQueue — antigüedad de una solicitud", () => {
	// Reloj fijo: la hoja de revisión y estas pruebas fijan `now` para que la antigüedad no dependa
	// de cuándo se corran.
	const AHORA = new Date("2026-10-07T12:00:00");

	it("marca la antigüedad de una solicitud vieja y deja sin marca la reciente", async () => {
		const list = vi.fn<QueueProps["list"]>().mockResolvedValue([
			makeItem({
				id: "req-vieja",
				dataset_title: "Encuesta de satisfacción 2024",
				created_at: "2026-04-03T00:00:00.000000",
			}),
			makeItem({ id: "req-nueva", created_at: "2026-10-01T00:00:00.000000" }),
		]);
		renderQueue({ list, now: AHORA });

		const vieja = await rowFor("Encuesta de satisfacción 2024");
		// Mutación que lo rompe: si la fila no renderizara la edad, no habría texto que encontrar.
		const edadVieja = within(vieja).getByText("hace 6 meses");
		// Mutación que lo rompe: quitar el énfasis (o invertir el umbral) dejaría la clase fuera.
		expect(edadVieja).toHaveClass("text-destructive");
		expect(edadVieja).toHaveAttribute("data-stale", "true");

		const nueva = await rowFor("Matrícula 2026");
		const edadNueva = within(nueva).getByText("hace 6 días");
		// Mutación que lo rompe: marcar toda edad por igual pondría la clase en la fila reciente.
		expect(edadNueva).not.toHaveClass("text-destructive");
		expect(edadNueva).toHaveAttribute("data-stale", "false");
	});

	it("además de la edad, la fila sigue mostrando la fecha absoluta", async () => {
		const list = vi.fn<QueueProps["list"]>().mockResolvedValue([
			makeItem({
				id: "req-vieja",
				dataset_title: "Encuesta de satisfacción 2024",
				created_at: "2026-04-03T00:00:00.000000",
			}),
		]);
		renderQueue({ list, now: AHORA });

		const fila = await rowFor("Encuesta de satisfacción 2024");
		// Mutación que lo rompe: reemplazar la fecha absoluta por la relativa dejaría la primera fuera.
		expect(within(fila).getByText(/3 de abril de 2026/)).toBeInTheDocument();
		expect(within(fila).getByText("hace 6 meses")).toBeInTheDocument();
	});
});

describe("PublicationQueue — quién decidió la solicitud", () => {
	it("una solicitud aprobada muestra quién la aprobó, por nombre y nunca por id", async () => {
		const list = vi.fn<QueueProps["list"]>().mockResolvedValue([
			makeItem({
				id: "req-aprobada",
				dataset_title: "Matrícula 2026",
				status: "approved",
				approved_by_name: DECISOR_NAME,
			}),
		]);
		renderQueue({ list });

		const fila = await rowFor("Matrícula 2026");
		// Mutación que lo rompe: dejar de leer `approved_by_name` quita la frase y no hay texto que hallar.
		expect(within(fila).getByText(new RegExp(`Aprobada por ${DECISOR_NAME}`))).toBeInTheDocument();
		// Mutación que lo rompe: caer al id crudo cuando el nombre falta dejaría un UUID a la vista.
		expect(within(fila).queryByText(new RegExp(SOLICITANTE_ID))).toBeNull();
	});

	it("una solicitud rechazada muestra quién la rechazó", async () => {
		const list = vi.fn<QueueProps["list"]>().mockResolvedValue([
			makeItem({
				id: "req-rechazada",
				dataset_title: "Presupuesto 2026",
				status: "rejected",
				approved_by_name: DECISOR_NAME,
			}),
		]);
		renderQueue({ list });

		const fila = await rowFor("Presupuesto 2026");
		// Mutación que lo rompe: mapear el decisor sólo para `approved` dejaría el rechazo sin frase.
		expect(within(fila).getByText(new RegExp(`Rechazada por ${DECISOR_NAME}`))).toBeInTheDocument();
	});

	it("una fila decidida sin nombre usa la etiqueta neutral y nunca un id crudo", async () => {
		const list = vi.fn<QueueProps["list"]>().mockResolvedValue([
			makeItem({
				id: "req-sin-nombre",
				dataset_title: "Matrícula 2026",
				status: "approved",
				approved_by_name: undefined,
			}),
		]);
		renderQueue({ list });

		const fila = await rowFor("Matrícula 2026");
		// Mutación que lo rompe: sin la etiqueta neutral la frase del decisor no existiría.
		expect(within(fila).getByText(new RegExp(REQUESTER_FALLBACK))).toBeInTheDocument();
		// Mutación que lo rompe: caer al id de quien decidió cuando falta el nombre lo haría visible.
		expect(within(fila).queryByText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/)).toBeNull();
	});

	it("una solicitud cancelada y una anulada no se atribuyen un decisor", async () => {
		const list = vi.fn<QueueProps["list"]>().mockResolvedValue([
			makeItem({
				id: "req-cancelada",
				dataset_title: "Solicitud cancelada",
				status: "cancelled",
				approved_by_name: DECISOR_NAME,
			}),
			makeItem({
				id: "req-anulada",
				dataset_title: "Solicitud anulada",
				status: "annulled",
				approved_by_name: DECISOR_NAME,
			}),
		]);
		renderQueue({ list });

		for (const [titulo, esperado] of [
			["Solicitud cancelada", WITHDRAWN_NOTE],
			["Solicitud anulada", ANNULLED_NOTE],
		] as const) {
			const fila = await rowFor(titulo);
			// Mutación que lo rompe: sin el desenlace honesto la frase no existiría.
			expect(within(fila).getByText(esperado)).toBeInTheDocument();
			// Mutación que lo rompe: mostrar `approved_by_name` con sólo traerlo (sin mirar el estado)
			// pondría el nombre del decisor en un desenlace que no tuvo decisor.
			expect(within(fila).queryByText(new RegExp(DECISOR_NAME))).toBeNull();
			expect(within(fila).queryByText(/Aprobada por|Rechazada por/)).toBeNull();
		}
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
		auth.setUser(makeUser({ id: SOLICITANTE_ID, name: "otro.nombre" }));
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
		auth.setUser(makeUser({ id: OTRO_ID, name: SOLICITANTE_ID }));
		renderQueue({ currentUser: undefined });

		const fila = await rowFor("Matrícula 2026");
		expect(within(fila).queryByText(SELF_APPROVAL)).toBeNull();
		expect(within(fila).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();
		expect(within(fila).getByRole("button", { name: REJECT_LABEL })).toBeInTheDocument();
		expect(within(fila).getByLabelText(COMMENT_LABEL)).toBeInTheDocument();
	});
});

describe("PublicationQueue — la excepción de auto-aprobación (`c′`)", () => {
	// Quien mira es, en todos estos casos, **quien creó** la solicitud. La regla de cuatro ojos deja de
	// decidirse acá: el dueño es el catálogo, y la fila trae su respuesta —`decidable_by_caller`, el campo
	// congelado del store—, así que el portal la refleja en vez de deducir que «la propia no se decide».
	it("la propia **se** decide cuando el catálogo concede la excepción", async () => {
		renderQueue({
			currentUser: SOLICITANTE_ID,
			list: vi.fn().mockResolvedValue([makeItem({ decidable_by_caller: true })]),
		});

		const propia = await rowFor("Matrícula 2026");
		expect(within(propia).queryByText(SELF_APPROVAL)).toBeNull();
		expect(within(propia).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();
		expect(within(propia).getByRole("button", { name: REJECT_LABEL })).toBeInTheDocument();
		expect(within(propia).getByLabelText(COMMENT_LABEL)).toBeInTheDocument();
	});

	it("y la decisión sale: aprobar la propia llama a `decide` con su fila", async () => {
		// La guarda del control también lee la respuesta del catálogo: sin esto, la nota desaparecería del
		// dibujo pero la decisión seguiría sin enviarse.
		const decide = vi
			.fn()
			.mockResolvedValue(makeItem({ decidable_by_caller: true, status: "approved" }));
		const readDataset = vi.fn().mockResolvedValue(makeDataset({ private: false }));
		renderQueue({
			currentUser: SOLICITANTE_ID,
			list: vi.fn().mockResolvedValue([makeItem({ decidable_by_caller: true })]),
			decide,
			readDataset,
		});

		const propia = await rowFor("Matrícula 2026");
		await fireEvent.click(within(propia).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() => expect(decide).toHaveBeenCalledWith("req-1", true, undefined));
	});

	it("la propia sigue sin decidirse cuando el catálogo no la concede", async () => {
		// La rama negativa del campo: hay otra persona que puede aprobarla, así que cuatro ojos manda.
		renderQueue({
			currentUser: SOLICITANTE_ID,
			list: vi.fn().mockResolvedValue([makeItem({ decidable_by_caller: false })]),
		});

		const propia = await rowFor("Matrícula 2026");
		expect(within(propia).getByText(SELF_APPROVAL)).toBeInTheDocument();
		expect(within(propia).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
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

	it("rechazar con el motivo escrito envía la decisión con ese comentario", async () => {
		const { decide } = renderQueue();
		// Un rechazo no toca la visibilidad: basta con su fila confirmada, sin relectura.
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
	it("aprobar: confirma con la relectura del valor almacenado y la fila sale de la cola", async () => {
		const { decide, readDataset, ondecided } = renderQueue();
		// La acción devuelve sólo su fila `approved`; la confirmación viene de la relectura pública.
		const aprobada = makeItem({ status: "approved" });
		decide.mockResolvedValue(aprobada);
		readDataset.mockResolvedValue(makeDataset({ private: false }));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() => expect(ondecided).toHaveBeenCalledWith(aprobada));
		expect(decide).toHaveBeenCalledWith("req-1", true, undefined);
		// La relectura es la fuente: pidió el dataset de la solicitud aprobada.
		expect(readDataset).toHaveBeenCalledWith("pkg-1");
		expect(screen.getByText(APPROVED_NOTE)).toBeInTheDocument();
		expect(screen.queryByText("Matrícula 2026")).toBeNull();
		// La otra solicitud sigue en la cola: sólo salió la decidida.
		expect(screen.getByText("Presupuesto 2026")).toBeInTheDocument();
	});

	it("aprobar cuya relectura sigue privada: la fila no sale de la cola", async () => {
		const { decide, readDataset, ondecided } = renderQueue();
		// La fila dice `approved`, pero el valor almacenado sigue privado: la aprobación no se
		// concedió. Mutación que lo rompe: confiar en el estado de la fila la sacaría de la cola.
		decide.mockResolvedValue(makeItem({ status: "approved" }));
		readDataset.mockResolvedValue(makeDataset({ private: true }));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(UNCONFIRMED_DECIDE),
		);
		// La confirmación sí se intentó: la relectura del valor almacenado se pidió.
		expect(readDataset).toHaveBeenCalledWith("pkg-1");
		expect(ondecided).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
		expect(within(fila).getByRole("button", { name: APPROVE_LABEL })).toBeEnabled();
	});

	it("aprobar cuya relectura falla: estado intermedio, no un fallo de la acción", async () => {
		const { decide, readDataset, ondecided } = renderQueue();
		decide.mockResolvedValue(makeItem({ status: "approved" }));
		readDataset.mockRejectedValue(new Error("502 Bad Gateway"));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(UNCONFIRMED_DECIDE),
		);
		// La acción resolvió: su error genérico no aparece, y la fila sigue en la cola.
		expect(readDataset).toHaveBeenCalledWith("pkg-1");
		expect(within(fila).getByRole("alert")).not.toHaveTextContent(ERROR_PREFIX);
		expect(ondecided).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
	});

	it("rechazar: confirma con el estado devuelto y no relee el dataset", async () => {
		const { decide, readDataset, ondecided } = renderQueue();
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
		// Un rechazo no toca la visibilidad: no hay nada que releer.
		expect(readDataset).not.toHaveBeenCalled();
	});

	it("rechazar con 200 que no deja la solicitud rechazada: no confirma y la conserva", async () => {
		const { decide, readDataset, ondecided } = renderQueue();
		// El catálogo contestó 200 pero la solicitud volvió pendiente: no concedió la decisión.
		decide.mockResolvedValue(makeItem({ status: "pending" }));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.input(within(fila).getByLabelText(COMMENT_LABEL), {
			target: { value: "Los datos aún no están consolidados." },
		});
		await fireEvent.click(within(fila).getByRole("button", { name: REJECT_LABEL }));

		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(UNCONFIRMED_DECIDE),
		);
		expect(ondecided).not.toHaveBeenCalled();
		expect(readDataset).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
	});

	it("403: rechazo honesto con la capacidad que falta y la fila sigue pendiente", async () => {
		const { decide, readDataset, ondecided } = renderQueue();
		decide.mockRejectedValue(new CkanApiError(SERVER_403_DECIDE, 403, "Authorization Error"));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		// Anclado: la alerta debe ser exactamente la frase honesta, y el mensaje crudo no debe verse.
		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(new RegExp(`^${REFUSED_DECIDE}$`)),
		);
		expect(within(fila).getByRole("alert")).not.toHaveTextContent(SERVER_403_DECIDE);
		expect(ondecided).not.toHaveBeenCalled();
		// La decisión no se registró: no hay nada que releer.
		expect(readDataset).not.toHaveBeenCalled();
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
		expect(within(fila).getByRole("button", { name: APPROVE_LABEL })).toBeEnabled();
	});

	it("otro fallo: error explícito y la fila sigue ahí para reintentar", async () => {
		const { decide, readDataset, ondecided } = renderQueue();
		decide.mockRejectedValueOnce(new CkanApiError("Service Unavailable", 503));
		const aprobada = makeItem({ status: "approved" });
		decide.mockResolvedValueOnce(aprobada);
		readDataset.mockResolvedValue(makeDataset({ private: false }));

		const fila = await rowFor("Matrícula 2026");
		await fireEvent.click(within(fila).getByRole("button", { name: APPROVE_LABEL }));

		await waitFor(() =>
			expect(within(fila).getByRole("alert")).toHaveTextContent(
				/^No se pudo registrar la decisión\./,
			),
		);
		// Y el dato técnico detrás, que es lo que el usuario cita cuando consulta con soporte.
		expect(within(fila).getByRole("alert")).toHaveTextContent("error 503");
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

	it("empezar una decisión limpia el anuncio anterior", async () => {
		// El anuncio afirma un desenlace. Si una segunda decisión arranca, la cola **no** puede seguir
		// afirmando el de la anterior mientras la nueva está en vuelo: es la conducta que la extracción del
		// cuerpo de decidir perdió en silencio y que la revisión nativa del PR #67 encontró (`R3-1`). Sin
		// esta prueba, el cableado se puede volver a romper sin que nadie se entere.
		const { decide, readDataset } = renderQueue();
		decide.mockResolvedValueOnce(makeItem({ status: "approved" }));
		readDataset.mockResolvedValue(makeDataset({ private: false }));

		const primera = await rowFor("Matrícula 2026");
		await fireEvent.click(within(primera).getByRole("button", { name: APPROVE_LABEL }));
		expect(await screen.findByRole("status")).toHaveTextContent(APPROVED_NOTE);

		// La segunda queda en vuelo: la promesa no se resuelve nunca.
		decide.mockReturnValue(new Promise(() => {}));
		const segunda = await rowFor("Presupuesto 2026");
		await fireEvent.click(within(segunda).getByRole("button", { name: APPROVE_LABEL }));

		expect(within(segunda).getByRole("button", { name: /aprobando/i })).toBeDisabled();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("una fila a la vez: mientras una decide, las otras no ofrecen la suya", async () => {
		const { decide } = renderQueue();
		// La decisión queda **en vuelo**: la promesa no se resuelve nunca.
		decide.mockReturnValue(new Promise(() => {}));

		const primera = await rowFor("Matrícula 2026");
		const segunda = await rowFor("Presupuesto 2026");

		await fireEvent.click(within(primera).getByRole("button", { name: APPROVE_LABEL }));

		// La que decidió reporta que está ocupada…
		expect(within(primera).getByRole("button", { name: /aprobando/i })).toBeDisabled();
		// …y la otra tampoco acepta una segunda decisión en paralelo: es el candado de la cola, que
		// desde el 2026-10-14 vive en el cableado del componente de decidir (`disabled`), no dentro de él.
		expect(within(segunda).getByRole("button", { name: APPROVE_LABEL })).toBeDisabled();
		expect(within(segunda).getByRole("button", { name: REJECT_LABEL })).toBeDisabled();
		expect(decide).toHaveBeenCalledTimes(1);
	});
});

// La presentación de la cola: las secciones y el plegado. Nada de esto cambia **qué** se decide ni
// **quién** puede decidirlo; cambia cuánto detalle se ve de entrada. El disparador del plegado lleva
// el título del dataset en su nombre accesible, así que dos filas nunca comparten nombre y estas
// aserciones no dependen de una posición en la lista.
describe("PublicationQueue — la presentación: secciones y plegado", () => {
	// El disparador tiene **un solo** nombre accesible, estable: el estado lo dice `aria-expanded`. Por
	// eso estas aserciones buscan el mismo nombre antes y después de plegar, y leen el estado del
	// atributo — no de un texto que cambia.
	const detalles = (titulo: string) => `Detalles de ${titulo}`;

	it('con `expansion="primera"` abre sólo el primer pendiente ajeno y pliega el resto, que sigue siendo legible', async () => {
		renderQueue({ expansion: "primera" });

		const abierta = await rowFor("Matrícula 2026");
		const plegada = await rowFor("Presupuesto 2026");

		// La primera —la que quien mira puede decidir— conserva la vista de decidir.
		expect(within(abierta).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();

		// La segunda queda plegada: sin botones de decisión, con su disparador a la vista.
		expect(within(plegada).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
		expect(within(plegada).queryByRole("button", { name: REJECT_LABEL })).toBeNull();
		expect(
			within(plegada).getByRole("button", { name: detalles("Presupuesto 2026") }),
		).toHaveAttribute("aria-expanded", "false");

		// Plegada no es vacía: el dataset, la organización y quién la pidió siguen a la vista.
		expect(within(plegada).getByText("Facultad de Ciencias Económicas")).toBeInTheDocument();
		expect(within(plegada).getByText(/^Solicitada por editor\.economicas/)).toBeInTheDocument();
	});

	it("desplegar una fila plegada muestra la vista de decidir, y volver a activar la pliega", async () => {
		renderQueue({ expansion: "primera" });

		const fila = await rowFor("Presupuesto 2026");
		const disparador = within(fila).getByRole("button", { name: detalles("Presupuesto 2026") });
		await fireEvent.click(disparador);

		expect(within(fila).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();
		// El nombre **no cambió**: es el mismo control, y el estado lo dice el atributo.
		expect(disparador).toHaveAttribute("aria-expanded", "true");

		await fireEvent.click(disparador);

		expect(within(fila).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
		expect(disparador).toHaveAttribute("aria-expanded", "false");
	});

	it("cuatro ojos: nunca abre la solicitud propia, abre la primera que quien mira puede decidir", async () => {
		renderQueue({ expansion: "primera", currentUser: SOLICITANTE_ID });

		const propia = await rowFor("Matrícula 2026");
		const ajena = await rowFor("Presupuesto 2026");

		// La propia (req-1, de quien mira) queda plegada; la ajena es la que arranca abierta.
		expect(
			within(propia).getByRole("button", { name: detalles("Matrícula 2026") }),
		).toHaveAttribute("aria-expanded", "false");
		expect(within(propia).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
		expect(within(ajena).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();

		// Y al desplegarla muestra la nota de cuatro ojos, sin ofrecer ninguna decisión.
		await fireEvent.click(within(propia).getByRole("button", { name: detalles("Matrícula 2026") }));
		expect(within(propia).getByText(SELF_APPROVAL)).toBeInTheDocument();
		expect(within(propia).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
		expect(within(propia).queryByRole("button", { name: REJECT_LABEL })).toBeNull();
	});

	it('con `expansion="primera"`, la propia que el catálogo concede arranca abierta', async () => {
		// La regla del plegado es «la primera que quien mira **puede** decidir»: con la excepción concedida,
		// su propia solicitud es una de ellas y no hay motivo para dejar el control detrás del disparador.
		renderQueue({
			expansion: "primera",
			currentUser: SOLICITANTE_ID,
			list: vi.fn().mockResolvedValue([makeItem({ decidable_by_caller: true })]),
		});

		const propia = await rowFor("Matrícula 2026");
		expect(within(propia).getByRole("button", { name: APPROVE_LABEL })).toBeInTheDocument();
	});

	it("con todas las solicitudes propias no abre ninguna: no hay nada que decidir", async () => {
		renderQueue({
			expansion: "primera",
			currentUser: SOLICITANTE_ID,
			list: vi.fn().mockResolvedValue([makeItem()]),
		});

		const fila = await rowFor("Matrícula 2026");
		expect(within(fila).getByRole("button", { name: detalles("Matrícula 2026") })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		expect(within(fila).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
	});

	it("`secciones` agrupa en Pendientes y después Resueltas, cada grupo con su conteo", async () => {
		renderQueue({
			secciones: true,
			list: vi.fn().mockResolvedValue([
				...ITEMS,
				makeItem({
					id: "req-9",
					dataset_id: "pkg-9",
					dataset_title: "Egresados 2025",
					status: "approved",
					approved_by_name: DECISOR_NAME,
				}),
			]),
		});

		const pendientes = await screen.findByRole("heading", { name: "Pendientes 2" });
		const resueltas = screen.getByRole("heading", { name: "Resueltas 1" });

		// El orden es el pedido: primero lo que falta decidir, después lo ya resuelto.
		expect(
			pendientes.compareDocumentPosition(resueltas) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();

		// Y la **pertenencia**, que el orden solo no prueba: cada fila está dentro del grupo que le
		// toca, no simplemente antes o después del otro título.
		const grupoPendientes = pendientes.closest("section");
		const grupoResueltas = resueltas.closest("section");
		expect(grupoPendientes).not.toBeNull();
		expect(grupoResueltas).not.toBeNull();
		expect(within(grupoPendientes as HTMLElement).getByText("Matrícula 2026")).toBeInTheDocument();
		expect(
			within(grupoPendientes as HTMLElement).getByText("Presupuesto 2026"),
		).toBeInTheDocument();
		expect(within(grupoResueltas as HTMLElement).getByText("Egresados 2025")).toBeInTheDocument();
		expect(within(grupoResueltas as HTMLElement).queryByText("Matrícula 2026")).toBeNull();
	});

	it("`secciones`: las resueltas llegan del catálogo (no sólo las decididas en la visita), la más nueva primero", async () => {
		const resuelta = (
			n: number,
			decided_at: string | undefined,
			created_at = "2026-09-01T00:00:00.000000",
		) =>
			makeItem({
				id: `res-${n}`,
				dataset_id: `pkg-res-${n}`,
				dataset_title: `Resuelta ${n}`,
				status: n % 2 ? "approved" : "rejected",
				approved_by_name: DECISOR_NAME,
				created_at,
				decided_at,
			});
		renderQueue({
			secciones: true,
			list: vi.fn().mockResolvedValue([
				resuelta(1, "2026-10-02T00:00:00.000000"),
				resuelta(2, "2026-10-05T00:00:00.000000"),
				// Sin `decided_at` (cancelaciones anteriores a la 0002): se ordena por la fecha de creación.
				resuelta(3, undefined, "2026-10-03T12:00:00.000000"),
				makeItem(),
			]),
		});

		const grupo = (await screen.findByRole("heading", { name: "Resueltas 3" })).closest("section");
		const titulos = within(grupo as HTMLElement)
			.getAllByRole("listitem")
			.map((li) => li.textContent?.match(/Resuelta \d/)?.[0]);
		expect(titulos).toEqual(["Resuelta 2", "Resuelta 3", "Resuelta 1"]);
		// «Pendientes» sigue primero.
		expect(
			screen
				.getByRole("heading", { name: "Pendientes 1" })
				.compareDocumentPosition(screen.getByRole("heading", { name: "Resueltas 3" })) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("`secciones` acota las resueltas a las 5 más nuevas y «Ver N más» muestra el resto", async () => {
		const todas = Array.from({ length: 8 }, (_, i) =>
			makeItem({
				id: `res-${i}`,
				dataset_id: `pkg-res-${i}`,
				dataset_title: `Resuelta ${i}`,
				status: "approved",
				approved_by_name: DECISOR_NAME,
				decided_at: `2026-10-0${i + 1}T00:00:00.000000`,
			}),
		);
		renderQueue({ secciones: true, list: vi.fn().mockResolvedValue(todas) });

		const grupo = (await screen.findByRole("heading", { name: "Resueltas 8" })).closest(
			"section",
		) as HTMLElement;
		expect(within(grupo).getAllByRole("listitem")).toHaveLength(5);
		expect(within(grupo).getByText("Resuelta 7")).toBeInTheDocument();
		expect(within(grupo).queryByText("Resuelta 2")).toBeNull();

		const mas = within(grupo).getByRole("button", { name: "Ver 3 más" });
		expect(mas).toHaveAttribute("aria-expanded", "false");
		await fireEvent.click(mas);
		expect(within(grupo).getAllByRole("listitem")).toHaveLength(8);
		const menos = within(grupo).getByRole("button", { name: "Ver menos" });
		expect(menos).toHaveAttribute("aria-expanded", "true");
	});

	it("`secciones` con 5 resueltas o menos no ofrece «Ver más»", async () => {
		renderQueue({
			secciones: true,
			list: vi
				.fn()
				.mockResolvedValue([
					makeItem({ id: "req-9", status: "approved", approved_by_name: DECISOR_NAME }),
				]),
		});
		await rowFor("Matrícula 2026");
		expect(screen.queryByRole("button", { name: /Ver .* más|Ver menos/ })).toBeNull();
	});

	it("`secciones` no titula un grupo vacío", async () => {
		renderQueue({
			secciones: true,
			list: vi
				.fn()
				.mockResolvedValue([
					makeItem({ id: "req-9", status: "approved", approved_by_name: DECISOR_NAME }),
				]),
		});

		await rowFor("Matrícula 2026");
		expect(screen.queryByRole("heading", { name: /^Pendientes/ })).toBeNull();
		expect(screen.getByRole("heading", { name: "Resueltas 1" })).toBeInTheDocument();
	});
});

// El enlace al dataset: la cola es la **única** superficie por la que un administrador que no es el
// solicitante puede llegar al dataset. El dataset está privado —no aparece en el catálogo—, así que
// sin este enlace revisar antes de decidir exige escribir la URL a mano.
describe("PublicationQueue — el enlace al dataset", () => {
	it("el título enlaza al dataset en una pestaña nueva", async () => {
		renderQueue();

		const row = await rowFor("Matrícula 2026");
		const link = within(row).getByRole("link", { name: /Matrícula 2026/ });

		// El nombre accesible **conserva el título visible** y además anuncia la pestaña nueva: la aserción
		// es sobre el nombre completo, no un `match` que pasaría igual sin el aviso `sr-only`.
		expect(link).toHaveAccessibleName("Matrícula 2026 (se abre en una pestaña nueva)");

		// El `href` codifica el id del dataset: es el destino que el revisor no tiene de otra forma.
		expect(link).toHaveAttribute("href", "/dataset/pkg-1");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));

		// El id nunca se renderiza como texto visible: la fila muestra el título.
		expect(within(row).queryByText(/pkg-1/)).toBeNull();
	});

	it("el enlace no anida dentro del disparador: el botón conserva su nombre y su estado", async () => {
		renderQueue({ expansion: "primera" });

		const row = await rowFor("Matrícula 2026");
		const link = within(row).getByRole("link", { name: /Matrícula 2026/ });

		// Un interactivo dentro de otro es inválido: el enlace vive en el encabezado, no en el botón.
		expect(link.closest("button")).toBeNull();
		expect(within(row).getByRole("button", { name: "Detalles de Matrícula 2026" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});
});
