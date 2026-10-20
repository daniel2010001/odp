import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import type { PublicationRequest } from "$lib/api/publication";
import { sessionExpiredLoginUrl } from "$lib/session";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanOrganization, CkanPackage, CkanResource, CkanUser } from "$lib/types/ckan";
import DatasetPage from "./+page.svelte";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el
// tipo real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	createPortalClient: vi.fn<() => object>(),
	showDataset: vi.fn(),
	getMockDatasetById: vi.fn(),
	listUpdatableOrganizationIds: vi.fn(),
	canAdministerOrganization: vi.fn(),
	check: vi.fn(),
	copyToClipboard: vi.fn(),
	// Las acciones de publicación que la ficha consume: la lista alimenta la tarjeta del estado, `decide`
	// es la que monta el control de decidir (2026-10-14) y las otras dos las llaman los controles del
	// hero.
	listRequests: vi.fn(),
	decideRequest: vi.fn(),
	requestPublication: vi.fn(),
	cancelRequest: vi.fn(),
}));

// Se mockea en el borde de módulo para que `package_show` nunca dispare HTTP real. `$lib/mock/data`
// devuelve un dataset centinela: si la página cayera al fallback de desarrollo, su título aparecería
// renderizado y el test lo detecta.
vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000" },
}));
vi.mock("$lib/api/client", () => ({ createPortalClient: mocks.createPortalClient }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({
		listUpdatableOrganizationIds: mocks.listUpdatableOrganizationIds,
		canAdministerOrganization: mocks.canAdministerOrganization,
	}),
}));
vi.mock("$lib/api/publication", () => ({
	createPublicationApi: () => ({
		list: mocks.listRequests,
		decide: mocks.decideRequest,
		request: mocks.requestPublication,
		cancel: mocks.cancelRequest,
	}),
}));
vi.mock("$lib/mock/data", () => ({ getMockDatasetById: mocks.getMockDatasetById }));
// La copia al portapapeles se intercepta para poder probar el acuse del botón sin depender de
// `navigator.clipboard`, que jsdom no implementa. El resto del módulo —las citas— queda real.
vi.mock("$lib/utils/citation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/utils/citation")>();
	return { ...actual, copyToClipboard: mocks.copyToClipboard };
});
// La sonda de sesión se inyecta como mock: la decisión `resolveUnauthorized` que la usa sigue
// siendo la real, así que la expulsión y su orden se miden de verdad.
vi.mock("$lib/api/session", () => ({
	createSessionApi: () => ({ check: mocks.check }),
}));

const DATASET_PATH = "/dataset/matricula-2026";
// Sin sesión, un 403 y un 404 rinden el mismo estado: mismo rótulo, misma oración, ninguna acción.
const NOT_FOUND_TITLE = "Dataset no encontrado";
const AMBIGUOUS_MESSAGE = "No se encontró el dataset solicitado, o no tiene permiso para verlo.";
const MOCK_TITLE = "Dataset Mock De Desarrollo";

/**
 * Una fila de `publication_requests` con la forma del contrato, para no depender de campos que la tabla
 * no devuelve. Vive en el ámbito del archivo porque la usan **dos** bloques: el de la solicitud de
 * publicación y el de decidirla desde la ficha.
 */
function makeRow(overrides: Partial<PublicationRequest> = {}): PublicationRequest {
	return {
		id: "req-1",
		dataset_id: "pkg-1",
		status: "pending",
		requested_by: "user-editor",
		requested_by_name: "editor.tecnologia",
		approved_by: null,
		approved_by_name: null,
		comments: null,
		motive: null,
		created_at: "2026-10-01T00:00:00.000000",
		...overrides,
	};
}

function makeUser(overrides: Partial<CkanUser> = {}): CkanUser {
	return {
		id: "user-1",
		name: "dueno",
		display_name: "Dueño",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

function makeDataset(overrides: Partial<CkanPackage> & { owner_org?: string } = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: false,
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

function makeOrganization(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-1",
		name: "facultad-de-ciencias",
		title: "Facultad de Ciencias",
		description: "",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

function setParams(params: Record<string, string>, path = DATASET_PATH) {
	pageStore.set({ params, url: new URL(`http://localhost${path}`) });
}

// `unhandledRejection` es un listener de proceso: el hook lo retira siempre, incluso si una aserción
// falla antes de retirarlo a mano.
let capturaRechazos: ((razon: unknown) => void) | null = null;

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
	setParams({ id: "matricula-2026" });
	mocks.createPortalClient.mockReturnValue({});
	mocks.showDataset.mockResolvedValue(makeDataset());
	// Sin solicitudes, la tarjeta del estado no aparece y el hero no gana la acción de publicación: es
	// el estado por defecto de las pruebas que no hablan de publicación.
	mocks.listRequests.mockResolvedValue([]);
	mocks.getMockDatasetById.mockReturnValue(
		makeDataset({ id: "mock-0", name: "mock-0", title: MOCK_TITLE }),
	);
	// Fail closed: sin respuesta explícita, la página no ofrece editar.
	mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "unknown" });
	// Y tampoco ofrece decidir: la única respuesta que lo ofrece es `may`.
	mocks.canAdministerOrganization.mockResolvedValue("may_not");
	// La copia del enlace tiene éxito salvo que un test diga lo contrario.
	mocks.copyToClipboard.mockResolvedValue(true);
	// Sonda por defecto no concluyente: sólo los tests de sesión viva/muerta la cambian.
	mocks.check.mockResolvedValue({
		state: "inconclusive",
		error: new CkanApiError("Server Error", 500),
	});
});

afterEach(() => {
	if (capturaRechazos) process.off("unhandledRejection", capturaRechazos);
	capturaRechazos = null;
	vi.unstubAllEnvs();
	auth.reset();
});

