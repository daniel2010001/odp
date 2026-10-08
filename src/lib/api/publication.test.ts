// API de publicación: las cuatro acciones del contrato, del lado del consumidor.
//
// Lo que se prueba acá es la **forma del llamado**, porque la forma es el contrato: qué acción, con qué
// claves y por qué verbo. La fuente autoritativa es `PUBLICATION-ACTIONS.md` del otro repositorio
// (`odp-docker`, `master`); si una firma cambia allí, este archivo es el que cambia acá.
//
// Tres reglas del contrato que se fijan como aserción y no como comentario:
//  · el retorno es **uniforme** —la fila, y nada más—: estos métodos no devuelven el dataset, así que
//    quien necesite su valor nuevo **relee** en vez de creerle al que lo escribió;
//  · `publication_request_list` es un **GET** (`side_effect_free`), no un POST;
//  · un fallo llega con su `__type` y su `payload` **intactos**, porque el portal distingue con ellos el
//    rechazo sin comentario (`ValidationError` con la clave `comments`) sin leer prosa humana.

import { describe, expect, it, vi } from "vitest";
import { CkanApiError } from "$lib/types/api";
import type { CkanClient } from "./client";
import { createPublicationApi, type PublicationRequest } from "./publication";

function makeRow(overrides: Partial<PublicationRequest> = {}): PublicationRequest {
	return {
		id: "req-1",
		dataset_id: "pkg-1",
		status: "pending",
		requested_by: "user-1",
		requested_by_name: "editor.tecnologia",
		approved_by: null,
		approved_by_name: null,
		comments: null,
		motive: null,
		created_at: "2026-10-01T00:00:00.000000",
		...overrides,
	};
}

/**
 * Cliente falso con los dos verbos, porque la lista va por `get` y el resto por `post`.
 *
 * Dos parámetros a propósito en cada uno: así las llamadas se tipan como tupla `[acción, params]` y los
 * tests pueden leer el payload que la API mandó a CKAN.
 */
function makeClient(respuestas: Record<string, unknown>) {
	const responder = (action: string) => {
		const valor = respuestas[action];
		if (valor === undefined) throw new Error(`acción no esperada: ${action}`);
		return typeof valor === "function" ? (valor as () => unknown)() : valor;
	};
	const post = vi.fn(async (action: string, _params?: Record<string, unknown>) =>
		responder(action),
	);
	const get = vi.fn(async (action: string, _params?: Record<string, unknown>) => responder(action));
	return { client: { post, get } as unknown as CkanClient, post, get };
}

describe("createPublicationApi — pedir y cancelar", () => {
	it("pedir: llama `publication_request_create` con `dataset_id` y devuelve la fila", async () => {
		const fila = makeRow();
		const { client, post } = makeClient({ publication_request_create: fila });

		const devuelta = await createPublicationApi(client).request("pkg-1");

		expect(post).toHaveBeenCalledWith("publication_request_create", { dataset_id: "pkg-1" });
		// Uniforme: la fila, y nada más. No hay envoltorio ni `dataset` en la respuesta.
		expect(devuelta).toBe(fila);
	});

	it("pedir con comentario: viaja en `comments`", async () => {
		const { client, post } = makeClient({ publication_request_create: makeRow() });

		await createPublicationApi(client).request("pkg-1", "Es para el catálogo abierto.");

		expect(post).toHaveBeenCalledWith("publication_request_create", {
			dataset_id: "pkg-1",
			comments: "Es para el catálogo abierto.",
		});
	});

	it("cancelar: llama `publication_request_cancel` con `request_id`", async () => {
		const { client, post } = makeClient({
			publication_request_cancel: makeRow({ status: "cancelled" }),
		});

		await createPublicationApi(client).cancel("req-1");

		expect(post).toHaveBeenCalledWith("publication_request_cancel", { request_id: "req-1" });
	});
});

describe("createPublicationApi — decidir", () => {
	it("aprobar: manda `approve: true` y **no** inventa la clave del comentario", async () => {
		const { client, post } = makeClient({
			publication_request_decide: makeRow({ status: "approved" }),
		});

		await createPublicationApi(client).decide("req-1", true);

		const [, payload] = post.mock.calls[0];
		expect(payload).toEqual({ request_id: "req-1", approve: true });
		expect(payload).not.toHaveProperty("comments");
	});

	it("rechazar con motivo: el motivo viaja, porque rechazar lo exige", async () => {
		const { client, post } = makeClient({
			publication_request_decide: makeRow({ status: "rejected" }),
		});

		await createPublicationApi(client).decide(
			"req-1",
			false,
			"Los datos personales no están anonimizados.",
		);

		expect(post).toHaveBeenCalledWith("publication_request_decide", {
			request_id: "req-1",
			approve: false,
			comments: "Los datos personales no están anonimizados.",
		});
	});
});

describe("createPublicationApi — listar", () => {
	it("listar: es un **GET** — la acción es `side_effect_free` — y el filtro va como `status`", async () => {
		const filas = [makeRow(), makeRow({ id: "req-2" })];
		const { client, get, post } = makeClient({ publication_request_list: filas });

		const devueltas = await createPublicationApi(client).list("pending");

		expect(get).toHaveBeenCalledWith("publication_request_list", { status: "pending" });
		expect(post).not.toHaveBeenCalled();
		expect(devueltas).toEqual(filas);
	});

	it("listar sin filtro: manda el objeto vacío, no una clave con `undefined`", async () => {
		const { client, get } = makeClient({ publication_request_list: [] });

		await createPublicationApi(client).list();

		expect(get).toHaveBeenCalledWith("publication_request_list", {});
	});
});

describe("createPublicationApi — lo que un fallo trae", () => {
	it("un `ValidationError` con `comments` llega con su tipo y su payload: es el único rechazo legible por máquina", async () => {
		// El contrato lo declara: el rechazo **sin comentario** no es un `403`, es un `ValidationError`
		// con la clave `comments`. El portal tiene que poder distinguirlo **sin leer prosa**, porque la
		// prosa de un `403` no distingue cuatro casos entre sí.
		const error = new CkanApiError(
			"Validation Error: comments is required when rejecting",
			409,
			"Validation Error",
			{ comments: ["Missing value"] },
		);
		const { client } = makeClient({
			publication_request_decide: () => {
				throw error;
			},
		});

		await expect(createPublicationApi(client).decide("req-1", false)).rejects.toBe(error);
		await expect(createPublicationApi(client).decide("req-1", false)).rejects.toMatchObject({
			status: 409,
			ckanType: "Validation Error",
			payload: { comments: ["Missing value"] },
		});
	});

	it("no se traga el error ni lo reescribe: quien llama decide qué hacer con él", async () => {
		const error = new CkanApiError("Access denied", 403, "Authorization Error", {
			message: "Four eyes: the approver cannot be the requester of the request they decide",
		});
		const { client } = makeClient({
			publication_request_decide: () => {
				throw error;
			},
		});

		await expect(createPublicationApi(client).decide("req-1", true)).rejects.toBe(error);
	});
});
