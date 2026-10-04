// Tests de la hoja de revisión del error: la propiedad que la hace útil es que cubra los cinco
// estados que el autor tiene que mirar —401, 403, 404, 500 y 503— y que muestre el **componente
// real**, no una maqueta. Cada aserción de copia sale de `errorCopy`/`errorState` del propio
// componente: si la hoja deja de renderizarlo (o alguien escribe el texto a mano), estos tests
// fallan.
//
// Los 503 y los 500 no se pueden provocar a mano: por eso la hoja los muestra juntos, igual que
// `/dev/copy` muestra el estado de sesión que la sonda nunca resuelve sola.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { contrastRatio, parseCssColor } from "$lib/color/contrast";
import { errorCopy, errorState } from "$lib/components/error/ErrorPage.svelte";
import ErrorSheet from "./+page.svelte";
import { formatMeasures, type SheetMeasures } from "./measures";

const COVERED_STATUSES = [401, 403, 404, 500, 503] as const;
const CLIENT_STATUSES = [401, 403, 404] as const;
const SERVER_STATUSES = [500, 503] as const;

function panel(status: number): HTMLElement {
	return screen.getByTestId(`error-variant-${status}`);
}

function headingOf(status: number): string {
	return within(panel(status)).getByRole("heading", { level: 1 }).textContent?.trim() ?? "";
}