describe("Página de dataset — carga por el puente del portal", () => {
	it("crea el cliente del portal, sin credencial: el servidor pone la del usuario", async () => {
		auth.setUser(makeUser());

		render(DatasetPage);
		await waitFor(() => expect(mocks.createPortalClient).toHaveBeenCalled());

		// El cliente del portal no admite `apiKey` ni `baseUrl`: no hay token del lado del navegador que
		// pasarle, y por eso la página lo construye sin argumentos.
		expect(mocks.createPortalClient.mock.calls[0]).toEqual([]);
	});

	it("no revela que el dataset existe cuando package_show responde 403 y no cae al mock", async () => {
		mocks.showDataset.mockRejectedValue(new CkanApiError("Forbidden", 403));

		render(DatasetPage);

		expect(await screen.findByText(AMBIGUOUS_MESSAGE)).toBeTruthy();
		expect(screen.queryByText(MOCK_TITLE)).toBeNull();
	});

	it("muestra el mensaje ambiguo de no encontrado cuando package_show responde 404", async () => {
		mocks.showDataset.mockRejectedValue(new CkanApiError("Not Found", 404));

		render(DatasetPage);

		expect(await screen.findByText(AMBIGUOUS_MESSAGE)).toBeTruthy();
	});

	it("renderiza el título del dataset cuando package_show resuelve", async () => {
		mocks.showDataset.mockResolvedValue(makeDataset());

		render(DatasetPage);

		expect(await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" })).toBeTruthy();
	});
});

describe("Página de dataset — estados de fallo honestos", () => {
	it("ante un 403 anónimo renderiza el mismo estado que un 404, sin inicio de sesión ni reintento", async () => {
		mocks.showDataset.mockRejectedValue(new CkanApiError("Access denied", 403));

		const { unmount } = render(DatasetPage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		// El rótulo nombra el estado; ya no es un «Error al cargar el dataset» genérico.
		expect(screen.getByText(NOT_FOUND_TITLE)).toBeTruthy();
		// Sin token nadie sondea: un espectador anónimo no es una sesión muerta (sondear
		// `user_show {}` sin token responde 404 y lo etiquetaría como expirado).
		expect(mocks.check).not.toHaveBeenCalled();

		// El estado de error no ofrece inicio de sesión: ese botón delataría que el recurso existe. El
		// camino al login vive en el encabezado, que no lleva información sobre el recurso solicitado.
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();

		unmount();

		// La propiedad de carga: el 404 rinde exactamente el mismo estado, sin filtrar la existencia.
		mocks.showDataset.mockRejectedValue(new CkanApiError("Not Found", 404));
		render(DatasetPage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.getByText(NOT_FOUND_TITLE)).toBeTruthy();
		expect(screen.queryByText(/privad/i)).toBeNull();
	});

	it("ante un 403 con sesión viva dice que la cuenta no está autorizada, sin pedir iniciar sesión ni ofrecer reintento", async () => {
		auth.setUser(makeUser());
		mocks.check.mockResolvedValue({ state: "alive", user: makeUser() });
		mocks.showDataset.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(DatasetPage);

		await screen.findByText(/su cuenta no está autorizada para ver este dataset/i);
		expect(mocks.check).toHaveBeenCalledTimes(1);
		expect(screen.queryByText(/inicie sesión/i)).toBeNull();
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
	});

	it("ante un 403 con sonda no concluyente no afirma ninguna causa y ofrece reintentar", async () => {
		auth.setUser(makeUser());
		mocks.check.mockResolvedValue({ state: "inconclusive", error: new CkanApiError("x", 500) });
		mocks.showDataset.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(DatasetPage);

		await screen.findByText(/puede que su sesión ya no sea válida/i);
		expect(screen.getByText("No se pudo confirmar el acceso")).toBeTruthy();
		// Subjuntivo («no esté autorizada») como posibilidad, no como hecho.
		expect(screen.queryByText(/no está autorizada/i)).toBeNull();
		expect(screen.getByRole("button", { name: /Reintentar/i })).toBeTruthy();
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
	});

	it("ante una sesión muerta expulsa al login con el motivo y no renderiza estado de fallo", async () => {
		auth.setUser(makeUser());
		mocks.check.mockResolvedValue({ state: "dead" });
		mocks.showDataset.mockRejectedValue(new CkanApiError("Access denied", 403));

		const { container } = render(DatasetPage);

		await waitFor(() => expect(goto).toHaveBeenCalledTimes(1));
		expect(vi.mocked(goto).mock.calls[0][0]).toBe(sessionExpiredLoginUrl(DATASET_PATH));
		// Guard de regresión, no un paso TDD: el camino `expelled` ya limpia `loading`. Sin esta
		// aserción, una reescritura podría dejar el esqueleto de carga renderizado para siempre y los
		// tests de arriba no lo notarían.
		expect(container.querySelector(".animate-pulse")).toBeNull();
		expect(
			screen.queryByText(/no autorizada|es privado|no encontrado|no se pudo confirmar/i),
		).toBeNull();
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
	});

	it("si la navegación de la expulsión falla, no se queda cargando ni afirma una causa: cae al estado no concluyente", async () => {
		// Caso defensivo: la sonda decidió `dead`, pero el `goto` de la expulsión rechaza. La sesión ya
		// se limpió y la navegación no ocurrió, así que el portal no puede afirmar «su sesión expiró»
		// (nadie llegó al login) ni «su cuenta no está autorizada». Debe salir del esqueleto de carga
		// y aterrizar en el estado que no afirma ninguna de las dos causas, con reintento.
		auth.setUser(makeUser());
		mocks.check.mockResolvedValue({ state: "dead" });
		mocks.showDataset.mockRejectedValue(new CkanApiError("Access denied", 403));
		vi.mocked(goto).mockRejectedValueOnce(new Error("navigation failed"));

		const { container } = render(DatasetPage);

		await screen.findByText("No se pudo confirmar el acceso");
		expect(screen.getByText(/puede que su sesión ya no sea válida/i)).toBeTruthy();
		expect(screen.queryByText(/no está autorizada/i)).toBeNull();
		expect(screen.getByRole("button", { name: /Reintentar/i })).toBeTruthy();
		expect(container.querySelector(".animate-pulse")).toBeNull();
		expect(vi.mocked(goto).mock.calls[0][0]).toBe(sessionExpiredLoginUrl(DATASET_PATH));
	});

	it("ante un 404 muestra el estado no encontrado sin reintento ni inicio de sesión", async () => {
		mocks.showDataset.mockRejectedValue(new CkanApiError("Not Found", 404));

		render(DatasetPage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.getByText(NOT_FOUND_TITLE)).toBeTruthy();
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
		expect(screen.queryByText(MOCK_TITLE)).toBeNull();
	});

	it("en DEV, un 403 definitivo nunca se enmascara con el mock aunque el id exista", async () => {
		vi.stubEnv("DEV", true);
		mocks.showDataset.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(DatasetPage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.queryByText(MOCK_TITLE)).toBeNull();
	});

	it("en DEV, un 404 definitivo tampoco se enmascara con el mock aunque el id exista", async () => {
		vi.stubEnv("DEV", true);
		mocks.showDataset.mockRejectedValue(new CkanApiError("Not Found", 404));

		render(DatasetPage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.queryByText(MOCK_TITLE)).toBeNull();
	});

	it("ante un catálogo inalcanzable informa el fallo de la consulta y ofrece reintentar, sin decir que falta o es privado", async () => {
		vi.stubEnv("DEV", true);
		mocks.getMockDatasetById.mockReturnValue(undefined);
		mocks.showDataset.mockRejectedValue(new CkanApiError("Server Error", 500));

		render(DatasetPage);

		await screen.findByText(/no se pudo completar la consulta al catálogo de datos/i);
		// Un 5xx es una respuesta del catálogo: el texto no puede culpar a la conexión.
		expect(screen.queryByText(/conectar|conexión/i)).toBeNull();
		expect(screen.queryByText(/no encontrado|privado/i)).toBeNull();
		expect(screen.getByRole("button", { name: /Reintentar/i })).toBeTruthy();
	});

	it("en DEV, un fallo no definitivo todavía puede enmascararse con datos mock", async () => {
		vi.stubEnv("DEV", true);
		mocks.showDataset.mockRejectedValue(new TypeError("Failed to fetch"));

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: MOCK_TITLE });
	});

	it("el título del documento refleja el fallo y no siempre dice «Cargando...»", async () => {
		mocks.showDataset.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(DatasetPage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		await waitFor(() => expect(document.title).toBe("Dataset no encontrado — UMSS"));
	});

	it("con un id de ruta vacío muestra su propio estado, sin reintento ni inicio de sesión", async () => {
		setParams({ id: "" }, "/dataset/");

		render(DatasetPage);

		await screen.findByText(/parámetros de navegación inválidos/i);
		expect(screen.getByText("La dirección no contiene un dataset válido.")).toBeTruthy();
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
		expect(screen.getByRole("link", { name: /Volver al catálogo/i })).toBeTruthy();
		expect(mocks.showDataset).not.toHaveBeenCalled();
	});
});

// ─── El enlace de la organización ─────────────────────────────────────
// La organización tiene página propia (`/organization/[id]`, que resuelve name o id) y es ahí donde
// el lector espera aterrizar; una búsqueda filtrada por `org` no es la organización. Las tres
// superficies que nombran a la organización —el breadcrumb, la insignia del hero y la tarjeta del
// panel lateral— comparten la misma forma que ya usan las tarjetas del panel.
describe("Página de dataset — el enlace de la organización", () => {
	async function renderWithOrganization(): Promise<HTMLElement> {
		mocks.showDataset.mockResolvedValue(makeDataset({ organization: makeOrganization() }));

		const { container } = render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		return container;
	}

	it("el breadcrumb lleva la organización a su página, no a una búsqueda filtrada", async () => {
		await renderWithOrganization();

		const nav = document.querySelector('nav[aria-label="Ruta de navegación"]');
		expect(nav).not.toBeNull();
		const crumb = within(nav as HTMLElement).getByRole("link", { name: "Facultad de Ciencias" });
		expect(crumb).toHaveAttribute("href", "/organization/facultad-de-ciencias");
	});

	it("la insignia del hero y la tarjeta lateral llevan la organización a su página", async () => {
		await renderWithOrganization();

		// La insignia del hero comparte el nombre con la miga del breadcrumb: se miden las dos, en orden
		// de aparición, y ninguna puede quedar fuera del destino de la organización.
		const named = screen.getAllByRole("link", { name: "Facultad de Ciencias" });
		expect(named.map((link) => link.getAttribute("href"))).toEqual([
			"/organization/facultad-de-ciencias",
			"/organization/facultad-de-ciencias",
		]);

		const card = screen.getByRole("link", { name: /Ver datasets de Facultad de Ciencias/i });
		expect(card).toHaveAttribute("href", "/organization/facultad-de-ciencias");
	});

	it("codifica el `name` de la organización en el `href`: una sola forma de armar la URL", async () => {
		// Regla única: la URL de la organización se codifica con `encodeURIComponent` en todas las
		// superficies. Con un `name` fuera del alfabeto de slugs (`[a-z0-9_-]`) la forma cruda y la
		// codificada divergen, así que este caso fija la regla que un slug no puede distinguir.
		mocks.showDataset.mockResolvedValue(
			makeDataset({ organization: makeOrganization({ name: "facultad de ciencias/ñ" }) }),
		);

		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });

		const nav = document.querySelector('nav[aria-label="Ruta de navegación"]');
		expect(nav).not.toBeNull();
		const crumb = within(nav as HTMLElement).getByRole("link", { name: "Facultad de Ciencias" });
		expect(crumb).toHaveAttribute("href", "/organization/facultad%20de%20ciencias%2F%C3%B1");

		const card = screen.getByRole("link", { name: /Ver datasets de Facultad de Ciencias/i });
		expect(card).toHaveAttribute("href", "/organization/facultad%20de%20ciencias%2F%C3%B1");
	});

	it("una organización con título pero sin `name` muestra la miga como texto y nunca como `/organization/undefined`", async () => {
		// Guarda que señaló la revisión `R3-ORG-NAME-GUARD`: el guard miraba `title` mientras el `href`
		// se armaba con `name`, así que una organización con título y sin `name` producía
		// `/organization/undefined`. Se exige `name`, que es lo que el enlace necesita; la miga sigue.
		mocks.showDataset.mockResolvedValue(
			makeDataset({ organization: makeOrganization({ name: undefined }) }),
		);

		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });

		const nav = document.querySelector('nav[aria-label="Ruta de navegación"]') as HTMLElement;
		expect(nav).not.toBeNull();
		// La miga sigue mostrándose como texto (la información de dónde estás no se pierde)…
		expect(within(nav).getByText("Facultad de Ciencias")).toBeTruthy();
		// …pero ya no es un enlace, porque no hay destino que ofrecer.
		expect(within(nav).queryByRole("link", { name: "Facultad de Ciencias" })).toBeNull();
		const hrefs = Array.from(nav.querySelectorAll("a[href]")).map(
			(anchor) => anchor.getAttribute("href") ?? "",
		);
		expect(hrefs.some((href) => href.includes("undefined"))).toBe(false);
	});

	it("ninguna superficie del dataset apunta a la búsqueda filtrada por organización", async () => {
		const container = await renderWithOrganization();

		const hrefs = Array.from(container.querySelectorAll("a[href]")).map(
			(anchor) => anchor.getAttribute("href") ?? "",
		);
		expect(hrefs.some((href) => href.includes("search?org="))).toBe(false);
	});
});

