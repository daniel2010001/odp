import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { sessionExpiredLoginUrl } from "$lib/session";
import { auth, isAuthenticated } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanOrganization, CkanPackage, CkanResource, CkanUser } from "$lib/types/ckan";
import Dashboard from "./+page.svelte";

const mocks = vi.hoisted(() => ({
	currentUser: vi.fn(),
	listForUser: vi.fn(),
	canCreateDataset: vi.fn(),
	sessionCheck: vi.fn(),
}));

vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ currentUser: mocks.currentUser }),
}));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({
		listForUser: mocks.listForUser,
		canCreateDataset: mocks.canCreateDataset,
	}),
}));
// La sonda de sesión se controla por test: su veredicto decide qué se carga y qué se ofrece.
vi.mock("$lib/api/session", () => ({
	createSessionApi: () => ({ check: mocks.sessionCheck }),
}));

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
		name: "Recurso",
		url: "https://datos.umss.edu/recurso.csv",
		created: "2026-01-01T00:00:00.000000",
		last_modified: "2026-01-01T00:00:00.000000",
		state: "active",
		position: 0,
		...overrides,
	};
}

function makePackage(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-estudiantil-2026",
		title: "Matrícula Estudiantil 2026",
		private: true,
		state: "active",
		resources: [makeResource()],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

function makePackages(n: number): CkanPackage[] {
	return Array.from({ length: n }, (_, index) =>
		makePackage({
			id: `pkg-${index + 1}`,
			name: `dataset-${index + 1}`,
			title: `Dataset ${index + 1}`,
		}),
	);
}

function makeOrganization(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-1",
		name: "facultad-de-ciencias",
		title: "Facultad de Ciencias",
		description: "",
		image_url: "",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
	mocks.currentUser.mockResolvedValue({ count: 1, results: [makePackage()] });
	mocks.listForUser.mockResolvedValue([makeOrganization()]);
	// La compuerta del panel pregunta lo mismo que el asistente; por defecto puede crear. Los tests
	// que representan un `member` la pisan con `false`.
	mocks.canCreateDataset.mockResolvedValue(true);
	// Por defecto la sesión vive y el llamador es el usuario autenticado; los tests que necesitan
	// una sesión muerta o inconclusa pisan este veredicto.
	mocks.sessionCheck.mockResolvedValue({ state: "alive", user: baseUser });
});

