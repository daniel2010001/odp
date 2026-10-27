// Tests de la maqueta de administración de usuarios: lo que importa capturar es la lista con sus
// roles, sólo con usuarios activos (Q5: los bloqueados quedan para la implementación), y el formulario
// de alta, que se abre con `?vista=nuevo`.

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

	it("muestra la lista con su rol, sin el formulario abierto", () => {
		at("http://localhost/dev/prototype/users");
		render(UsersMock);

		expect(screen.getByRole("heading", { level: 1, name: "Usuarios" })).toBeTruthy();
		expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("sólo muestra usuarios activos: ni estado «Bloqueado» ni filtro por estado (Q5)", () => {
		at("http://localhost/dev/prototype/users");
		render(UsersMock);

		expect(document.body.textContent).not.toMatch(/bloque/i);
		expect(screen.queryByRole("combobox", { name: "Estado" })).toBeNull();
		expect(screen.queryByRole("columnheader", { name: "Estado" })).toBeNull();
	});

	it("abre el formulario de alta con ?vista=nuevo", () => {
		at("http://localhost/dev/prototype/users?vista=nuevo");
		render(UsersMock);

		expect(screen.getByRole("dialog", { name: "Nuevo usuario" })).toBeTruthy();
	});
});

describe("maqueta — usuarios con varias organizaciones", () => {
	afterEach(() => at("http://localhost/"));

	it("muestra un rol por organización, el superadministrador aparte y el usuario sin organización", () => {
		at("http://localhost/dev/prototype/users");
		render(UsersMock);

		// Un rol por organización: la sigla con su rol, y el resto resumido en «+N».
		expect(screen.getAllByTitle("Dirección de Investigación").length).toBeGreaterThan(1);
		expect(screen.getAllByText("+1").length).toBeGreaterThan(0);
		// El superadministrador es una marca de la cuenta, no un rol de organización.
		expect(screen.getByText("Superadministrador", { selector: "span" })).toBeTruthy();
		expect(screen.getByText("Sin organización")).toBeTruthy();
		// No queda la «organización principal», que CKAN no tiene (Q8).
		expect(screen.queryByText(/organización principal/i)).toBeNull();
	});

	it("el alta es una invitación con una o más organizaciones", () => {
		at("http://localhost/dev/prototype/users?vista=nuevo");
		render(UsersMock);

		expect(screen.getByRole("button", { name: "Enviar invitación" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Agregar otra organización" })).toBeTruthy();
	});
});
