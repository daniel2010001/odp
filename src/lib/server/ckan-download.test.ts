// Pruebas de la **descarga por el portal**: el servidor autentica contra el catálogo y devuelve los bytes
// (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, S3 y § El diseño de T6, G1–G6).
//
// Lo que estas pruebas fijan, y por qué:
//  1. **Las negativas no llaman al archivo.** Sesión muerta, `resource_show` denegado, enlace externo: la
//     aserción es que el `fetch` del archivo **no se llamó**, no sólo el status.
//  2. **La URL del archivo se construye, no se copia.** El host de `resource.url` no se usa jamás (SSRF con
//     credencial): el archivo se pide a `internalUrl`.
//  3. **Del cliente viajan `Range` e `If-Range` y nada más** —ni su `Authorization` ni su `Cookie`—; el archivo se
//     pide con `Accept-Encoding: identity`.
//  4. **Ningún contenido activo desde el origen del portal**: sólo la lista G4 va `inline`; lo demás,
//     `attachment` + `sandbox`; `nosniff` siempre.

import { describe, expect, it, vi } from "vitest";
import type { Fetcher } from "./ckan-bridge";
import { downloadResource } from "./ckan-download";

const INTERNAL_URL = "http://ckan:5000";
const TOKEN = "jwt-de-la-sesion";
const SHOW_URL = `${INTERNAL_URL}/api/3/action/resource_show`;

function resourceShow(result: Record<string, unknown>, status = 200): Response {
	return new Response(JSON.stringify({ success: status === 200, result }), { status });
}

const UPLOAD = {
	id: "res-1",
	package_id: "pkg-1",
	url_type: "upload",
	url: "http://localhost:5000/dataset/pkg-1/resource/res-1/download/flujos.pdf",
};

/** Un `fetch` que responde `resource_show` con lo pedido y el archivo con `file` (o lo que se le pase). */
function makeFetcher(show: Response, file?: Response | Error) {
	return vi.fn<Fetcher>(async (url) => {
		if (url.startsWith(SHOW_URL)) return show;
		if (file instanceof Error) throw file;
		return (
			file ?? new Response("bytes", { status: 200, headers: { "content-type": "application/pdf" } })
		);
	});
}

function descarga(
	fetcher: Fetcher,
	overrides: Partial<Parameters<typeof downloadResource>[0]> = {},
) {
	return downloadResource({
		resourceId: "res-1",
		session: { token: TOKEN },
		internalUrl: INTERNAL_URL,
		incomingHeaders: new Headers(),
		fetcher,
		...overrides,
	});
}

function fileCalls(fetcher: ReturnType<typeof makeFetcher>) {
	return fetcher.mock.calls.filter(([url]) => !url.startsWith(SHOW_URL));
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
	return new Headers(init?.headers).get(name);
}