// ─── La primera miga del breadcrumb ───────────────────────────────────
// Las dos páginas —dataset y recurso— nombran el mismo destino (`/search`) con la misma palabra. La
// miga lleva el rótulo como texto visible y conserva su `role: "Catálogo"`, que es quien dice el nivel.
describe("Página de dataset — la primera miga del breadcrumb", () => {
	it("nombra el catálogo con la misma palabra que la página de recurso: «Datasets» hacia /search", async () => {
		mocks.showDataset.mockResolvedValue(makeDataset());

		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });

		const nav = document.querySelector('nav[aria-label="Ruta de navegación"]') as HTMLElement;
		expect(nav).not.toBeNull();
		const crumb = within(nav).getByRole("link", { name: "Datasets" });
		expect(crumb).toHaveAttribute("href", "/search");
		// El portal no puede nombrar el mismo destino con dos palabras.
		expect(within(nav).queryByRole("link", { name: "Catálogo" })).toBeNull();
	});
});

// ─── El tipo de recurso en la tarjeta del listado (block C, C1) ───────
// La tarjeta decide su único chip por `url_type`: un archivo alojado muestra su formato, una
// referencia externa muestra «Enlace». La prueba de las dos direcciones es el punto: un `format` y
// un `size` no pueden promover un enlace a archivo, y un archivo no puede perder su formato.

