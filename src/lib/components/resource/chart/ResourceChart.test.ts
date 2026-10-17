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
