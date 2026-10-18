// Tests del playground `/dev/chart-editor`: duplica la página de crear un gráfico con el `ChartForm` real y
// deja comparar la disposición. Se protege que (1) renderiza, (2) cada interruptor cambia la disposición de
// forma observable, (3) las variantes viajan en la URL y se leen de ella, y (4) el valor por defecto es la
// disposición de tarjetas separadas (L47); «columna» sigue disponible para comparar con la de hoy.

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import ChartEditorSheet from "./+page.svelte";

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function abrir(params: Record<string, string> = {}) {
	const url = new URL("http://localhost/dev/chart-editor");
	for (const [clave, valor] of Object.entries(params)) url.searchParams.set(clave, valor);
	pageStore.set({ params: {}, url });
	return render(ChartEditorSheet);
}

const variantes = () => within(screen.getByTestId("layout-variants"));
const pulsar = (nombre: string) =>
	fireEvent.click(variantes().getByRole("button", { name: nombre }));
const secciones = () =>
	screen.getByTestId("editor-card").querySelectorAll("section[aria-labelledby]");
const contenedor = () =>
	screen.getByRole("heading", { name: "Datos" }).closest("section")?.parentElement;
const ultimaUrl = () => {
	const llamadas = vi.mocked(replaceState).mock.calls;
	return new URL(llamadas[llamadas.length - 1][0] as string, "http://localhost");
};

beforeEach(() => vi.mocked(replaceState).mockClear());

