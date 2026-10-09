import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import type { PublicationRequest } from "$lib/api/publication";
import { sessionExpiredLoginUrl } from "$lib/session";
import { auth } from "$lib/stores/auth";
import { type ApiClientConfig, CkanApiError } from "$lib/types/api";
import type { CkanOrganization, CkanPackage, CkanResource, CkanUser } from "$lib/types/ckan";
import DatasetPage from "./+page.svelte";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el
// tipo real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	createCkanClient: vi.fn<(config: ApiClientConfig) => object>(),
	showDataset: vi.fn(),
	getMockDatasetById: vi.fn(),
	listUpdatableOrganizationIds: vi.fn(),
	check: vi.fn(),
	copyToClipboard: vi.fn(),
	// Las tres acciones de publicación, que la ficha consume desde `B1`: la lista alimenta la tarjeta
	// del estado y las otras dos son las que los controles llaman.
	listRequests: vi.fn(),
	requestPublication: vi.fn(),
	cancelRequest: vi.fn(),
}));

// Se mockea en el borde de módulo para que `package_show` nunca dispare HTTP real. `$lib/mock/data`
// devuelve un dataset centinela: si la página cayera al fallback de desarrollo, su título aparecería
// renderizado y el test lo detecta.
vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000" },
}));
vi.mock("$lib/api/client", () => ({ createCkanClient: mocks.createCkanClient }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({
		listUpdatableOrganizationIds: mocks.listUpdatableOrganizationIds,
	}),
}));
vi.mock("$lib/api/publication", () => ({
	createPublicationApi: () => ({
		list: mocks.listRequests,
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
	mocks.createCkanClient.mockReturnValue({});
	mocks.showDataset.mockResolvedValue(makeDataset());
	// Sin solicitudes, la tarjeta del estado no aparece y el hero no gana la acción de publicación: es
	// el estado por defecto de las pruebas que no hablan de publicación.
	mocks.listRequests.mockResolvedValue([]);
	mocks.getMockDatasetById.mockReturnValue(
		makeDataset({ id: "mock-0", name: "mock-0", title: MOCK_TITLE }),
	);
	// Fail closed: sin respuesta explícita, la página no ofrece editar.
	mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "unknown" });
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

describe("Página de dataset — carga con API key", () => {
	it("crea el cliente CKAN con un apiKey que devuelve el token de la sesión", async () => {
		auth.login("token-de-prueba", makeUser());

		render(DatasetPage);
		await waitFor(() => expect(mocks.createCkanClient).toHaveBeenCalled());

		const config = mocks.createCkanClient.mock.calls[0][0];
		expect(config.apiKey).toBeTypeOf("function");
		expect((config.apiKey as () => string | null)()).toBe("token-de-prueba");
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
		auth.login("tok-123", makeUser());
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
		auth.login("tok-123", makeUser());
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
		auth.login("tok-123", makeUser());
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
		auth.login("tok-123", makeUser());
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

// ─── El reparto de las acciones del hero ──────────────────────────────
// La hoja `/dev/dataset-hero` (variante G) fijó el criterio en vez de una posición fija: **una
// acción va en la fila del título; dos o más van en la fila de las insignias**, alineadas a la
// derecha. Acá copiar enlace siempre está y «Editar» sólo con permiso, así que la misma página
// rinde de dos formas. jsdom no tiene motor de layout: la fila se mide por la relación entre nodos
// —el contenedor común— y la alineación por la clase declarada, no por píxeles.
describe("Página de dataset — el reparto de las acciones del hero (la regla)", () => {
	async function renderHero(): Promise<{ copy: HTMLElement; title: HTMLElement }> {
		render(DatasetPage);

		const copy = await screen.findByRole("button", { name: "Copiar enlace del dataset" });
		const title = screen.getByRole("heading", { level: 1, name: "Matrícula 2026" });
		return { copy, title };
	}

	it("con una sola acción, copiar comparte la fila del título y la columna de texto puede encogerse", async () => {
		// Fail closed por defecto: sin permiso confirmado, la única acción disponible es copiar.
		const { copy, title } = await renderHero();

		expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();

		const columna = title.parentElement as HTMLElement;
		expect(columna.className).toContain("min-w-0");
		expect(columna.className).toContain("flex-1");

		const fila = columna.parentElement as HTMLElement;
		expect(fila.className).toContain("flex");
		expect(fila.contains(copy)).toBe(true);

		// El grupo no empuja al título: es `shrink-0` y hermano de la columna, así que el título se
		// parte dentro de su columna en vez de empujar la acción a una línea propia.
		const grupo = copy.parentElement as HTMLElement;
		expect(grupo.className).toContain("shrink-0");
		expect(grupo.parentElement).toBe(fila);
	});

	it("con dos acciones, copiar y «Editar» bajan a la fila de las insignias y el título queda solo", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ owner_org: "org-1", organization: makeOrganization() }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });

		await renderHero();
		const editar = await screen.findByRole("link", { name: "Editar" });
		// El permiso acaba de cambiar el reparto: la rama de una acción se desmontó, así que **las dos
		// cosas** se vuelven a leer del DOM nuevo —el botón de copiar y el título—. Reusar el título
		// capturado antes del cambio haría que la aserción dependiera de cuándo se resolvió el helper:
		// un nodo desmontado no está contenido en ninguna fila, así que la prueba pasaría o fallaría
		// según los microtasks. Hallazgo `R3-1` de la compuerta `review-e6dab4f3b36e3fdb`.
		const copy = screen.getByRole("button", { name: "Copiar enlace del dataset" });
		const title = screen.getByRole("heading", { level: 1, name: "Matrícula 2026" });

		const grupo = copy.parentElement as HTMLElement;
		expect(grupo).toContainElement(editar);

		// La fila de las insignias aloja las dos cosas: las insignias a la izquierda y las acciones a
		// la derecha (`justify-between`), sin que el título comparta esa fila.
		const fila = grupo.parentElement as HTMLElement;
		expect(fila.className).toContain("justify-between");
		expect(within(fila).getByRole("link", { name: "Facultad de Ciencias" })).toBeTruthy();
		expect(fila.contains(title)).toBe(false);
		expect(title.parentElement).toBe(fila.parentElement);
	});
});

// ─── El acuse de «Copiar enlace» ──────────────────────────────────────
// El ícono cambia, pero un cambio de color no le dice nada a un lector de pantalla: el acuse vive
// en el nombre accesible, que pasa a «Enlace copiado» y vuelve a los 2 s.
describe("Página de dataset — el acuse de «Copiar enlace»", () => {
	it("cambia el nombre accesible a «Enlace copiado» y vuelve a los 2 s, con el ícono como refuerzo", async () => {
		render(DatasetPage);

		const copiar = await screen.findByRole("button", { name: "Copiar enlace del dataset" });
		expect(copiar.querySelector(".lucide-link-2")).not.toBeNull();

		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			await fireEvent.click(copiar);
			expect(mocks.copyToClipboard).toHaveBeenCalledTimes(1);

			const copiado = screen.getByRole("button", { name: "Enlace copiado" });
			expect(copiado.querySelector(".lucide-check")).not.toBeNull();

			await vi.advanceTimersByTimeAsync(2000);
			expect(screen.getByRole("button", { name: "Copiar enlace del dataset" })).toBeTruthy();
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
	/** Una fila con la forma del contrato, para no depender de campos que la tabla no devuelve. */
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

	it("muestra el estado de la solicitud **después** de la información textual", async () => {
		// La dirección trae el **nombre** del dataset y la fila trae su **id**: el filtro tiene que cruzar
		// esos dos mundos, y por eso esta prueba sirve aunque los dos valores sean distintos a propósito.
		setParams({ id: "matricula-2026" });
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-1" })]);
		auth.login("tok-123", makeUser());

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

	it("no muestra la solicitud de **otro** dataset: el filtro es por id, no «alguna fila»", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([makeRow({ dataset_id: "pkg-999" })]);
		auth.login("tok-123", makeUser());

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
		auth.login("tok-123", makeUser());

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
		auth.login("tok-123", makeUser());

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
		auth.login("tok-123", makeUser());

		render(DatasetPage);

		expect(await screen.findByTestId("estado-solicitud")).toHaveTextContent(
			"Pendiente de revisión",
		);
		expect(screen.queryByRole("button", { name: "Solicitar publicación" })).not.toBeInTheDocument();
	});
});

// El flujo de publicación tiene **una sola** compuerta: no hay camino directo, ni siquiera para la
// superadministración. Publicar es siempre pedir, y la decisión se toma en la cola. Estas dos pruebas
// fijan ese contrato para los dos actores que antes se repartían los controles.
describe("Página de dataset — el camino directo ya no se ofrece", () => {
	it("la superadministración tampoco publica en directo: sólo ve la solicitud", async () => {
		mocks.showDataset.mockResolvedValue(
			makeDataset({ id: "pkg-1", owner_org: "org-1", private: true }),
		);
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		mocks.listRequests.mockResolvedValue([]);
		auth.login("tok-123", makeUser({ sysadmin: true }));

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
		auth.login("tok-123", makeUser({ sysadmin: false }));

		render(DatasetPage);

		await screen.findByRole("heading", { level: 1, name: "Matrícula 2026" });
		expect(screen.queryByRole("button", { name: "Publicar dataset" })).not.toBeInTheDocument();
		expect(
			await screen.findByRole("button", { name: "Solicitar publicación" }),
		).toBeInTheDocument();
	});
});
