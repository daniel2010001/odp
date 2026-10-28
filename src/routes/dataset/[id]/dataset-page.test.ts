import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto, replaceState } from "$app/navigation";
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
	historyRequests: vi.fn(),
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
		history: mocks.historyRequests,
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
	mocks.historyRequests.mockResolvedValue([]);
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

	it("la miga y la tarjeta lateral llevan la organización a su página; la insignia del hero, a su búsqueda", async () => {
		await renderWithOrganization();

		// Regla de las insignias (T13, L32): una insignia es enlace sólo si existe un filtro de búsqueda. El de la
		// organización es `org`, así que la insignia del hero filtra el catálogo; la miga y la tarjeta lateral
		// siguen yendo a la página de la organización.
		const named = screen.getAllByRole("link", { name: "Facultad de Ciencias" });
		expect(named.map((link) => link.getAttribute("href"))).toEqual([
			"/organization/facultad-de-ciencias",
		]);
		const badge = screen.getByRole("link", {
			name: "Ver datasets de Facultad de Ciencias en el catálogo",
		});
		expect(badge).toHaveAttribute("href", "/search?org=facultad-de-ciencias");

		const card = screen.getByRole("link", { name: "Ver los datasets de la organización" });
		expect(card).toHaveAttribute("href", "/organization/facultad-de-ciencias");
		// Variante C de `/dev/card-links`: fila de pie de la tarjeta, con el alto táctil de 44 px.
		expect(card.className).toContain("min-h-11");
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

		const card = screen.getByRole("link", { name: "Ver los datasets de la organización" });
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

	it("sólo la insignia del hero apunta a la búsqueda filtrada por organización", async () => {
		const container = await renderWithOrganization();

		const hrefs = Array.from(container.querySelectorAll("a[href]"))
			.map((anchor) => anchor.getAttribute("href") ?? "")
			.filter((href) => href.includes("search?org="));
		expect(hrefs).toEqual(["/search?org=facultad-de-ciencias"]);
	});

	it("codifica el `name` en la búsqueda de la insignia", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ organization: makeOrganization({ name: "facultad de ciencias/ñ" }) }),
		);

		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });

		expect(
			screen.getByRole("link", { name: "Ver datasets de Facultad de Ciencias en el catálogo" }),
		).toHaveAttribute("href", "/search?org=facultad+de+ciencias%2F%C3%B1");
	});

	it("sin `name` la insignia del hero es texto: no hay filtro que ofrecer", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ organization: makeOrganization({ name: undefined }) }),
		);

		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });

		expect(screen.queryByRole("link", { name: /Ver datasets de/ })).toBeNull();
		const hero = screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
		expect(within(hero).getAllByText("Facultad de Ciencias").length).toBeGreaterThan(0);
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

/**
 * Renderiza la página con un único recurso y devuelve su fila ya montada. La fila es el ancestro del
 * enlace a la ficha: el formato es un enlace hermano, no un descendiente de él.
 */
async function renderResourceCard(resource: CkanResource): Promise<HTMLElement> {
	mocks.showDataset.mockResolvedValue(makeDataset({ resources: [resource] }));

	render(DatasetPage);

	const link = await screen.findByRole("link", { name: /Recurso de prueba, detalle del recurso/i });
	return link.closest("div.relative") as HTMLElement;
}

describe("Página de dataset — el tipo de recurso en la tarjeta del listado", () => {
	it('un recurso alojado (`url_type: "upload"`) muestra su formato y nunca «Enlace»', async () => {
		const card = await renderResourceCard(makeCardResource({ url_type: "upload", format: "CSV" }));

		expect(within(card).getByText("CSV")).toBeTruthy();
		expect(within(card).queryByText("Enlace externo")).toBeNull();
	});

	it("un archivo alojado sin formato dice «Archivo» y no el rótulo inglés «FILE»", async () => {
		const card = await renderResourceCard(
			makeCardResource({ url_type: "upload", format: undefined }),
		);

		expect(within(card).getByText("Archivo")).toBeTruthy();
		expect(within(card).queryByText("FILE")).toBeNull();
	});

	it("un recurso sin `url_type` (referencia externa) dice «Enlace externo» y no enlaza el formato", async () => {
		const card = await renderResourceCard(makeCardResource({ format: "CSV" }));

		expect(within(card).getByText("Enlace externo")).toBeTruthy();
		expect(within(card).queryByText("CSV")).toBeNull();
		expect(within(card).queryByRole("link", { name: /formato/i })).toBeNull();
	});
});

