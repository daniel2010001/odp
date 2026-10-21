// Pruebas de la page de solicitudes: la cola en su propia ruta, con las llamadas **reales** de la capa de API.
//
// Lo que se prueba es lo que la page decide y el componente no puede: que sin sesión no se muestre nada y se
// navegue al login; que las **pestañas de organización** aparezcan sólo cuando hay más de una —un filtro que no
// filtra es ruido—; que filtrar **filtre de verdad** y sin otra llamada; que la cola monte sobre la tarjeta de la
// page (la barra pegada toma su fondo); y que una fila cuyo título no se pudo resolver se lea con la frase del
// portal y **no** con la línea principal vacía.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import type { PublicationRequest } from "$lib/api/publication";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import RequestsPage from "./+page.svelte";

const mocks = vi.hoisted(() => ({
	createPortalClient: vi.fn<() => object>(),
	listRequests: vi.fn(),
	decideRequest: vi.fn(),
	showDataset: vi.fn(),
	check: vi.fn(),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "http://localhost:5000" } }));
vi.mock("$lib/api/client", () => ({ createPortalClient: mocks.createPortalClient }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/api/publication", () => ({
	createPublicationApi: () => ({
		list: mocks.listRequests,
		decide: mocks.decideRequest,
	}),
}));
vi.mock("$lib/api/session", () => ({ createSessionApi: () => ({ check: mocks.check }) }));

const SIN_TITULO = "Dataset no disponible";

// La barra pegada de la cola mide su alto con `ResizeObserver`, que jsdom no trae.
beforeAll(() => {
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});

function makeUser(): CkanUser {
	return {
		id: "user-admin",
		name: "admin.tecnologia",
		display_name: "Administración de Tecnología",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		sysadmin: false,
	};
}

/** Una fila con la forma del contrato, con los dos títulos que el catálogo ahora devuelve. */
function makeRow(overrides: Partial<PublicationRequest> = {}): PublicationRequest {
	return {
		id: "req-1",
		dataset_id: "pkg-1",
		dataset_title: "Matrícula 2026",
		organization_title: "Facultad de Tecnología",
		requested_visibility: "public",
		status: "pending",
		requested_by: "user-editor",
		requested_by_name: "editor.tecnologia",
		approved_by: null,
		approved_by_name: null,
		comments: null,
		motive: null,
		created_at: "2026-10-01T00:00:00.000000",
		decided_at: null,
		consumed_at: null,
		...overrides,
	};
}

function renderPage() {
	return render(RequestsPage);
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
	mocks.createPortalClient.mockReturnValue({});
	mocks.check.mockResolvedValue({ state: "alive", user: makeUser() });
	mocks.listRequests.mockResolvedValue([makeRow()]);
	mocks.showDataset.mockResolvedValue({ id: "pkg-1", private: true, resources: [] });
});

describe("Solicitudes — la compuerta de sesión", () => {
	it("sin sesión no muestra la cola y navega al login", async () => {
		renderPage();

		await waitFor(() => expect(vi.mocked(goto)).toHaveBeenCalledTimes(1));
		expect(vi.mocked(goto).mock.calls[0][0]).toBe("/auth/login");
		expect(mocks.listRequests).not.toHaveBeenCalled();
	});

	it("con la sesión viva muestra la cola y **no** navega a ningún lado", async () => {
		auth.setUser(makeUser());

		renderPage();

		expect(
			await screen.findByRole("heading", { level: 1, name: "Solicitudes de publicación" }),
		).toBeInTheDocument();
		expect(vi.mocked(goto)).not.toHaveBeenCalled();
		expect((await screen.findAllByText("Matrícula 2026")).length).toBeGreaterThan(0);
	});
});

const mostrar = () => screen.getByRole("combobox", { name: /Mostrar/ }) as HTMLSelectElement;
const tablist = () => screen.queryByRole("tablist", { name: "Organización" });
const titulos = () =>
	[...document.querySelectorAll("[data-request-id]")].map((li) =>
		li.getAttribute("data-request-id"),
	);

