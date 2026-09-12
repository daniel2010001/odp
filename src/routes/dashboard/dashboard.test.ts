import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import type { CkanOrganization, CkanPackage, CkanUser } from "$lib/types/ckan";
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

const pkg: CkanPackage = {
	id: "pkg-1",
	name: "matricula-estudiantil-2026",
	title: "Matrícula Estudiantil 2026",
	private: true,
	state: "active",
	resources: [],
	tags: [],
	groups: [],
	extras: [],
	metadata_created: "2026-01-01T00:00:00.000000",
	metadata_modified: "2026-01-01T00:00:00.000000",
};

const org: CkanOrganization = {
	id: "org-1",
	name: "facultad-de-ciencias",
	title: "Facultad de Ciencias",
	description: "",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
};

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
	mocks.currentUser.mockResolvedValue([pkg]);
	mocks.listForUser.mockResolvedValue([org]);
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

		expect(screen.getByText(/administrador/i)).toBeInTheDocument();
	});

	it("ofrece el CTA al wizard y lista datasets y organizaciones enlazados", async () => {
		auth.login("tok-123", baseUser);

		render(Dashboard);

		const cta = await screen.findByRole("link", { name: /publicar dataset/i });
		expect(cta).toHaveAttribute("href", "/dashboard/datasets/new");

		const datasetLink = await screen.findByRole("link", {
			name: /matrícula estudiantil 2026/i,
		});
		expect(datasetLink).toHaveAttribute("href", "/dataset/matricula-estudiantil-2026");

		const orgLink = await screen.findByRole("link", { name: /facultad de ciencias/i });
		expect(orgLink).toHaveAttribute("href", "/organization/facultad-de-ciencias");

		expect(screen.getByText(/mis datasets/i)).toBeInTheDocument();
		expect(screen.getByText(/mis organizaciones/i)).toBeInTheDocument();
	});

	it("muestra estados vacíos explícitos cuando ambas listas están vacías", async () => {
		mocks.currentUser.mockResolvedValue([]);
		mocks.listForUser.mockResolvedValue([]);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		await screen.findByText(/publique su primer dataset/i);
		await screen.findByText(/aún no pertenece a ninguna organización/i);

		// El CTA sigue disponible aunque no haya datos que listar.
		expect(screen.getByRole("link", { name: /publicar dataset/i })).toHaveAttribute(
			"href",
			"/dashboard/datasets/new",
		);
	});

	it("muestra error con reintento en una sección y mantiene visible la otra", async () => {
		mocks.listForUser.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([org]);
		auth.login("tok-123", baseUser);

		render(Dashboard);

		// Los datasets cargan bien aun cuando las organizaciones fallan.
		await screen.findByRole("link", { name: /matrícula estudiantil 2026/i });
		await screen.findByText(/no se pudo cargar sus organizaciones/i);

		await fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
		await screen.findByRole("link", { name: /facultad de ciencias/i });
	});
});
