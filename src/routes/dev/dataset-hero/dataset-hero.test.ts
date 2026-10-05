// Tests de la hoja de revisión del hero del dataset.
//
// La propiedad que la hace útil es que las colocaciones del botón «Copiar enlace» sean
// distinguibles y revisables: junto al título (hoy), en el grupo de acciones, en la fila de
// insignias, las dos fusiones pedidas por el autor (D y E) y las acciones a la altura de las
// insignias (F). La variante G construye la regla —una acción en la fila del título, dos o más en
// la de insignias— y por eso se prueba **en los dos sentidos**: con «Puede editar» (dos acciones,
// insignias) y con «No puede editar» (una acción, título). El test fija la estructura —no la
// apariencia—: que el interruptor de cada variante cambie lo que se renderiza, que el botón de
// copiar caiga en la fila que la variante declara, y que el permiso siga gobernando la acción
// «Editar». El instrumento se prueba aparte, con entradas conocidas, porque en jsdom no hay
// layout; su columna «Fila con» se prueba sobre el nodo renderizado, que es estructural y no
// depende del motor de layout.
//
// La variante E fija el caso de sólo copiar para poder verlo sin cambiar de preset; por eso no
// muestra «Editar» aunque el preset permita editar. F sí lo muestra: sus acciones son un grupo.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import HeroSheet from "./+page.svelte";
import { formatHeroMeasurement } from "./measures";

const VARIANT_IDS = ["a", "b", "c", "d", "e", "f", "g"] as const;

const PRESET_IDS = [
	"puede-editar",
	"no-puede-editar",
	"permiso-fallo",
	"titulo-largo",
	"privado",
	"publico",
] as const;

function renderOf(variantId: string): HTMLElement {
	return screen.getByTestId(`hero-render-${variantId}`);
}

describe("hoja del hero — cobertura de variantes", () => {
	it("renderiza las variantes construidas, y ninguna de más", () => {
		render(HeroSheet);

		for (const id of VARIANT_IDS) {
			expect(screen.getByTestId(`hero-variant-${id}`)).toBeInTheDocument();
		}
		expect(screen.getAllByTestId(/^hero-variant-/)).toHaveLength(VARIANT_IDS.length);
	});

	it("el interruptor de cada variante cambia lo que se renderiza", async () => {
		render(HeroSheet);

		for (const id of VARIANT_IDS) {
			const toggle = screen.getByTestId(`variant-switch-${id}`);
			expect(toggle).toHaveAttribute("aria-checked", "true");

			await fireEvent.click(toggle);
			await waitFor(() => {
				expect(screen.queryByTestId(`hero-variant-${id}`)).toBeNull();
			});
			expect(toggle).toHaveAttribute("aria-checked", "false");

			await fireEvent.click(toggle);
			await waitFor(() => {
				expect(screen.getByTestId(`hero-variant-${id}`)).toBeInTheDocument();
			});
		}
	});

	it("cada variante coloca el botón de copiar en el lugar que declara", () => {
		render(HeroSheet);

		// A · la fila única de hoy: copiar, título y «Editar» comparten fila.
		expect(within(renderOf("a")).getByTestId("hero-row-a")).toContainElement(
			within(renderOf("a")).getByTestId("hero-copy-a"),
		);
		expect(within(renderOf("a")).getByTestId("hero-row-a")).toContainElement(
			within(renderOf("a")).getByTestId("hero-title-a"),
		);

		// B · copiar sube al grupo de acciones de la derecha.
		expect(within(renderOf("b")).getByTestId("hero-actions-b")).toContainElement(
			within(renderOf("b")).getByTestId("hero-copy-b"),
		);
		expect(
			within(renderOf("b"))
				.getByTestId("hero-badges-b")
				.querySelector('[data-testid="hero-copy-b"]'),
		).toBeNull();

		// C · copiar baja a la fila de insignias.
		expect(within(renderOf("c")).getByTestId("hero-badges-c")).toContainElement(
			within(renderOf("c")).getByTestId("hero-copy-c"),
		);
		expect(
			within(renderOf("c"))
				.getByTestId("hero-badges-c")
				.querySelector('[data-testid="hero-title-c"]'),
		).toBeNull();

		// D · copiar y «Editar» comparten la fila del título como grupo de acciones.
		const rowD = within(renderOf("d")).getByTestId("hero-row-d");
		expect(rowD).toContainElement(within(renderOf("d")).getByTestId("hero-title-d"));
		expect(rowD).toContainElement(within(renderOf("d")).getByTestId("hero-copy-d"));
		expect(rowD).toContainElement(within(renderOf("d")).getByTestId("hero-edit-d"));
		expect(
			within(renderOf("d"))
				.getByTestId("hero-badges-d")
				.querySelector('[data-testid="hero-copy-d"]'),
		).toBeNull();

		// E · mismo reparto que D, con copiar como única acción de la fila del título.
		const rowE = within(renderOf("e")).getByTestId("hero-row-e");
		expect(rowE).toContainElement(within(renderOf("e")).getByTestId("hero-title-e"));
		expect(rowE).toContainElement(within(renderOf("e")).getByTestId("hero-copy-e"));
		expect(within(renderOf("e")).queryByTestId("hero-edit-e")).toBeNull();

		// F · el título queda en su propia fila; copiar y «Editar» comparten la de las insignias.
		const rowF = within(renderOf("f")).getByTestId("hero-badges-row-f");
		expect(rowF).toContainElement(within(renderOf("f")).getByTestId("hero-badges-f"));
		expect(rowF).toContainElement(within(renderOf("f")).getByTestId("hero-actions-f"));
		expect(rowF).toContainElement(within(renderOf("f")).getByTestId("hero-copy-f"));
		expect(within(renderOf("f")).getByTestId("hero-actions-f")).toContainElement(
			within(renderOf("f")).getByTestId("hero-edit-f"),
		);
		expect(rowF).not.toContainElement(within(renderOf("f")).getByTestId("hero-title-f"));

		// G · con permiso hay dos acciones (copiar + «Editar»): bajan a la fila de las insignias y el
		// título queda en su propia fila. El otro sentido de la regla se fija en «presets de caso».
		const rowG = within(renderOf("g")).getByTestId("hero-badges-row-g");
		expect(rowG).toContainElement(within(renderOf("g")).getByTestId("hero-badges-g"));
		expect(rowG).toContainElement(within(renderOf("g")).getByTestId("hero-actions-g"));
		expect(rowG).toContainElement(within(renderOf("g")).getByTestId("hero-copy-g"));
		expect(rowG).toContainElement(within(renderOf("g")).getByTestId("hero-edit-g"));
		expect(rowG).not.toContainElement(within(renderOf("g")).getByTestId("hero-title-g"));
		expect(within(renderOf("g")).queryByTestId("hero-row-g")).toBeNull();
	});
});

