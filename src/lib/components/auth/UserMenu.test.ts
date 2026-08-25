import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import UserMenu from "./UserMenu.svelte";

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
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("UserMenu", () => {
	it("renderiza el display_name del usuario autenticado", () => {
		auth.login("tok-123", baseUser);

		render(UserMenu);

		expect(screen.getByText("Jane Doe")).toBeInTheDocument();
	});

	it("usa el username como respaldo cuando no hay display_name", () => {
		auth.login("tok-123", { ...baseUser, display_name: "" });

		render(UserMenu);

		expect(screen.getByText("jdoe")).toBeInTheDocument();
	});

	it("abre el dropdown y muestra Dashboard y Cerrar sesión", async () => {
		auth.login("tok-123", baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));

		expect(screen.getByRole("menuitem", { name: /dashboard/i })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
	});

	it("cierra el dropdown al presionar Escape", async () => {
		auth.login("tok-123", baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));
		expect(screen.getByRole("menuitem", { name: /dashboard/i })).toBeInTheDocument();

		await fireEvent.keyDown(document, { key: "Escape" });

		expect(screen.queryByRole("menuitem", { name: /dashboard/i })).not.toBeInTheDocument();
	});

	it("cierra sesión: revoca el token, limpia el store y redirige a /", async () => {
		auth.login("tok-123", baseUser);

		render(UserMenu);
		await fireEvent.click(screen.getByRole("button", { name: "Jane Doe" }));
		await fireEvent.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

		await waitFor(() => expect(goto).toHaveBeenCalledWith("/"));

		expect(fetchMock).toHaveBeenCalledWith(
			"/auth/logout",
			expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "tok-123" }) }),
		);
		expect(get(auth).token).toBeNull();
		expect(get(auth).user).toBeNull();
	});
});