describe("playground del editor de gráficos", () => {
	it("renderiza el formulario real con los presets en el panel global", () => {
		abrir();

		expect(screen.getByRole("heading", { name: "Nuevo gráfico", level: 1 })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Datos" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Presentación" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
		for (const nombre of [
			"Planilla completa",
			"Sólo columnas de texto",
			"Una sola columna numérica",
		]) {
			expect(screen.getByRole("button", { name: nombre })).toBeInTheDocument();
		}
	});

	it("por defecto son tarjetas separadas: cada sección y el gráfico en su tarjeta, sin contenedor común", () => {
		abrir();

		const [datos, presentacion] = Array.from(secciones());
		const grafico = screen.getByRole("heading", { name: "Vista previa" }).closest("section");
		expect(variantes().getByRole("button", { name: "Tarjetas separadas (nuevo)" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		for (const tarjeta of [datos, presentacion, grafico]) {
			expect(tarjeta?.className).toContain("rounded-xl");
			expect(tarjeta?.className).toContain("bg-card");
		}
		// Los encabezados son los de la barra del buscador, y no hay scroll interno.
		const encabezado = screen.getByRole("heading", { name: "Datos" });
		expect(encabezado.className).toContain("uppercase");
		expect(encabezado.className).toContain("text-destructive");
		// Ningún ancestro común de las tarjetas es una tarjeta: el contenedor de ambos no tiene caja.
		const comun = datos.parentElement?.parentElement;
		expect(comun?.contains(grafico)).toBe(true);
		expect(comun?.className).not.toMatch(/\b(border|bg-card|rounded-\w+)\b/);
		expect(screen.getByTestId("editor-card").className).not.toContain("border");
		expect(screen.getByTestId("editor-card").querySelector("[class*='overflow-y']")).toBeNull();
		expect(screen.getByTestId("editor-card").querySelector("[class*='max-h-']")).toBeNull();
		// Las acciones quedan fuera de las tarjetas.
		const acciones = screen.getByTestId("chart-actions");
		for (const tarjeta of [datos, presentacion, grafico]) {
			expect(tarjeta?.contains(acciones)).toBe(false);
		}
		expect(within(acciones).getByRole("button", { name: "Guardar" })).toBeInTheDocument();
		expect(within(acciones).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
		// La separación entre secciones no aplica: ya son tarjetas.
		expect(variantes().queryByText("Separación entre Datos y Presentación")).toBeNull();
	});

	it("el gráfico se pega debajo del encabezado del portal, con su token y sin números sueltos", () => {
		abrir();

		const grafico = screen.getByRole("heading", { name: "Vista previa" }).closest("section");
		expect(grafico?.className).toContain("lg:sticky");
		expect(grafico?.className).toContain("lg:top-[calc(var(--header-h)+1rem)]");
		expect(grafico?.className).not.toContain("lg:top-6");
	});

	it("la disposición de columna sigue disponible y es la de hoy", async () => {
		abrir();
		await pulsar("Columna (hoy)");

		expect(contenedor()?.parentElement?.className).toContain("lg:flex-row");
		expect(contenedor()?.parentElement?.className).not.toContain("flex-row-reverse");
		expect(secciones()[1].className).toContain("border-t");
		expect(screen.queryByRole("heading", { name: "Opciones del gráfico" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Datos" })).toBeNull();
		const grafico = screen.getByRole("heading", { name: "Vista previa" }).closest("section");
		expect(grafico?.className).toContain("lg:top-[calc(var(--header-h)+1rem)]");
	});

	it("el lado del panel pasa a la derecha", async () => {
		abrir();
		await pulsar("Derecha");

		expect(contenedor()?.parentElement?.className).toContain("lg:flex-row-reverse");
	});

	it("la separación en tarjetas pone cada sección en su caja, sin línea", async () => {
		abrir();
		await pulsar("Columna (hoy)");
		await pulsar("Una tarjeta por sección");

		for (const seccion of secciones()) {
			expect(seccion.className).toContain("rounded-lg");
			expect(seccion.className).not.toContain("border-t");
		}
	});

	it("el acordeón pliega y despliega cada sección", async () => {
		abrir();
		await pulsar("Acordeón");

		const trigger = screen.getByRole("button", { name: "Datos" });
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		await fireEvent.click(trigger);
		expect(screen.getByRole("button", { name: "Datos" })).toHaveAttribute("aria-expanded", "false");
		expect(screen.getByRole("button", { name: "Presentación" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});

	it("el estilo del buscador pone el panel en una tarjeta con encabezado en mayúsculas", async () => {
		abrir();
		await pulsar("Como los filtros del buscador");

		const encabezado = screen.getByRole("heading", { name: "Opciones del gráfico" });
		expect(encabezado.className).toContain("uppercase");
		expect(encabezado.className).toContain("text-destructive");
		expect(encabezado.parentElement?.className).toMatch(/rounded-xl.*sticky/);
		expect(encabezado.parentElement?.className).toContain("lg:top-[calc(var(--header-h)+1rem)]");
		expect(encabezado.parentElement?.className).toContain("var(--header-h)-2rem");
	});

	it("cambiar el caso cambia las columnas que el formulario ofrece", async () => {
		abrir();
		expect(screen.getByRole("button", { name: "Columna del eje horizontal" })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: "Una sola columna numérica" }));

		expect(screen.queryByRole("button", { name: "Columna del eje horizontal" })).toBeNull();
	});

	it("las variantes viajan en la URL", async () => {
		abrir();
		await pulsar("Derecha");
		await pulsar("Acordeón");
		await pulsar("Una tarjeta por sección");

		const params = ultimaUrl().searchParams;
		expect(params.get("lado")).toBe("right");
		expect(params.get("separacion")).toBe("cards");
		expect(params.get("panel")).toBe("accordion");
		expect(params.get("caso")).toBe("planilla");
	});

	it("las variantes se leen de la URL, y un valor desconocido cae a hoy", () => {
		abrir({ lado: "right", separacion: "cards", panel: "sidebar" });

		expect(contenedor()?.parentElement?.className).toContain("lg:flex-row-reverse");
		expect(secciones()[0].className).toContain("rounded-lg");
		expect(screen.getByRole("heading", { name: "Opciones del gráfico" })).toBeInTheDocument();
		expect(variantes().getByRole("button", { name: "Derecha" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("el valor retirado «steps» de una URL vieja cae al valor por defecto", () => {
		abrir({ separacion: "steps", panel: "column" });

		expect(variantes().getByRole("button", { name: "Línea (hoy)" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.queryByRole("button", { name: "Pasos numerados" })).toBeNull();
		expect(secciones()[0]).not.toHaveTextContent(/^1\s*Datos/);
	});

	it("un valor inválido en la URL deja la disposición por defecto", () => {
		abrir({ lado: "arriba", separacion: "x", panel: "y" });

		expect(variantes().getByRole("button", { name: "Izquierda (hoy)" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(variantes().getByRole("button", { name: "Tarjetas separadas (nuevo)" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});
});
