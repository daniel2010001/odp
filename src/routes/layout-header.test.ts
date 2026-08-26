import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import Layout from "./+layout.svelte";

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

const children = createRawSnippet(() => ({ render: () => "Contenido" }));

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
});

describe("Header (layout)", () => {
	it("muestra 'Iniciar Sesión' hacia /auth/login cuando el usuario es anónimo", () => {
		render(Layout, { children });

		const link = screen.getByRole("link", { name: "Iniciar Sesión" });
		expect(link).toHaveAttribute("href", "/auth/login");
	});

	it("muestra el menú de usuario cuando hay sesión autenticada", () => {
		auth.login("tok-123", baseUser);

		render(Layout, { children });

		expect(screen.getByText("Jane Doe")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "Iniciar Sesión" })).not.toBeInTheDocument();
	});
});
