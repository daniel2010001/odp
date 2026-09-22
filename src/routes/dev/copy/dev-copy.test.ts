// Tests de la única propiedad que hace útil a esta hoja: la **antideriva**.
//
// Una hoja de revisión de copia que repite las cadenas a mano es peor que no tener hoja: puede
// mostrar un texto que la aplicación nunca renderiza y el autor aprobaría algo que no se publica.
// Por eso ninguna aserción de este archivo escribe la cadena esperada: todas calculan la esperanza
// llamando a la misma función que usa la aplicación (`describeFailure`, `failureActions`,
// `emptyStateMessage`). Si la hoja deja de usar el módulo —o alguien copia el texto a mano— estos
// tests fallan.

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import {
	type AccessContext,
	type ApiFailureKind,
	type ApiSubject,
	describeFailure,
	failureActions,
} from "$lib/api/failure";
import {
	EMPTY_STATE_HEADING,
	EMPTY_STATE_PRIMARY_ACTION_LABEL,
	emptyStateMessage,
} from "$lib/copy/dashboard";
import { SESSION_EXPIRED_MESSAGE, SESSION_EXPIRED_PARAM } from "$lib/session";
import { CkanApiError } from "$lib/types/api";
import CopySheet from "./+page.svelte";

/** Fallo representativo por clase, igual que en `failure.test.ts`. */
const ERROR_BY_KIND: Record<ApiFailureKind, unknown> = {
	unauthorized: new CkanApiError("Access denied", 403),
	"not-found": new CkanApiError("Not Found", 404),
	unavailable: new CkanApiError("Sin respuesta del catálogo", 0),
};

/**
 * Las combinaciones que el portal puede alcanzar de verdad.
 *
 * La sonda de sesión sólo corre ante un `403` con token (ver
 * `src/routes/dataset/[id]/resource/[resourceId]/resource-page.test.ts` y `src/lib/session-guard.ts`),
 * así que `unavailable` y `not-found` nunca llegan con un contexto identificado: un espectador sin
 * sesión no alcanza la rama inconclusa, y por eso la hoja no inventa esas filas.
 */
const REACHABLE_CASES: { subject: ApiSubject; kind: ApiFailureKind; access: AccessContext }[] = [
	{ subject: "resource", kind: "unauthorized", access: "anonymous" },
	{ subject: "resource", kind: "unauthorized", access: "session-alive" },
	{ subject: "resource", kind: "unauthorized", access: "unknown" },
	{ subject: "resource", kind: "not-found", access: "anonymous" },
	{ subject: "resource", kind: "unavailable", access: "anonymous" },
	{ subject: "dataset", kind: "unauthorized", access: "anonymous" },
	{ subject: "dataset", kind: "unauthorized", access: "session-alive" },
	{ subject: "dataset", kind: "unauthorized", access: "unknown" },
	{ subject: "dataset", kind: "not-found", access: "anonymous" },
	{ subject: "dataset", kind: "unavailable", access: "anonymous" },
];

/** Las cuatro variantes del estado vacío del panel, por su bandera característica. */
const EMPTY_STATE_CASES = [
	{
		id: "can-create",
		flags: {
			canCreate: true,
			confirmedNoOrganizations: false,
			confirmedNoCreatePermission: false,
		},
	},
	{
		id: "no-organizations",
		flags: {
			canCreate: false,
			confirmedNoOrganizations: true,
			confirmedNoCreatePermission: false,
		},
	},
	{
		id: "no-create-permission",
		flags: {
			canCreate: false,
			confirmedNoOrganizations: false,
			confirmedNoCreatePermission: true,
		},
	},
	{
		id: "neutral",
		flags: {
			canCreate: false,
			confirmedNoOrganizations: false,
			confirmedNoCreatePermission: false,
		},
	},
];