/** Un recurso del listado, con la forma de `resource_show`. */
function makeCardResource(overrides: Partial<CkanResource> = {}): CkanResource {
	return {
		id: "res-card-1",
		package_id: "pkg-1",
		name: "Recurso de prueba",
		description: "Recurso que el listado renderiza",
		format: "CSV",
		url: "https://data.umss.edu.bo/dataset/x/resource/res-card-1",
		resource_type: "file",
		mimetype: "text/csv",
		size: 1024,
		created: "2026-01-01T00:00:00.000000",
		last_modified: "2026-01-01T00:00:00.000000",
		state: "active",
		position: 0,
		...overrides,
	};
}

/** Renderiza la página con un único recurso y devuelve su tarjeta ya montada. */
async function renderResourceCard(resource: CkanResource): Promise<HTMLElement> {
	mocks.showDataset.mockResolvedValue(makeDataset({ resources: [resource] }));

	render(DatasetPage);

	return screen.findByRole("link", { name: /Recurso de prueba, detalle del recurso/i });
}

describe("Página de dataset — el tipo de recurso en la tarjeta del listado", () => {
	it('un recurso alojado (`url_type: "upload"`) muestra su formato y nunca «Enlace»', async () => {
		const card = await renderResourceCard(makeCardResource({ url_type: "upload", format: "CSV" }));

		expect(within(card).getByText("CSV")).toBeTruthy();
		expect(within(card).queryByText("Enlace")).toBeNull();
	});

	it("un archivo alojado sin formato dice «Archivo» y no el rótulo inglés «FILE»", async () => {
		const card = await renderResourceCard(
			makeCardResource({ url_type: "upload", format: undefined }),
		);

		expect(within(card).getByText("Archivo")).toBeTruthy();
		expect(within(card).queryByText("FILE")).toBeNull();
	});

	it("un recurso sin `url_type` (referencia externa) muestra «Enlace» y no el chip de formato", async () => {
		const card = await renderResourceCard(makeCardResource({ format: "CSV" }));

		expect(within(card).getByText("Enlace")).toBeTruthy();
		expect(within(card).queryByText("CSV")).toBeNull();

		// El ícono se fue por decisión del autor: sin él, el chip de enlace deja de ser más grande
		// que el de formato. Un `svg` acá sería la regresión silenciosa de esa decisión.
		const linkChip = within(card).getByText("Enlace");
		expect(linkChip.querySelectorAll("svg").length).toBe(0);
	});
});

// ─── La tarjeta de información técnica del dataset ────────────────────
// El molde es la tarjeta del recurso: eyebrow «Metadatos», una descripción
// bajo el título, la tabla sólo con los campos semánticos y una franja monoespaciada con los
// identificadores. Los identificadores dejan de mezclarse con «Visibilidad» y «Estado».
describe("Página de dataset — la tarjeta de información técnica", () => {
	async function renderTechnicalCard(): Promise<HTMLElement> {
		mocks.showDataset.mockResolvedValue(makeDataset());

		render(DatasetPage);

		const heading = await screen.findByRole("heading", {
			name: "Información sobre el dataset",
		});
		return heading.parentElement as HTMLElement;
	}

	it("unifica el eyebrow con el de la tarjeta del recurso", async () => {
		const card = await renderTechnicalCard();

		expect(within(card).getByText("Metadatos")).toBeTruthy();
		// «Sobre este dataset» sigue siendo el título de la tarjeta de descripción, no de ésta.
		expect(screen.getByRole("heading", { name: "Sobre este dataset" })).toBeTruthy();
		expect(within(card).queryByText("Sobre este dataset")).toBeNull();
	});

	it("dice «Metadatos» una sola vez, y el sidebar se llama «Detalles»", async () => {
		// Decisión del autor (2026-09-28/29): el eyebrow de la tarjeta técnica es exactamente «Metadatos»
		// —igual en las dos páginas— y el segundo título dice de qué es la información. El sidebar es un
		// **resumen** y se llama «Detalles», así que la palabra no se repite. La aserción es de **conteo**
		// y no de ausencia: mientras el eyebrow fue «Metadatos · Información técnica» el match exacto no lo
		// alcanzaba y «no aparece» probaba menos de lo que decía; con el eyebrow corto, «no aparece» sería
		// directamente falso.
		mocks.showDataset.mockResolvedValue(makeDataset());

		render(DatasetPage);

		const heading = await screen.findByRole("heading", { name: "Información sobre el dataset" });
		const card = heading.parentElement as HTMLElement;

		expect(within(card).getAllByText("Metadatos")).toHaveLength(1);
		expect(screen.getAllByText("Metadatos")).toHaveLength(1);
		expect(screen.getByText("Detalles")).toBeTruthy();
	});

	it("agrega la línea descriptiva bajo el título", async () => {
		const card = await renderTechnicalCard();

		expect(within(card).getByText("Visibilidad, estado y sus identificadores.")).toBeTruthy();
	});

	it("deja en la tabla sólo los campos semánticos y saca los identificadores", async () => {
		const card = await renderTechnicalCard();
		const table = card.querySelector(".overflow-hidden") as HTMLElement | null;
		expect(table).not.toBeNull();

		expect(within(table as HTMLElement).getByText("Visibilidad")).toBeTruthy();
		expect(within(table as HTMLElement).getByText("Estado")).toBeTruthy();
		expect(within(table as HTMLElement).queryByText("Dirección web")).toBeNull();
		expect(within(table as HTMLElement).queryByText("Identificador")).toBeNull();
	});

	it("muestra la dirección web y el identificador en la franja monoespaciada bajo la tabla", async () => {
		const card = await renderTechnicalCard();
		const table = card.querySelector(".overflow-hidden") as HTMLElement | null;
		const strip = table?.nextElementSibling as HTMLElement | null;

		// La franja es hermana de la tabla, no una fila dentro de ella: antes del cambio los
		// identificadores vivían en `code.font-mono` dentro de la tabla y este caso pasaba en falso.
		expect(strip).not.toBeNull();
		expect((strip as HTMLElement).textContent).toContain("Dirección web");
		expect((strip as HTMLElement).textContent).toContain("Identificador");
		const codes = Array.from((strip as HTMLElement).querySelectorAll("code.font-mono")).map(
			(code) => code.textContent,
		);
		expect(codes).toEqual(["matricula-2026", "pkg-1"]);
	});

	it("la franja envuelve entre identificadores y no dentro de un valor", async () => {
		const card = await renderTechnicalCard();
		const table = card.querySelector(".overflow-hidden") as HTMLElement | null;
		const strip = table?.nextElementSibling as HTMLElement | null;
		expect(strip).not.toBeNull();

		// jsdom no aplica Tailwind: lo de abajo es un contrato de clases, no una medición de layout.
		// `flex` + `flex-wrap` es lo que permite partir entre elementos; con el contenido en un solo
		// bloque en línea, la única ruptura posible vuelve a ser dentro del valor.
		const row = (strip as HTMLElement).firstElementChild as HTMLElement | null;
		expect(row).not.toBeNull();
		expect((row as HTMLElement).className).toContain("flex");
		expect((row as HTMLElement).className).toContain("flex-wrap");

		// Cada identificador es su propio hijo: el navegador puede bajar de línea «Identificador: …»
		// entero en vez de partir la oración. El `·` conserva la separación visual del molde.
		const items = Array.from((row as HTMLElement).children);
		const slugItem = items.find((el) => el.textContent?.startsWith("Dirección web:"));
		const idItem = items.find((el) => el.textContent?.startsWith("Identificador:"));
		expect(slugItem).not.toBeUndefined();
		expect(idItem).not.toBeUndefined();
		expect(slugItem).not.toBe(idItem);
		expect(items.some((el) => el.textContent === "·")).toBe(true);

		// `break-all` sobrevive sólo en los `code`, como último recurso para un valor que no cabe.
		for (const item of [slugItem, idItem]) {
			const code = item?.querySelector("code");
			expect(code).not.toBeNull();
			expect((code as HTMLElement).className).toContain("break-all");
		}
	});
});