describe("Dashboard", () => {
	it("redirige a /auth/login sin sesión y no llama a CKAN", async () => {
		render(Dashboard);

		await waitFor(() => expect(goto).toHaveBeenCalledWith("/auth/login"));
		expect(mocks.currentUser).not.toHaveBeenCalled();
		expect(mocks.listForUser).not.toHaveBeenCalled();
		// El guard corta antes de la sonda: sin token no hay nada que sondear.
		expect(mocks.sessionCheck).not.toHaveBeenCalled();
	});

	it("renderiza el saludo con el display_name cuando hay sesión", async () => {
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// La identidad no se dibuja hasta que la sonda resuelve sin declarar la sesión muerta.
		expect(await screen.findByText(/hola, jane doe/i)).toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();
	});

	it("muestra el badge de administrador cuando isSuperAdmin es true", async () => {
		auth.login("tok-123", { ...baseUser, sysadmin: true });
		// La identidad que manda es la que devuelve la sonda `alive`, no la guardada.
		mocks.sessionCheck.mockResolvedValue({
			state: "alive",
			user: { ...baseUser, sysadmin: true },
		});

		render(Dashboard);

		expect(await screen.findByText(/^administrador$/i)).toBeInTheDocument();
	});

	it("consulta «Mis datasets» con el id del usuario autenticado", async () => {
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// El `fq` del creador se construye con este id: si el loader llama a `currentUser()`
		// sin argumento, la consulta deja de medir la identidad y el resto de la suite no lo nota.
		// La paginación viaja como segundo argumento: la primera página empieza en el offset 0.
		await waitFor(() =>
			expect(mocks.currentUser).toHaveBeenCalledWith(baseUser.id, { limit: 20, offset: 0 }),
		);
	});

	it("ofrece el CTA al wizard y lista datasets y organizaciones enlazados", async () => {
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// La acción aparece dos veces por diseño: la tarjeta de la grilla y el botón de la barra
		// pegajosa. Las dos tienen que apuntar al wizard.
		const ctas = await screen.findAllByRole("link", { name: /publicar dataset/i });
		expect(ctas.length).toBeGreaterThan(0);
		for (const cta of ctas) {
			expect(cta).toHaveAttribute("href", "/dashboard/datasets/new");
		}

		const datasetLink = await screen.findByRole("link", {
			name: /matrícula estudiantil 2026/i,
		});
		expect(datasetLink).toHaveAttribute("href", "/dataset/matricula-estudiantil-2026");

		const orgLink = await screen.findByRole("link", { name: /facultad de ciencias/i });
		expect(orgLink).toHaveAttribute("href", "/organization/facultad-de-ciencias");

		expect(screen.getByText(/mis datasets/i)).toBeInTheDocument();
		expect(screen.getByText(/mis organizaciones/i)).toBeInTheDocument();
	});

	it("cada dataset muestra su cantidad de recursos, la fecha de actualización y su visibilidad", async () => {
		mocks.currentUser.mockResolvedValue({
			count: 1,
			results: [
				makePackage({
					resources: [
						makeResource({ id: "r1" }),
						makeResource({ id: "r2" }),
						makeResource({ id: "r3" }),
					],
					metadata_modified: "2026-09-04T00:00:00.000000",
				}),
			],
		});
		auth.login("tok-123", baseUser);

		render(Dashboard);

		const fila = await screen.findByRole("link", { name: /matrícula estudiantil 2026/i });
		expect(fila).toHaveTextContent(/3 recursos/);
		expect(fila).toHaveTextContent(/actualizado el/i);
		expect(fila).toHaveTextContent(/privado/i);
	});

	it("cada organización muestra su sigla, su cantidad de datasets y el rol del usuario", async () => {
		mocks.listForUser.mockResolvedValue([
			makeOrganization({
				capacity: "editor",
				package_count: 5,
				extras: [{ key: "sigla", value: "FCyT" }],
			}),
		]);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		const fila = await screen.findByRole("link", { name: /facultad de ciencias/i });
		expect(fila).toHaveTextContent("FCyT");
		expect(fila).toHaveTextContent(/5 datasets/);
		expect(fila).toHaveTextContent(/editor/i);
	});

	it("sin sigla declarada, el mosaico cae al monograma derivado del nombre", async () => {
		mocks.listForUser.mockResolvedValue([makeOrganization({ extras: [] })]);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		const fila = await screen.findByRole("link", { name: /facultad de ciencias/i });
		expect(fila).toHaveTextContent("FC");
	});

	it("la barra de acciones arranca oculta", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Dashboard);

		// La barra sólo existe cuando hay al menos una acción (organización cargada): hay que esperar a
		// que la carga termine para poder observarla.
		await waitFor(() => expect(container.querySelector("[data-sticky-actions]")).not.toBeNull());
		const barra = container.querySelector("[data-sticky-actions]");
		// El estado oculto es la clase de opacidad del contenedor. El `inert` (que además la saca del
		// orden de tabulación) **no** se puede afirmar acá: jsdom no implementa `inert`. Ese
		// comportamiento se verificó en un navegador real, no en esta suite.
		expect(barra?.parentElement?.className).toContain("opacity-0");
	});

	it("sin organizaciones no ofrece publicar en ninguna superficie (D3)", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		mocks.listForUser.mockResolvedValue([]);
		mocks.canCreateDataset.mockResolvedValue(false);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/publique su primer dataset/i);
		await screen.findByText(/aún no pertenece a ninguna organización/i);

		// D3: sin organización la oferta no se puede cumplir (el wizard fallaría), así que desaparece
		// de todas las superficies: ni CTA, ni grilla de acciones, ni encabezado «Acciones», ni barra.
		expect(screen.queryByRole("link", { name: /publicar dataset/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: /acciones/i })).not.toBeInTheDocument();
	});

	it("muestra error con reintento en una sección y mantiene visible la otra", async () => {
		mocks.listForUser
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce([makeOrganization()]);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// Los datasets cargan bien aun cuando las organizaciones fallan.
		await screen.findByRole("link", { name: /matrícula estudiantil 2026/i });
		await screen.findByText(/no se pudieron cargar sus organizaciones/i);

		await fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
		await screen.findByRole("link", { name: /facultad de ciencias/i });
	});
});

