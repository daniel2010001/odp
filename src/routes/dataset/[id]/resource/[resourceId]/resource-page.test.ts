import { render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { sessionExpiredLoginUrl } from "$lib/session";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage, CkanResource, CkanUser } from "$lib/types/ckan";
import ResourcePage from "./+page.svelte";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el
// tipo real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	showResource: vi.fn(),
	showDataset: vi.fn(),
	search: vi.fn(),
	check: vi.fn(),
}));

vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/client", () => ({ createCkanClient: () => ({}) }));
vi.mock("$lib/api/resources", () => ({
	createResourceApi: () => ({ show: mocks.showResource }),
}));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ show: mocks.showDataset }),
}));
vi.mock("$lib/api/datastore", () => ({
	createDatastoreApi: () => ({ search: mocks.search }),
}));
// La sonda de sesión se inyecta como mock: la decisión `resolveUnauthorized` que la usa sigue
// siendo la real, así que la expulsión y su orden se miden de verdad.
vi.mock("$lib/api/session", () => ({
	createSessionApi: () => ({ check: mocks.check }),
}));

const RESOURCE_PATH = "/dataset/matricula-2026/resource/res-1";
const SHOWCASE_PATH = "/dataset/showcase-observatorio-movilidad/resource/res-showcase-1";
// Sin sesión, un 403 y un 404 rinden el mismo estado: mismo rótulo, misma oración, ninguna acción.
const NOT_FOUND_TITLE = "Recurso no encontrado";
const AMBIGUOUS_MESSAGE = "No se encontró el recurso solicitado, o no tiene permiso para verlo.";

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

function makeResource(overrides: Partial<CkanResource> = {}): CkanResource {
	return {
		id: "res-1",
		package_id: "pkg-1",
		name: "Matrícula 2026",
		format: "PDF",
		url: "https://datos.umss.edu/matricula-2026.pdf",
		resource_type: "file",
		mimetype: "application/pdf",
		size: 1024,
		created: "2026-01-01T00:00:00.000000",
		last_modified: "2026-01-01T00:00:00.000000",
		state: "active",
		position: 0,
		...overrides,
	};
}

function makeDataset(): CkanPackage {
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
	};
}

function setParams(params: Record<string, string>, path = RESOURCE_PATH) {
	pageStore.set({ params, url: new URL(`http://localhost${path}`) });
}