describe("Página de dataset — acceso a la edición", () => {
	it("muestra «Editar» hacia la ruta de edición cuando la organización es editable", async () => {
		mocks.showDataset.mockResolvedValue(makeDataset({ owner_org: "org-1" }));
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });

		render(DatasetPage);

		const editar = await screen.findByRole("link", { name: /editar/i });
		expect(editar).toHaveAttribute("href", "/dashboard/datasets/matricula-2026/edit");
	});

	it("no muestra «Editar» cuando la organización del dataset no es editable", async () => {
		mocks.showDataset.mockResolvedValue(makeDataset({ owner_org: "org-2" }));
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		await waitFor(() => expect(mocks.listUpdatableOrganizationIds).toHaveBeenCalledTimes(1));
		expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
	});

	it("no muestra «Editar» cuando la pregunta no se pudo hacer (fail closed)", async () => {
		mocks.showDataset.mockResolvedValue(makeDataset({ owner_org: "org-1" }));
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "unknown" });

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		await waitFor(() => expect(mocks.listUpdatableOrganizationIds).toHaveBeenCalledTimes(1));
		expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
	});

	it("conserva el dataset y no ofrece editar cuando la pregunta de permiso rechaza", async () => {
		// El rechazo sube hasta `loadDataset`, que lo espera: sin el `catch` de `loadEditPermission`
		// quedaría sin manejar. La captura de abajo prueba que ese `catch` es load-bearing.
		mocks.showDataset.mockResolvedValue(makeDataset({ owner_org: "org-1" }));
		mocks.listUpdatableOrganizationIds.mockRejectedValue(new Error("boom"));
		const sinManejar: unknown[] = [];
		capturaRechazos = (razon: unknown) => sinManejar.push(razon);
		process.on("unhandledRejection", capturaRechazos);

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		await waitFor(() => expect(mocks.listUpdatableOrganizationIds).toHaveBeenCalledTimes(1));
		expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
		// Macrotarea: Node emite `unhandledRejection` recién después de agotar las microtareas.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(sinManejar).toEqual([]);
	});
});

// ─── El reparto de las acciones del hero (T4, v0.1.1) ─────────────────
// «Copiar enlace» es sólo ícono, va a la izquierda del título y anclado a su primera línea, en las dos
// fichas (decisión del autor, 2026-10-19). Ya no cuenta como acción del reparto: las demás —«Editar», la
// solicitud de publicación— siguen donde estaban, en la fila de las insignias, alineadas a la derecha.
// jsdom no tiene motor de layout: la fila se mide por la relación entre nodos y la alineación por la clase.
describe("Página de dataset — el hero: «Copiar enlace» a la izquierda del título", () => {
	async function renderHero(): Promise<{ copy: HTMLElement; title: HTMLElement }> {
		render(DatasetPage);

		const copy = await screen.findByRole("button", { name: "Copiar enlace del dataset" });
		const title = screen.getByRole("heading", { level: 1, name: "Matrícula 2026" });
		return { copy, title };
	}

	it("el botón de copiar precede al `h1`, es sólo ícono y se ancla a la primera línea del título", async () => {
		const { copy, title } = await renderHero();

		expect(copy.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(copy.textContent?.trim()).toBe("");
		expect(copy.className).toContain("size-9");

		// El contenedor mide `1lh` (la primera línea del título); la fila los pone lado a lado y el título
		// puede encogerse en vez de empujar el botón a una línea propia.
		expect(copy.parentElement?.className).toContain("h-[1lh]");
		const fila = title.parentElement as HTMLElement;
		expect(fila.className).toContain("flex");
		expect(fila.className).toContain("items-start");
		expect(fila.contains(copy)).toBe(true);
		expect(title.className).toContain("min-w-0");
	});

	it("sin otras acciones no hay grupo de acciones: la fila de las insignias queda sólo con las insignias", async () => {
		// Fail closed por defecto: sin permiso confirmado, copiar es lo único que hay.
		mocks.showDataset.mockResolvedValue(makeDataset({ organization: makeOrganization() }));
		const { copy } = await renderHero();

		expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
		const fila = screen.getAllByRole("link", { name: "Facultad de Ciencias" })[0]
			.parentElement as HTMLElement;
		expect(fila.contains(copy)).toBe(false);
	});

	it("con «Editar», las otras acciones se quedan en la fila de las insignias y copiar sigue junto al título", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ owner_org: "org-1", organization: makeOrganization() }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });

		await renderHero();
		const editar = await screen.findByRole("link", { name: "Editar" });
		// El permiso acaba de cambiar el reparto: se vuelve a leer del DOM nuevo (hallazgo `R3-1` de la
		// compuerta `review-e6dab4f3b36e3fdb`: un nodo capturado antes del cambio puede estar desmontado).
		const copy = screen.getByRole("button", { name: "Copiar enlace del dataset" });
		const title = screen.getByRole("heading", { level: 1, name: "Matrícula 2026" });

		// Copiar quedó con el título; «Editar» está con las insignias, a la derecha (`justify-between`).
		expect(title.parentElement).toContainElement(copy);
		const fila = editar.parentElement?.parentElement as HTMLElement;
		expect(fila.className).toContain("justify-between");
		expect(within(fila).getByRole("link", { name: "Facultad de Ciencias" })).toBeTruthy();
		expect(fila.contains(copy)).toBe(false);
		expect(fila.contains(title)).toBe(false);
	});
});

