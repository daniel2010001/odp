import { render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import Dashboard from "./+page.svelte";

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
});

describe("Dashboard guard", () => {
	it("redirige a /auth/login cuando no hay sesión", async () => {
		render(Dashboard);

		await waitFor(() => expect(goto).toHaveBeenCalledWith("/auth/login"));
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
});
