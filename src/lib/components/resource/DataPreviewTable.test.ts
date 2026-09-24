import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { DatastoreField } from "$lib/api/datastore";
import DataPreviewTable from "./DataPreviewTable.svelte";

const fields: DatastoreField[] = [
	{ id: "_id", type: "int" },
	{ id: "ciudad", type: "text" },
	{ id: "flujo", type: "int" },
];

const records = [
	{ _id: 1, ciudad: "Cochabamba", flujo: 1200 },
	{ _id: 2, ciudad: "Quillacollo", flujo: 800 },
];

describe("DataPreviewTable", () => {
	it("renderiza encabezados de columna excluyendo _id", () => {
		render(DataPreviewTable, { props: { fields, records, total: 42 } });

		expect(screen.getByRole("columnheader", { name: "ciudad" })).toBeInTheDocument();
		expect(screen.getByRole("columnheader", { name: "flujo" })).toBeInTheDocument();
		expect(screen.queryByRole("columnheader", { name: "_id" })).toBeNull();
	});

	it("renderiza los valores de las celdas", () => {
		render(DataPreviewTable, { props: { fields, records, total: 42 } });

		expect(screen.getByText("Cochabamba")).toBeInTheDocument();
		expect(screen.getByText("1200")).toBeInTheDocument();
		expect(screen.getByText("Quillacollo")).toBeInTheDocument();
	});

	it("muestra la nota con el total de filas", () => {
		render(DataPreviewTable, { props: { fields, records, total: 42 } });

		expect(screen.getByText("Mostrando 2 de 42 filas")).toBeInTheDocument();
	});

	it("celdas vacías se muestran como guion", () => {
		const sparse = [{ _id: 1, ciudad: null, flujo: "" }];
		render(DataPreviewTable, { props: { fields, records: sparse, total: 1 } });

		expect(screen.getAllByText("—")).toHaveLength(2);
	});

	it("un objeto y un array se muestran como su JSON, no como `[object Object]`", () => {
		const composite = [{ _id: 1, ciudad: { nombre: "Cochabamba" }, flujo: [1, 2, 3] }];
		render(DataPreviewTable, { props: { fields, records: composite, total: 1 } });

		expect(screen.getByText('{"nombre":"Cochabamba"}')).toBeInTheDocument();
		expect(screen.getByText("[1,2,3]")).toBeInTheDocument();
		expect(screen.queryByText("[object Object]")).toBeNull();
	});

	it("un número y un texto primitivos se renderizan sin cambios", () => {
		render(DataPreviewTable, { props: { fields, records, total: 42 } });

		expect(screen.getByText("Cochabamba")).toBeInTheDocument();
		expect(screen.getByText("1200")).toBeInTheDocument();
		expect(screen.queryByText("[object Object]")).toBeNull();
	});

	it("una función o un símbolo sueltos caen al guion, nunca a `undefined`", () => {
		const exotic = [{ _id: 1, ciudad: Symbol("x"), flujo: () => 1 }];
		render(DataPreviewTable, { props: { fields, records: exotic, total: 1 } });

		expect(screen.getAllByText("—")).toHaveLength(2);
		expect(screen.queryByText("undefined")).toBeNull();
	});
});