describe("Sonda de sesión (D2)", () => {
	it("dead: limpia la sesión y navega al login sin cargar nada", async () => {
		mocks.sessionCheck.mockResolvedValue({ state: "dead" });
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await waitFor(() => expect(goto).toHaveBeenCalledTimes(1));
		// La sesión guardada se limpia **antes** de navegar: el guard de `/auth/login` reenvía al
		// dashboard a quien todavía tiene un token, así que el orden inverso produciría un bucle.
		expect(goto).toHaveBeenCalledWith(sessionExpiredLoginUrl("/dashboard"));
		// El destino viaja en la URL: el motivo (`expired`) y la vuelta codificada (`returnTo`).
		const destino = vi.mocked(goto).mock.calls[0][0] as string;
		expect(destino).toContain("expired=1");
		expect(destino).toContain("returnTo=%2Fdashboard");
		// Y no se cargó nada: la sesión caída no debe producir ni una consulta.
		expect(mocks.currentUser).not.toHaveBeenCalled();
		expect(mocks.listForUser).not.toHaveBeenCalled();
		expect(mocks.canCreateDataset).not.toHaveBeenCalled();
		expect(get(isAuthenticated)).toBe(false);
		expect(localStorage.getItem("auth")).toBeNull();
	});

	it("dead: no renderiza la identidad de la sesión guardada", async () => {
		mocks.sessionCheck.mockResolvedValue({ state: "dead" });
		auth.login("tok-123", { ...baseUser, sysadmin: true });

		render(Dashboard);

		await waitFor(() => expect(goto).toHaveBeenCalledTimes(1));
		// El saludo y el badge salen de la sesión guardada: no pueden dibujarse mientras no se sepa que
		// la sesión no está muerta, y acá CKAN ya dijo que lo está.
		expect(screen.queryByText(/hola,/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/^administrador$/i)).not.toBeInTheDocument();
		// Y ningún dato derivado de la sesión muerta.
		expect(
			screen.queryByRole("link", { name: /matrícula estudiantil 2026/i }),
		).not.toBeInTheDocument();
		expect(mocks.currentUser).not.toHaveBeenCalled();
	});

	it("inconclusive: carga las dos secciones y no expulsa ni navega", async () => {
		mocks.sessionCheck.mockResolvedValue({
			state: "inconclusive",
			error: new CkanApiError("Server Error", 500),
		});
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// Un hipo de CKAN no puede dejar al usuario sin panel: se carga con la sesión guardada.
		await waitFor(() => expect(mocks.currentUser).toHaveBeenCalledTimes(1));
		expect(mocks.listForUser).toHaveBeenCalledTimes(1);
		expect(goto).not.toHaveBeenCalled();
		expect(get(isAuthenticated)).toBe(true);
	});

	it("alive: el llamador de la sonda reemplaza al usuario guardado obsoleto", async () => {
		auth.login("tok-123", { ...baseUser, display_name: "Obsoleto" });
		mocks.sessionCheck.mockResolvedValue({
			state: "alive",
			user: { ...baseUser, display_name: "Jane Doe" },
		});

		render(Dashboard);

		// `$currentUser` sigue siendo la única fuente de identidad, y ahora refleja al llamador real.
		expect(await screen.findByText(/hola, jane doe/i)).toBeInTheDocument();
		await waitFor(() => expect(mocks.currentUser).toHaveBeenCalledTimes(1));
	});

	it("token sin identidad: mismo camino de expiración y sin un segundo mensaje", async () => {
		mocks.sessionCheck.mockResolvedValue({
			state: "inconclusive",
			error: new CkanApiError("Server Error", 500),
		});
		// Sesión local corrupta: hay token pero ningún id de usuario utilizable.
		auth.login("tok-123", { ...baseUser, id: "" });

		render(Dashboard);

		await waitFor(() => expect(goto).toHaveBeenCalledTimes(1));
		expect(goto).toHaveBeenCalledWith(sessionExpiredLoginUrl("/dashboard"));
		// Una sola condición, un solo mensaje: el diagnóstico viejo ya no existe.
		expect(
			screen.queryByText(/no se pudo identificar al usuario autenticado/i),
		).not.toBeInTheDocument();
		expect(mocks.currentUser).not.toHaveBeenCalled();
		expect(get(isAuthenticated)).toBe(false);
	});
});