describe("hoja del hero — presets de caso", () => {
	it("ofrece los seis presets", () => {
		render(HeroSheet);

		for (const id of PRESET_IDS) {
			expect(screen.getByTestId(`preset-${id}`)).toBeInTheDocument();
		}
	});

	it("«puede editar» muestra «Editar» en las variantes que lo ofrecen, y E no", () => {
		render(HeroSheet);

		// A, B, C, D, F y G muestran «Editar»; E fija el caso de sólo copiar.
		expect(screen.getAllByRole("link", { name: "Editar" })).toHaveLength(6);
		expect(within(renderOf("e")).queryByRole("link", { name: "Editar" })).toBeNull();
	});

	it("G construye la regla: con dos acciones baja a las insignias, con una vuelve al título", async () => {
		// El punto entero de la variante: el mismo markup rinde distinto según cuántas acciones haya.
		// Se recorren los tres presets que cambian el número de acciones, ida y vuelta.
		render(HeroSheet);

		// «Puede editar»: dos acciones → fila de insignias, sin fila de título propia.
		expect(within(renderOf("g")).getByTestId("hero-badges-row-g")).toContainElement(
			within(renderOf("g")).getByTestId("hero-copy-g"),
		);
		expect(within(renderOf("g")).getByTestId("hero-badges-row-g")).toContainElement(
			within(renderOf("g")).getByTestId("hero-edit-g"),
		);
		expect(within(renderOf("g")).queryByTestId("hero-row-g")).toBeNull();

		// «No puede editar»: una sola acción → vuelve a la fila del título, como grupo a la derecha.
		await fireEvent.click(screen.getByTestId("preset-no-puede-editar"));
		await waitFor(() => {
			expect(within(renderOf("g")).queryByTestId("hero-badges-row-g")).toBeNull();
		});
		const rowG = within(renderOf("g")).getByTestId("hero-row-g");
		expect(rowG).toContainElement(within(renderOf("g")).getByTestId("hero-title-g"));
		expect(rowG).toContainElement(within(renderOf("g")).getByTestId("hero-copy-g"));
		expect(within(renderOf("g")).queryByTestId("hero-edit-g")).toBeNull();

		// «Falló la verificación de permiso»: también una sola acción (copiar), otra vez al título.
		await fireEvent.click(screen.getByTestId("preset-permiso-fallo"));
		await waitFor(() => {
			expect(within(renderOf("g")).getByTestId("hero-row-g")).toContainElement(
				within(renderOf("g")).getByTestId("hero-copy-g"),
			);
		});
		expect(within(renderOf("g")).queryByTestId("hero-badges-row-g")).toBeNull();
	});

	it("«no puede editar» no muestra ninguna acción", async () => {
		render(HeroSheet);

		await fireEvent.click(screen.getByTestId("preset-no-puede-editar"));
		await waitFor(() => {
			expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
		});
		expect(screen.queryAllByRole("status")).toHaveLength(0);
	});

	it("«falló la verificación» no ofrece acción y explica que no pudo verificarse", async () => {
		render(HeroSheet);

		await fireEvent.click(screen.getByTestId("preset-permiso-fallo"));
		await waitFor(() => {
			expect(screen.queryAllByRole("link", { name: "Editar" })).toHaveLength(0);
		});

		const notes = screen.getAllByRole("status");
		expect(notes).toHaveLength(VARIANT_IDS.length);
		for (const note of notes) {
			expect(note).toHaveTextContent("No se pudo verificar si puede editar este dataset.");
		}
	});

	it("«título muy largo» aplica el título largo en todas las variantes", async () => {
		render(HeroSheet);

		await fireEvent.click(screen.getByTestId("preset-titulo-largo"));
		await waitFor(() => {
			expect(renderOf("a")).toHaveTextContent("Registro histórico consolidado de flujos");
		});
		expect(renderOf("f")).toHaveTextContent("Registro histórico consolidado de flujos");
	});

	it("recorre los seis presets sin dejar la hoja vacía ni perder las variantes", async () => {
		render(HeroSheet);

		for (const id of PRESET_IDS) {
			await fireEvent.click(screen.getByTestId(`preset-${id}`));
			await waitFor(() => {
				expect(screen.getByTestId(`preset-${id}`)).toHaveAttribute("aria-pressed", "true");
			});
			for (const variantId of VARIANT_IDS) {
				expect(screen.getByTestId(`hero-variant-${variantId}`)).toBeInTheDocument();
			}
		}
	});

	it("«privado» y «público» cambian sólo la insignia de visibilidad", async () => {
		render(HeroSheet);

		expect(renderOf("a")).toHaveTextContent("Público");

		await fireEvent.click(screen.getByTestId("preset-privado"));
		await waitFor(() => {
			expect(renderOf("a")).toHaveTextContent("Privado");
		});
		expect(renderOf("a")).not.toHaveTextContent("Público");
	});
});

