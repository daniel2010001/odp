// Insertar un gráfico (P4): el camino de la página incrustable, el código `<iframe>` y la política de
// *framing* por ruta. La política es de seguridad (Risk ítem 2): lo que no es `/embed/**` no se puede
// enmarcar desde otro sitio, y ninguna forma rara de escribir la ruta debe abrir esa puerta.

import { describe, expect, it } from "vitest";
import {
	embedPath,
	embedSnippet,
	embedUrl,
	framingHeaders,
	isEmbedPath,
	SELF_FRAMING_HEADERS,
} from "./embed";

describe("embedPath / embedUrl", () => {
	it("arma la ruta de la página incrustable y la URL absoluta", () => {
		expect(embedPath("abc-123")).toBe("/embed/charts/abc-123");
		expect(embedUrl("https://datos.umss.edu.bo", "abc-123")).toBe(
			"https://datos.umss.edu.bo/embed/charts/abc-123",
		);
	});

	it("codifica un id con caracteres especiales", () => {
		expect(embedPath("a/b c")).toBe("/embed/charts/a%2Fb%20c");
	});
});

describe("embedSnippet", () => {
	it("es un <iframe> con la URL absoluta como src, un título accesible y tamaño", () => {
		const html = embedSnippet("https://x.test/embed/charts/v1", "Salario por turno");
		expect(html).toBe(
			'<iframe src="https://x.test/embed/charts/v1" title="Salario por turno" width="100%" height="420" style="border:0" loading="lazy"></iframe>',
		);
	});

	it("escapa el título para que no rompa el atributo", () => {
		const html = embedSnippet("https://x.test/e", 'A "B" <c> & d');
		expect(html).toContain('title="A &quot;B&quot; &lt;c&gt; &amp; d"');
		expect(html).not.toContain('"B"');
	});
});

describe("isEmbedPath", () => {
	it.each([
		"/embed/charts/x",
		"/embed/charts/x/",
		"/embed/charts/x/__data.json",
		"/embed/anything",
		// Doble codificación: SvelteKit la enruta a la página como `viewId="%2e%2e"`, no como `..` (verificador de P4).
		"/embed/charts/%252e%252e",
	])("%s es incrustable", (path) => {
		expect(isEmbedPath(path)).toBe(true);
	});

	it.each([
		"/",
		"/dataset/x",
		"/embed",
		"/embed/",
		"/embedded",
		"/embedded/charts/x",
		"/embed-x/charts/x",
		"/embed-x",
		"/Embed/charts/x",
		"/x/embed/charts/x",
		"//embed/charts/x",
		"/embed//charts/x",
		"/embed/../dataset/x",
		"/embed/./charts/x",
		"/embed/%2e%2e/dataset/x",
		"/embed/%2E%2E/dataset/x",
		"/embed/charts/%2e%2e/%2e%2e/dataset",
		"/embed%2Fcharts/x",
		"/%65mbed/charts/x",
		"/embed/..%2Fdataset/x",
		"/embed/charts%5Cx",
		"/embed/charts/..%5cx",
		"/embed/charts/%2e%2e%2fx",
		"/embed/%00",
		"/embed/%zz",
		"",
	])("%s NO es incrustable", (path) => {
		expect(isEmbedPath(path)).toBe(false);
	});
});

describe("framingHeaders", () => {
	it("fuera de /embed: sólo el propio origen, con las dos cabeceras", () => {
		expect(framingHeaders("/dataset/x")).toEqual({
			"Content-Security-Policy": "frame-ancestors 'self'",
			"X-Frame-Options": "SAMEORIGIN",
		});
		expect(SELF_FRAMING_HEADERS["Content-Security-Policy"]).toBe("frame-ancestors 'self'");
	});

	it("en /embed/**: cualquier ancestro y sin X-Frame-Options", () => {
		expect(framingHeaders("/embed/charts/x")).toEqual({
			"Content-Security-Policy": "frame-ancestors *",
		});
	});
});