describe("Oferta de publicación (D3)", () => {
	it("con una organización vuelven la grilla y el CTA del estado vacío", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		mocks.listForUser.mockResolvedValue([makeOrganization()]);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		const acciones = await screen.findByRole("region", { name: /acciones/i });
		// La sección de acciones tiene dos superficies (la tarjeta de la grilla y el botón de la barra
		// pegajosa); las dos apuntan al wizard.
		const enlacesDeAccion = within(acciones).getAllByRole("link", { name: /publicar dataset/i });
		expect(enlacesDeAccion.length).toBeGreaterThan(0);
		for (const enlace of enlacesDeAccion) {
			expect(enlace).toHaveAttribute("href", "/dashboard/datasets/new");
		}

		const misDatasets = await screen.findByRole("region", { name: /mis datasets/i });
		expect(within(misDatasets).getByRole("link", { name: /publicar dataset/i })).toHaveAttribute(
			"href",
			"/dashboard/datasets/new",
		);
	});

	it("no ofrece publicar a un `member`: pertenece pero no puede crear (D3)", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		mocks.listForUser.mockResolvedValue([makeOrganization({ capacity: "member" })]);
		mocks.canCreateDataset.mockResolvedValue(false);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// La tarjeta «Mis organizaciones» sigue listando la membresía con su rol: eso es lo que promete.
		expect(await screen.findByRole("link", { name: /facultad de ciencias/i })).toBeInTheDocument();
		// Pero ninguna superficie ofrece publicar, porque el backend no podría cumplirlo.
		await screen.findByText(/requiere rol de editor o administrador en una organización/i);
		expect(screen.queryByRole("link", { name: /publicar dataset/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: /acciones/i })).not.toBeInTheDocument();
		// La frase de «pertenecer» sería falsa para un miembro: el miembro sí pertenece.
		expect(screen.queryByText(/requiere pertenecer a una organización/i)).not.toBeInTheDocument();
		// La compuerta preguntó lo mismo que el asistente, no la lista amplia de membresías.
		expect(mocks.canCreateDataset).toHaveBeenCalledTimes(1);
	});

	it("si la pregunta de permiso falla, no ofrece nada, no afirma un rol y no borra la membresía", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		mocks.listForUser.mockResolvedValue([makeOrganization({ capacity: "member" })]);
		mocks.canCreateDataset.mockRejectedValue(new Error("boom"));
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// Un fallo de permiso no toca la lista de membresías: la tarjeta la sigue mostrando.
		expect(await screen.findByRole("link", { name: /facultad de ciencias/i })).toBeInTheDocument();
		// Fail closed: sin respuesta no se ofrece publicar y la copia queda neutra.
		await screen.findByText(/aún no ha creado ningún dataset/i);
		expect(screen.queryByText(/requiere pertenecer a una organización/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/requiere rol de editor o administrador/i)).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /publicar dataset/i })).not.toBeInTheDocument();
	});
});

describe("Estado vacío de «Mis datasets»", () => {
	it("con organización disponible muestra la copia base y el CTA", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		mocks.listForUser.mockResolvedValue([makeOrganization()]);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/aún no ha creado ningún dataset/i);
		// Con organización la exigencia no se menciona: la premisa ya está cumplida.
		expect(screen.queryByText(/requiere pertenecer a una organización/i)).not.toBeInTheDocument();
		expect(screen.getAllByRole("link", { name: /publicar dataset/i }).length).toBeGreaterThan(0);
	});

	it("con organizaciones cargadas y vacías exige pertenecer a una y retira el CTA", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		mocks.listForUser.mockResolvedValue([]);
		mocks.canCreateDataset.mockResolvedValue(false);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/requiere pertenecer a una organización/i);
		expect(screen.queryByRole("link", { name: /publicar dataset/i })).not.toBeInTheDocument();
	});

	it("mientras las organizaciones cargan no afirma que haga falta una", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		// Nunca resuelve: las organizaciones quedan en carga de forma indefinida.
		mocks.listForUser.mockReturnValue(new Promise(() => {}));
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/aún no ha creado ningún dataset/i);
		// Corrección sobre el playground: sin saber si el usuario tiene una organización, el estado
		// vacío **no** puede afirmar que publicar la exija.
		expect(screen.queryByText(/requiere pertenecer a una organización/i)).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /publicar dataset/i })).not.toBeInTheDocument();
	});

	it("con la carga de organizaciones fallida no afirma que haga falta una y muestra el error honesto", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		mocks.listForUser.mockRejectedValue(new Error("boom"));
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/aún no ha creado ningún dataset/i);
		// Un fallo deja la pregunta abierta (¿tiene organizaciones o no?), así que el estado vacío
		// conserva la copia neutra y el error es la lectura honesta: no se pudo saber.
		expect(screen.queryByText(/requiere pertenecer a una organización/i)).not.toBeInTheDocument();
		expect(await screen.findByRole("alert")).toHaveTextContent(
			/no se pudieron cargar sus organizaciones/i,
		);
	});
});