describe("Solicitudes — pendientes y resueltas", () => {
	it("pide todas las filas en **una** llamada sin estado; muestra las pendientes y «Mostrar» da las resueltas, la más nueva primero", async () => {
		auth.setUser(makeUser());
		mocks.listRequests.mockResolvedValue([
			makeRow({
				id: "req-old",
				dataset_title: "Viejo aprobado",
				status: "approved",
				approved_by_name: "admin.tecnologia",
				decided_at: "2026-10-02T00:00:00.000000",
			}),
			makeRow({ id: "req-1", dataset_title: "Matrícula 2026" }),
			makeRow({
				id: "req-new",
				dataset_title: "Nuevo rechazado",
				status: "rejected",
				approved_by_name: "admin.tecnologia",
				decided_at: "2026-10-09T00:00:00.000000",
			}),
		]);

		renderPage();

		await screen.findAllByText("Matrícula 2026");
		expect(mocks.listRequests).toHaveBeenCalledTimes(1);
		expect(mocks.listRequests).toHaveBeenCalledWith();
		expect(titulos()).toEqual(["req-1"]);
		expect(within(mostrar()).getByRole("option", { name: "Pendientes (1)" })).toBeInTheDocument();
		expect(within(mostrar()).getByRole("option", { name: "Resueltas (2)" })).toBeInTheDocument();

		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		expect(titulos()).toEqual(["req-new", "req-old"]);
	});

	it("las pendientes llegan de la más antigua a la más nueva, aunque el catálogo las devuelva al revés", async () => {
		auth.setUser(makeUser());
		mocks.listRequests.mockResolvedValue([
			makeRow({ id: "nueva", dataset_title: "Nueva", created_at: "2026-10-09T00:00:00.000000" }),
			makeRow({ id: "vieja", dataset_title: "Vieja", created_at: "2026-09-01T00:00:00.000000" }),
			makeRow({ id: "media", dataset_title: "Media", created_at: "2026-10-01T00:00:00.000000" }),
		]);

		renderPage();

		await screen.findAllByText("Vieja");
		expect(titulos()).toEqual(["vieja", "media", "nueva"]);
	});

	it("la cola vive en la tarjeta de la page: la barra pegada toma el fondo de la tarjeta", async () => {
		auth.setUser(makeUser());
		mocks.listRequests.mockResolvedValue([
			makeRow({ id: "a", dataset_title: "Pend Tec" }),
			makeRow({
				id: "c",
				dataset_title: "Pend Eco",
				organization_title: "Facultad de Ciencias Económicas",
			}),
		]);

		renderPage();

		const barra = await screen.findByTestId("barra-pestanas");
		expect(barra.className.split(/\s+/)).toContain("bg-card");
		expect(barra.className.split(/\s+/)).not.toContain("bg-background");
	});

	it("decidir deja la fila en la lista como resuelta, con quien la decidió, y no vuelve a pedir el listado", async () => {
		auth.setUser(makeUser());
		mocks.showDataset.mockResolvedValue({ id: "pkg-1", private: false, resources: [] });
		mocks.decideRequest.mockResolvedValue(
			makeRow({
				status: "rejected",
				approved_by_name: "admin.tecnologia",
				decided_at: "2026-10-20T10:00:00.000000",
				comments: "Falta",
			}),
		);

		renderPage();

		await fireEvent.input(await screen.findByLabelText("Comentario (obligatorio para rechazar)"), {
			target: { value: "Falta" },
		});
		await fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));

		expect(await screen.findByRole("status")).toHaveTextContent("La solicitud fue rechazada.");
		expect(mocks.decideRequest).toHaveBeenCalledWith("req-1", false, "Falta");
		expect(mocks.listRequests).toHaveBeenCalledTimes(1);
		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		expect(screen.getByTestId("status-line")).toHaveTextContent(
			"Rechazada por admin.tecnologia el 20 de octubre de 2026",
		);
	});
});

