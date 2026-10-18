// El hook del servidor y el bloqueo del *framing* (P4, Risk ítem 2): todo lo que sirve SvelteKit lleva
// `frame-ancestors 'self'` y `X-Frame-Options: SAMEORIGIN`, salvo `/embed/**`. Se prueba con `handle` real y un
// `resolve` doble, porque la decisión es sobre la respuesta, venga de una página o de un error.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyFramingHeaders } from "$lib/charts/embed";

// `hooks.server.ts` importa `$app/environment` y `$env/dynamic/private`, que Vitest no resuelve (no hay alias),
// así que el hook no se puede montar acá. La decisión vive en `applyFramingHeaders` y se prueba con respuestas
// reales; el hook es el adaptador, y lo que se ancla es que la use sobre **toda** respuesta.
function run(path: string, response: Response = new Response("ok")) {
	return Promise.resolve({
		res: applyFramingHeaders(response, new URL(path, "http://localhost").pathname),
	});
}

const SELF = "frame-ancestors 'self'";

describe("hooks — framing", () => {
	it("una página normal sólo se puede enmarcar desde el mismo origen", async () => {
		const { res } = await run("/dataset/x");
		expect(res.headers.get("Content-Security-Policy")).toBe(SELF);
		expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("la portada también", async () => {
		const { res } = await run("/");
		expect(res.headers.get("Content-Security-Policy")).toBe(SELF);
		expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("/embed/charts/x se puede enmarcar desde cualquier sitio y no lleva X-Frame-Options", async () => {
		const { res } = await run("/embed/charts/x");
		expect(res.headers.get("Content-Security-Policy")).toBe("frame-ancestors *");
		expect(res.headers.has("X-Frame-Options")).toBe(false);
	});

	it.each([
		"/embedded",
		"/embed-x",
		"/embed",
		"/embed/../dataset/x",
		"/embed/%2e%2e/dataset/x",
		"/embed%2Fcharts/x",
		"/EMBED/charts/x",
	])("el casi-igual %s sigue bloqueado", async (path) => {
		const { res } = await run(path);
		expect(res.headers.get("Content-Security-Policy")).toBe(SELF);
		expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("un 404 de una ruta normal lleva el bloqueo", async () => {
		const { res } = await run("/no-existe", new Response("nope", { status: 404 }));
		expect(res.status).toBe(404);
		expect(res.headers.get("Content-Security-Policy")).toBe(SELF);
		expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("un 404 bajo /embed lleva la política abierta", async () => {
		const { res } = await run("/embed/nada", new Response("nope", { status: 404 }));
		expect(res.status).toBe(404);
		expect(res.headers.get("Content-Security-Policy")).toBe("frame-ancestors *");
		expect(res.headers.has("X-Frame-Options")).toBe(false);
	});

	it("no pisa el cuerpo, el estado ni otras cabeceras, y no agrega más CSP que frame-ancestors", async () => {
		const upstream = new Response("cuerpo", {
			status: 201,
			headers: { "X-Otra": "1", "Content-Type": "text/plain" },
		});
		const { res } = await run("/x", upstream);
		expect(res.status).toBe(201);
		expect(await res.text()).toBe("cuerpo");
		expect(res.headers.get("X-Otra")).toBe("1");
		expect(res.headers.get("Content-Security-Policy")).toBe(SELF);
	});

	it("funciona con una respuesta de cabeceras inmutables (redirección de fetch)", async () => {
		const redirect = Response.redirect("http://localhost/y", 302);
		const { res } = await run("/x", redirect);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("http://localhost/y");
		expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("una cabecera de CSP que ya traía la respuesta se reemplaza por la del portal", async () => {
		const { res } = await run(
			"/x",
			new Response("ok", { headers: { "Content-Security-Policy": "frame-ancestors *" } }),
		);
		expect(res.headers.get("Content-Security-Policy")).toBe(SELF);
	});

	it("/embed/** quita un X-Frame-Options que la respuesta ya trajera", async () => {
		const { res } = await run(
			"/embed/charts/x",
			new Response("ok", { headers: { "X-Frame-Options": "DENY" } }),
		);
		expect(res.headers.has("X-Frame-Options")).toBe(false);
	});
});

describe("hooks.server.ts — el adaptador", () => {
	const source = readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), "hooks.server.ts"),
		"utf8",
	);

	it("aplica el bloqueo a la respuesta de resolve, es decir a páginas y errores por igual", () => {
		expect(source).toMatch(
			/return applyFramingHeaders\(\s*await resolve\(event\),\s*event\.url\.pathname\s*\)/,
		);
	});

	it("conserva la resolución de sesión y el borrado de la cookie muerta", () => {
		expect(source).toContain("event.locals.session = session");
		expect(source).toContain("event.locals.user = user");
		expect(source).toContain("event.cookies.delete(SESSION_COOKIE_NAME");
	});

	it("no define otra CSP que frame-ancestors", () => {
		expect(source).not.toMatch(/default-src|script-src|style-src/);
	});
});
