// Pruebas de la page de solicitudes: la cola en su propia ruta, con las llamadas **reales** de la capa de API.
//
// Lo que se prueba es lo que la page decide y el componente no puede: que sin sesión no se muestre nada y se
// navegue al login; que el **filtro por organización** aparezca sólo cuando hay más de una —un filtro que no
// filtra es ruido—; que filtrar **filtre de verdad**; y que una fila cuyo título no se pudo resolver se lea
// con la frase del portal y **no** con la línea principal vacía.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import type { PublicationRequest } from "$lib/api/publication";
import { auth } from "$lib/stores/auth";
import type { ApiClientConfig } from "$lib/types/api";
import type { CkanUser } from "$lib/types/ckan";
import RequestsPage from "./+page.svelte";

const mocks = vi.hoisted(() => ({
	createCkanClient: vi.fn<(config: ApiClientConfig) => object>(),
	listRequests: vi.fn(),
	decideRequest: vi.fn(),
	showDataset: vi.fn(),
	check: vi.fn(),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "http://localhost:5000" } }));
vi.mock("$lib/api/client", () => ({ createCkanClient: mocks.createCkanClient }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/api/publication", () => ({
	createPublicationApi: () => ({
		list: mocks.listRequests,
		decide: mocks.decideRequest,
	}),
}));
vi.mock("$lib/api/session", () => ({ createSessionApi: () => ({ check: mocks.check }) }));

const SIN_TITULO = "Dataset no disponible";

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
	mocks.createCkanClient.mockReturnValue({});
	mocks.check.mockResolvedValue({ state: "alive", user: makeUser() });
	mocks.listRequests.mockResolvedValue([makeRow()]);
});

describe("Solicitudes — la compuerta de sesión", () => {
	it("sin sesión no muestra la cola y navega al login", async () => {
		renderPage();

		await waitFor(() => expect(vi.mocked(goto)).toHaveBeenCalledTimes(1));
		expect(vi.mocked(goto).mock.calls[0][0]).toBe("/auth/login");
		expect(mocks.listRequests).not.toHaveBeenCalled();
	});

	it("con la sesión viva muestra la cola y **no** navega a ningún lado", async () => {
		auth.login("tok-123", makeUser());

		renderPage();

		expect(
			await screen.findByRole("heading", { level: 1, name: "Solicitudes de publicación" }),
		).toBeInTheDocument();
		expect(vi.mocked(goto)).not.toHaveBeenCalled();
		expect(await screen.findByText("Matrícula 2026")).toBeInTheDocument();
	});
});

describe("Solicitudes — el filtro por organización", () => {
	it("con **una sola** organización no dibuja el selector: no hay nada que filtrar", async () => {
		auth.login("tok-123", makeUser());
		mocks.listRequests.mockResolvedValue([makeRow()]);

		renderPage();

		await screen.findByText("Matrícula 2026");
		expect(
			screen.queryByRole("group", { name: "Filtrar por organización" }),
		).not.toBeInTheDocument();
	});

	it("con dos organizaciones dibuja el selector, y filtrar filtra de verdad", async () => {
		auth.login("tok-123", makeUser());
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

		await screen.findByText("Matrícula 2026");
		const filtro = await screen.findByRole("group", { name: "Filtrar por organización" });
		expect(screen.getByText("Presupuesto 2026")).toBeInTheDocument();

		await fireEvent.click(within(filtro).getByRole("button", { name: "Facultad de Tecnología" }));

		await waitFor(() => expect(screen.queryByText("Presupuesto 2026")).not.toBeInTheDocument());
		expect(screen.getByText("Matrícula 2026")).toBeInTheDocument();
		// El filtro es del lado de la page: no dispara otra llamada al catálogo.
		expect(mocks.listRequests).toHaveBeenCalledTimes(1);
	});
});

describe("Solicitudes — lo que la page le entrega a la cola", () => {
	it("una fila sin título resoluble se lee con la frase del portal, nunca con la línea vacía", async () => {
		auth.login("tok-123", makeUser());
		// El contrato tiene dos formas de vacío: `null` (el campo está vacío) y el token `"unknown"` (el id
		// está seteado y no resuelve). Las dos tienen que leerse igual, y ninguna puede mostrar el id.
		mocks.listRequests.mockResolvedValue([
			makeRow({ dataset_title: null }),
			makeRow({ id: "req-2", dataset_title: "unknown", organization_title: null }),
		]);

		renderPage();

		expect(await screen.findAllByText(SIN_TITULO)).toHaveLength(2);
		expect(screen.queryByText("pkg-1")).not.toBeInTheDocument();
		expect(screen.queryByText("unknown")).not.toBeInTheDocument();
	});
});
