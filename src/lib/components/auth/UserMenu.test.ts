import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import UserMenu from "./UserMenu.svelte";

// La capacidad se pregunta con la misma llamada que usan la ficha y el panel: se la reemplaza por un
// doble para decidir «puede», «no puede» o «falló» sin red.
const mocks = vi.hoisted(() => ({
	createPortalClient: vi.fn<() => object>(() => ({})),
	listUpdatableOrganizationIds: vi.fn(),
}));

vi.mock("$lib/api/client", () => ({ createPortalClient: mocks.createPortalClient }));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({
		listUpdatableOrganizationIds: mocks.listUpdatableOrganizationIds,
	}),
}));

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	auth.reset();
	fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
	vi.stubGlobal("fetch", fetchMock);
	vi.clearAllMocks();
	mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: [] });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("UserMenu", () => {
	it("renderiza el display_name del usuario autenticado", () => {
		auth.setUser(baseUser);

		render(UserMenu);

		expect(screen.getByText("Jane Doe")).toBeInTheDocument();
	});

	it("usa el username como respaldo cuando no hay display_name", () => {
		auth.setUser({ ...baseUser, display_name: "" });

		render(UserMenu);

		expect(screen.getByText("jdoe")).toBeInTheDocument();
	});

	it("la entrada de solicitudes apunta a la ruta inglesa del portal", async () => {
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		auth.setUser(baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));

		// La ruta del portal va en inglés, como el resto de `src/routes/`; el copy visible sigue en español.
		// Esta prueba existe porque la ruta nació en español y nada la fijaba.
		const entrada = await screen.findByRole("menuitem", { name: /solicitudes/i });
		expect(entrada).toHaveAttribute("href", "/dashboard/requests");
	});

	it("un editor (capacidad de update_dataset en alguna organización) ve «Solicitudes»", async () => {
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "known", ids: ["org-1"] });
		auth.setUser(baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));

		expect(await screen.findByRole("menuitem", { name: /solicitudes/i })).toBeInTheDocument();
	});

	it("un miembro (sin capacidad en ninguna organización) no ve «Solicitudes»", async () => {
		auth.setUser(baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));

		await waitFor(() => expect(mocks.listUpdatableOrganizationIds).toHaveBeenCalled());
		expect(screen.getByRole("menuitem", { name: /panel/i })).toBeInTheDocument();
		expect(screen.queryByRole("menuitem", { name: /solicitudes/i })).not.toBeInTheDocument();
	});

	it("la superadministración ve «Solicitudes»", async () => {
		auth.setUser({ ...baseUser, sysadmin: true });

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));

		expect(await screen.findByRole("menuitem", { name: /solicitudes/i })).toBeInTheDocument();
	});

	it("si la consulta de capacidad falla, «Solicitudes» queda oculta (falla cerrado)", async () => {
		mocks.listUpdatableOrganizationIds.mockResolvedValue({ state: "unknown" });
		auth.setUser(baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));

		await waitFor(() => expect(mocks.listUpdatableOrganizationIds).toHaveBeenCalled());
		expect(screen.queryByRole("menuitem", { name: /solicitudes/i })).not.toBeInTheDocument();
	});

	it("si la consulta de capacidad lanza, «Solicitudes» queda oculta y el menú sigue operable", async () => {
		mocks.listUpdatableOrganizationIds.mockRejectedValue(new Error("red caída"));
		auth.setUser(baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));

		await waitFor(() => expect(mocks.listUpdatableOrganizationIds).toHaveBeenCalled());
		expect(screen.queryByRole("menuitem", { name: /solicitudes/i })).not.toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
	});

	it("abre el dropdown y muestra Panel y Cerrar sesión", async () => {
		auth.setUser(baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));

		expect(screen.getByRole("menuitem", { name: /panel/i })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
	});

	it("cierra el dropdown al presionar Escape", async () => {
		auth.setUser(baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));
		expect(screen.getByRole("menuitem", { name: /panel/i })).toBeInTheDocument();

		await fireEvent.keyDown(document, { key: "Escape" });

		expect(screen.queryByRole("menuitem", { name: /panel/i })).not.toBeInTheDocument();
	});

	it("cierra sesión: pide al servidor cerrar la sesión, limpia el store y redirige a /", async () => {
		auth.setUser(baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));
		await fireEvent.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

		await waitFor(() => expect(goto).toHaveBeenCalledWith("/"));

		expect(fetchMock).toHaveBeenCalledWith(
			"/auth/logout",
			expect.objectContaining({ method: "POST", body: "{}" }),
		);
		expect(get(auth).user).toBeNull();
	});
});