// ─── El acuse de «Copiar enlace» ──────────────────────────────────────
// El ícono pasa a una marca y el aviso «Enlace copiado» se anuncia por `role="status"` (el nombre accesible
// del botón ya no cambia: un cambio de nombre con el foco encima se anunciaría dos veces).
describe("Página de dataset — el acuse de «Copiar enlace»", () => {
	it("avisa «Enlace copiado» y lo retira a los 2 s, con el ícono como refuerzo", async () => {
		render(DatasetPage);

		const copiar = await screen.findByRole("button", { name: "Copiar enlace del dataset" });
		expect(copiar.querySelector(".lucide-link-2")).not.toBeNull();

		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			await fireEvent.click(copiar);
			await vi.advanceTimersByTimeAsync(0);
			expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://localhost/dataset/matricula-2026");

			expect(screen.getByRole("status").textContent).toBe("Enlace copiado");
			expect(copiar.querySelector(".lucide-check")).not.toBeNull();

			await vi.advanceTimersByTimeAsync(2000);
			expect(screen.getByRole("status").textContent).toBe("");
		} finally {
			vi.useRealTimers();
		}
	});
});

// El cableado de `B1`: la ficha muestra **el estado** de la solicitud y ofrece **la acción** en el hero.
// Las dos cosas salen de la misma respuesta (la lista acotada por organización), así que lo que se prueba
// acá es el **filtro**, el lugar donde el estado vive, y que un fallo de esta consulta no se lleve puesta
// la ficha que sí cargó.
describe("Página de dataset — la solicitud de publicación", () => {
	it("muestra el estado de la solicitud **después** de la información textual", async () => {
		// La dirección trae el **nombre** del dataset y la fila trae su **id**: el filtro tiene que cruzar
		// esos dos mundos, y por eso esta prueba sirve aunque los dos valores sean distintos a propósito.
		setParams({ id: "matricula-2026" });
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1" })]);
		auth.setUser(makeUser());

		render(DatasetPage);

		const estado = await screen.findByTestId("estado-solicitud");
		expect(estado).toHaveTextContent("Pendiente de revisión, pedida por editor.tecnologia.");
		// **Y la insignia en el hero**, que es donde el autor pidió que viva el estado (2026-10-08): una
		// insignia con las otras, y no un distintivo con forma de botón en la fila de acciones.
		expect(screen.getByText("Solicitud pendiente")).toBeInTheDocument();
		// El pedido del autor, como aserción: la tarjeta va **después** de «Sobre este dataset».
		expect(
			screen.getByRole("heading", { name: "Sobre este dataset" }).compareDocumentPosition(estado) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("la tarjeta encabeza la columna lateral, antes de «Citar como»: el aprobador no tiene que bajar", async () => {
		// Variante C de `/dev/requests-position`, elegida por el autor (2026-10-19, textual: «para
		// dev/requests-position creo que me voy por la C»). La columna lateral es pegajosa en escritorio.
		setParams({ id: "matricula-2026" });
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1" })]);
		auth.setUser(makeUser());

		render(DatasetPage);

		const estado = await screen.findByTestId("estado-solicitud");
		const aside = estado.closest("aside");
		expect(aside).not.toBeNull();
		const citar = within(aside as HTMLElement).getByText("Citar como");
		expect(estado.compareDocumentPosition(citar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("un estado rechazado explica el motivo en la tarjeta: dejó de vivir en la fila de acciones", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([
			makeRow({
				dataset_id: "pkg-1",
				status: "rejected",
				approved_by_name: "coordinacion",
				comments: "Faltan metadatos de contacto.",
			}),
		]);
		auth.setUser(makeUser());

		render(DatasetPage);

		// Desde el 2026-10-08 el hero ya no dibuja el motivo (la solicitud es una insignia); la tarjeta
		// es la única superficie que lo explica, y por eso se afirma acá y con la frase completa.
		const estado = await screen.findByTestId("estado-solicitud");
		expect(estado).toHaveTextContent(
			"Rechazada por coordinacion. Motivo: Faltan metadatos de contacto.",
		);
	});

	it("una solicitud aprobada no muestra la tarjeta, para nadie: la ficha pública queda igual a las demás", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: false }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.canAdministerOrganization.mockResolvedValue("may");
		mocks.listRequests.mockResolvedValue([
			makeRow({ dataset_id: "pkg-1", status: "approved", approved_by_name: "coordinacion" }),
		]);
		auth.setUser(makeUser());

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		await waitFor(() => expect(mocks.listRequests).toHaveBeenCalled());
		expect(screen.queryByTestId("estado-solicitud")).not.toBeInTheDocument();
		expect(screen.queryByText("Solicitud de publicación")).not.toBeInTheDocument();
	});

	it("una solicitud cancelada tampoco muestra la tarjeta", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1", status: "cancelled" })]);
		auth.setUser(makeUser());

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		await waitFor(() => expect(mocks.listRequests).toHaveBeenCalled());
		expect(screen.queryByTestId("estado-solicitud")).not.toBeInTheDocument();
	});

	it("no muestra la solicitud de **otro** dataset: el filtro es por id, no «alguna fila»", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-999" })]);
		auth.setUser(makeUser());

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		await waitFor(() => expect(mocks.listRequests).toHaveBeenCalled());
		expect(screen.queryByTestId("estado-solicitud")).not.toBeInTheDocument();
	});

	it("si la consulta de solicitudes falla, la ficha se muestra igual", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockRejectedValue(new CkanApiError("Service Unavailable", 503));
		auth.setUser(makeUser());

		render(DatasetPage);

		// El dataset cargó y se ve; la consulta que falló no deja tarjeta ni rompe la página. La espera va
		// **antes** de mirar el DOM: la ficha se dibuja cuando las tres llamadas se asentaron, y con la
		// tercera rechazada eso ocurre un tic más tarde.
		await waitFor(() => expect(mocks.listRequests).toHaveBeenCalled());
		expect(
			await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" }),
		).toBeInTheDocument();
		expect(screen.queryByTestId("estado-solicitud")).not.toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("quien puede editar y no pidió nada recibe la acción en el hero", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([]);
		auth.setUser(makeUser());

		render(DatasetPage);

		expect(
			await screen.findByRole("button", { name: "Solicitar publicación" }),
		).toBeInTheDocument();
	});

	it("quien no puede editar no recibe la acción, pero sí ve el estado", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-999"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1" })]);
		auth.setUser(makeUser());

		render(DatasetPage);

		expect(await screen.findByTestId("estado-solicitud")).toHaveTextContent(
			"Pendiente de revisión",
		);
		expect(screen.queryByRole("button", { name: "Solicitar publicación" })).not.toBeInTheDocument();
	});

	it("una fila legada guardada por **nombre** también se muestra: el filtro acepta las dos formas", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		// Las filas anteriores al PR #12 del catálogo guardaron el **nombre** del dataset, y la lectura las
		// devuelve **tal cual** (`_row_dict` arma el diccionario con las columnas crudas): un filtro que sólo
		// compara contra el id las deja invisibles en la ficha, aunque la cola sí las muestre.
		mocks.listRequests.mockResolvedValue([
			makeRow({ dataset_id: "matricula-2026", requested_by_name: "editor.legado" }),
		]);
		auth.setUser(makeUser());

		render(DatasetPage);

		const statusCard = await screen.findByTestId("estado-solicitud");
		expect(statusCard).toHaveTextContent("Pendiente de revisión, pedida por editor.legado.");
	});

	it("con dos pendientes elige la más reciente por `created_at`, no la primera del arreglo", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		// La más vieja va **primero** a propósito: una página que toma «la primera pendiente» mostraría a
		// `editor.antiguo`, y esta aserción falla.
		mocks.listRequests.mockResolvedValue([
			makeRow({
				id: "req-old",
				requested_by_name: "editor.antiguo",
				created_at: "2026-10-01T00:00:00.000000",
			}),
			makeRow({
				id: "req-new",
				requested_by_name: "editor.reciente",
				created_at: "2026-10-05T00:00:00.000000",
			}),
		]);
		auth.setUser(makeUser());

		render(DatasetPage);

		const statusCard = await screen.findByTestId("estado-solicitud");
		expect(statusCard).toHaveTextContent("Pendiente de revisión, pedida por editor.reciente.");
	});

	// El desempate: dos pendientes con el **mismo** `created_at`. Una comparación estricta deja que las
	// decida el orden del arreglo — justo la dependencia que esta selección dice haber quitado.
	it("con dos pendientes empatadas en `created_at` gana la de id mayor, no la primera", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		// La de id **mayor** va segunda: si el empate lo decidiera el arreglo, ganaría `editor.a`.
		mocks.listRequests.mockResolvedValue([
			makeRow({
				id: "req-a",
				requested_by_name: "editor.a",
				created_at: "2026-10-05T00:00:00.000000",
			}),
			makeRow({
				id: "req-b",
				requested_by_name: "editor.b",
				created_at: "2026-10-05T00:00:00.000000",
			}),
		]);
		auth.setUser(makeUser());

		render(DatasetPage);

		const statusCard = await screen.findByTestId("estado-solicitud");
		expect(statusCard).toHaveTextContent("Pendiente de revisión, pedida por editor.b.");
	});

	it("el desempate no depende del orden del arreglo", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		// Las **mismas** dos filas, en el orden inverso: el resultado tiene que ser el mismo.
		mocks.listRequests.mockResolvedValue([
			makeRow({
				id: "req-b",
				requested_by_name: "editor.b",
				created_at: "2026-10-05T00:00:00.000000",
			}),
			makeRow({
				id: "req-a",
				requested_by_name: "editor.a",
				created_at: "2026-10-05T00:00:00.000000",
			}),
		]);
		auth.setUser(makeUser());

		render(DatasetPage);

		const statusCard = await screen.findByTestId("estado-solicitud");
		expect(statusCard).toHaveTextContent("Pendiente de revisión, pedida por editor.b.");
	});

	it("con más de una pendiente lo dice, en vez de elegir en silencio", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([
			makeRow({ id: "req-old", created_at: "2026-10-01T00:00:00.000000" }),
			makeRow({ id: "req-new", created_at: "2026-10-05T00:00:00.000000" }),
		]);
		auth.setUser(makeUser());

		render(DatasetPage);

		const pendingCount = await screen.findByTestId("pending-requests-count");
		expect(pendingCount).toHaveTextContent("Hay 2 solicitudes pendientes para este dataset.");
	});

	it("con una sola pendiente no agrega la línea de conteo", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1" })]);
		auth.setUser(makeUser());

		render(DatasetPage);

		await screen.findByTestId("estado-solicitud");
		expect(screen.queryByTestId("pending-requests-count")).toBeNull();
	});
});

