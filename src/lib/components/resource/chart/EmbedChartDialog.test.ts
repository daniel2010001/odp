// El botón «Insertar» y su diálogo (P4): el código `<iframe>` listo para copiar, el botón de copiar y el
// teclado. Visible para cualquier visitante: insertar un gráfico público es una acción de lectura.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import EmbedChartDialog from "./EmbedChartDialog.svelte";

const pageStore = page as unknown as { set: (value: unknown) => void };
const copy = vi.hoisted(() => ({ copyToClipboard: vi.fn() }));
vi.mock("$lib/utils/citation", () => copy);

const VIEW = { id: "view-1", title: "Salario por turno" };
const EXPECTED =
	'<iframe src="https://datos.umss.edu.bo/embed/charts/view-1" title="Salario por turno" width="100%" height="420" style="border:0" loading="lazy"></iframe>';

beforeEach(() => {
	vi.clearAllMocks();
	copy.copyToClipboard.mockResolvedValue(true);
	pageStore.set({
		params: {},
		url: new URL("https://datos.umss.edu.bo/dataset/x/resource/r"),
		status: 200,
		error: null,
	});
});

function open() {
	render(EmbedChartDialog, { props: { view: VIEW } });
	const trigger = screen.getByRole("button", { name: /Insertar/ });
	return trigger;
}

describe("EmbedChartDialog", () => {
	it("ofrece un botón «Insertar» que nombra el gráfico y no abre nada todavía", () => {
		const trigger = open();
		expect(trigger).toHaveAccessibleName(/Salario por turno/);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("al abrir muestra el <iframe> con la URL absoluta de la página incrustable", async () => {
		await fireEvent.click(open());

		const dialog = await screen.findByRole("dialog", { name: /Insertar el gráfico/ });
		expect(dialog).toBeInTheDocument();
		const code = screen.getByLabelText("Código para insertar") as HTMLTextAreaElement;
		expect(code.value).toBe(EXPECTED);
		expect(code).toHaveAttribute("readonly");
	});

	it("«Copiar código» copia exactamente ese texto y lo avisa", async () => {
		await fireEvent.click(open());
		await screen.findByRole("dialog");

		await fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));

		expect(copy.copyToClipboard).toHaveBeenCalledWith(EXPECTED);
		expect(await screen.findByText("Código copiado")).toBeInTheDocument();
	});

	it("si copiar falla lo dice y deja el código visible para copiarlo a mano", async () => {
		copy.copyToClipboard.mockResolvedValue(false);
		await fireEvent.click(open());
		await screen.findByRole("dialog");

		await fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));

		expect(await screen.findByText(/No se pudo copiar/)).toBeInTheDocument();
		expect((screen.getByLabelText("Código para insertar") as HTMLTextAreaElement).value).toBe(
			EXPECTED,
		);
	});

	it("al abrir mueve el foco al diálogo y Escape lo cierra devolviendo el foco al botón", async () => {
		const trigger = open();
		trigger.focus();

		await fireEvent.click(trigger);
		const dialog = await screen.findByRole("dialog");
		await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

		await fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await waitFor(() => expect(trigger).toHaveFocus());
	});

	it("«Cerrar» cierra el diálogo", async () => {
		await fireEvent.click(open());
		await screen.findByRole("dialog");

		await fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("un gráfico sin título usa el mismo nombre que la lista", async () => {
		render(EmbedChartDialog, { props: { view: { id: "v2", title: "  " } } });
		await fireEvent.click(screen.getByRole("button", { name: /Insertar/ }));
		await screen.findByRole("dialog");

		expect((screen.getByLabelText("Código para insertar") as HTMLTextAreaElement).value).toContain(
			'title="Gráfico sin título"',
		);
	});
});