describe("Solicitudes — las pestañas de organización", () => {
	it("con **una sola** organización no dibuja las pestañas: no hay nada que filtrar", async () => {
		auth.setUser(makeUser());
		mocks.listRequests.mockResolvedValue([makeRow()]);

		renderPage();

		await screen.findAllByText("Matrícula 2026");
		expect(tablist()).toBeNull();
		expect(
			screen.queryByRole("group", { name: "Filtrar por organización" }),
		).not.toBeInTheDocument();
	});

	it("con dos organizaciones dibuja las pestañas, y filtrar filtra de verdad sin otra llamada", async () => {
		auth.setUser(makeUser());
		mocks.listRequests.mockResolvedValue([
			makeRow({ id: "req-1", dataset_title: "Matrícula 2026" }),
			makeRow({
				id: "req-2",
				dataset_title: "Presupuesto 2026",
				organization_title: "Facultad de Ciencias Económicas",
				requested_by: "user-otro",
				requested_by_name: "editor.economicas",
			}),
		]);

		renderPage();

		await screen.findAllByText("Matrícula 2026");
		expect(screen.getAllByText("Presupuesto 2026").length).toBeGreaterThan(0);
		const tab = within(tablist() as HTMLElement).getByRole("tab", {
			name: /Facultad de Tecnología/,
		});
		await fireEvent.mouseDown(tab);
		await fireEvent.click(tab);

		await waitFor(() => expect(screen.queryByText("Presupuesto 2026")).not.toBeInTheDocument());
		expect(screen.getAllByText("Matrícula 2026").length).toBeGreaterThan(0);
		// El filtro es de las filas ya cargadas: no dispara otra llamada al catálogo.
		expect(mocks.listRequests).toHaveBeenCalledTimes(1);
	});
});

describe("Solicitudes — lo que la page le entrega a la cola", () => {
	it("una fila sin título resoluble se lee con la frase del portal, nunca con la línea vacía", async () => {
		auth.setUser(makeUser());
		// El contrato tiene dos formas de vacío: `null` (el campo está vacío) y el token `"unknown"` (el id
		// está seteado y no resuelve). Las dos tienen que leerse igual, y ninguna puede mostrar el id.
		mocks.listRequests.mockResolvedValue([
			makeRow({ dataset_title: null }),
			makeRow({ id: "req-2", dataset_title: "unknown", organization_title: null }),
		]);

		renderPage();

		// Una por fila: el título es el botón de la cabecera (la abierta repite el nombre en su «Cerrar»).
		expect(
			await screen.findAllByRole("button", { name: new RegExp(`^${SIN_TITULO}`) }),
		).toHaveLength(2);
		expect(screen.queryByText("pkg-1")).not.toBeInTheDocument();
		expect(screen.queryByText("unknown")).not.toBeInTheDocument();
	});

	it("la respuesta del catálogo llega a la cola: la propia que el catálogo concede se puede decidir", async () => {
		// La excepción de cuatro ojos (#74) la decide el catálogo en `decidable_by_caller`. Si la page la pierde al
		// traducir la fila, la cola aplica la regla vieja y el único aprobador posible no puede decidir — en la
		// ficha del dataset sí podía, porque ahí la fila no pasa por esta traducción.
		auth.setUser(makeUser());
		mocks.listRequests.mockResolvedValue([
			makeRow({ requested_by: "user-admin", decidable_by_caller: true }),
		]);

		renderPage();

		expect(await screen.findByRole("button", { name: "Aprobar" })).toBeInTheDocument();
		expect(screen.queryByText("No puede aprobar su propia solicitud.")).not.toBeInTheDocument();
	});

	it("y la que el catálogo no concede sigue sin decidirse (la cola la deja plegada)", async () => {
		auth.setUser(makeUser());
		mocks.listRequests.mockResolvedValue([
			makeRow({ requested_by: "user-admin", decidable_by_caller: false }),
		]);

		renderPage();

		expect((await screen.findAllByText("Matrícula 2026")).length).toBeGreaterThan(0);
		expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
	});
});
