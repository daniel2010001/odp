import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeAll, describe, expect, it } from "vitest";
import TagsInput from "./TagsInput.svelte";

beforeAll(() => {
	// jsdom no implementa `ResizeObserver` ni `scrollIntoView`, que bits-ui `Command` usa al abrir
	// la lista. Se proveen stubs deterministas para poder montar el combobox en tests.
	class ResizeObserverStub {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {};
	}
});

describe("TagsInput", () => {
	it("renderiza las etiquetas seleccionadas como chips con su botón de quitar", () => {
		render(TagsInput, { props: { value: ["matrícula", "estudiantes"] } });

		expect(screen.getByText("matrícula")).toBeInTheDocument();
		expect(screen.getByText("estudiantes")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Quitar etiqueta matrícula" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Quitar etiqueta estudiantes" })).toBeInTheDocument();
	});

	it("quitar un chip actualiza el value", async () => {
		render(TagsInput, { props: { value: ["matrícula", "estudiantes"] } });

		await fireEvent.click(screen.getByRole("button", { name: "Quitar etiqueta matrícula" }));

		expect(screen.queryByText("matrícula")).not.toBeInTheDocument();
		expect(screen.getByText("estudiantes")).toBeInTheDocument();
	});

	it("filtra las sugerencias según lo escrito", async () => {
		render(TagsInput, { props: { suggestions: ["salud", "educación", "covid-19"] } });

		await fireEvent.input(screen.getByRole("combobox"), { target: { value: "sal" } });

		expect(await screen.findByRole("option", { name: "salud" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "educación" })).not.toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "covid-19" })).not.toBeInTheDocument();
	});

	it("agregar una sugerencia con click la añade al value", async () => {
		render(TagsInput, { props: { suggestions: ["salud", "educación"] } });

		await fireEvent.focus(screen.getByRole("combobox"));
		await fireEvent.click(await screen.findByRole("option", { name: "salud" }));

		expect(
			await screen.findByRole("button", { name: "Quitar etiqueta salud" }),
		).toBeInTheDocument();
	});

	it("agregar el texto escrito con Enter lo añade al value", async () => {
		render(TagsInput, { props: { suggestions: ["salud"] } });

		const input = screen.getByRole("combobox");
		await fireEvent.input(input, { target: { value: "presupuesto" } });
		await waitFor(() =>
			expect(screen.getByRole("option", { name: "Agregar «presupuesto»" })).toHaveAttribute(
				"aria-selected",
				"true",
			),
		);
		await fireEvent.keyDown(input, { key: "Enter" });

		expect(
			await screen.findByRole("button", { name: "Quitar etiqueta presupuesto" }),
		).toBeInTheDocument();
	});

	it("rechaza una etiqueta de un solo carácter y muestra el mensaje", async () => {
		render(TagsInput, { props: { suggestions: ["educación"] } });

		const input = screen.getByRole("combobox");
		await fireEvent.input(input, { target: { value: "x" } });
		await fireEvent.keyDown(input, { key: "Enter" });

		const mensaje = await screen.findByText(/debe tener entre 2 y 100/);
		expect(mensaje).toHaveAttribute("aria-live", "polite");
		expect(screen.queryByRole("button", { name: /Quitar etiqueta/ })).not.toBeInTheDocument();
	});

	it("rechaza una etiqueta con carácter inválido y muestra el mensaje", async () => {
		render(TagsInput, { props: { suggestions: ["salud"] } });

		const input = screen.getByRole("combobox");
		await fireEvent.input(input, { target: { value: "salud!" } });
		await fireEvent.keyDown(input, { key: "Enter" });

		const mensaje = await screen.findByText(/solo puede tener/);
		expect(mensaje).toHaveAttribute("aria-live", "polite");
		expect(screen.queryByRole("button", { name: /Quitar etiqueta/ })).not.toBeInTheDocument();
	});

	it("excluye de las sugerencias las etiquetas ya seleccionadas", async () => {
		render(TagsInput, { props: { value: ["salud"], suggestions: ["salud", "educación"] } });

		await fireEvent.focus(screen.getByRole("combobox"));

		expect(await screen.findByRole("option", { name: "educación" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "salud" })).not.toBeInTheDocument();
	});
});
