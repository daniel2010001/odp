// El envoltorio de la página de error: lo único que agrega sobre el componente es traducir el error
// que SvelteKit entrega. Estos tests fijan ese cableado —de dónde sale el estado y qué ruta
// reintenta—, no la presentación, que tiene los suyos en `src/lib/components/error/error-page.test.ts`.

import { render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { page } from "$app/stores";
import ErrorBoundary from "./+error.svelte";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el tipo
// real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test, igual que en
// `login.test.ts` y en `dataset-page.test.ts`.
//
// El stub declara `error` como `{ message: string }`: la MISMA forma que el `App.Error` real de
// SvelteKit. Esa igualdad es la que impide que el doble de test vuelva a fabricar un `status` que en
// producción no existe (ver el comentario de `+error.svelte`).
const pageStore = page as unknown as {
	set: (value: {
		params: Record<string, string>;
		url: URL;
		status?: number;
		error?: { message: string } | null;
	}) => void;
};

function setPage(path: string, status: number, message: string | null): void {
	pageStore.set({
		params: {},
		url: new URL(`http://localhost${path}`),
		status,
		error: message === null ? null : { message },
	});
}

describe("La página de error del portal", () => {
	beforeEach(() => {
		setPage("/no-existe", 404, "Not Found");
	});

	it("un 404 cae del lado del cliente", () => {
		setPage("/no-existe", 404, "Not Found");

		render(ErrorBoundary);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"No se pudo abrir esta página",
		);
	});

	it("la clasificación sale de `page.status`, no de `page.error`", () => {
		// El ancla del defecto que este bloque encontró: `App.Error` sólo lleva `message`, así que un
		// status leído de `page.error` sería `undefined` en producción y TODO error renderizaría el
		// estado del servidor. Con el mensaje ausente, el estado tiene que seguir siendo el del cliente.
		setPage("/no-existe", 404, null);

		render(ErrorBoundary);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"No se pudo abrir esta página",
		);
	});

	it("un 403 cae en el MISMO estado que el 404: no delata que el recurso existe", () => {
		setPage("/dataset/privado", 403, "Access denied");

		render(ErrorBoundary);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"No se pudo abrir esta página",
		);
	});

	it("un 500 cae del lado del servidor y ofrece reintentar en su propia ruta", () => {
		setPage("/dashboard", 500, "Internal Error");

		render(ErrorBoundary);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"Algo falló de nuestro lado",
		);
		expect(screen.getByRole("link", { name: /reintentar/i })).toHaveAttribute("href", "/dashboard");
	});

	it("no ofrece iniciar sesión: ese camino vive en el encabezado, que no sabe qué se pidió", () => {
		setPage("/dataset/privado", 403, "Access denied");

		render(ErrorBoundary);

		expect(
			screen.queryByRole("link", { name: /iniciar sesión|ingresar|login/i }),
		).not.toBeInTheDocument();
	});
});
