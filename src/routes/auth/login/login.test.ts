import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { SESSION_EXPIRED_MESSAGE } from "$lib/session";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import Login from "./+page.svelte";

const mocks = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock("$lib/api/auth", () => ({ login: mocks.login }));

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el
// tipo real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test, igual
// que en `src/routes/dataset/[id]/dataset-page.test.ts`.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

function getForm(container: HTMLElement): HTMLFormElement {
	const form = container.querySelector("form");
	if (!form) throw new Error("No se encontró el formulario");
	return form as HTMLFormElement;
}

beforeEach(() => {
	auth.reset();
	localStorage.clear();
	vi.clearAllMocks();
	// El stub de `page` es un store compartido: se fija la URL por defecto para que ningún test
	// herede el `?expired=1` del anterior.
	pageStore.set({ params: {}, url: new URL("http://localhost/auth/login") });
});

describe("Login", () => {
	it("con ?expired=1 y sin sesión muestra el aviso de sesión expirada y no navega", () => {
		pageStore.set({ params: {}, url: new URL("http://localhost/auth/login?expired=1") });

		render(Login);

		expect(screen.getByRole("alert")).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
		expect(goto).not.toHaveBeenCalled();
	});

	it("sin el parámetro no muestra ningún aviso", () => {
		render(Login);

		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("un login rechazado con ?expired=1 muestra el error de acceso y no el aviso de sesión", async () => {
		pageStore.set({ params: {}, url: new URL("http://localhost/auth/login?expired=1") });
		mocks.login.mockRejectedValue(new Error("Usuario o contraseña incorrectos"));

		const { container } = render(Login);

		await fireEvent.input(screen.getByLabelText("Nombre de usuario"), {
			target: { value: "jdoe" },
		});
		await fireEvent.input(screen.getByLabelText("Contraseña"), {
			target: { value: "secreta123" },
		});
		await fireEvent.submit(getForm(container));

		// Una sola condición, un mensaje: el error del intento reemplaza al aviso de la vuelta.
		const alerta = await screen.findByRole("alert");
		expect(alerta).toHaveTextContent("Usuario o contraseña incorrectos");
		expect(alerta).not.toHaveTextContent(SESSION_EXPIRED_MESSAGE);
	});

	it("con una sesión autenticada rebota al panel y no muestra el aviso", async () => {
		pageStore.set({ params: {}, url: new URL("http://localhost/auth/login?expired=1") });
		auth.login("tok-123", baseUser);

		render(Login);

		await waitFor(() => expect(goto).toHaveBeenCalledWith("/dashboard"));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
