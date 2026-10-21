import { describe, expect, it } from "vitest";
import { byLabel, sortByLabel } from "./collate";

const ordenar = (labels: string[]) =>
	sortByLabel(
		labels,
		(l) => l,
		(l) => l,
	);

describe("sortByLabel — colación en español", () => {
	it("ordena con acentos como la letra base: «Álgebra» antes de «Biología»", () => {
		expect(ordenar(["Biología", "Álgebra", "Zoología", "Astronomía"])).toEqual([
			"Álgebra",
			"Astronomía",
			"Biología",
			"Zoología",
		]);
	});

	it("«ñ» va después de «n» y antes de «o»", () => {
		expect(ordenar(["Oro", "Ñandú", "Nube", "Zeta"])).toEqual(["Nube", "Ñandú", "Oro", "Zeta"]);
	});

	it("los números comparan como números: «Dataset 9» antes de «Dataset 10»", () => {
		expect(ordenar(["Dataset 10", "Dataset 9", "Dataset 2"])).toEqual([
			"Dataset 2",
			"Dataset 9",
			"Dataset 10",
		]);
	});

	it("ignora mayúsculas: «biología» y «Álgebra» no se separan por caja", () => {
		expect(ordenar(["biología", "Álgebra", "Cálculo"])).toEqual(["Álgebra", "biología", "Cálculo"]);
	});

	it("los empates por etiqueta se resuelven por id y no cambian la entrada", () => {
		const items = [
			{ id: "b", label: "Salud" },
			{ id: "a", label: "salud" },
		];
		const orden = sortByLabel(
			items,
			(i) => i.label,
			(i) => i.id,
		);
		expect(orden.map((i) => i.id)).toEqual(["a", "b"]);
		expect(items.map((i) => i.id)).toEqual(["b", "a"]);
	});

	it("byLabel es el colador compartido", () => {
		expect(byLabel.compare("Dataset 9", "Dataset 10")).toBeLessThan(0);
	});
});
