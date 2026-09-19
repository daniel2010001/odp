import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import type { CkanOrganization, CkanPackage, CkanResource, CkanUser } from "$lib/types/ckan";
import Dashboard from "./+page.svelte";

const mocks = vi.hoisted(() => ({
	currentUser: vi.fn(),
	listForUser: vi.fn(),
}));

vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ currentUser: mocks.currentUser }),
}));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ listForUser: mocks.listForUser }),
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
});

describe("Dashboard", () => {
	it("redirige a /auth/login sin sesión y no llama a CKAN", async () => {
		render(Dashboard);

		await waitFor(() => expect(goto).toHaveBeenCalledWith("/auth/login"));
		expect(mocks.currentUser).not.toHaveBeenCalled();
		expect(mocks.listForUser).not.toHaveBeenCalled();
	});

	it("renderiza el saludo con el display_name cuando hay sesión", () => {
		auth.login("tok-123", baseUser);

		render(Dashboard);

		expect(screen.getByText(/hola, jane doe/i)).toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();
	});

	it("muestra el badge de administrador cuando isSuperAdmin es true", () => {
		auth.login("tok-123", { ...baseUser, sysadmin: true });

		render(Dashboard);

		expect(screen.getByText(/^administrador$/i)).toBeInTheDocument();
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

	it("la barra de acciones arranca oculta", () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Dashboard);

		const barra = container.querySelector("[data-sticky-actions]");
		expect(barra).not.toBeNull();
		// El estado oculto es la clase de opacidad del contenedor. El `inert` (que además la saca del
		// orden de tabulación) **no** se puede afirmar acá: jsdom no implementa `inert`. Ese
		// comportamiento se verificó en un navegador real, no en esta suite.
		expect(barra?.parentElement?.className).toContain("opacity-0");
	});

	it("muestra estados vacíos explícitos cuando ambas listas están vacías", async () => {
		mocks.currentUser.mockResolvedValue({ count: 0, results: [] });
		mocks.listForUser.mockResolvedValue([]);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/publique su primer dataset/i);
		await screen.findByText(/aún no pertenece a ninguna organización/i);

		// El CTA sigue disponible aunque no haya datos que listar.
		const ctas = screen.getAllByRole("link", { name: /publicar dataset/i });
		expect(ctas.length).toBeGreaterThan(0);
		for (const cta of ctas) {
			expect(cta).toHaveAttribute("href", "/dashboard/datasets/new");
		}
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