describe("hoja del hero — instrumento", () => {
	it("mide la separación título ↔ copiar de cada variante visible", async () => {
		render(HeroSheet);

		for (const id of VARIANT_IDS) {
			await waitFor(() => {
				expect(screen.getByTestId(`instrument-row-${id}`)).toBeInTheDocument();
			});
		}
	});

	it("apagar una variante quita su fila del instrumento", async () => {
		render(HeroSheet);

		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-a")).toBeInTheDocument();
		});

		await fireEvent.click(screen.getByTestId("variant-switch-a"));
		await waitFor(() => {
			expect(screen.queryByTestId("instrument-row-a")).toBeNull();
		});
	});

	it("«Fila con» declara con qué comparte fila el botón de cada variante", async () => {
		render(HeroSheet);

		// Estructural, no geométrico: se resuelve subiendo por el DOM, así que vale también en
		// jsdom. A, B, D y E comparten la fila del título; C, F y G bajo «puede editar» bajan a la de
		// las insignias.
		const expected: Record<string, string> = {
			a: "título",
			b: "título",
			c: "insignias",
			d: "título",
			e: "título",
			f: "insignias",
			g: "insignias",
		};
		for (const [id, rowWith] of Object.entries(expected)) {
			await waitFor(() => {
				expect(screen.getByTestId(`instrument-row-with-${id}`)).toHaveTextContent(rowWith);
			});
		}
	});

	it("el instrumento reporta lo que G hace en cada preset, contando sus acciones", async () => {
		// La columna no se limita a repetir una colocación fija: imprime la fila y el número de
		// acciones, así que la regla condicional de G queda a la vista en los números.
		render(HeroSheet);

		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-with-g")).toHaveTextContent(
				"insignias · 2 acciones",
			);
		});

		await fireEvent.click(screen.getByTestId("preset-no-puede-editar"));
		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-with-g")).toHaveTextContent("título · 1 acción");
		});

		await fireEvent.click(screen.getByTestId("preset-permiso-fallo"));
		await waitFor(() => {
			expect(screen.getByTestId("instrument-row-with-g")).toHaveTextContent("título · 1 acción");
		});
	});
});