// ─── «Resumen» (sidebar) e «Información técnica» (cuerpo) ──────────────
// Variante C / 3b de `/dev/dataset-details` (decisión del autor, 2026-10-19): el sidebar resume lo que
// responde «¿me sirve esto?» y la tarjeta del cuerpo trae **todos** los campos registrados, en grupos.
// Antes: «Detalles» (creado, modificado, licencia, autor, mantenedor) y «Metadatos / Información sobre
// el dataset» (visibilidad, estado y una franja de identificadores); los correos, la versión, el sitio de
// origen y los extras no se mostraban en ningún lado.
describe("Página de dataset — el resumen bajo el título (P17, S53)", () => {
	it("el resumen editorial se muestra como bajada del título, en el hero", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({
				extras: [{ key: "summary", value: "Matrícula por facultad, en datos ficticios." }],
			}),
		);
		render(DatasetPage);

		const lede = await screen.findByText("Matrícula por facultad, en datos ficticios.");
		expect(lede.tagName).toBe("P");
		const hero = screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
		expect(hero.contains(lede)).toBe(true);
	});

	it("sin resumen no inventa uno con la descripción: la descripción ya está en la página", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ notes: "Descripción larga del dataset.", extras: [] }),
		);
		render(DatasetPage);

		const h1 = await screen.findByRole("heading", { level: 1 });
		const hero = h1.closest("section") as HTMLElement;
		expect(hero.querySelector("[data-dataset-summary]")).toBeNull();
	});
});

