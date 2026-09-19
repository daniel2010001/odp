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
		await waitFor(() => expect(mocks.currentUser).toHaveBeenCalledWith(baseUser.id));
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
