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
		render(DataPreviewTable, { props: { fields, records, total: 42, limit: 20 } });

		expect(screen.getByRole("columnheader", { name: "ciudad" })).toBeInTheDocument();
		expect(screen.getByRole("columnheader", { name: "flujo" })).toBeInTheDocument();
		expect(screen.queryByRole("columnheader", { name: "_id" })).toBeNull();
	});

	it("renderiza los valores de las celdas", () => {
		render(DataPreviewTable, { props: { fields, records, total: 42, limit: 20 } });

		expect(screen.getByText("Cochabamba")).toBeInTheDocument();
		expect(screen.getByText("1200")).toBeInTheDocument();
		expect(screen.getByText("Quillacollo")).toBeInTheDocument();
	});

	it("muestra la nota con el total de filas", () => {
		render(DataPreviewTable, { props: { fields, records, total: 42, limit: 20 } });

		expect(screen.getByText("Mostrando 2 de 42 filas")).toBeInTheDocument();
	});

	it("celdas vacías se muestran como guion", () => {
		const sparse = [{ _id: 1, ciudad: null, flujo: "" }];
		render(DataPreviewTable, { props: { fields, records: sparse, total: 1, limit: 20 } });

		expect(screen.getAllByText("—")).toHaveLength(2);
	});
});
