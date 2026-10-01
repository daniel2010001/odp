// Tests del contrato de presentación de la página de error del portal.
//
// ─── El punto de este archivo ────────────────────────────────────────
// El portal tiene DOS estados de error y no tres. Toda la familia 4xx —401, 403, 404, cualquier
// otro— renderiza letra por letra el mismo encabezado y el mismo cuerpo, porque distinguir «no
// existe» de «sin permiso» filtraría la existencia del recurso. Es exactamente el razonamiento de
// `src/lib/api/failure.ts`, y la aserción de igualdad profunda de abajo es el ancla que impide que
// una sesión futura agregue una variante con sabor a permiso.
//
// Las cadenas congeladas se escriben acá a mano a propósito: si el componente las parafrasea, el
// test falla. La hoja de revisión (`src/routes/dev/error`) hace lo contrario —deriva la copia del
// componente— para que lo que el autor aprueba sea lo que se publica.

import { render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ErrorPage, { errorCopy, errorState } from "./ErrorPage.svelte";

const CLIENT_STATUSES = [401, 403, 404] as const;
const SERVER_STATUSES = [500, 503] as const;
const ALL_STATUSES = [...CLIENT_STATUSES, ...SERVER_STATUSES] as const;

/** La copia congelada del contrato (`odd/tasks/block-b-error-page.md`). No se deriva del componente. */
const FROZEN_CLIENT = {
	heading: "No se pudo abrir esta página",
	body: "Puede que la dirección no exista o que usted no tenga permiso para verla. Vuelva al catálogo para buscar los datos que necesita.",
	title: "Página no disponible — UMSS",
	primary: "Volver al catálogo",
	secondary: "Ir a la página de inicio",
};

const FROZEN_SERVER = {
	heading: "Algo falló de nuestro lado",
	body: "No pudimos completar la operación. El problema está en el servidor, no en su equipo: intente nuevamente en unos minutos.",
	title: "Error del servidor — UMSS",
	primary: "Reintentar",
	secondary: "Volver al catálogo",
};

interface CapturedAction {
	name: string;
	href: string | null;
}

interface CapturedState {
	eyebrow: string;
	heading: string;
	body: string;
	actions: CapturedAction[];
}

function normalize(value: string | null | undefined): string {
	return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Renderiza el componente y devuelve el texto visible que no depende del estado observado.
 *
 * La línea de diagnóstico (sólo DEV, `font-mono`) es lo único que difiere legítimamente entre dos
 * estados de la misma familia —nombra el estado y la ruta—, así que se excluye: acá se compara la
 * presentación, no el andamiaje de desarrollo.
 */
function capture(status: number, props: { message?: string; path?: string } = {}): CapturedState {
	const { container, unmount } = render(ErrorPage, { props: { status, ...props } });
	const clone = container.cloneNode(true) as HTMLElement;
	for (const diagnostic of clone.querySelectorAll(".font-mono")) diagnostic.remove();

	const captured: CapturedState = {
		eyebrow: normalize(clone.querySelector("p")?.textContent),
		heading: normalize(clone.querySelector("h1")?.textContent),
		body: normalize(clone.querySelector("h1 + p")?.textContent),
		actions: Array.from(clone.querySelectorAll("a")).map((anchor) => ({
			name: normalize(anchor.textContent),
			href: anchor.getAttribute("href"),
		})),
	};
	unmount();
	return captured;
}

function actionNames(captured: CapturedState): string[] {
	return captured.actions.map((action) => action.name);
}

describe("ErrorPage — la familia 4xx es un solo estado", () => {
	it("401, 403 y 404 renderizan idéntico encabezado, cuerpo y acciones", () => {
		const [first, ...rest] = CLIENT_STATUSES.map((status) => capture(status));
		if (!first) throw new Error("el estado 4xx no renderizó");

		for (const other of rest) {
			expect(other.heading).toBe(first.heading);
			expect(other.body).toBe(first.body);
			expect(other.actions).toEqual(first.actions);
		}
	});

	it("cada estado 4xx usa la copia congelada, con su propio número en el eyebrow", () => {
		for (const status of CLIENT_STATUSES) {
			const captured = capture(status);
			expect(captured.eyebrow).toBe(`ERROR ${status}`);
			expect(captured.heading).toBe(FROZEN_CLIENT.heading);
			expect(captured.body).toBe(FROZEN_CLIENT.body);
		}
	});

	it("no expone ninguna variante con sabor a permiso en el encabezado", () => {
		for (const status of CLIENT_STATUSES) {
			expect(capture(status).heading).not.toMatch(/permiso|autoriz|acceso|denegad|privad/i);
		}
	});
});

describe("ErrorPage — el estado 5xx", () => {
	it("500 y 503 comparten encabezado y cuerpo", () => {
		const [first, ...rest] = SERVER_STATUSES.map((status) => capture(status, { path: "/search" }));
		if (!first) throw new Error("el estado 5xx no renderizó");

		for (const other of rest) {
			expect(other.heading).toBe(first.heading);
			expect(other.body).toBe(first.body);
		}
	});

	it("cada estado 5xx usa la copia congelada, con su propio número en el eyebrow", () => {
		for (const status of SERVER_STATUSES) {
			const captured = capture(status, { path: "/search" });
			expect(captured.eyebrow).toBe(`ERROR ${status}`);
			expect(captured.heading).toBe(FROZEN_SERVER.heading);
			expect(captured.body).toBe(FROZEN_SERVER.body);
		}
	});

	it("el estado 5xx y el 4xx son textos distintos", () => {
		const client = capture(404);
		const server = capture(500, { path: "/search" });

		expect(server.heading).not.toBe(client.heading);
		expect(server.body).not.toBe(client.body);
	});
});

describe("ErrorPage — clasificación por estado", () => {
	it("todo 4xx es el estado de cliente y todo lo demás el de servidor", () => {
		for (const status of [400, 401, 403, 404, 418, 451, 499]) {
			expect(errorState(status)).toBe("client");
		}
		// Un 3xx, un 2xx, un 5xx y un estado no observado (0) no describen una página faltante.
		for (const status of [0, 200, 302, 500, 502, 503, 599, 1000]) {
			expect(errorState(status)).toBe("server");
		}
	});

	it("errorCopy devuelve la copia del estado que le toca", () => {
		expect(errorCopy(401)).toEqual(errorCopy(404));
		expect(errorCopy(500)).toEqual(errorCopy(503));
		expect(errorCopy(404)).not.toEqual(errorCopy(500));
	});
});

describe("ErrorPage — acciones", () => {
	it("el 4xx ofrece «Volver al catálogo» hacia /search y «Ir a la página de inicio» hacia /", () => {
		expect(capture(404).actions).toEqual([
			{ name: FROZEN_CLIENT.primary, href: "/search" },
			{ name: FROZEN_CLIENT.secondary, href: "/" },
		]);
	});

	it("el 5xx ofrece «Reintentar» hacia la ruta fallida y «Volver al catálogo» hacia /search", () => {
		expect(capture(500, { path: "/dataset/privado" }).actions).toEqual([
			{ name: FROZEN_SERVER.primary, href: "/dataset/privado" },
			{ name: FROZEN_SERVER.secondary, href: "/search" },
		]);
	});

	it("el reintento existe en el 5xx y no en el 4xx", () => {
		for (const status of SERVER_STATUSES) {
			expect(actionNames(capture(status, { path: "/search" }))).toContain(FROZEN_SERVER.primary);
		}
		for (const status of CLIENT_STATUSES) {
			expect(actionNames(capture(status))).not.toContain(FROZEN_SERVER.primary);
		}
	});

	it("sin ruta fallida no inventa un reintento sin destino", () => {
		const captured = capture(500);

		expect(actionNames(captured)).toEqual([FROZEN_SERVER.secondary]);
		expect(captured.actions.every((action) => action.href !== null)).toBe(true);
	});

	it("las dos acciones son los únicos elementos enfocables de la página", () => {
		for (const status of ALL_STATUSES) {
			const { container, unmount } = render(ErrorPage, { props: { status, path: "/search" } });
			const focusables = container.querySelectorAll(
				"a, button, input, select, textarea, [tabindex]",
			);
			expect(focusables).toHaveLength(2);
			unmount();
		}
	});
});

describe("ErrorPage — ninguna acción ni texto de inicio de sesión", () => {
	for (const status of ALL_STATUSES) {
		it(`el estado ${status} no ofrece iniciar sesión`, () => {
			render(ErrorPage, { props: { status, path: "/search" } });

			expect(screen.queryByRole("link", { name: /iniciar sesión|ingresar|login/i })).toBeNull();
			expect(screen.queryByRole("button", { name: /iniciar sesión|ingresar|login/i })).toBeNull();
			expect(document.body.textContent ?? "").not.toMatch(/iniciar sesión|ingresar|login/i);
		});
	}
});

describe("ErrorPage — el título del documento", () => {
	it("el 4xx titula con la copia congelada", async () => {
		render(ErrorPage, { props: { status: 404 } });

		await waitFor(() => expect(document.title).toBe(FROZEN_CLIENT.title));
	});

	it("el 5xx titula con la copia congelada", async () => {
		render(ErrorPage, { props: { status: 500 } });

		await waitFor(() => expect(document.title).toBe(FROZEN_SERVER.title));
	});

	it("los dos títulos difieren", () => {
		expect(FROZEN_CLIENT.title).not.toBe(FROZEN_SERVER.title);
	});
});

describe("ErrorPage — estructura y accesibilidad", () => {
	for (const status of ALL_STATUSES) {
		it(`el estado ${status} tiene un solo h1 y un ícono oculto a lectores`, () => {
			const { container, unmount } = render(ErrorPage, { props: { status, path: "/search" } });

			expect(container.querySelectorAll("h1")).toHaveLength(1);
			const icon = container.querySelector("svg");
			expect(icon).not.toBeNull();
			expect(icon).toHaveAttribute("aria-hidden", "true");
			unmount();
		});
	}

	it("el 4xx usa FileQuestion y el 5xx TriangleAlert", () => {
		for (const status of CLIENT_STATUSES) {
			const { container, unmount } = render(ErrorPage, { props: { status } });
			expect(container.querySelector("svg")?.getAttribute("class")).toMatch(/file-question/);
			unmount();
		}
		for (const status of SERVER_STATUSES) {
			const { container, unmount } = render(ErrorPage, { props: { status, path: "/search" } });
			expect(container.querySelector("svg")?.getAttribute("class")).toMatch(/triangle-alert/);
			unmount();
		}
	});

	it("el eyebrow usa el acento coral que el sistema reserva para los eyebrows", () => {
		const { container, unmount } = render(ErrorPage, { props: { status: 404 } });

		const eyebrow = container.querySelector("p");
		expect(eyebrow?.className).toContain("text-xs");
		expect(eyebrow?.className).toContain("uppercase");
		expect(eyebrow?.className).toContain("tracking-wider");
		expect(eyebrow?.className).toContain("text-destructive");
		unmount();
	});

	it("las dos acciones llevan un anillo de foco visible", () => {
		for (const status of ALL_STATUSES) {
			const { container, unmount } = render(ErrorPage, { props: { status, path: "/search" } });

			const actions = Array.from(container.querySelectorAll("a"));
			expect(actions).toHaveLength(2);
			for (const action of actions) {
				expect(action.className).toContain("focus-visible:ring-2");
				expect(action.className).toContain("focus-visible:ring-ring");
			}
			unmount();
		}
	});

	it("centra la columna con las clases del contrato y apila las acciones en móvil", () => {
		const { container, unmount } = render(ErrorPage, { props: { status: 404 } });

		const column = container.firstElementChild;
		expect(column?.className).toContain("max-w-xl");
		expect(column?.className).toContain("py-16");
		expect(column?.className).toContain("px-4");

		const actions = container.querySelector("a")?.parentElement;
		expect(actions?.className).toContain("flex-col");
		expect(actions?.className).toContain("sm:flex-row");
		unmount();
	});
});

describe("ErrorPage — la línea de diagnóstico sólo existe en desarrollo", () => {
	it("en desarrollo muestra el estado, la ruta y el mensaje crudo", () => {
		const { container, unmount } = render(ErrorPage, {
			props: { status: 404, path: "/no-existe", message: "Not Found" },
		});

		const diagnostic = container.querySelector(".font-mono");
		expect(diagnostic).toHaveTextContent("404");
		expect(diagnostic).toHaveTextContent("/no-existe");
		expect(diagnostic).toHaveTextContent("Not Found");
		unmount();
	});

	it("fuera de desarrollo no renderiza la línea de diagnóstico", () => {
		vi.stubEnv("DEV", false);
		try {
			const { container, unmount } = render(ErrorPage, {
				props: { status: 404, path: "/no-existe", message: "Not Found" },
			});

			expect(container.querySelector(".font-mono")).toBeNull();
			unmount();
		} finally {
			vi.unstubAllEnvs();
		}
	});
});