describe("Página de dataset — «Resumen» e «Información técnica»", () => {
	const FULL = () =>
		makeDataset({
			author: "Unidad de Estadística",
			author_email: "estadistica@umss.edu.bo",
			maintainer: "María Rojas",
			maintainer_email: "mrojas@umss.edu.bo",
			version: "2026.2",
			url: "https://planificacion.umss.edu.bo/matricula",
			license_title: "Creative Commons Atribución 4.0",
			extras: [
				{ key: "Frecuencia de actualización", value: "Semestral" },
				{ key: "Cobertura geográfica", value: "Cochabamba, Bolivia" },
				{ key: "Cobertura temporal", value: "Enero a diciembre de 2026" },
			],
		});

	async function renderTechnicalCard(dataset: CkanPackage): Promise<HTMLElement> {
		mocks.showDataset.mockResolvedValue(dataset);
		render(DatasetPage);
		const eyebrow = await screen.findByText("Información técnica");
		return eyebrow.closest("[id]") as HTMLElement;
	}

	function groupTitles(card: HTMLElement): string[] {
		return within(card)
			.getAllByRole("group")
			.map((g) => g.querySelector("h3")?.textContent?.trim() ?? "");
	}

	it("el sidebar se llama «Resumen» y ya no hay «Detalles» ni «Metadatos»", async () => {
		await renderTechnicalCard(FULL());

		expect(screen.getByText("Resumen")).toBeTruthy();
		expect(screen.queryByText("Detalles")).toBeNull();
		expect(screen.queryByText("Metadatos")).toBeNull();
		expect(screen.queryByText("Información sobre el dataset")).toBeNull();
	});

	it("el resumen trae los cuatro datos clave", async () => {
		await renderTechnicalCard(FULL());
		const summary = document.getElementById("summary") as HTMLElement;

		for (const [label, value] of [
			["Lo mantiene", "María Rojas"],
			["Se actualiza", "Semestral"],
			["Última actualización", "1 de enero de 2026"],
		]) {
			expect(within(summary).getByText(label).tagName).toBe("DT");
			expect(within(summary).getByText(value).tagName).toBe("DD");
		}
		// La licencia es un dato más del resumen: su valor vive en el `dd` de su fila, aunque sea un enlace.
		expect(within(summary).getByText("Licencia").tagName).toBe("DT");
		expect(
			within(summary).getByText("Creative Commons Atribución 4.0").closest("dd"),
		).not.toBeNull();
	});

	it("«Lo mantiene» cae al autor y luego a la organización", async () => {
		await renderTechnicalCard(makeDataset({ author: "Unidad de Estadística" }));
		expect(screen.getByText("Unidad de Estadística", { selector: "dd" })).toBeTruthy();
	});

	it("con pocos datos el resumen omite los hechos que faltan, no los inventa", async () => {
		await renderTechnicalCard(makeDataset());
		const summary = document.getElementById("summary") as HTMLElement;

		expect(within(summary).queryByText("Lo mantiene")).toBeNull();
		expect(within(summary).queryByText("Se actualiza")).toBeNull();
		expect(within(summary).queryByText("Licencia")).toBeNull();
		expect(within(summary).getByText("Última actualización")).toBeTruthy();
	});

	it("el enlace «Ver la información técnica» apunta a la tarjeta del cuerpo", async () => {
		const card = await renderTechnicalCard(FULL());
		const link = screen.getByRole("link", { name: "Ver la información técnica" });

		expect(link.getAttribute("href")).toBe(`#${card.id}`);
		// Variante C de `/dev/card-links`: fila de pie de la tarjeta, con el alto táctil de 44 px.
		expect(link.className).toContain("min-h-11");
		expect(card.id).toBe("technical-info");
		// Como `#preview` del recurso: el encabezado fijo no tapa el título al saltar.
		expect(card.className).toContain("scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))]");
	});

	it("la tarjeta muestra cada campo registrado, agrupado en cinco grupos", async () => {
		const card = await renderTechnicalCard(FULL());

		expect(groupTitles(card)).toEqual([
			"Responsables",
			"Fechas y versión",
			"Condiciones y estado",
			"Origen y cobertura",
			"Identificadores",
		]);
		const rows: [string, string][] = [
			["Autor", "Unidad de Estadística"],
			["Correo del autor", "estadistica@umss.edu.bo"],
			["Mantenedor", "María Rojas"],
			["Correo del mantenedor", "mrojas@umss.edu.bo"],
			["Creado", "1 de enero de 2026"],
			["Modificado", "1 de enero de 2026"],
			["Versión", "2026.2"],
			["Frecuencia de actualización", "Semestral"],
			["Licencia", "Creative Commons Atribución 4.0"],
			["Visibilidad", "Público"],
			["Estado", "Activo"],
			["Sitio de origen", "https://planificacion.umss.edu.bo/matricula"],
			["Cobertura geográfica", "Cochabamba, Bolivia"],
			["Cobertura temporal", "Enero a diciembre de 2026"],
			["Dirección web", "matricula-2026"],
			["Identificador", "pkg-1"],
		];
		for (const [label, value] of rows) {
			const dt = within(card).getByText(label, { selector: "dt" });
			expect(dt.nextElementSibling?.textContent).toContain(value);
		}
		// Estructura 3b: el título va afuera de la tarjeta pequeña y la franja de identificadores desapareció.
		expect(card.querySelector("code")).toBeNull();
		expect(within(card).queryByText("Campo")).toBeNull();
	});

	it("con pocos datos no se renderizan los grupos vacíos", async () => {
		const card = await renderTechnicalCard(makeDataset());

		// Sin autor, correos, versión, licencia, sitio ni extras quedan: fechas, condiciones e identificadores.
		expect(groupTitles(card)).toEqual([
			"Fechas y versión",
			"Condiciones y estado",
			"Identificadores",
		]);
		expect(within(card).queryByText("Correo del autor", { selector: "dt" })).toBeNull();
		expect(within(card).queryByText("Versión", { selector: "dt" })).toBeNull();
	});

	it("sólo se copian los correos, el sitio de origen, la dirección web y el identificador", async () => {
		const card = await renderTechnicalCard(FULL());

		// El ícono de enlace de la sección (T25) no es un dato de la ficha: se cuenta aparte.
		const buttons = within(card)
			.getAllByRole("button")
			.filter((b) => !b.getAttribute("aria-label")?.startsWith("Copiar enlace a la sección"));
		expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
			"Copiar correo del autor",
			"Copiar correo del mantenedor",
			"Copiar sitio de origen",
			"Copiar dirección web",
			"Copiar identificador",
		]);
	});

	it("copiar un correo copia su valor", async () => {
		const card = await renderTechnicalCard(FULL());

		await fireEvent.click(within(card).getByRole("button", { name: "Copiar correo del autor" }));

		await waitFor(() =>
			expect(mocks.copyToClipboard).toHaveBeenCalledWith("estadistica@umss.edu.bo"),
		);
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
		const fila = screen
			.getByRole("link", {
				name: "Ver datasets de Facultad de Ciencias en el catálogo",
			})
			.closest("[data-hero-row]") as HTMLElement;
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

		// Copiar quedó con el título; «Editar» está con las insignias, a la derecha, en la misma fila sin envolver.
		expect(title.parentElement).toContainElement(copy);
		const fila = editar.closest("[data-hero-row]") as HTMLElement;
		expect(fila.className).toContain("flex-nowrap");
		expect(
			within(fila).getByRole("link", {
				name: "Ver datasets de Facultad de Ciencias en el catálogo",
			}),
		).toBeTruthy();
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

		// Cada botón de copiar trae su propio aviso `role="status"` (también los de «Información técnica»):
		// el de este botón es el de su mismo contenedor.
		const aviso = () => within(copiar.parentElement as HTMLElement).getByRole("status");
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			await fireEvent.click(copiar);
			await vi.advanceTimersByTimeAsync(0);
			expect(mocks.copyToClipboard).toHaveBeenCalledWith("http://localhost/dataset/matricula-2026");

			expect(aviso().textContent).toBe("Enlace copiado");
			expect(copiar.querySelector(".lucide-check")).not.toBeNull();

			await vi.advanceTimersByTimeAsync(2000);
			expect(aviso().textContent).toBe("");
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
		// Variante C de la posición de las solicitudes, elegida por el autor (2026-10-19, textual: «para
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

// ─── Acciones responsivas del hero, insignias y términos de la licencia (T13, v0.1.1) ─────────────
// Promovido desde `/dev/responsive-actions` con la elección del autor (L32, L37, L39, L42): hero C7 —«Editar»
// como acción principal, «Más acciones» sólo si hay secundarias, y la solicitud junto a su estado bajo las
// insignias, a la izquierda—, diseño móvil M1, la regla de las insignias (enlace sólo si hay un filtro de
// búsqueda; «Público» y «Activo» no se muestran) y los términos de la licencia en su propia fila (L3).
// jsdom no tiene layout: los umbrales responsivos se prueban por contrato de clases y se midieron en Chromium.
describe("Página de dataset — hero C7, insignias y licencia (T13)", () => {
	const heroOf = () => screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;

	function editorDataset(overrides: Partial<CkanPackage> = {}) {
		mocks.showDataset.mockResolvedValue(
			makeDataset({
				id: "pkg-1",
				owner_org: "org-1",
				private: true,
				organization: makeOrganization(),
				...overrides,
			}),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		auth.setUser(makeUser());
	}

	it("«Público» y «Activo» son los estados por defecto: el hero no los muestra", async () => {
		mocks.showDataset.mockResolvedValue(makeDataset({ organization: makeOrganization() }));
		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });

		const hero = within(heroOf());
		expect(hero.queryByText("Público")).toBeNull();
		expect(hero.queryByText("Activo")).toBeNull();
	});

	it("«Privado» y los estados que no son el de por defecto sí se muestran, como texto: informan, no filtran", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ private: true, state: "draft", organization: makeOrganization() }),
		);
		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });

		const hero = within(heroOf());
		expect(hero.getByText("Privado")).toBeInTheDocument();
		expect(hero.getByText("Borrador")).toBeInTheDocument();
		expect(hero.queryByRole("link", { name: /Privado|Borrador/ })).toBeNull();
	});

	it("«Editar» es la acción principal y, sin acciones secundarias, no hay «Más acciones»", async () => {
		editorDataset({ private: false });
		render(DatasetPage);

		const editar = await screen.findByRole("link", { name: "Editar" });
		expect(editar).toHaveAttribute("href", "/dashboard/datasets/matricula-2026/edit");
		// Responsivo: queda sólo en ícono bajo 32 rem de su contenedor, sin perder el nombre accesible.
		expect(editar.className).toContain("size-11");
		expect(editar.className).toContain("@[32rem]:h-9");
		expect(screen.queryByRole("button", { name: "Más acciones" })).toBeNull();
		expect(heroOf().querySelector(".\\@container")).not.toBeNull();
	});

	it("privado y sin solicitud: la unidad (estado + acción) va bajo las insignias, a la izquierda", async () => {
		editorDataset();
		mocks.listRequests.mockResolvedValue([]);
		render(DatasetPage);

		const pedir = await screen.findByRole("button", { name: "Solicitar publicación" });
		const unidad = pedir.closest("[data-unit]") as HTMLElement;
		expect(unidad).toHaveTextContent("Sin solicitud");
		// Diseño M1: una fila en la tarjeta —etiqueta a la izquierda, botón a la derecha—, sin envolver.
		expect(unidad.className).toContain("flex-nowrap");
		expect(unidad.className).toContain("w-full");
		expect(unidad.className).not.toContain("ml-auto");
		// Bajo la fila de las insignias y de «Editar».
		const fila = heroOf().querySelector("[data-hero-row]") as HTMLElement;
		expect(fila.compareDocumentPosition(unidad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(fila.contains(unidad)).toBe(false);
	});

	it("con una solicitud pendiente el estado vive en la unidad, junto a «Cancelar solicitud», y no se repite en las insignias", async () => {
		editorDataset();
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1" })]);
		render(DatasetPage);

		const cancelar = await screen.findByRole("button", { name: "Cancelar solicitud" });
		const unidad = cancelar.closest("[data-unit]") as HTMLElement;
		expect(unidad).toHaveTextContent("Solicitud pendiente");
		expect(within(heroOf()).getAllByText("Solicitud pendiente")).toHaveLength(1);
	});

	it("con una solicitud rechazada la unidad ofrece «Volver a solicitar»", async () => {
		editorDataset();
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1", status: "rejected" })]);
		render(DatasetPage);

		const otraVez = await screen.findByRole("button", { name: "Volver a solicitar" });
		expect(otraVez.closest("[data-unit]")).toHaveTextContent("Solicitud rechazada");
	});

	it("quien no puede editar ve el estado de la solicitud como insignia, sin unidad ni acción", async () => {
		editorDataset();
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-999"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1" })]);
		render(DatasetPage);

		await screen.findByTestId("estado-solicitud");
		const hero = heroOf();
		expect(within(hero).getByText("Solicitud pendiente")).toBeInTheDocument();
		expect(hero.querySelector("[data-unit]")).toBeNull();
		expect(within(hero).queryByRole("link", { name: "Editar" })).toBeNull();
	});

	it("un dataset público no tiene unidad, aunque quien mira pueda editar", async () => {
		editorDataset({ private: false });
		render(DatasetPage);

		await screen.findByRole("link", { name: "Editar" });
		expect(heroOf().querySelector("[data-unit]")).toBeNull();
	});

	describe("etiquetas y licencia", () => {
		it("cada etiqueta lleva a la búsqueda filtrada por ella, con 44 px de área", async () => {
			mocks.showDataset.mockResolvedValue(
				makeDataset({
					tags: [
						{ id: "t1", name: "matricula", display_name: "matrícula", state: "active" },
						{ id: "t2", name: "datos abiertos", display_name: "datos abiertos", state: "active" },
					],
				}),
			);
			render(DatasetPage);

			const link = await screen.findByRole("link", {
				name: "Ver datasets con la etiqueta matrícula en el catálogo",
			});
			expect(link).toHaveAttribute("href", "/search?tags=matricula");
			expect(link.textContent?.trim()).toBe("#matrícula");
			expect(
				screen.getByRole("link", {
					name: "Ver datasets con la etiqueta datos abiertos en el catálogo",
				}),
			).toHaveAttribute("href", "/search?tags=datos+abiertos");
			// El área de toque llega a 44 px por el pseudoelemento, sin mover el layout.
			expect(link.className).toContain("after:-inset-y-3");
		});

		const withLicense = (extra: Partial<CkanPackage> = {}) =>
			makeDataset({
				license_id: "cc-by",
				license_title: "CC BY — Atribución",
				license_url: "https://creativecommons.org/licenses/by/4.0/deed.es",
				...extra,
			});

		it("el nombre de la licencia lleva a la búsqueda por licencia", async () => {
			mocks.showDataset.mockResolvedValue(withLicense());
			render(DatasetPage);

			const name = await screen.findByRole("link", {
				name: "Ver datasets con licencia CC BY — Atribución en el catálogo",
			});
			expect(name).toHaveAttribute("href", "/search?license=cc-by");
			expect(name.textContent?.trim()).toBe("CC BY — Atribución");
		});

		it("los términos tienen su propia fila «Términos»: enlace externo en otra pestaña con nombre accesible explícito", async () => {
			mocks.showDataset.mockResolvedValue(withLicense());
			render(DatasetPage);

			const terms = await screen.findByRole("link", {
				name: "Ver los términos de la licencia CC BY — Atribución (sitio externo, se abre en otra pestaña)",
			});
			expect(terms).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/deed.es");
			expect(terms).toHaveAttribute("target", "_blank");
			expect(terms).toHaveAttribute("rel", "noopener noreferrer");
			expect(terms.querySelector(".lucide-external-link")).not.toBeNull();
			// Fila propia del «Resumen»: su `dt` es «Términos» y está justo después de la de la licencia.
			const row = terms.closest("dd") as HTMLElement;
			expect(row.previousElementSibling?.textContent).toBe("Términos");
			// El enlace del nombre y el externo son dos enlaces separados.
			expect(terms.closest("dd")).not.toBe(
				screen.getByRole("link", { name: /Ver datasets con licencia/ }).closest("dd"),
			);
		});

		it("con un id conocido, «Términos» usa la página oficial en español aunque CKAN traiga otra", async () => {
			mocks.showDataset.mockResolvedValue(
				withLicense({ license_url: "http://www.opendefinition.org/licenses/cc-by" }),
			);
			render(DatasetPage);

			const terms = await screen.findByRole("link", { name: /Ver los términos de la licencia/ });
			expect(terms).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/deed.es");
		});

		it("con un id desconocido, «Términos» usa la dirección de CKAN", async () => {
			mocks.showDataset.mockResolvedValue(
				withLicense({ license_id: "nueva", license_url: "https://example.org/terminos" }),
			);
			render(DatasetPage);

			const terms = await screen.findByRole("link", { name: /Ver los términos de la licencia/ });
			expect(terms).toHaveAttribute("href", "https://example.org/terminos");
		});

		it("sin `license_url` ni página mapeada no hay fila «Términos» ni enlace externo, pero el nombre sigue filtrando", async () => {
			mocks.showDataset.mockResolvedValue(
				withLicense({ license_id: "other-open", license_url: undefined }),
			);
			render(DatasetPage);

			await screen.findByRole("link", { name: /Ver datasets con licencia/ });
			expect(screen.queryByText("Términos", { selector: "dt" })).toBeNull();
			expect(screen.queryByRole("link", { name: /Ver los términos/ })).toBeNull();
		});

		it("una dirección que no es web (`javascript:`) no se ofrece como enlace de términos", async () => {
			mocks.showDataset.mockResolvedValue(
				withLicense({ license_id: "nueva", license_url: "javascript:alert(1)" }),
			);
			render(DatasetPage);

			await screen.findByRole("link", { name: /Ver datasets con licencia/ });
			expect(screen.queryByText("Términos", { selector: "dt" })).toBeNull();
			expect(screen.queryByRole("link", { name: /Ver los términos/ })).toBeNull();
		});

		it("sin `license_id` el nombre es texto: no hay filtro que ofrecer", async () => {
			mocks.showDataset.mockResolvedValue(
				withLicense({ license_id: undefined, license_url: undefined }),
			);
			render(DatasetPage);

			await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
			expect(screen.queryByRole("link", { name: /Ver datasets con licencia/ })).toBeNull();
			expect(
				within(document.getElementById("summary") as HTMLElement).getByText("CC BY — Atribución"),
			).toBeInTheDocument();
		});
	});
});

