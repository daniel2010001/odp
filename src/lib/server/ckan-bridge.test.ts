// Pruebas del **puente vivo**: lo que el portal hace con un pedido de acción del navegador.
//
// `ckan-proxy.ts` decide *qué* se puede pedir y con qué cabeceras; acá se prueba el camino completo —sesión
// resuelta, acción permitida, reenvío y respuesta normalizada—, porque es donde un descuido se convierte en
// algo distinto de lo que dice el diseño.
//
// Lo que estas pruebas fijan, y por qué:
//  1. **Una acción no permitida no se reenvía.** No alcanza con devolver `404`: la aserción es que el `fetch`
//     **no se llamó**, porque un reenvío que ya salió no se puede deshacer.
//  2. **Sin sesión no se reenvía tampoco**, y la respuesta es propia (`401`), no la de CKAN.
//  3. **La credencial viaja en la cabecera, nunca en la URL** —ni siquiera en un `GET`, donde los parámetros sí
//     van en la query—. Un token en una URL termina en logs, historiales y `Referer`.
//  4. **La respuesta del catálogo pasa tal cual** —status y cuerpo—, incluidos sus errores: el portal necesita
//     su `status`, su `__type` y su `payload` para distinguir rechazos que la prosa no distingue.
//  5. **Un catálogo caído no se disfraza de respuesta válida**: un fallo de red es `502` con cuerpo propio, y
//     no una excepción que tumbe el request ni un `200` vacío que el navegador lea como «no hay nada».

import { describe, expect, it, vi } from "vitest";
import { type Fetcher, forwardToCatalog } from "./ckan-bridge";

const INTERNAL_URL = "http://ckan:5000";
const TOKEN = "jwt-de-la-sesion";

/** Un `fetch` de mentira que registra cómo lo llamaron y devuelve lo que se le pida. */
function makeFetcher(respuesta: Partial<Response> = {}) {
	const fetcher = vi.fn<Fetcher>().mockResolvedValue({
		status: 200,
		json: async () => ({ success: true, result: { ok: true } }),
		...respuesta,
	} as Response);
	return fetcher;
}

function pedido(overrides: Partial<Parameters<typeof forwardToCatalog>[0]> = {}) {
	return {
		action: "package_show",
		method: "POST" as const,
		params: { id: "pkg-1" },
		session: { token: TOKEN },
		internalUrl: INTERNAL_URL,
		incomingHeaders: new Headers(),
		...overrides,
	};
}

