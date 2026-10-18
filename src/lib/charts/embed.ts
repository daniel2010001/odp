// Insertar un gráfico en otra página (P4, L28 punto 4): la ruta de la página incrustable, el código `<iframe>`
// que se le entrega a quien inserta, y la política de *framing* del portal.
//
// ─── La política de framing es de seguridad (Risk ítem 2) ──────────────
// Hasta P4 el portal no enviaba `frame-ancestors` ni `X-Frame-Options` (L28, «Hallazgo de seguridad»), así que
// cualquier página se podía meter en un `<iframe>` ajeno. Ahora **todo lo que sirve SvelteKit** sólo se puede
// enmarcar desde el propio origen, salvo `/embed/**`, que existe para eso. `/api/` es CKAN a través del proxy y
// queda fuera: los hooks no lo cubren (L30).
//
// Es una función pura, sin módulos virtuales de SvelteKit, para que se pruebe sin ellos: el hook sólo la llama.
//
// ─── Por qué el cotejo de la ruta es estricto ──────────────────────────
// Una ruta es incrustable sólo si empieza **exactamente** por `/embed/` y ningún segmento, ya decodificado, es
// vacío, `.` o `..` ni lleva una barra, una barra invertida o un carácter de control. Ante cualquier duda
// —una codificación rara, un `%` mal formado— se bloquea: equivocarse hacia «bloqueado» sólo rompe un
// `<iframe>`, equivocarse hacia «permitido» abre el portal entero al *clickjacking*. `/embedded`, `/embed-x`,
// `/embed` y `/Embed/…` no son incrustables.

/** El prefijo de las páginas que se pueden enmarcar desde cualquier sitio. */
const EMBED_PREFIX = "/embed/";

export const SELF_FRAMING_HEADERS = {
	"Content-Security-Policy": "frame-ancestors 'self'",
	"X-Frame-Options": "SAMEORIGIN",
} as const;

export const ANY_FRAMING_HEADERS = {
	"Content-Security-Policy": "frame-ancestors *",
} as const;

/** La ruta de la página incrustable de una vista guardada. */
export function embedPath(viewId: string): string {
	return `/embed/charts/${encodeURIComponent(viewId)}`;
}

/** La URL **absoluta** de la página incrustable: es el `src` del `<iframe>`. */
export function embedUrl(origin: string, viewId: string): string {
	return `${origin}${embedPath(viewId)}`;
}

function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** El código para pegar en otra página: el `title` es el nombre accesible del marco. */
export function embedSnippet(url: string, title: string): string {
	return `<iframe src="${escapeAttribute(url)}" title="${escapeAttribute(title)}" width="100%" height="420" style="border:0" loading="lazy"></iframe>`;
}

/** ¿`pathname` es una página que se puede enmarcar desde cualquier sitio? Ver el encabezado del archivo. */
export function isEmbedPath(pathname: string): boolean {
	if (!pathname.startsWith(EMBED_PREFIX)) return false;
	const segments = pathname.slice(EMBED_PREFIX.length).split("/");
	// Una barra final es válida (`/embed/charts/x/`); cualquier otro segmento vacío no.
	if (segments.at(-1) === "") segments.pop();
	if (segments.length === 0) return false;
	return segments.every((segment) => {
		let decoded: string;
		try {
			decoded = decodeURIComponent(segment);
		} catch {
			return false;
		}
		if (decoded === "" || decoded === "." || decoded === "..") return false;
		return [...decoded].every((char) => {
			const code = char.charCodeAt(0);
			return char !== "/" && char !== "\\" && code > 0x1f && code !== 0x7f;
		});
	});
}

/** Las cabeceras de framing que corresponden a una ruta. */
export function framingHeaders(pathname: string): Record<string, string> {
	return isEmbedPath(pathname) ? { ...ANY_FRAMING_HEADERS } : { ...SELF_FRAMING_HEADERS };
}

/**
 * La respuesta con las cabeceras de framing de su ruta. Reemplaza lo que la respuesta ya traía y, en
 * `/embed/**`, quita `X-Frame-Options` (que no tiene forma de decir «cualquiera»). Una respuesta de cabeceras
 * inmutables (la de un `fetch` o `Response.redirect`) se reconstruye con el mismo cuerpo, estado y cabeceras.
 */
export function applyFramingHeaders(response: Response, pathname: string): Response {
	const wanted = framingHeaders(pathname);
	const apply = (target: Response) => {
		target.headers.delete("X-Frame-Options");
		target.headers.delete("Content-Security-Policy");
		for (const [name, value] of Object.entries(wanted)) target.headers.set(name, value);
		return target;
	};
	try {
		return apply(response);
	} catch {
		return apply(
			new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			}),
		);
	}
}