describe("Paginación de «Mis datasets»", () => {
	it("el badge muestra el total y no el largo de la página", async () => {
		mocks.currentUser.mockResolvedValue({ count: 137, results: makePackages(20) });
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// Llegan 20 resultados, pero el conjunto tiene 137: el badge describe el conjunto, no la página.
		expect(await screen.findByText("137")).toBeInTheDocument();
		expect(screen.queryByText("20")).not.toBeInTheDocument();
	});

	it("con más de una página, muestra el rango y habilita «siguiente» en la primera página", async () => {
		mocks.currentUser.mockResolvedValue({ count: 137, results: makePackages(20) });
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/1–20 de 137/);
		expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Página siguiente" })).toBeEnabled();
	});

	it("«siguiente» recarga con offset 20 y el pie pasa al rango de la página 2", async () => {
		mocks.currentUser.mockResolvedValue({ count: 137, results: makePackages(20) });
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/1–20 de 137/);
		await fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

		await waitFor(() =>
			expect(mocks.currentUser).toHaveBeenLastCalledWith(baseUser.id, {
				limit: 20,
				offset: 20,
			}),
		);
		expect(await screen.findByText(/21–40 de 137/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
	});

	it("con una sola página no renderiza controles de paginación", async () => {
		mocks.currentUser.mockResolvedValue({ count: 12, results: makePackages(12) });
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByRole("link", { name: /dataset 12/i });
		expect(screen.queryByRole("button", { name: "Página anterior" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Página siguiente" })).not.toBeInTheDocument();
	});

	it("si el total encoge y deja la página pedida fuera de rango, vuelve a la última válida y recarga", async () => {
		mocks.currentUser
			.mockResolvedValueOnce({ count: 137, results: makePackages(20) })
			// La página 2 ya no existe: el conjunto se redujo a 20 mientras se paginaba.
			.mockResolvedValueOnce({ count: 20, results: [] })
			.mockResolvedValueOnce({ count: 20, results: makePackages(20) });
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/1–20 de 137/);
		await fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

		// Tercera llamada: vuelve al offset 0 (última página válida) en vez de dejar la lista vacía
		// con un rango que se ve legítimo.
		await waitFor(() => expect(mocks.currentUser).toHaveBeenCalledTimes(3));
		expect(mocks.currentUser).toHaveBeenNthCalledWith(3, baseUser.id, { limit: 20, offset: 0 });
		expect(await screen.findByText("20")).toBeInTheDocument();
		expect(screen.queryByText(/de 137/)).not.toBeInTheDocument();
	});

	it("con un error a la vista no queda ni control ni rango: el pie describiría filas que no se muestran", async () => {
		mocks.currentUser
			.mockResolvedValueOnce({ count: 137, results: makePackages(20) })
			.mockRejectedValueOnce(new Error("boom"));
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/1–20 de 137/);
		await fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

		// El `catch` limpia la lista pero conserva `totalDatasets = 137`: sin la guarda, el pie
		// seguiría anunciando «21–40 de 137» al lado de un panel que dice que no se pudo cargar nada.
		await screen.findByRole("alert");
		expect(screen.queryByRole("button", { name: "Página siguiente" })).not.toBeInTheDocument();
		expect(screen.queryByText(/de 137/)).not.toBeInTheDocument();
	});

	it("en la última página deshabilita «siguiente» y muestra el rango final", async () => {
		mocks.currentUser.mockResolvedValue({ count: 137, results: makePackages(20) });
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/1–20 de 137/);
		for (let p = 2; p <= 7; p += 1) {
			await fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
			await waitFor(() =>
				expect(mocks.currentUser).toHaveBeenLastCalledWith(baseUser.id, {
					limit: 20,
					offset: (p - 1) * 20,
				}),
			);
		}

		// El esqueleto de carga tiene `role="status"`: esperar a que desaparezca es lo que
		// distingue «está deshabilitado porque es la última página» de «está deshabilitado
		// porque todavía está cargando». Sin esto, la aserción pasaría por el motivo equivocado.
		await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
		expect(await screen.findByText(/121–137 de 137/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();

		// El borde se lee en el atributo, no en la ausencia de llamada: `fireEvent.click` despacha el
		// evento directo al elemento y **no** respeta `disabled` (jsdom no aplica ahí la activation
		// behavior del navegador), así que el manejador corre igual y los fetch extra aparecen. El
		// contraste importa: con `pagina * PAGE_SIZE > totalDatasets` en vez de `>=`, en la página 7 el
		// botón quedaría habilitado y esta aserción falla.
		expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
	});
});