// El flujo de publicación tiene **una sola** compuerta: no hay camino directo, ni siquiera para la
// superadministración. Publicar es siempre pedir, y la decisión se toma en la cola. Estas dos pruebas
// fijan ese contrato para los dos actores que antes se repartían los controles.
describe("Página de dataset — decidir la solicitud desde la ficha", () => {
	// La variante (b), promovida el 2026-10-14: la tarjeta que muestra el estado de la solicitud también
	// deja decidirla, cuando quien mira **administra la organización dueña**. La pregunta al catálogo es la
	// que la decisión exige —`permission: "admin"`, no la de editar, que incluye a los editores— y falla
	// cerrado: `may_not` y `unknown` se comportan igual.
	const ESTADO_PENDIENTE = "Pendiente de revisión, pedida por editor.tecnologia.";

	/** Deja la ficha con el dataset privado, una solicitud pendiente ajena y una sesión viva. */
	function montar(overrides: Partial<PublicationRequest> = {}): void {
		setParams({ id: "matricula-2026" });
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1", ...overrides })]);
		auth.setUser(makeUser());
	}

	it("ofrece decidir cuando quien mira administra la organización dueña", async () => {
		montar();
		mocks.canAdministerOrganization.mockResolvedValue("may");

		render(DatasetPage);

		expect(await screen.findByRole("button", { name: "Aprobar" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
		expect(screen.getByLabelText("Comentario (obligatorio para rechazar)")).toBeInTheDocument();
		// La pregunta se hizo por la organización **dueña** del dataset, que es la que decide.
		expect(mocks.canAdministerOrganization).toHaveBeenCalledWith("org-1");
	});

	it("no ofrece decidir cuando no administra la organización", async () => {
		montar();
		mocks.canAdministerOrganization.mockResolvedValue("may_not");

		render(DatasetPage);

		expect(await screen.findByTestId("estado-solicitud")).toHaveTextContent(ESTADO_PENDIENTE);
		expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
	});

	it("no ofrece decidir cuando la pregunta de permiso no se pudo hacer (fail closed)", async () => {
		montar();
		mocks.canAdministerOrganization.mockResolvedValue("unknown");

		render(DatasetPage);

		expect(await screen.findByTestId("estado-solicitud")).toHaveTextContent(ESTADO_PENDIENTE);
		expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
	});

	it("la solicitud propia no se decide, ni administrando la organización", async () => {
		// Cuatro ojos: `requested_by` es el **id** de quien pidió, y acá es el mismo de la sesión. La fila
		// **no** trae la respuesta del catálogo, así que este caso fija el fallback: sin respuesta, la propia
		// sigue bloqueada —una fila que no dice nada no concede nada—.
		montar({ requested_by: "user-1" });
		mocks.canAdministerOrganization.mockResolvedValue("may");

		render(DatasetPage);

		expect(await screen.findByText("No puede aprobar su propia solicitud.")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
	});

	it("la solicitud propia **se** decide cuando el catálogo concede la excepción", async () => {
		// La excepción `c′`: el catálogo confirmó que no hay otra persona que pueda aprobarla, así que la
		// propia deja de estar bloqueada. La ficha no lo deduce: refleja la respuesta de la fila.
		montar({ requested_by: "user-1", decidable_by_caller: true });
		mocks.canAdministerOrganization.mockResolvedValue("may");

		render(DatasetPage);

		expect(await screen.findByRole("button", { name: "Aprobar" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
		expect(screen.queryByText("No puede aprobar su propia solicitud.")).not.toBeInTheDocument();
	});

	it("la solicitud propia sigue sin decidirse cuando el catálogo no concede la excepción", async () => {
		// La rama negativa del campo, con la frase de cuatro ojos: hay otra persona que puede aprobarla.
		montar({ requested_by: "user-1", decidable_by_caller: false });
		mocks.canAdministerOrganization.mockResolvedValue("may");

		render(DatasetPage);

		expect(await screen.findByText("No puede aprobar su propia solicitud.")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
	});

	it("aprobar confirma con la relectura del valor almacenado y la ficha queda pública", async () => {
		// La primera lectura ve el dataset **almacenado** privado; la segunda es la relectura que confirma
		// la aprobación, y ya lo ve público. Sin esa relectura la decisión no se da por hecha.
		mocks.showDataset
			.mockResolvedValueOnce(makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }))
			.mockResolvedValueOnce(makeDataset({ id: "pkg-1", owner_org: "org-1", private: false }));
		montar();
		mocks.canAdministerOrganization.mockResolvedValue("may");
		mocks.decideRequest.mockResolvedValue(makeRow({ dataset_id: "pkg-1", status: "approved" }));

		render(DatasetPage);
		await fireEvent.click(await screen.findByRole("button", { name: "Aprobar" }));

		await waitFor(() => expect(mocks.decideRequest).toHaveBeenCalledWith("req-1", true, undefined));
		// La confirmación relee el dataset **de la fila**, por su id — no el parámetro de la ruta.
		await waitFor(() => expect(mocks.showDataset).toHaveBeenCalledWith("pkg-1"));
		// Aprobada, la solicitud ya no tiene nada en curso: la tarjeta se retira (2026-10-18) y la ficha
		// queda igual a las demás fichas públicas.
		await waitFor(() => expect(screen.queryByTestId("estado-solicitud")).not.toBeInTheDocument());
		// El efecto de la visibilidad, sin ambigüedad: la aprobación confirmada hizo público el dataset, así
		// que **ya no queda ningún «Privado»** en la ficha (la insignia del hero y la fila «Visibilidad» de
		// la tarjeta de metadatos dicen lo mismo, y por eso no se afirma sobre «Público»).
		expect(screen.queryByText("Privado")).not.toBeInTheDocument();
	});

	it("rechazar exige el motivo, y con él la tarjeta explica el rechazo", async () => {
		montar();
		mocks.canAdministerOrganization.mockResolvedValue("may");
		mocks.decideRequest.mockResolvedValue(
			makeRow({ dataset_id: "pkg-1", status: "rejected", comments: "Faltan metadatos." }),
		);

		render(DatasetPage);
		const campo = await screen.findByLabelText("Comentario (obligatorio para rechazar)");
		await fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));

		// Sin motivo no viaja ninguna decisión y se dice por qué.
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Para rechazar una solicitud debe escribir un motivo.",
		);
		expect(mocks.decideRequest).not.toHaveBeenCalled();

		await fireEvent.input(campo, { target: { value: "Faltan metadatos." } });
		await fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));

		await waitFor(() =>
			expect(mocks.decideRequest).toHaveBeenCalledWith("req-1", false, "Faltan metadatos."),
		);
		expect(await screen.findByTestId("estado-solicitud")).toHaveTextContent(
			"Rechazada. Motivo: Faltan metadatos.",
		);
	});
});

describe("Página de dataset — el camino directo ya no se ofrece", () => {
	it("la superadministración tampoco publica en directo: sólo ve la solicitud", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([]);
		auth.setUser(makeUser({ sysadmin: true }));

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		expect(screen.queryByRole("button", { name: "Publicar dataset" })).not.toBeInTheDocument();
		expect(
			await screen.findByRole("button", { name: "Solicitar publicación" }),
		).toBeInTheDocument();
	});

	it("un editor no superadministrador tampoco publica en directo: ve la misma solicitud", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([]);
		auth.setUser(makeUser({ sysadmin: false }));

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		expect(screen.queryByRole("button", { name: "Publicar dataset" })).not.toBeInTheDocument();
		expect(
			await screen.findByRole("button", { name: "Solicitar publicación" }),
		).toBeInTheDocument();
	});
});
