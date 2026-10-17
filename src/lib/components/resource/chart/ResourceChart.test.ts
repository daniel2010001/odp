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

describe("ResourceChart — el estilo nuevo (L28, decisión 3)", () => {
	// Los dos estilos viven en el mismo componente: `variant` elige cuál se dibuja, así que promover el nuevo
	// es cambiar su valor por defecto. Lo que se fija acá es lo que el estilo nuevo agrega —la dona con el
	// total en el centro— y lo que **no** puede perder: los rótulos de los rangos decididos en L21.

	function renderStyled(
		groups: ChartGroup[],
		chartType: "bar" | "pie",
		variant: "current" | "new",
	) {
		return render(ResourceChart, {
			props: {
				groups,
				chartType,
				bucket: "number_step",
				step: 5000,
				xLabel: "salario",
				yLabel: "Cantidad de filas",
				variant,
			},
		});
	}

	it("el pastel es una dona con el total en el centro, y el total también está en la etiqueta accesible", () => {
		renderStyled(GROUPS, "pie", "new");

		expect(screen.getByText("Total")).toBeInTheDocument();
		expect(screen.getByText("11")).toBeInTheDocument();
		expect(screen.getByRole("img")).toHaveAccessibleName(/Total: 11/);
	});

	it("el estilo actual no dibuja la dona ni el total", () => {
		renderStyled(GROUPS, "pie", "current");

		expect(screen.queryByText("Total")).toBeNull();
		expect(screen.getByRole("img")).not.toHaveAccessibleName(/Total/);
	});

	it("el estilo nuevo conserva los dos rótulos del rango: el eje «0–5000» y la tabla «[0, 5000)»", () => {
		renderStyled(GROUPS, "bar", "new");

		expect(within(axis()).getByText("0–5000")).toBeInTheDocument();
		const rows = within(table()).getAllByRole("row").slice(1);
		expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual([
			"[0, 5000)",
			"[5000, 10000)",
			"Sin dato",
		]);
	});
});
