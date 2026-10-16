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
		// Lo que manda el cliente del portal (`src/lib/api/client.ts`): un `POST` sin este tipo no se reenvía.
		incomingHeaders: new Headers({ "content-type": "application/json" }),
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

describe("el puente — un `POST` que no es JSON no se reenvía", () => {
	// `SameSite=Lax` retiene la cookie en un `POST` cross-site, pero **no** entre subdominios del mismo sitio, y la
	// verificación de origen de SvelteKit sólo mira los tipos de formulario: un `POST` **sin** `Content-Type`
	// (un `Blob` sin tipo, por ejemplo) pasa sin preflight y sin esa verificación. Exigir `application/json` obliga
	// a cualquier origen ajeno a pasar por el preflight de CORS, que el portal no concede.
	it("sin `Content-Type` es 415 y **no** llama al catálogo", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(
			pedido({ action: "package_delete", incomingHeaders: new Headers() }),
			fetcher,
		);

		expect(resultado.status).toBe(415);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("con un tipo de formulario (`text/plain`) es 415 y **no** llama al catálogo", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(
			pedido({
				action: "package_delete",
				incomingHeaders: new Headers({ "content-type": "text/plain" }),
			}),
			fetcher,
		);

		expect(resultado.status).toBe(415);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("con `application/json` y parámetros de tipo (`charset`) sí se reenvía", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(
			pedido({
				incomingHeaders: new Headers({ "content-type": "Application/JSON; charset=utf-8" }),
			}),
			fetcher,
		);

		expect(fetcher).toHaveBeenCalledOnce();
		expect(resultado.status).toBe(200);
	});

	it("un `GET` no necesita `Content-Type`: no tiene cuerpo", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(pedido({ method: "GET", incomingHeaders: new Headers() }), fetcher);

		expect(fetcher).toHaveBeenCalledOnce();
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
			"content-type": "application/json",
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

describe("el puente — subidas multipart (E2/E3)", () => {
	const MULTIPART = "multipart/form-data; boundary=----abc123";

	/** Un cuerpo en stream que registra si alguien lo leyó o lo bloqueó: el puente no debe tocarlo. */
	function cuerpo() {
		return new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("partes"));
				controller.close();
			},
		});
	}

	function subida(overrides: Partial<Parameters<typeof forwardToCatalog>[0]> = {}) {
		return pedido({
			action: "resource_create",
			params: {},
			incomingHeaders: new Headers({ "content-type": MULTIPART }),
			rawBody: cuerpo(),
			...overrides,
		});
	}

	it("una acción de subida con multipart se reenvía con el stream intacto y `duplex: half`", async () => {
		const fetcher = makeFetcher();
		const raw = cuerpo();

		const resultado = await forwardToCatalog(subida({ rawBody: raw }), fetcher);

		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe(`${INTERNAL_URL}/api/3/action/resource_create`);
		expect(init?.method).toBe("POST");
		expect(init?.body).toBe(raw);
		expect((init as RequestInit & { duplex?: string }).duplex).toBe("half");
		// No se leyó ni se bloqueó: sigue siendo el mismo stream, libre para que `fetch` lo consuma.
		expect(raw.locked).toBe(false);
		expect(resultado.status).toBe(200);
	});

	it("`resource_update` también acepta multipart", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(subida({ action: "resource_update" }), fetcher);

		expect(fetcher.mock.calls[0][0]).toBe(`${INTERNAL_URL}/api/3/action/resource_update`);
	});

	it("conserva el `Content-Type` del cliente tal cual (lleva el boundary) y pone la credencial de la sesión", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(subida(), fetcher);

		const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
		expect(headers.get("content-type")).toBe(MULTIPART);
		expect(headers.get("authorization")).toBe(TOKEN);
	});

	it("conserva el `Content-Length` del cliente: sin él el stream viaja `chunked` y un WSGI puede leerlo vacío", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(
			subida({
				incomingHeaders: new Headers({ "content-type": MULTIPART, "content-length": "6" }),
			}),
			fetcher,
		);

		expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("content-length")).toBe("6");
	});

	it("un `Content-Length` que no es un entero no viaja", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(
			subida({
				incomingHeaders: new Headers({ "content-type": MULTIPART, "content-length": "6, 7" }),
			}),
			fetcher,
		);

		expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("content-length")).toBeNull();
	});

	it("ninguna otra cabecera del cliente viaja, y su `Authorization` tampoco", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(
			subida({
				incomingHeaders: new Headers({
					"content-type": MULTIPART,
					authorization: "token-del-atacante",
					cookie: "portal=sellada",
					"x-extra": "1",
				}),
			}),
			fetcher,
		);

		const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
		expect([...headers.keys()].sort()).toEqual(["authorization", "content-type"]);
		expect(headers.get("authorization")).toBe(TOKEN);
	});

	it("un anónimo sube sin credencial: el catálogo decide", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(subida({ session: "anonymous" }), fetcher);

		const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
		expect(headers.has("authorization")).toBe(false);
		expect(headers.get("content-type")).toBe(MULTIPART);
	});

	it("multipart en cualquier otra acción es 415 y **no** llama al catálogo", async () => {
		const fetcher = makeFetcher();

		for (const action of ["package_create", "package_delete", "resource_delete", "user_show"]) {
			const resultado = await forwardToCatalog(subida({ action }), fetcher);
			expect(resultado.status).toBe(415);
		}
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("una sesión muerta es 401 y **no** llama al catálogo", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(subida({ session: "dead" }), fetcher);

		expect(resultado.status).toBe(401);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("una acción desconocida es 404 y **no** llama al catálogo", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(subida({ action: "api_token_create" }), fetcher);

		expect(resultado.status).toBe(404);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("multipart sin cuerpo en stream es 415 y **no** llama al catálogo", async () => {
		const fetcher = makeFetcher();

		const resultado = await forwardToCatalog(subida({ rawBody: null }), fetcher);

		expect(resultado.status).toBe(415);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("un fallo de red al subir es 502, igual que con JSON", async () => {
		const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error("ECONNREFUSED"));

		const resultado = await forwardToCatalog(subida(), fetcher);

		expect(resultado.status).toBe(502);
	});

	it("PRESERVE: el JSON de siempre sigue reenviándose con `application/json` y sin `duplex`", async () => {
		const fetcher = makeFetcher();

		await forwardToCatalog(
			pedido({ action: "resource_create", params: { package_id: "p" } }),
			fetcher,
		);

		const [, init] = fetcher.mock.calls[0];
		expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
		expect(init?.body).toBe(JSON.stringify({ package_id: "p" }));
		expect((init as RequestInit & { duplex?: string }).duplex).toBeUndefined();
	});
});
