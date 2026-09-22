import { render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { sessionExpiredLoginUrl } from "$lib/session";
import { auth } from "$lib/stores/auth";
import { type ApiClientConfig, CkanApiError } from "$lib/types/api";
import type { CkanPackage, CkanResource, CkanUser } from "$lib/types/ckan";
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
	check: vi.fn(),
}));

// Se mockea en el borde de módulo para que `package_show` nunca dispare HTTP real. `$lib/mock/data`
// devuelve un dataset centinela: si la página cayera al fallback de desarrollo, su título aparecería
// renderizado y el test lo detecta.
vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/client", () => ({ createCkanClient: mocks.createCkanClient }));
vi.mock("$lib/api/datasets", () => ({ createDatasetApi: () => ({ show: mocks.showDataset }) }));
vi.mock("$lib/mock/data", () => ({ getMockDatasetById: mocks.getMockDatasetById }));
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

function makeUser(): CkanUser {
	return {
		id: "user-1",
		name: "dueno",
		display_name: "Dueño",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
	};
}

function makeDataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
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

function setParams(params: Record<string, string>, path = DATASET_PATH) {
	pageStore.set({ params, url: new URL(`http://localhost${path}`) });
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
	setParams({ id: "matricula-2026" });
	mocks.createCkanClient.mockReturnValue({});
	mocks.showDataset.mockResolvedValue(makeDataset());
	mocks.getMockDatasetById.mockReturnValue(
		makeDataset({ id: "mock-0", name: "mock-0", title: MOCK_TITLE }),
	);
	// Sonda por defecto no concluyente: sólo los tests de sesión viva/muerta la cambian.
	mocks.check.mockResolvedValue({
		state: "inconclusive",
		error: new CkanApiError("Server Error", 500),
	});
});

afterEach(() => {
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
	});
});
