// El gráfico del recurso: lo que dibuja y, sobre todo, cómo **rotula** cada grupo.
//
// LayerChart no necesita un navegador para producir el SVG, pero sí un `ResizeObserver`, que jsdom no
// implementa: el stub de abajo alcanza porque acá no se mide el layout, sólo se leen los rótulos.
//
// Lo que se fija es la decisión del autor sobre los rangos numéricos (L21): el eje escribe «0–5000» y la
// tabla accesible —y el tooltip, que por el mismo `groupLabels` recibe la otra forma— el intervalo exacto
// «[0, 5000)».

import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { ChartGroup } from "$lib/charts/contract";
import ResourceChart from "./ResourceChart.svelte";

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const GROUPS: ChartGroup[] = [
	{ key: 0, value: 3 },
	{ key: 5000, value: 7 },
	{ key: null, value: 1 },
];

function renderChart(groups: ChartGroup[], bucket: "number_step" | "value" = "number_step") {
	return render(ResourceChart, {
		props: {
			groups,
			chartType: "bar",
			bucket,
			step: bucket === "number_step" ? 5000 : undefined,
			xLabel: "salario",
			yLabel: "Cantidad de filas",
		},
	});
}

const axis = () => document.querySelector("svg") as unknown as HTMLElement;
const table = () => screen.getByRole("table");

describe("ResourceChart — los rangos numéricos se escriben de las dos formas (L21)", () => {
	it("la tabla accesible muestra el intervalo semiabierto exacto", () => {
		renderChart(GROUPS);

		const rows = within(table()).getAllByRole("row").slice(1);
		expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual([
			"[0, 5000)",
			"[5000, 10000)",
			"Sin dato",
		]);
		expect(within(table()).queryByText("0–5000")).toBeNull();
	});

	it("el eje del gráfico muestra el rango con guion, no el intervalo", () => {
		renderChart(GROUPS);

		expect(within(axis()).getByText("0–5000")).toBeInTheDocument();
		expect(within(axis()).queryByText("[0, 5000)")).toBeNull();
	});

	it("con «valor tal cual» no hay dos formas: el rótulo es el mismo en los dos lugares", () => {
		renderChart([{ key: "mañana", value: 4 }], "value");

		expect(within(table()).getByText("mañana")).toBeInTheDocument();
		expect(within(axis()).getByText("mañana")).toBeInTheDocument();
	});
});

describe("ResourceChart — el estilo del gráfico (L28, decisión 3)", () => {
	// Lo que el estilo agrega —la dona con el total en el centro— y lo que **no** puede perder: los rótulos de
	// los rangos decididos en L21.

	function renderStyled(groups: ChartGroup[], chartType: "bar" | "pie") {
		return render(ResourceChart, {
			props: {
				groups,
				chartType,
				bucket: "number_step",
				step: 5000,
				xLabel: "salario",
				yLabel: "Cantidad de filas",
			},
		});
	}

	it("el pastel es una dona con el total en el centro, y el total también está en la etiqueta accesible", () => {
		renderStyled(GROUPS, "pie");

		expect(screen.getByText("Total")).toBeInTheDocument();
		expect(screen.getByText("11")).toBeInTheDocument();
		expect(screen.getByRole("img")).toHaveAccessibleName(/Total: 11/);
	});

	it("conserva los dos rótulos del rango: el eje «0–5000» y la tabla «[0, 5000)»", () => {
		renderStyled(GROUPS, "bar");

		expect(within(axis()).getByText("0–5000")).toBeInTheDocument();
		const rows = within(table()).getAllByRole("row").slice(1);
		expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual([
			"[0, 5000)",
			"[5000, 10000)",
			"Sin dato",
		]);
	});
});

describe("ResourceChart — los números se escriben en es-BO, con a lo sumo dos decimales (P3)", () => {
	// El servidor devuelve los promedios sin redondear (`8496.754044…`, L23).
	const AVERAGES: ChartGroup[] = [
		{ key: "mañana", value: 8496.754044 },
		{ key: "noche", value: 3986.38 },
		{ key: null, value: 1266 },
	];

	it("la tabla accesible redondea y separa los millares", () => {
		renderChart(AVERAGES, "value");

		const rows = within(table()).getAllByRole("row").slice(1);
		expect(rows.map((row) => row.lastElementChild?.textContent)).toEqual([
			"8.496,75",
			"3.986,38",
			"1.266",
		]);
		expect(within(table()).queryByText(/8496/)).toBeNull();
	});

	it("el total de la dona usa el mismo formato", () => {
		render(ResourceChart, {
			props: {
				groups: AVERAGES,
				chartType: "pie",
				bucket: "value",
				xLabel: "turno",
				yLabel: "Promedio de salario",
			},
		});

		expect(screen.getByText("13.749,13")).toBeInTheDocument();
	});

	it("los rótulos del eje vertical usan el mismo formato", () => {
		// jsdom no mide el layout: sin un tamaño, la escala vertical no tiene marcas que rotular.
		const size = { configurable: true, get: () => 400 };
		Object.defineProperty(HTMLElement.prototype, "clientWidth", size);
		Object.defineProperty(HTMLElement.prototype, "clientHeight", size);
		try {
			renderChart([{ key: "mañana", value: 12345.678 }], "value");
		} finally {
			Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
			Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
		}

		const ticks = Array.from(axis().querySelectorAll("text")).map((node) => node.textContent);
		expect(ticks.some((text) => /^\d{1,3}(\.\d{3})+$/.test(text ?? ""))).toBe(true);
		expect(ticks.some((text) => /^\d{4,}$/.test(text ?? ""))).toBe(false);
	});
});
