// Tests del playground `/dev/resource-views`.
//
// Protegen lo que el playground afirma: que cada interruptor cambia **algo observable** de la disposición
// (si no, el autor compararía dos variantes idénticas), que las pestañas tienen contenido real y la semántica
// de `Tabs`, y que el estado viaja en la URL y vuelve de ella. El comportamiento de los gráficos en sí
// (borrar, errores, versiones) vive en `ResourceCharts.test.ts`.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { auth } from "$lib/stores/auth";
import Playground from "./+page.svelte";

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

/** Abre el playground con su estado en la URL, que es donde el panel lo guarda. */
function abrir(params: Record<string, string> = {}) {
	const url = new URL("http://localhost/dev/resource-views");
	for (const [clave, valor] of Object.entries(params)) url.searchParams.set(clave, valor);
	pageStore.set({ params: {}, url });
	return render(Playground);
}

const crear = () => screen.queryAllByRole("link", { name: /Crear gráfico/ });
const pulsar = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
	auth.reset();
	vi.mocked(replaceState).mockClear();
});

describe("playground de las vistas del recurso — presets", () => {
	it("por defecto: tres gráficos apilados, con la tabla arriba y «Crear gráfico» en el encabezado", async () => {
		abrir();

		expect(
			await screen.findByRole("heading", { name: "Salario promedio por turno" }),
		).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Docentes por facultad" })).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Salario máximo por facultad" }),
		).toBeInTheDocument();
		expect(screen.getByText("Vista previa")).toBeInTheDocument();
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(crear()).toHaveLength(1);
		expect(
			within(
				screen
					.getByRole("heading", { name: "Gráficos del recurso" })
					.closest("section") as HTMLElement,
			).getAllByRole("link", { name: /Crear gráfico/ }),
		).toHaveLength(1);
	});

	it("«Sin gráficos» dice que el recurso no tiene y «Un gráfico» muestra uno", async () => {
		abrir({ graficos: "0" });
		expect(await screen.findByText("Este recurso todavía no tiene gráficos")).toBeInTheDocument();

		await pulsar("Un gráfico");
		await waitFor(() => expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1));
	});

	it("un visitante anónimo no tiene «Crear gráfico», «Editar» ni «Eliminar» en ninguna variante", async () => {
		abrir({ rol: "visitante", crear: "card" });
		await screen.findByRole("heading", { name: "Salario promedio por turno" });

		expect(crear()).toHaveLength(0);
		expect(screen.queryByRole("link", { name: /Editar/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Eliminar/ })).toBeNull();

		await pulsar("Pestañas");
		await pulsar("Final de la barra de pestañas");
		expect(crear()).toHaveLength(0);
	});
});

describe("playground de las vistas del recurso — disposición", () => {
	it("con pestañas hay una barra «Tabla | gráfico 1 | gráfico 2 | gráfico 3» y la tabla es lo primero que se ve", async () => {
		abrir({ disposicion: "tabs" });

		await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(4));
		const tabs = screen.getAllByRole("tab");
		expect(tabs.map((t) => t.textContent?.trim())).toEqual([
			"Tabla",
			"Salario promedio por turno",
			"Docentes por facultad",
			"Salario máximo por facultad",
		]);
		expect(tabs[0]).toHaveAttribute("aria-selected", "true");
		expect(await screen.findByText("Docente 1")).toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: "Salario promedio por turno" })).toBeNull();
	});

	it("elegir una pestaña de gráfico cambia el contenido: aparece el gráfico y se va la tabla", async () => {
		abrir({ disposicion: "tabs" });
		await screen.findByText("Docente 1");

		await fireEvent.click(screen.getByRole("tab", { name: "Docentes por facultad" }));

		expect(
			await screen.findByRole("heading", { name: "Docentes por facultad" }),
		).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Docentes por facultad" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByText("Docente 1")).not.toBeVisible();
		await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument());
		expect(screen.getByRole("tabpanel")).toBeInTheDocument();
	});

	it("la barra se maneja con el teclado: la flecha derecha pasa a la pestaña siguiente", async () => {
		abrir({ disposicion: "tabs" });
		const tabla = await screen.findByRole("tab", { name: "Tabla" });
		tabla.focus();

		await fireEvent.keyDown(tabla, { key: "ArrowRight" });

		expect(screen.getByRole("tab", { name: "Salario promedio por turno" })).toHaveFocus();
	});

	it("con pestañas, quien edita conserva «Editar» y «Eliminar» dentro de cada gráfico", async () => {
		abrir({ disposicion: "tabs" });
		await fireEvent.click(await screen.findByRole("tab", { name: "Docentes por facultad" }));

		expect(
			await screen.findByRole("link", { name: /Editar el gráfico «Docentes por facultad»/ }),
		).toHaveAttribute("href", "/dataset/planilla-docente/resource/res-planilla/charts/view-2/edit");
		expect(
			screen.getByRole("button", { name: /Eliminar el gráfico «Docentes por facultad»/ }),
		).toBeInTheDocument();
	});

	it("eliminar el gráfico de la pestaña activa devuelve a la tabla", async () => {
		abrir({ disposicion: "tabs", graficos: "1" });
		await fireEvent.click(await screen.findByRole("tab", { name: "Salario promedio por turno" }));
		await fireEvent.click(await screen.findByRole("button", { name: /Eliminar el gráfico/ }));
		const dialog = await screen.findByRole("dialog");
		await fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

		await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(1));
		expect(screen.getByRole("tab", { name: "Tabla" })).toHaveAttribute("aria-selected", "true");
	});

	it("el interruptor de disposición alterna entre apilado y pestañas", async () => {
		abrir();
		await screen.findByRole("heading", { name: "Salario promedio por turno" });
		expect(screen.queryByRole("tablist")).toBeNull();

		await pulsar("Pestañas");
		expect(await screen.findByRole("tablist")).toBeInTheDocument();

		await pulsar(/Apilado/);
		await waitFor(() => expect(screen.queryByRole("tablist")).toBeNull());
		expect(
			await screen.findByRole("heading", { name: "Salario promedio por turno" }),
		).toBeInTheDocument();
	});
});