describe("hoja del hero — la ruta no existe en producción", () => {
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

describe("formatHeroMeasurement", () => {
	it("imprime la caja del título, la separación y el número de acciones", () => {
		expect(
			formatHeroMeasurement({
				variant: "a",
				label: "A · Copiar junto al título (hoy)",
				titleWidth: 512,
				titleHeight: 72.5,
				gapX: 12,
				gapY: 0,
				rowWith: "título",
				actions: 2,
			}),
		).toEqual({
			variant: "a",
			label: "A · Copiar junto al título (hoy)",
			title: "512.00 × 72.50 px",
			gapX: "12.00 px",
			gapY: "0.00 px",
			rowWith: "título · 2 acciones",
		});
	});

	it("nombra la fila de las insignias cuando el botón no comparte la del título", () => {
		const formatted = formatHeroMeasurement({
			variant: "f",
			label: "F · Acciones a la altura de las insignias",
			titleWidth: 480,
			titleHeight: 96,
			gapX: 0,
			gapY: 16,
			rowWith: "insignias",
			actions: 2,
		});

		expect(formatted.rowWith).toBe("insignias · 2 acciones");
		expect(formatted.gapY).toBe("16.00 px");
	});

	it("usa el singular con una sola acción y no inventa fila cuando no hay botón", () => {
		// Es el caso de G sin permiso: una acción, en la fila del título.
		const unaAccion = formatHeroMeasurement({
			variant: "g",
			label: "G · La regla",
			titleWidth: 480,
			titleHeight: 72,
			gapX: 0,
			gapY: 0,
			rowWith: "título",
			actions: 1,
		});
		expect(unaAccion.rowWith).toBe("título · 1 acción");

		const sinBoton = formatHeroMeasurement({
			variant: "g",
			label: "G · La regla",
			titleWidth: 0,
			titleHeight: 0,
			gapX: 0,
			gapY: 0,
			rowWith: "—",
			actions: 0,
		});
		expect(sinBoton.rowWith).toBe("—");
	});
});

describe("hoja del hero — el acuse de copiar", () => {
	it("acusa el clic y lo retira a los 2 s, sin dejar el temporizador vivo", async () => {
		// Hallazgo `R3-COPY` de la compuerta `review-5667c785ed46242e`: el único camino que mutaba
		// `copiedVariant` no lo ejercía ningún test, y su temporizador no se cancelaba nunca.
		// Se falsean sólo los temporizadores: falsear las microtareas también dejaría a Svelte sin
		// forma de aplicar el cambio de estado.
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			render(HeroSheet);

			const botones = screen.getAllByRole("button", { name: "Copiar enlace del dataset" });
			expect(botones.length).toBeGreaterThan(0);
			expect(screen.queryByRole("button", { name: "Enlace copiado" })).toBeNull();

			await fireEvent.click(botones[0]);
			expect(screen.getByRole("button", { name: "Enlace copiado" })).toBeTruthy();

			await vi.advanceTimersByTimeAsync(2000);
			expect(screen.queryByRole("button", { name: "Enlace copiado" })).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("cancela el temporizador al desmontar, en vez de disparar sobre la hoja muerta", async () => {
		// Hallazgo `R3-001` de la compuerta `review-ba2348da1d5c0683`: el arreglo traía la cancelación
		// pero ninguna prueba la ejercía, así que la propiedad seguía sin demostrar. Un llamador
		// espía es lo que hace observable la cancelación: en jsdom, un `setState` posterior al
		// desmontaje no se queja, así que el silencio no probaría nada.
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const espia = vi.spyOn(globalThis, "clearTimeout");
		try {
			const { unmount } = render(HeroSheet);
			const botones = screen.getAllByRole("button", { name: "Copiar enlace del dataset" });
			await fireEvent.click(botones[0]);
			expect(espia).not.toHaveBeenCalled();

			await unmount();
			expect(espia).toHaveBeenCalled();
		} finally {
			espia.mockRestore();
			vi.useRealTimers();
		}
	});

	it("vuelve a medir cuando cambia el ancho", async () => {
		// Hallazgo `R3-002` de la misma compuerta: el oyente de `resize` y su dependencia no los
		// ejercía ningún test, así que la re-medición tampoco estaba demostrada. Se cuenta la lectura
		// del rectángulo, que es lo que el efecto hace al re-correr.
		const espia = vi.spyOn(Element.prototype, "getBoundingClientRect");
		try {
			render(HeroSheet);
			await tick();
			const antes = espia.mock.calls.length;
			expect(antes).toBeGreaterThan(0);

			window.dispatchEvent(new Event("resize"));
			await tick();

			expect(espia.mock.calls.length).toBeGreaterThan(antes);
		} finally {
			espia.mockRestore();
		}
	});
});