describe("el puente — el verbo no lo elige el cliente", () => {
	it("un mutador **no** se reenvía con `GET`: es el CSRF que `SameSite=Lax` no frena", async () => {
		// La navegación de nivel superior **sí** lleva la cookie `Lax`, así que una página ajena puede provocar
		// un `GET` con la sesión de la víctima. Si el puente reenviara cualquier verbo sobre cualquier acción
		// permitida, eso sería una escritura disparada desde otro sitio. No se depende de que CKAN lo rechace:
		// se rechaza acá, y sin llamar al catálogo.
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(
			pedido({ action: "package_delete", method: "GET", params: { id: "pkg-1" } }),
			fetcher,
		);

		expect(resultado.status).toBe(405);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("ese mismo mutador **sí** se reenvía con `POST`", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(
			pedido({ action: "package_delete", method: "POST", params: { id: "pkg-1" } }),
			fetcher,
		);

		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe(`${INTERNAL_URL}/api/3/action/package_delete`);
		expect(init?.method).toBe("POST");
		expect(resultado.status).toBe(200);
	});
});

describe("el puente — la guarda va antes del reenvío", () => {
	it("una acción no permitida devuelve 404 y **no** llama al catálogo", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(pedido({ action: "user_create" }), fetcher);

		expect(resultado.status).toBe(404);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("ni siquiera una acción de tokens se reenvía", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(pedido({ action: "api_token_create" }), fetcher);

		expect(resultado.status).toBe(404);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("una cookie que **no abre** es una sesión muerta: 401 y **no** llama al catálogo", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(pedido({ session: "dead" }), fetcher);

		expect(resultado.status).toBe(401);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("**sin cookie** se reenvía anónimo: sin `Authorization` y con los parámetros, porque el catálogo decide qué es público", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(
			pedido({ session: "anonymous", method: "GET", params: { id: "pkg-1" } }),
			fetcher,
		);

		// El reenvío **sí** ocurre: sin cookie no hay sesión que expulsar, hay un visitante.
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe(`${INTERNAL_URL}/api/3/action/package_show?id=pkg-1`);
		expect(new Headers(init?.headers).get("authorization")).toBeNull();
		expect(resultado.status).toBe(200);
	});
});

describe("el puente — el pedido al catálogo", () => {
	it("un POST manda los parámetros como cuerpo JSON y la credencial en la cabecera", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(pedido({ params: { id: "pkg-1", rows: 5 } }), fetcher);

		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe(`${INTERNAL_URL}/api/3/action/package_show`);
		expect(init?.method).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual({ id: "pkg-1", rows: 5 });
		expect(new Headers(init?.headers).get("authorization")).toBe(TOKEN);
	});

	it("un GET manda los parámetros en la query y la credencial sigue en la cabecera, nunca en la URL", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(
			pedido({ action: "publication_request_list", method: "GET", params: { status: "pending" } }),
			fetcher,
		);

		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe(`${INTERNAL_URL}/api/3/action/publication_request_list?status=pending`);
		expect(url).not.toContain(TOKEN);
		expect(init?.method).toBe("GET");
		expect(init?.body).toBeUndefined();
		expect(new Headers(init?.headers).get("authorization")).toBe(TOKEN);
	});

	it("un valor `undefined` no se manda como la cadena «undefined»", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(
			pedido({ method: "GET", params: { status: undefined, rows: 5 } }),
			fetcher,
		);

		const [url] = fetcher.mock.calls[0];
		expect(url).toBe(`${INTERNAL_URL}/api/3/action/package_show?rows=5`);
	});

	it("las cabeceras del cliente no viajan al catálogo", async () => {
		const fetcher = makeFetcher();
		const incomingHeaders = new Headers({
			authorization: "token-del-navegador",
			cookie: "odp_session=x",
		});

		await forwardToCatalog(pedido({ incomingHeaders }), fetcher);

		const [, init] = fetcher.mock.calls[0];
		const enviadas = new Headers(init?.headers);
		expect(enviadas.get("authorization")).toBe(TOKEN);
		expect(enviadas.get("cookie")).toBeNull();
	});
});

describe("el puente — la respuesta del catálogo", () => {
	it("pasa el status y el cuerpo tal cual, también cuando el catálogo niega", async () => {
		const negado = {
			success: false,
			error: { __type: "Authorization Error", message: "Access denied" },
		};
		const fetcher = makeFetcher({ status: 403, json: async () => negado });

		const resultado = await forwardToCatalog(pedido(), fetcher);

		expect(resultado.status).toBe(403);
		expect(resultado.body).toEqual(negado);
	});

	it("un catálogo caído es 502 con cuerpo propio, sin excepción", async () => {
		const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error("ECONNREFUSED"));

		const resultado = await forwardToCatalog(pedido(), fetcher);

		expect(resultado.status).toBe(502);
		expect(resultado.body).toHaveProperty("error");
	});

	it("un cuerpo que no es JSON no rompe el puente: se conserva el status y el cuerpo queda vacío", async () => {
		const fetcher = makeFetcher({
			status: 502,
			json: async () => {
				throw new SyntaxError("no es JSON");
			},
		});

		const resultado = await forwardToCatalog(pedido(), fetcher);

		expect(resultado.status).toBe(502);
		expect(resultado.body).toBeNull();
	});
});