describe("playground de las vistas del recurso — lugar de «Crear gráfico»", () => {
	it("encabezado de la sección: el enlace vive junto al título «Gráficos del recurso»", async () => {
		abrir({ crear: "heading" });
		await screen.findByRole("heading", { name: "Salario promedio por turno" });

		const seccion = screen
			.getByRole("heading", { name: "Gráficos del recurso" })
			.closest("section") as HTMLElement;
		expect(within(seccion).getAllByRole("link", { name: /Crear gráfico/ })).toHaveLength(1);
	});

	it("final de la barra de pestañas: el enlace está junto a las pestañas y no hay encabezado de sección", async () => {
		abrir({ disposicion: "tabs", crear: "tabs" });
		const tablist = await screen.findByRole("tablist");

		expect(crear()).toHaveLength(1);
		expect(tablist.parentElement).toContainElement(crear()[0]);
		expect(screen.queryByRole("heading", { name: "Gráficos del recurso" })).toBeNull();
	});

	it("sin pestañas, el final de la barra no existe y el enlace cae al encabezado de la sección", async () => {
		abrir({ disposicion: "stacked", crear: "tabs" });
		await screen.findByRole("heading", { name: "Salario promedio por turno" });

		const seccion = screen
			.getByRole("heading", { name: "Gráficos del recurso" })
			.closest("section") as HTMLElement;
		expect(within(seccion).getAllByRole("link", { name: /Crear gráfico/ })).toHaveLength(1);
	});

	it("banda del encabezado del recurso: el enlace sale de la sección y aparece junto a «Descargar recurso»", async () => {
		abrir({ crear: "header" });
		await screen.findByRole("heading", { name: "Salario promedio por turno" });

		const banda = within(screen.getByTestId("banda-encabezado"));
		expect(banda.getByRole("link", { name: /Crear gráfico/ })).toHaveAttribute(
			"href",
			"/dataset/planilla-docente/resource/res-planilla/charts/new",
		);
		expect(crear()).toHaveLength(1);
	});

	it("tarjeta punteada: aparece al final de la lista, también sin gráficos", async () => {
		abrir({ crear: "card", graficos: "0" });
		await screen.findByText("Este recurso todavía no tiene gráficos");

		const enlace = crear();
		expect(enlace).toHaveLength(1);
		expect(enlace[0].className).toContain("border-dashed");
		const seccion = screen
			.getByRole("heading", { name: "Gráficos del recurso" })
			.closest("section") as HTMLElement;
		expect(within(seccion).getAllByRole("link", { name: /Crear gráfico/ })).toHaveLength(1);
		// Ya no está en el encabezado: la sección tiene un solo enlace y es la tarjeta.
		expect(seccion.querySelector(".border-dashed")).toBe(enlace[0]);
	});

	it("«Editar» y «Eliminar» siguen disponibles en las cuatro ubicaciones", async () => {
		for (const crearEn of ["heading", "tabs", "header", "card"]) {
			const { unmount } = abrir({ crear: crearEn, graficos: "1" });
			expect(await screen.findByRole("link", { name: /Editar el gráfico/ })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /Eliminar el gráfico/ })).toBeInTheDocument();
			unmount();
		}
	});
});

describe("playground de las vistas del recurso — la URL", () => {
	it("lee las variantes de la URL", async () => {
		abrir({ disposicion: "tabs", crear: "card", graficos: "1", rol: "visitante" });

		await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
		expect(screen.getByRole("button", { name: "Pestañas" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: "Un gráfico" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("button", { name: "Visitante anónimo" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("un valor desconocido cae al de hoy en vez de romper la hoja", async () => {
		abrir({ disposicion: "mosaico", crear: "nunca", graficos: "9", rol: "dios" });

		expect(
			await screen.findByRole("heading", { name: "Salario promedio por turno" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(screen.getByRole("button", { name: /Apilado/ })).toHaveAttribute("aria-pressed", "true");
	});

	it("mover un interruptor escribe el estado completo en la URL, y esa URL reabre lo mismo", async () => {
		const { unmount } = abrir();
		await screen.findByRole("heading", { name: "Salario promedio por turno" });

		await pulsar("Pestañas");
		await pulsar("Tarjeta punteada al final");
		await pulsar("Un gráfico");
		await pulsar("Visitante anónimo");

		const ultima = vi.mocked(replaceState).mock.calls.at(-1)?.[0] as string;
		const params = new URL(ultima, "http://localhost").searchParams;
		expect(Object.fromEntries(params)).toEqual({
			graficos: "1",
			rol: "visitante",
			disposicion: "tabs",
			crear: "card",
		});

		unmount();
		abrir(Object.fromEntries(params));
		await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
		expect(screen.getByRole("button", { name: "Tarjeta punteada al final" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});
});