function bodyOf(status: number): string {
	const heading = within(panel(status)).getByRole("heading", { level: 1 });
	const body = heading.nextElementSibling;
	return body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

// El stub de `$app/stores` expone `page` como store escribible; el tipo real de SvelteKit es de
// sólo lectura y se fija con un cast limitado al test (mismo patrón que `search-page.test.ts`).
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function setUrl(search: string): void {
	pageStore.set({ params: {}, url: new URL(`http://localhost/dev/error${search}`) });
}

/** Los data-testid de las tarjetas renderizadas, en orden. */
function renderedCardIds(): (string | null)[] {
	return Array.from(document.querySelectorAll('[data-testid^="error-variant-"]')).map((node) =>
		node.getAttribute("data-testid"),
	);
}

/** Afirma que las cinco tarjetas siguen ahí, en orden, sin importar el estado del panel. */
function expectAllCards(): void {
	expect(renderedCardIds()).toEqual(COVERED_STATUSES.map((status) => `error-variant-${status}`));
}

/** Ratio WCAG esperado de un par de colores CSS: sale del módulo puro, no de una constante mágica. */
function ratioOf(color: string, background: string): number {
	const foreground = parseCssColor(color);
	const parsedBackground = parseCssColor(background);
	if (!foreground || !parsedBackground) {
		throw new Error(`par de colores no parseable: ${color} / ${background}`);
	}
	return contrastRatio(foreground, parsedBackground);
}

// El store de `page` persiste entre tests: cada uno arranca en una URL sin parámetros para que los
// defaults y la preselección por URL no se contaminen entre casos.
beforeEach(() => {
	setUrl("");
});

describe("hoja de error — cobertura de estados", () => {
	it("cubre exactamente 401, 403, 404, 500 y 503, ni uno más", () => {
		render(ErrorSheet);

		const rendered = Array.from(document.querySelectorAll('[data-testid^="error-variant-"]')).map(
			(node) => node.getAttribute("data-testid"),
		);

		expect(rendered).toEqual(COVERED_STATUSES.map((status) => `error-variant-${status}`));
	});

	for (const status of COVERED_STATUSES) {
		it(`la variante ${status} renderiza el componente real con su copia y una etiqueta visible`, () => {
			render(ErrorSheet);

			const copy = errorCopy(status);
			const variant = panel(status);

			expect(within(variant).getByRole("heading", { level: 1 })).toHaveTextContent(copy.heading);
			expect(variant).toHaveTextContent(copy.body);
			expect(variant).toHaveTextContent(`ERROR ${status}`);
			// La etiqueta nombra la variante y su familia, para que el revisor sepa qué está mirando.
			expect(variant).toHaveTextContent(errorState(status) === "client" ? "4xx" : "5xx");
		});
	}

	it("las tres variantes 4xx son el mismo estado y las dos 5xx el suyo", () => {
		render(ErrorSheet);

		const clientHeadings = CLIENT_STATUSES.map((status) => headingOf(status));
		expect(new Set(clientHeadings).size).toBe(1);

		const serverHeadings = SERVER_STATUSES.map((status) => headingOf(status));
		expect(new Set(serverHeadings).size).toBe(1);

		expect(headingOf(404)).not.toBe(headingOf(500));
		expect(bodyOf(401)).toBe(bodyOf(403));
		expect(bodyOf(403)).toBe(bodyOf(404));
	});

	it("ninguna variante ofrece una acción de inicio de sesión", () => {
		render(ErrorSheet);

		for (const status of COVERED_STATUSES) {
			const variant = panel(status);
			expect(
				within(variant).queryByRole("link", { name: /iniciar sesión|ingresar|login/i }),
			).toBeNull();
			expect(variant.textContent ?? "").not.toMatch(/iniciar sesión|ingresar|login/i);
		}
	});

	it("sólo las variantes 5xx ofrecen reintentar", () => {
		render(ErrorSheet);

		for (const status of SERVER_STATUSES) {
			expect(within(panel(status)).getByRole("link", { name: /reintentar/i })).toBeInTheDocument();
		}
		for (const status of CLIENT_STATUSES) {
			expect(within(panel(status)).queryByRole("link", { name: /reintentar/i })).toBeNull();
		}
	});
});

describe("hoja de error — la ruta no existe en producción", () => {
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

describe("hoja de error — panel de control de la ronda de revisión", () => {
	it("muestra el panel de control", () => {
		render(ErrorSheet);

		expect(screen.getByTestId("control-panel")).toBeInTheDocument();
	});

	it("el preset «500 sin ruta» quita «Reintentar» y el preset con ruta lo repone", async () => {
		render(ErrorSheet);

		await fireEvent.click(screen.getByTestId("preset-500-no-path"));
		await waitFor(() => {
			expect(within(panel(500)).queryByRole("link", { name: /reintentar/i })).toBeNull();
		});

		await fireEvent.click(screen.getByTestId("preset-500-path"));
		await waitFor(() => {
			expect(within(panel(500)).getByRole("link", { name: /reintentar/i })).toBeInTheDocument();
		});
	});

	it("el interruptor de tema agrega y quita la clase dark en la raíz", async () => {
		render(ErrorSheet);

		const sheet = screen.getByTestId("error-sheet");
		expect(sheet).not.toHaveClass("dark");

		await fireEvent.click(screen.getByTestId("theme-dark"));
		await waitFor(() => expect(sheet).toHaveClass("dark"));

		await fireEvent.click(screen.getByTestId("theme-light"));
		await waitFor(() => expect(sheet).not.toHaveClass("dark"));
	});

	it("el diseño único conserva el contrato de presentación del componente", async () => {
		// Fuera de DEV el componente no debe filtrar la línea de diagnóstico monoespaciada; el resto
		// del contrato tiene que seguir en pie igual.
		vi.stubEnv("DEV", false);
		try {
			render(ErrorSheet);

			const cases = [
				{ status: 404, path: "con" },
				{ status: 500, path: "con" },
				{ status: 500, path: "sin" },
			] as const;

			for (const { status, path } of cases) {
				if (status === 500) {
					await fireEvent.click(
						screen.getByTestId(path === "con" ? "preset-500-path" : "preset-500-no-path"),
					);
					await waitFor(() => {
						const retry = within(panel(500)).queryByRole("link", { name: /reintentar/i });
						expect(retry !== null).toBe(path === "con");
					});
				}

				const root = screen.getByTestId(`error-render-${status}`).firstElementChild as HTMLElement;

				// Restricción 1: la columna del contrato, sin ensanchar.
				expect(root.className).toContain("max-w-xl");
				expect(root.className).toContain("py-16");
				expect(root.className).toContain("px-4");
				expect(root.className).not.toContain("lg:max-w");

				// Restricción 2: el eyebrow es el primer <p> y conserva sus clases.
				const eyebrow = root.querySelector("p");
				expect(eyebrow?.textContent).toContain(`ERROR ${status}`);
				for (const required of ["text-xs", "uppercase", "tracking-wider", "text-destructive"]) {
					expect(eyebrow?.className).toContain(required);
				}

				// Restricción 3: h1 y cuerpo hermanos inmediatos.
				const heading = root.querySelector("h1");
				expect(heading?.nextElementSibling?.tagName).toBe("P");

				// Restricción 4: el primer <svg> es el ícono del estado, oculto a lectores, y cambia
				// entre cliente y servidor.
				const icon = root.querySelector("svg");
				expect(icon?.getAttribute("aria-hidden")).toBe("true");
				expect(icon?.getAttribute("class")).toMatch(
					status >= 500 ? /triangle-alert/ : /file-question/,
				);

				// Restricción 5: una acción en el 500 sin ruta —no se inventa «Reintentar»—, dos en el
				// resto. La ronda pedía «exactamente 2» en todas las combinaciones, pero el propio
				// contrato —el reintento existe sólo con ruta— deja una sola en el 500 sin ruta: se
				// afirma el número real.
				const focusables = root.querySelectorAll("a, button, input, select, textarea, [tabindex]");
				expect(focusables).toHaveLength(status === 500 && path === "sin" ? 1 : 2);

				// Restricción 6: fuera de DEV no hay ningún `.font-mono` dentro del componente.
				expect(root.querySelectorAll(".font-mono")).toHaveLength(0);

				// Restricción 7: el contenedor de acciones apila en móvil.
				const actions = root.querySelector("a")?.parentElement;
				expect(actions?.className).toContain("flex-col");
				expect(actions?.className).toContain("sm:flex-row");
			}
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

describe("hoja de error — instrumento de contraste", () => {
	// En jsdom no se aplica la hoja de estilos: el texto cae al negro por defecto y ningún ancestro
	// declara fondo, así que el fondo efectivo es el blanco del lienzo. El número esperado sale del
	// módulo puro, no de una constante mágica.
	const jsdomRatio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }).toFixed(2);

	it("mide el ratio y el veredicto del nodo ya renderizado", async () => {
		render(ErrorSheet);

		await waitFor(() => {
			expect(screen.getByTestId("contrast-ratio-eyebrow")).toHaveTextContent(jsdomRatio);
		});
		expect(screen.getByTestId("contrast-verdict-eyebrow").textContent?.trim()).toBe("ok");
	});

	it("fija las tres salidas del veredicto: falla, ok y no medible", async () => {
		render(ErrorSheet);

		// En jsdom no corre la hoja de estilos: se escriben inline el `color` y el `background-color`
		// sobre el eyebrow —el nodo que el instrumento mide— para que `getComputedStyle` los
		// devuelva. El ratio esperado sale de `contrastRatio` del módulo puro, no de un número escrito
		// a mano, y el veredicto se afirma como texto exacto, no con un `match` permisivo.
		const eyebrow = (): HTMLElement => {
			const root = screen.getByTestId("error-render-404").firstElementChild as HTMLElement;
			return root.querySelector("p") as HTMLElement;
		};

		// 1) Un par por debajo del umbral AA: el veredicto tiene que ser «falla», nunca un «ok»
		// optimista. Es la salida que el andamio de variantes dejó sin cubrir.
		const lowRatio = ratioOf("#000000", "#6b6b6b");
		expect(lowRatio).toBeLessThan(4.5);
		eyebrow().style.color = "#000000";
		eyebrow().style.backgroundColor = "#6b6b6b";
		await fireEvent.click(screen.getByTestId("theme-dark"));
		await waitFor(() =>
			expect(screen.getByTestId("contrast-ratio-eyebrow")).toHaveTextContent(lowRatio.toFixed(2)),
		);
		expect(screen.getByTestId("contrast-verdict-eyebrow").textContent?.trim()).toBe("falla");

		// 2) Un par por encima del umbral: el mismo camino tiene que decir «ok», no «falla».
		const highRatio = ratioOf("#000000", "#ffffff");
		expect(highRatio).toBeGreaterThan(4.5);
		eyebrow().style.color = "#000000";
		eyebrow().style.backgroundColor = "#ffffff";
		await fireEvent.click(screen.getByTestId("theme-light"));
		await waitFor(() =>
			expect(screen.getByTestId("contrast-verdict-eyebrow").textContent?.trim()).toBe("ok"),
		);
		expect(screen.getByTestId("contrast-ratio-eyebrow")).toHaveTextContent(highRatio.toFixed(2));

		// 3) Un fondo que no se puede parsear: «no medible» gana sobre el ok/falla calculado.
		eyebrow().style.backgroundColor = "lab(50 40 59.5)";
		await fireEvent.click(screen.getByTestId("theme-dark"));
		await waitFor(() =>
			expect(screen.getByTestId("contrast-verdict-eyebrow").textContent?.trim()).toBe("no medible"),
		);
	});

	it("recalcula al cambiar el tema y sigue midiendo", async () => {
		render(ErrorSheet);

		await waitFor(() =>
			expect(screen.getAllByTestId(/^contrast-ratio-/).length).toBeGreaterThan(0),
		);

		await fireEvent.click(screen.getByTestId("theme-dark"));
		await waitFor(() => {
			expect(screen.getByTestId("error-sheet")).toHaveClass("dark");
			expect(screen.getByTestId("contrast-ratio-eyebrow")).toHaveTextContent(jsdomRatio);
		});
	});

	it("imprime exactamente el texto que corresponde a la medida del árbol, no una constante", async () => {
		render(ErrorSheet);

		await waitFor(() =>
			expect(screen.getByTestId("measure-column-width")).toHaveTextContent("0.00 px"),
		);

		// jsdom no corre la hoja de estilos ni tiene motor de layout: `getBoundingClientRect` y los
		// `scroll/clientWidth` valen 0. Sin navegador no se puede verificar un número de diseño, y este
		// test no lo intenta. Lo que sí fija —y es lo que puede romperse— es el acoplamiento
		// medida→texto: el instrumento tiene que imprimir exactamente `formatMeasures` de lo que midió
		// en el árbol, no un literal. Se leen las mismas medidas del mismo nodo y se compara.
		// Límite explícito: en jsdom la medida leída es 0, así que el esperado es "0.00 px".
		const root = screen.getByTestId("error-render-404").firstElementChild as HTMLElement;
		// El instrumento mide la columna del componente y la tarjeta que vive dentro.
		const cardShell = root.firstElementChild instanceof HTMLElement ? root.firstElementChild : root;
		const raw: SheetMeasures = {
			columnWidth: root.getBoundingClientRect().width,
			cardScrollWidth: cardShell.scrollWidth,
			cardClientWidth: cardShell.clientWidth,
			pageScrollWidth: document.documentElement.scrollWidth,
			pageClientWidth: document.documentElement.clientWidth,
		};
		const expected = formatMeasures(raw);
		expect(expected.columnWidth).toBe("0.00 px");

		expect(screen.getByTestId("measure-column-width")).toHaveTextContent(expected.columnWidth);
		expect(screen.getByTestId("measure-card-overflow")).toHaveTextContent(expected.cardOverflow);
		expect(screen.getByTestId("measure-document-overflow")).toHaveTextContent(
			expected.documentOverflow,
		);
	});

	it("un fondo que no se puede parsear da «no medible», nunca «ok»", async () => {
		render(ErrorSheet);

		// `lab()` queda sin resolver en jsdom, igual que un fondo que el parser no entiende.
		const card = screen.getByTestId("error-render-404").firstElementChild as HTMLElement;
		card.style.backgroundColor = "lab(50 40 59.5)";

		await fireEvent.click(screen.getByTestId("theme-dark"));
		await waitFor(() =>
			expect(screen.getByTestId("contrast-verdict-eyebrow").textContent?.trim()).toBe("no medible"),
		);

		expect(screen.getByTestId("contrast-background-eyebrow").textContent).toContain("no medible");
	});
});

describe("hoja de error — estado preseleccionado por la URL", () => {
	it("?theme=oscuro arranca en oscuro y conserva las cinco tarjetas", () => {
		setUrl("?theme=oscuro");
		render(ErrorSheet);

		expect(screen.getByTestId("error-sheet")).toHaveClass("dark");
		expectAllCards();
	});

	it("?path=sin deja el 5xx sin «Reintentar» y conserva las cinco tarjetas", () => {
		setUrl("?path=sin");
		render(ErrorSheet);

		expect(within(panel(500)).queryByRole("link", { name: /reintentar/i })).toBeNull();
		expectAllCards();
	});

	it("un valor inválido cae al default sin romper la hoja", () => {
		setUrl("?theme=nope&path=nope");
		render(ErrorSheet);

		expect(screen.getByTestId("error-sheet")).not.toHaveClass("dark");
		expect(within(panel(500)).getByRole("link", { name: /reintentar/i })).toBeInTheDocument();
		expectAllCards();
	});

	it("sin parámetros queda el default", () => {
		setUrl("");
		render(ErrorSheet);

		expect(screen.getByTestId("error-sheet")).not.toHaveClass("dark");
		expect(within(panel(500)).getByRole("link", { name: /reintentar/i })).toBeInTheDocument();
		expectAllCards();
	});

	it("cambiar un control refleja el estado en la URL con un objeto plano", async () => {
		vi.mocked(replaceState).mockClear();
		render(ErrorSheet);

		await fireEvent.click(screen.getByTestId("theme-dark"));
		await waitFor(() => expect(replaceState).toHaveBeenCalled());

		const [url, state] = vi.mocked(replaceState).mock.calls.at(-1) ?? [];
		expect(url).toContain("theme=oscuro");
		expect(url).toContain("path=con");
		// Segundo argumento plano y serializable: un objeto no clonable rompería replaceState.
		expect(state).toEqual({});
	});
});