describe("hoja de copia — los estados de fallo", () => {
	for (const { subject, kind, access } of REACHABLE_CASES) {
		it(`muestra el texto que describeFailure devuelve para ${subject} / ${kind} / ${access}`, () => {
			render(CopySheet);

			const expected = describeFailure(ERROR_BY_KIND[kind], subject, access);
			const row = screen.getByTestId(`failure-${subject}-${kind}-${access}`);

			expect(row).toHaveTextContent(expected.title);
			expect(row).toHaveTextContent(expected.message);
		});

		it(`muestra las acciones que failureActions ofrece para ${subject} / ${kind} / ${access}`, () => {
			render(CopySheet);

			const expected = describeFailure(ERROR_BY_KIND[kind], subject, access);
			const { retry } = failureActions(expected, access);
			const row = screen.getByTestId(`failure-${subject}-${kind}-${access}`);

			expect(row).toHaveTextContent(retry ? "Reintentar" : "Ninguna acción");
		});
	}

	it("marca como no reproducible a mano cada combinación inconclusa, y sólo ésas", () => {
		render(CopySheet);

		// Una sesión a la que la sonda no pudo resolver no se arma a mano: la sonda responde por sí
		// sola. Es el estado que motiva la hoja, y existe para los dos sujetos.
		const markerRows = screen
			.getAllByTestId("unreproducible-marker")
			.map((marker) => marker.closest("article")?.getAttribute("data-testid"));

		expect(markerRows).toEqual([
			"failure-resource-unauthorized-unknown",
			"failure-dataset-unauthorized-unknown",
		]);
		for (const subject of ["resource", "dataset"] as const) {
			expect(screen.getByTestId(`failure-${subject}-unauthorized-unknown`)).toHaveTextContent(
				/no se puede reproducir a mano/i,
			);
		}
	});

	it("no inventa combinaciones que el portal no puede alcanzar", () => {
		render(CopySheet);

		// `unavailable` y `not-found` no sondean la sesión: sólo existen con contexto anónimo.
		for (const subject of ["resource", "dataset"] as const) {
			for (const kind of ["not-found", "unavailable"] as const) {
				expect(screen.queryByTestId(`failure-${subject}-${kind}-session-alive`)).toBeNull();
				expect(screen.queryByTestId(`failure-${subject}-${kind}-unknown`)).toBeNull();
			}
		}
	});
});

describe("hoja de copia — el aviso de sesión expirada", () => {
	it("muestra SESSION_EXPIRED_MESSAGE y el parámetro que lo dispara, tomados del módulo", () => {
		render(CopySheet);

		const notice = screen.getByTestId("session-expired-notice");
		expect(notice).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
		expect(notice).toHaveTextContent(SESSION_EXPIRED_PARAM);
	});
});

describe("hoja de copia — el estado vacío del panel", () => {
	for (const { id, flags } of EMPTY_STATE_CASES) {
		it(`muestra la variante «${id}» tal como la devuelve emptyStateMessage`, () => {
			render(CopySheet);

			expect(screen.getByTestId(`empty-state-${id}`)).toHaveTextContent(emptyStateMessage(flags));
		});
	}

	it("muestra las cuatro variantes, incluida la que no se puede producir a mano", () => {
		render(CopySheet);

		for (const { id } of EMPTY_STATE_CASES) {
			expect(screen.getByTestId(`empty-state-${id}`)).toBeInTheDocument();
		}
		expect(screen.getByTestId("empty-state-no-create-permission")).toHaveTextContent(
			/no se puede producir a mano/i,
		);
	});

	it("muestra el encabezado y la etiqueta del llamado a la acción tomados del módulo de copia", () => {
		render(CopySheet);

		expect(screen.getByTestId("empty-state-heading")).toHaveTextContent(EMPTY_STATE_HEADING);
		expect(screen.getByTestId("empty-state-primary-action")).toHaveTextContent(
			EMPTY_STATE_PRIMARY_ACTION_LABEL,
		);
	});
});

describe("hoja de copia — la ruta no existe en producción", () => {
	it("deja pasar la carga en desarrollo", async () => {
		const { load } = await import("./+page");

		expect(() => load(undefined as never)).not.toThrow();
	});

	it("lanza un 404 cuando el entorno no es de desarrollo", async () => {
		vi.stubEnv("DEV", false);
		try {
			const { load } = await import("./+page");

			expect(() => load(undefined as never)).toThrowError(expect.objectContaining({ status: 404 }));
		} finally {
			vi.unstubAllEnvs();
		}
	});
});