describe("Página de dataset — el historial de solicitudes (T14)", () => {
	const HISTORIAL = "Historial de solicitudes";

	it("con filas dibuja la tarjeta bajo «Resumen», pidiendo el historial del dataset cargado", async () => {
		auth.setUser(makeUser());
		mocks.historyRequests.mockResolvedValue([
			makeRow({
				id: "r2",
				status: "rejected",
				resolved_by_name: "Marta Quispe",
				decided_at: "2026-10-18T09:30:00.000000",
				decision_comment: "Falta la licencia.",
			}),
			makeRow({ id: "r1", status: "cancelled" }),
		]);

		render(DatasetPage);

		const tarjeta = await screen.findByTestId("historial-solicitudes");
		expect(mocks.historyRequests).toHaveBeenCalledWith("pkg-1");
		expect(within(tarjeta).getByText(HISTORIAL)).toBeTruthy();
		// Va plegado (S18): la última solicitud, y «Ver 1 más» despliega la otra.
		expect(within(tarjeta).getAllByTestId("historial-entrada")).toHaveLength(1);
		await fireEvent.click(within(tarjeta).getByRole("button", { name: "Ver 1 más" }));
		expect(within(tarjeta).getAllByTestId("historial-entrada")).toHaveLength(2);
		expect(tarjeta.textContent).toContain("Rechazada por Marta Quispe el 18 de octubre de 2026");
		expect(tarjeta.textContent).toContain("Motivo del rechazo: Falta la licencia.");
		const resumen = screen.getByText("Resumen");
		expect(
			resumen.compareDocumentPosition(tarjeta) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("sin filas no hay tarjeta", async () => {
		auth.setUser(makeUser());
		mocks.historyRequests.mockResolvedValue([]);

		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		await waitFor(() => expect(mocks.historyRequests).toHaveBeenCalled());

		expect(screen.queryByTestId("historial-solicitudes")).toBeNull();
	});

	it("anónimo: no pide el historial y no hay tarjeta", async () => {
		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		await waitFor(() => expect(mocks.listRequests).toHaveBeenCalled());

		expect(mocks.historyRequests).not.toHaveBeenCalled();
		expect(screen.queryByTestId("historial-solicitudes")).toBeNull();
	});

	it("si la consulta falla la ficha sigue entera y no muestra la tarjeta", async () => {
		auth.setUser(makeUser());
		mocks.historyRequests.mockRejectedValue(new CkanApiError("Server Error", 500));

		render(DatasetPage);

		expect(await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" })).toBeTruthy();
		await waitFor(() => expect(mocks.historyRequests).toHaveBeenCalled());
		expect(screen.queryByTestId("historial-solicitudes")).toBeNull();
	});

	it("orden «Propuesta» de la columna: solicitud, Resumen, Organización, Citar como y el historial al final", async () => {
		// S18 de `odd/tasks/prototype-presentation.md`: el autor aprobó el orden de `/dev/dataset-panel`.
		auth.setUser(makeUser());
		mocks.showDataset.mockResolvedValue(
			makeDataset({ owner_org: "org-1", private: true, organization: makeOrganization() }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		const pendiente = makeRow({ status: "pending" });
		mocks.listRequests.mockResolvedValue([pendiente]);
		mocks.historyRequests.mockResolvedValue([pendiente]);

		render(DatasetPage);

		const tarjeta = await screen.findByTestId("historial-solicitudes");
		await screen.findByTestId("estado-solicitud");
		const aside = tarjeta.closest("aside") as HTMLElement;
		expect(
			Array.from(aside.children).map((c) => c.querySelector("p")?.textContent?.trim()),
		).toEqual(["Solicitud de publicación", "Resumen", "Organización", "Citar como", HISTORIAL]);
	});

	it("convive con la tarjeta de la solicitud vigente sin reemplazarla", async () => {
		auth.setUser(makeUser());
		const pendiente = makeRow({ status: "pending" });
		mocks.listRequests.mockResolvedValue([pendiente]);
		mocks.historyRequests.mockResolvedValue([pendiente]);

		render(DatasetPage);

		expect(await screen.findByTestId("estado-solicitud")).toBeTruthy();
		expect(await screen.findByTestId("historial-solicitudes")).toBeTruthy();
	});
});

// ─── Anclas de sección (v0.1.1, T25 / S24, variante A del autor, L52) ────────────────────────────
// Siete secciones con id y un ícono de enlace junto a su título (visible al pasar el cursor o enfocar; siempre en
// táctil) que copia la URL completa con el fragmento, sin cambiar la URL de la página. Los ids son el destino de
// las filas «Ver…» y de las URL compartidas; el margen de desplazamiento deja la sección bajo el encabezado fijo.
describe("Página de dataset — anclas de sección", () => {
	const SECCIONES: Array<[id: string, titulo: string]> = [
		["summary", "Resumen"],
		["resources", "Recursos"],
		["license", "Términos"],
		["technical-info", "Información técnica"],
		["history", "Historial de solicitudes"],
		["organization", "Organización"],
		["cite", "Citar como"],
	];
	const SCROLL_MT = "scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))]";

	async function renderCompleta() {
		auth.setUser(makeUser());
		mocks.showDataset.mockResolvedValue(
			makeDataset({
				organization: makeOrganization(),
				license_id: "cc-by",
				license_title: "CC BY — Atribución",
				license_url: "https://creativecommons.org/licenses/by/4.0/deed.es",
			}),
		);
		mocks.historyRequests.mockResolvedValue([makeRow({ id: "r1", status: "cancelled" })]);
		render(DatasetPage);
		await screen.findByTestId("historial-solicitudes");
	}

	it.each(
		SECCIONES,
	)("#%s existe y deja el título bajo el encabezado fijo (scroll-margin)", async (id) => {
		await renderCompleta();

		const seccion = document.getElementById(id) as HTMLElement;
		expect(seccion).not.toBeNull();
		expect(seccion.className).toContain(SCROLL_MT);
		// El margen usa el aire compartido: ni 1rem ni 17px sueltos.
		expect(seccion.className).not.toMatch(/\+(1rem|17px)\)/);
	});

	it.each(
		SECCIONES,
	)("#%s lleva un ícono de enlace que copia la URL completa con su fragmento", async (id, titulo) => {
		await renderCompleta();

		const boton = within(document.getElementById(id) as HTMLElement).getByRole("button", {
			name: `Copiar enlace a la sección ${titulo}`,
		});
		await fireEvent.click(boton);
		await waitFor(() =>
			expect(mocks.copyToClipboard).toHaveBeenCalledWith(`http://localhost${DATASET_PATH}#${id}`),
		);
		// Copiar no navega ni escribe la URL de la página.
		expect(goto).not.toHaveBeenCalled();
		expect(window.location.hash).toBe("");
	});

	// Variante «Unificado» de `/dev/dataset-panel` (S18 de `odd/tasks/prototype-presentation.md`): antes el
	// botón iba junto al `h2` y aparecía sólo al pasar por el título (`group-hover/ancla`); ahora va junto a la
	// línea en mayúsculas de la tarjeta, como a la derecha, y aparece con toda la tarjeta.
	it.each([
		["resources", "Recursos"],
		["technical-info", "Información técnica"],
	])("#%s: el ícono va junto a la línea del título y aparece al pasar o enfocar en toda la tarjeta; siempre en táctil", async (id, titulo) => {
		await renderCompleta();

		const tarjeta = document.getElementById(id) as HTMLElement;
		expect(tarjeta.className).toContain("group/tarjeta");
		const boton = within(tarjeta).getByRole("button", {
			name: `Copiar enlace a la sección ${titulo}`,
		});
		expect(boton.textContent?.trim()).toBe("");
		expect(boton.parentElement?.querySelector("p")?.textContent?.trim()).toBe(titulo);
		expect(boton.parentElement?.querySelector("h2")).toBeNull();
		expect(boton.className).toContain("opacity-0");
		expect(boton.className).toContain("group-hover/tarjeta:opacity-100");
		expect(boton.className).toContain("group-focus-within/tarjeta:opacity-100");
		expect(boton.className).toContain("focus-visible:opacity-100");
		expect(boton.className).toContain("[@media(hover:none)]:opacity-100");
		expect(boton.className).toContain("motion-reduce:transition-none");
	});

	it("la URL copiada conserva la consulta de la página", async () => {
		pageStore.set({
			params: { id: "matricula-2026" },
			url: new URL(`http://localhost${DATASET_PATH}?from=search`),
		});
		await renderCompleta();

		await fireEvent.click(
			screen.getByRole("button", { name: "Copiar enlace a la sección Citar como" }),
		);
		await waitFor(() =>
			expect(mocks.copyToClipboard).toHaveBeenCalledWith(
				`http://localhost${DATASET_PATH}?from=search#cite`,
			),
		);
	});

	it.each([
		["#resumen", "summary"],
		["#recursos", "resources"],
		["#licencia", "license"],
		["#info-tecnica", "technical-info"],
		["#historial", "history"],
		["#organizacion", "organization"],
		["#citar", "cite"],
	])("un enlace viejo %s baja a la sección y reescribe la URL a #%s", async (old, id) => {
		window.history.replaceState(null, "", old);
		vi.mocked(replaceState).mockClear();
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		try {
			await renderCompleta();

			await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
			expect((scroll.mock.contexts[0] as HTMLElement).id).toBe(id);
			expect((vi.mocked(replaceState).mock.calls[0]?.[0] as URL).hash).toBe(`#${id}`);
		} finally {
			Reflect.deleteProperty(Element.prototype, "scrollIntoView");
			window.history.replaceState(null, "", window.location.pathname);
		}
	});

	it.each([
		"summary",
		"resources",
		"license",
		"technical-info",
		"history",
		"organization",
		"cite",
	])("un enlace directo #%s baja a la sección cuando ya existe, sin reescribir la URL", async (id) => {
		window.history.replaceState(null, "", `#${id}`);
		vi.mocked(replaceState).mockClear();
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		try {
			await renderCompleta();

			await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
			expect((scroll.mock.contexts[0] as HTMLElement).id).toBe(id);
			expect(replaceState).not.toHaveBeenCalled();
		} finally {
			Reflect.deleteProperty(Element.prototype, "scrollIntoView");
			window.history.replaceState(null, "", window.location.pathname);
		}
	});

	it("tras bajar al enlace, un desplazamiento posterior de la persona no se pisa", async () => {
		window.history.replaceState(null, "", "#technical-info");
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		try {
			await renderCompleta();
			await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));

			mocks.historyRequests.mockResolvedValue([makeRow({ id: "r2", status: "rejected" })]);
			await fireEvent.keyDown(document.body, { key: "End" });
			await new Promise((r) => setTimeout(r, 50));
			expect(scroll).toHaveBeenCalledTimes(1);
		} finally {
			Reflect.deleteProperty(Element.prototype, "scrollIntoView");
			window.history.replaceState(null, "", window.location.pathname);
		}
	});

	it("con movimiento reducido el salto es instantáneo", async () => {
		window.history.replaceState(null, "", "#technical-info");
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		const mm = window.matchMedia;
		window.matchMedia = ((q: string) => ({ ...mm(q), matches: true })) as typeof window.matchMedia;
		try {
			await renderCompleta();
			await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
			expect(scroll.mock.calls[0][0]).toMatchObject({ block: "start", behavior: "instant" });
		} finally {
			window.matchMedia = mm;
			Reflect.deleteProperty(Element.prototype, "scrollIntoView");
			window.history.replaceState(null, "", window.location.pathname);
		}
	});

	it("un enlace en inglés no se reescribe", async () => {
		window.history.replaceState(null, "", "#history");
		vi.mocked(replaceState).mockClear();
		try {
			await renderCompleta();
			expect(replaceState).not.toHaveBeenCalled();
		} finally {
			window.history.replaceState(null, "", window.location.pathname);
		}
	});

	it("las filas «Ver…» siguen apuntando a un id que existe", async () => {
		await renderCompleta();

		const link = screen.getByRole("link", { name: "Ver la información técnica" });
		expect(link).toHaveAttribute("href", "#technical-info");
		expect(document.getElementById("technical-info")).not.toBeNull();
	});

	it("sin organización o sin historial esas secciones no existen (no hay ids huérfanos)", async () => {
		mocks.showDataset.mockResolvedValue(makeDataset());
		render(DatasetPage);
		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });

		expect(document.getElementById("organization")).toBeNull();
		expect(document.getElementById("history")).toBeNull();
	});
});
