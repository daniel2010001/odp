// Tests de la maqueta de administración de usuarios: lo que importa capturar es la lista con sus
// roles y estados, y el formulario de alta, que se abre con `?vista=nuevo`.

import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "$app/stores";
import UsersMock from "./+page.svelte";

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function at(url: string) {
	pageStore.set({ params: {}, url: new URL(url) });
}

describe("maqueta — administración de usuarios", () => {
	afterEach(() => at("http://localhost/"));

	it("muestra la lista con rol y estado, sin el formulario abierto", () => {
		at("http://localhost/dev/prototype/users");
		render(UsersMock);

		expect(screen.getByRole("heading", { level: 1, name: "Usuarios" })).toBeTruthy();
		expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
		expect(screen.getByText("Bloqueado", { selector: "span" })).toBeTruthy();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("abre el formulario de alta con ?vista=nuevo", () => {
		at("http://localhost/dev/prototype/users?vista=nuevo");
		render(UsersMock);

		expect(screen.getByRole("dialog", { name: "Nuevo usuario" })).toBeTruthy();
	});
});