/** Todos los `href` renderizados en la página. */
function renderedHrefs(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll("a[href]")).map(
		(anchor) => anchor.getAttribute("href") ?? "",
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
	setParams({ id: "matricula-2026", resourceId: "res-1" });
	mocks.showResource.mockResolvedValue(makeResource());
	mocks.showDataset.mockResolvedValue(makeDataset());
	mocks.search.mockResolvedValue({ fields: [], records: [], total: 0 });
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

describe("Página de recurso — enlaces externos", () => {
	it("renderiza el enlace de descarga cuando la URL del recurso es http/https", async () => {
		const { container } = render(ResourcePage);

		const download = await screen.findByRole("link", { name: /Descargar recurso/i });
		expect(download.getAttribute("href")).toBe("https://datos.umss.edu/matricula-2026.pdf");
		expect(renderedHrefs(container)).toContain("https://datos.umss.edu/matricula-2026.pdf");
	});

	it("no renderiza un href javascript: guardado en la URL del recurso", async () => {
		mocks.showResource.mockResolvedValue(
			makeResource({ url: "javascript:alert(document.cookie)" }),
		);

		const { container } = render(ResourcePage);
		await waitFor(() => expect(mocks.showResource).toHaveBeenCalled());

		expect(container.querySelector("h1")).toBeTruthy();
		expect(renderedHrefs(container).some((href) => href.startsWith("javascript:"))).toBe(false);
		expect(screen.queryByRole("link", { name: /Descargar recurso/i })).toBeNull();
	});

	it("no renderiza un href javascript: guardado en el extra docs_url", async () => {
		mocks.showResource.mockResolvedValue(
			makeResource({
				resource_type: "api",
				extras: [
					{ key: "api_base_url", value: "https://datos.umss.edu/api" },
					{ key: "docs_url", value: "javascript:alert(document.cookie)" },
				],
			}),
		);

		const { container } = render(ResourcePage);
		await waitFor(() => expect(mocks.showResource).toHaveBeenCalled());

		expect(renderedHrefs(container).some((href) => href.startsWith("javascript:"))).toBe(false);
		expect(screen.queryByRole("link", { name: /Ver documentación de la API/i })).toBeNull();
	});
});

describe("Página de recurso — estados de fallo honestos", () => {
	it("ante un 403 anónimo renderiza el mismo estado que un 404, sin inicio de sesión ni reintento", async () => {
		mocks.showResource.mockRejectedValue(new CkanApiError("Access denied", 403));

		const { unmount } = render(ResourcePage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.getByText(NOT_FOUND_TITLE)).toBeTruthy();
		// El estado de error no ofrece inicio de sesión: ese botón delataría que el recurso existe. El
		// camino al login vive en el encabezado, que no lleva información sobre el recurso solicitado.
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();

		unmount();

		// La propiedad de carga: el 404 rinde exactamente el mismo estado, sin filtrar la existencia.
		mocks.showResource.mockRejectedValue(new CkanApiError("Not Found", 404));
		render(ResourcePage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.getByText(NOT_FOUND_TITLE)).toBeTruthy();
		expect(screen.queryByText(/privad/i)).toBeNull();
	});

	it("ante un 403 con sesión viva dice que la cuenta no está autorizada, sin pedir iniciar sesión ni ofrecer reintento", async () => {
		auth.login("tok-123", baseUser);
		mocks.check.mockResolvedValue({ state: "alive", user: baseUser });
		mocks.showResource.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(ResourcePage);

		await screen.findByText(/su cuenta no está autorizada para ver este recurso/i);
		expect(screen.queryByText(/inicie sesión/i)).toBeNull();
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
	});

	it("ante un 403 con sonda no concluyente no afirma ninguna causa y ofrece reintentar", async () => {
		auth.login("tok-123", baseUser);
		mocks.check.mockResolvedValue({ state: "inconclusive", error: new CkanApiError("x", 500) });
		mocks.showResource.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(ResourcePage);

		await screen.findByText(/puede que su sesión ya no sea válida/i);
		expect(screen.getByText("No se pudo confirmar el acceso")).toBeTruthy();
		// Subjuntivo («no esté autorizada») como posibilidad, no como hecho.
		expect(screen.queryByText(/no está autorizada/i)).toBeNull();
		expect(screen.getByRole("button", { name: /Reintentar/i })).toBeTruthy();
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
	});

	it("ante una sesión muerta expulsa al login con el motivo y no renderiza estado de fallo", async () => {
		auth.login("tok-123", baseUser);
		mocks.check.mockResolvedValue({ state: "dead" });
		mocks.showResource.mockRejectedValue(new CkanApiError("Access denied", 403));

		const { container } = render(ResourcePage);

		await waitFor(() => expect(goto).toHaveBeenCalledTimes(1));
		expect(vi.mocked(goto).mock.calls[0][0]).toBe(sessionExpiredLoginUrl(RESOURCE_PATH));
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
		auth.login("tok-123", baseUser);
		mocks.check.mockResolvedValue({ state: "dead" });
		mocks.showResource.mockRejectedValue(new CkanApiError("Access denied", 403));
		vi.mocked(goto).mockRejectedValueOnce(new Error("navigation failed"));

		const { container } = render(ResourcePage);

		await screen.findByText("No se pudo confirmar el acceso");
		expect(screen.getByText(/puede que su sesión ya no sea válida/i)).toBeTruthy();
		expect(screen.queryByText(/no está autorizada/i)).toBeNull();
		expect(screen.getByRole("button", { name: /Reintentar/i })).toBeTruthy();
		expect(container.querySelector(".animate-pulse")).toBeNull();
		expect(vi.mocked(goto).mock.calls[0][0]).toBe(sessionExpiredLoginUrl(RESOURCE_PATH));
	});

	it("ante un 404 muestra el estado no encontrado sin reintento ni inicio de sesión", async () => {
		mocks.showResource.mockRejectedValue(new CkanApiError("Not Found", 404));

		render(ResourcePage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.getByText(NOT_FOUND_TITLE)).toBeTruthy();
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
	});

	it("ante un catálogo inalcanzable informa el fallo de la consulta y ofrece reintentar, sin decir que falta o es privado", async () => {
		vi.stubEnv("DEV", true);
		mocks.showResource.mockRejectedValue(new CkanApiError("Server Error", 500));

		render(ResourcePage);

		await screen.findByText(/no se pudo completar la consulta al catálogo de datos/i);
		// Un 5xx es una respuesta del catálogo: el texto no puede culpar a la conexión.
		expect(screen.queryByText(/conectar|conexión/i)).toBeNull();
		expect(screen.queryByText(/no encontrado|privado/i)).toBeNull();
		expect(screen.getByRole("button", { name: /Reintentar/i })).toBeTruthy();
	});

	it("en DEV, un fallo no definitivo todavía puede enmascararse con datos mock", async () => {
		vi.stubEnv("DEV", true);
		setParams(
			{ id: "showcase-observatorio-movilidad", resourceId: "res-showcase-1" },
			SHOWCASE_PATH,
		);
		mocks.showResource.mockRejectedValue(new TypeError("Failed to fetch"));

		render(ResourcePage);

		await screen.findByRole("heading", { name: /Flujos vehiculares/i });
	});

	it("en DEV, un 403 definitivo nunca se enmascara con el mock aunque el id exista", async () => {
		vi.stubEnv("DEV", true);
		setParams(
			{ id: "showcase-observatorio-movilidad", resourceId: "res-showcase-1" },
			SHOWCASE_PATH,
		);
		mocks.showResource.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(ResourcePage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.queryByText(/Flujos vehiculares/i)).toBeNull();
	});

	it("en DEV, un 404 definitivo tampoco se enmascara con el mock aunque el id exista", async () => {
		vi.stubEnv("DEV", true);
		setParams(
			{ id: "showcase-observatorio-movilidad", resourceId: "res-showcase-1" },
			SHOWCASE_PATH,
		);
		mocks.showResource.mockRejectedValue(new CkanApiError("Not Found", 404));

		render(ResourcePage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		expect(screen.queryByText(/Flujos vehiculares/i)).toBeNull();
	});

	it("el título del documento refleja el fallo y no siempre dice «Cargando...»", async () => {
		mocks.showResource.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(ResourcePage);

		await screen.findByText(AMBIGUOUS_MESSAGE);
		await waitFor(() => expect(document.title).toBe("Recurso no encontrado — UMSS"));
	});

	it("con un segmento de ruta vacío muestra su propio estado, sin reintento ni inicio de sesión", async () => {
		setParams({ id: "matricula-2026", resourceId: "" }, "/dataset/matricula-2026/resource/");

		render(ResourcePage);

		await screen.findByText(/parámetros de navegación inválidos/i);
		expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeNull();
		expect(screen.queryByRole("link", { name: /Iniciar sesión/i })).toBeNull();
		expect(screen.getByRole("link", { name: /Volver al dataset/i })).toBeTruthy();
		expect(mocks.showResource).not.toHaveBeenCalled();
	});
});

// ─── El tipo de recurso en el encabezado (block C, C1) ───────────────
// El chip del encabezado es exclusivo: un archivo alojado (`url_type: "upload"`) muestra su formato,
// una referencia externa muestra «Enlace» y deja de mostrar el formato. La aserción de ausencia del
// formato en un enlace es la decisión, no un detalle: un enlace es un enlace y no conserva el chip
// de formato. Las aserciones se acotan a la fila de insignias del encabezado, porque el formato
// declarado sigue presente en la fila de metadatos (que es otra superficie).
describe("Página de recurso — el tipo de recurso en el encabezado", () => {
	async function renderHeader(): Promise<HTMLElement> {
		render(ResourcePage);
		const heading = await screen.findByRole("heading", { level: 1, name: /Matrícula 2026/i });
		const header = heading.closest("section");
		expect(header).toBeTruthy();
		return header as HTMLElement;
	}

	it('un recurso alojado (`url_type: "upload"`) muestra su formato y nunca «Enlace»', async () => {
		mocks.showResource.mockResolvedValue(makeResource({ url_type: "upload", format: "CSV" }));

		const header = await renderHeader();

		expect(within(header).getByText("CSV")).toBeTruthy();
		expect(within(header).queryByText("Enlace")).toBeNull();
	});

	it("un recurso sin `url_type` (referencia externa) muestra «Enlace» y no el formato", async () => {
		mocks.showResource.mockResolvedValue(makeResource({ format: "CSV" }));

		const header = await renderHeader();

		expect(within(header).getByText("Enlace")).toBeTruthy();
		// La decisión del autor: el chip es exclusivo, así que el formato declarado no se muestra aquí.
		expect(within(header).queryByText("CSV")).toBeNull();

		// El ícono se fue por decisión del autor: sin él, el chip de enlace deja de ser más grande
		// que el de formato. Un `svg` acá sería la regresión silenciosa de esa decisión.
		const linkChip = within(header).getByText("Enlace");
		expect(linkChip.querySelectorAll("svg").length).toBe(0);
	});
});

describe("Página de recurso — el dataset del breadcrumb", () => {
	it("un 403 definitivo del dataset no se enmascara en DEV: el recurso se muestra y el breadcrumb degrada", async () => {
		vi.stubEnv("DEV", true);
		setParams({ id: "showcase-observatorio-movilidad", resourceId: "res-1" }, SHOWCASE_PATH);
		mocks.showDataset.mockRejectedValue(new CkanApiError("Access denied", 403));

		render(ResourcePage);

		await screen.findByRole("heading", { name: /Matrícula 2026/i });
		expect(screen.queryByText(/Observatorio de Movilidad/i)).toBeNull();
	});

	it("un fallo no definitivo del dataset todavía puede caer al mock del breadcrumb en DEV", async () => {
		vi.stubEnv("DEV", true);
		setParams({ id: "showcase-observatorio-movilidad", resourceId: "res-1" }, SHOWCASE_PATH);
		mocks.showDataset.mockRejectedValue(new TypeError("Failed to fetch"));

		render(ResourcePage);

		await screen.findByText(/Observatorio de Movilidad/i);
	});
});