describe("la descarga — las negativas no llaman a nada", () => {
	it("una sesión muerta es 401 y no hace ningún fetch", async () => {
		const fetcher = makeFetcher(resourceShow(UPLOAD));
		const res = await descarga(fetcher, { session: "dead" });
		expect(res.status).toBe(401);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("un anónimo pide `resource_show` sin `Authorization`", async () => {
		const fetcher = makeFetcher(resourceShow(UPLOAD));
		await descarga(fetcher, { session: "anonymous" });
		const [, init] = fetcher.mock.calls[0];
		expect(headerOf(init, "authorization")).toBeNull();
	});

	it("una sesión viva pide `resource_show` con su credencial y el id", async () => {
		const fetcher = makeFetcher(resourceShow(UPLOAD));
		await descarga(fetcher);
		const [url, init] = fetcher.mock.calls[0];
		expect(url.startsWith(SHOW_URL)).toBe(true);
		expect(headerOf(init, "authorization")).toBe(TOKEN);
		expect(url + String(init?.body ?? "")).toContain("res-1");
	});

	it("un enlace externo (`url_type` distinto de upload) es 404 y el archivo nunca se pide", async () => {
		const fetcher = makeFetcher(resourceShow({ ...UPLOAD, url_type: undefined }));
		const res = await descarga(fetcher);
		expect(res.status).toBe(404);
		expect(fileCalls(fetcher)).toHaveLength(0);
	});

	it("CKAN 403 en `resource_show` es 403 y el archivo nunca se pide", async () => {
		const fetcher = makeFetcher(resourceShow({}, 403));
		const res = await descarga(fetcher);
		expect(res.status).toBe(403);
		expect(fileCalls(fetcher)).toHaveLength(0);
	});

	it("CKAN 404 en `resource_show` es 404 y el archivo nunca se pide", async () => {
		const fetcher = makeFetcher(resourceShow({}, 404));
		const res = await descarga(fetcher);
		expect(res.status).toBe(404);
		expect(fileCalls(fetcher)).toHaveLength(0);
	});

	it("un recurso sin nombre de archivo es 404 y el archivo nunca se pide", async () => {
		const fetcher = makeFetcher(
			resourceShow({ ...UPLOAD, url: "http://x/dataset/p/resource/r/download/" }),
		);
		const res = await descarga(fetcher);
		expect(res.status).toBe(404);
		expect(fileCalls(fetcher)).toHaveLength(0);
	});

	it("un fallo de red en `resource_show` es 502 con cuerpo propio", async () => {
		const fetcher = vi.fn<Fetcher>().mockRejectedValue(new Error("ECONNREFUSED"));
		const res = await descarga(fetcher);
		expect(res.status).toBe(502);
		expect(await res.text()).not.toContain("ECONNREFUSED");
	});

	it("un fallo de red al pedir el archivo es 502 con cuerpo de texto propio", async () => {
		const fetcher = makeFetcher(resourceShow(UPLOAD), new Error("ECONNRESET"));
		const res = await descarga(fetcher);
		expect(res.status).toBe(502);
		expect(res.headers.get("content-type")).toContain("text/plain");
		expect(await res.text()).not.toContain("ECONNRESET");
	});
});

describe("la descarga — la URL del archivo se construye", () => {
	it("sale de `internalUrl` aunque `resource.url` apunte a otro host (pin de SSRF)", async () => {
		const fetcher = makeFetcher(
			resourceShow({
				...UPLOAD,
				url: "http://evil.example/dataset/x/resource/y/download/flujos.pdf",
			}),
		);
		await descarga(fetcher);
		const [[url]] = fileCalls(fetcher);
		expect(url).toBe(`${INTERNAL_URL}/dataset/pkg-1/resource/res-1/download/flujos.pdf`);
		expect(url).not.toContain("evil.example");
	});

	it("codifica cada segmento y re-codifica el nombre ya decodificado", async () => {
		const fetcher = makeFetcher(
			resourceShow({
				...UPLOAD,
				package_id: "p/1",
				url: "http://h/dataset/p/resource/r/download/mi%20archivo%C3%B1.pdf?x=1#f",
			}),
		);
		await descarga(fetcher);
		const [[url]] = fileCalls(fetcher);
		expect(url).toBe(
			`${INTERNAL_URL}/dataset/p%2F1/resource/res-1/download/mi%20archivo%C3%B1.pdf`,
		);
	});

	it("tolera una `internalUrl` con barra final", async () => {
		const fetcher = makeFetcher(resourceShow(UPLOAD));
		await descarga(fetcher, { internalUrl: `${INTERNAL_URL}/` });
		const [[url]] = fileCalls(fetcher);
		expect(url).toBe(`${INTERNAL_URL}/dataset/pkg-1/resource/res-1/download/flujos.pdf`);
	});
});

describe("la descarga — qué viaja del cliente", () => {
	it("reenvía `Range` e `If-Range` más la credencial de la sesión, y nada más", async () => {
		const fetcher = makeFetcher(resourceShow(UPLOAD));
		await descarga(fetcher, {
			incomingHeaders: new Headers({
				range: "bytes=0-99",
				"if-range": '"etag-1"',
				authorization: "Bearer del-cliente",
				cookie: "odp_session=sellada",
				"x-otra": "1",
			}),
		});
		const [[, init]] = fileCalls(fetcher);
		const headers = new Headers(init?.headers);
		expect(headers.get("range")).toBe("bytes=0-99");
		expect(headers.get("if-range")).toBe('"etag-1"');
		expect(headers.get("authorization")).toBe(TOKEN);
		expect(headers.get("cookie")).toBeNull();
		expect(headers.get("x-otra")).toBeNull();
		expect([...headers.keys()].sort()).toEqual([
			"accept-encoding",
			"authorization",
			"if-range",
			"range",
		]);
	});

	it("pide el archivo sin compresión: `fetch` descomprime solo y el `Content-Length` dejaría de coincidir", async () => {
		const fetcher = makeFetcher(resourceShow(UPLOAD));
		await descarga(fetcher, { incomingHeaders: new Headers({ "accept-encoding": "gzip, br" }) });
		const [[, init]] = fileCalls(fetcher);
		expect(new Headers(init?.headers).get("accept-encoding")).toBe("identity");
	});

	it("un anónimo no manda `Authorization` al archivo, ni siquiera el del cliente", async () => {
		const fetcher = makeFetcher(resourceShow(UPLOAD));
		await descarga(fetcher, {
			session: "anonymous",
			incomingHeaders: new Headers({ authorization: "Bearer del-cliente" }),
		});
		for (const [, init] of fetcher.mock.calls) {
			expect(headerOf(init, "authorization")).toBeNull();
		}
	});
});

describe("la descarga — qué vuelve al cliente", () => {
	it("pasa un 206 con `Content-Range` y sólo las cabeceras de la lista", async () => {
		const upstream = new Response("ab", {
			status: 206,
			headers: {
				"content-type": "application/pdf",
				"content-length": "2",
				"content-range": "bytes 0-1/10",
				"accept-ranges": "bytes",
				etag: '"e"',
				"last-modified": "Wed, 01 Jan 2025 00:00:00 GMT",
				"set-cookie": "ckan=1",
				"x-ckan-interno": "1",
			},
		});
		const res = await descarga(makeFetcher(resourceShow(UPLOAD), upstream));
		expect(res.status).toBe(206);
		expect(res.headers.get("content-range")).toBe("bytes 0-1/10");
		expect(res.headers.get("accept-ranges")).toBe("bytes");
		expect(res.headers.get("content-length")).toBe("2");
		expect(res.headers.get("etag")).toBe('"e"');
		expect(res.headers.get("last-modified")).toBe("Wed, 01 Jan 2025 00:00:00 GMT");
		expect(res.headers.get("set-cookie")).toBeNull();
		expect(res.headers.get("x-ckan-interno")).toBeNull();
		expect(await res.text()).toBe("ab");
	});

	it("pasa un 416", async () => {
		const upstream = new Response(null, {
			status: 416,
			headers: { "content-range": "bytes */10", "content-type": "application/pdf" },
		});
		const res = await descarga(makeFetcher(resourceShow(UPLOAD), upstream));
		expect(res.status).toBe(416);
		expect(res.headers.get("content-range")).toBe("bytes */10");
	});

	it("devuelve el cuerpo como el stream del catálogo, sin leerlo", async () => {
		const upstream = new Response("bytes", { headers: { "content-type": "application/pdf" } });
		const res = await descarga(makeFetcher(resourceShow(UPLOAD), upstream));
		expect(upstream.bodyUsed).toBe(false);
		expect(res.body).toBe(upstream.body);
	});

	it("siempre `nosniff`, `private, no-store` y `Vary: Cookie`", async () => {
		const res = await descarga(makeFetcher(resourceShow(UPLOAD)));
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("cache-control")).toBe("private, no-store");
		expect(res.headers.get("vary")).toBe("Cookie");
	});

	it("text/html sale como adjunto, con `sandbox` y `nosniff`", async () => {
		const upstream = new Response("<script>1</script>", {
			headers: { "content-type": "text/html; charset=utf-8" },
		});
		const res = await descarga(
			makeFetcher(
				resourceShow({ ...UPLOAD, url: "http://h/d/p/resource/r/download/pagina.html" }),
				upstream,
			),
		);
		expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
		expect(res.headers.get("content-disposition")).toContain("pagina.html");
		expect(res.headers.get("content-security-policy")).toBe("sandbox");
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("image/svg+xml también sale como adjunto con `sandbox`", async () => {
		const upstream = new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } });
		const res = await descarga(makeFetcher(resourceShow(UPLOAD), upstream));
		expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
		expect(res.headers.get("content-security-policy")).toBe("sandbox");
	});

	it("un tipo ausente sale como adjunto con `sandbox`", async () => {
		const res = await descarga(
			makeFetcher(resourceShow(UPLOAD), new Response(new Uint8Array([1]))),
		);
		expect(res.headers.get("content-type")).toBeNull();
		expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
		expect(res.headers.get("content-security-policy")).toBe("sandbox");
	});

	it("application/pdf va inline: sin `attachment` ni `sandbox`, con `nosniff`", async () => {
		const res = await descarga(makeFetcher(resourceShow(UPLOAD)));
		expect(res.headers.get("content-disposition")).toBeNull();
		expect(res.headers.get("content-security-policy")).toBeNull();
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it.each([
		"image/png",
		"image/jpeg",
		"image/gif",
		"image/webp",
		"text/plain",
		"text/csv",
		"application/json",
		// GeoJSON es JSON: sin él, la vista previa de un `.geojson` quedaba en blanco (demo, 2026-10-18).
		"application/geo+json",
	])("%s va inline", async (tipo) => {
		const upstream = new Response("x", { headers: { "content-type": tipo } });
		const res = await descarga(makeFetcher(resourceShow(UPLOAD), upstream));
		expect(res.headers.get("content-disposition")).toBeNull();
		expect(res.headers.get("content-security-policy")).toBeNull();
	});

	it("Application/Geo+JSON; charset=utf-8 va inline con nosniff y sin sandbox", async () => {
		const upstream = new Response("x", {
			headers: { "content-type": "Application/Geo+JSON; charset=utf-8" },
		});
		const res = await descarga(makeFetcher(resourceShow(UPLOAD), upstream));
		expect(res.headers.get("content-disposition")).toBeNull();
		expect(res.headers.get("content-security-policy")).toBeNull();
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("compara el tipo sin parámetros y sin distinguir mayúsculas", async () => {
		const upstream = new Response("x", { headers: { "content-type": "Text/CSV; charset=utf-8" } });
		const res = await descarga(makeFetcher(resourceShow(UPLOAD), upstream));
		expect(res.headers.get("content-disposition")).toBeNull();
	});
});
